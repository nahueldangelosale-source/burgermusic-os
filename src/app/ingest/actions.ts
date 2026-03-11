"use server";

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "@/db";
import { products, inventorySnapshots } from "@/db/schema";
import { InventoryReportSchema } from "@/agents/translator/schema";
import { revalidatePath } from "next/cache";
import { DetectedItem } from "@/agents/translator/types";
import { getCurrentStock, recordTransaction } from "@/core/stock-engine";

export async function verifyKitchenPin(pin: string) {
    const validPin = process.env.KITCHEN_PIN;
    if (!validPin) {
        throw new Error("KITCHEN_PIN is not defined in environment variables");
    }
    return pin === validPin;
}

// 1. Accion de Analisis (IA)
export async function parseInventoryMessage(rawText: string) {
    // Obtenemos el catalogo para el contexto (RAG)
    const allProducts = await db.select().from(products);

    const contextString = JSON.stringify(allProducts.map(p => ({
        id: p.id,
        name: p.name,
        synonyms: p.synonyms
    })));

    const { object } = await generateObject({
        model: google("gemini-1.5-flash"), // Modelo rapido
        schema: InventoryReportSchema,
        system: `
      Eres un experto en inventario de restaurantes.
      Tu misión es extraer items de inventario de mensajes informales de WhatsApp.
      
      CATÁLOGO OFICIAL:
      ${contextString}
      
      INSTRUCCIONES:
      1. Identifica productos y cantidades.
      2. Mapea nombres informales ("paty") a IDs oficiales ("CARNE").
      3. Si no encuentras el producto en el catálogo, deja matchedSkuId null.
      En rawInput el input original.
    `,
        prompt: rawText,
    });

    return object;
}

// 2. Accion de Guardado (Base de Datos) — Con Ledger COUNT
export async function saveInventory(items: DetectedItem[]) {
    await db.transaction(async (tx) => {
        for (const item of items) {
            if (item.matchedSkuId) {
                // A. Guardar snapshot de conteo físico
                await tx.insert(inventorySnapshots).values({
                    productSku: item.matchedSkuId,
                    actualCount: item.quantity,
                    rawInput: item.rawInput,
                    reportedBy: "WebApp User",
                } as any);

                // B. Calcular delta: (conteo físico) − (stock calculado del Ledger)
                const calculatedStock = await getCurrentStock(item.matchedSkuId);
                const delta = item.quantity - calculatedStock;

                // C. Si hay diferencia, registrar transacción COUNT para reconciliar
                if (Math.abs(delta) > 0.01) {
                    await recordTransaction(tx, {
                        type: "COUNT",
                        productSku: item.matchedSkuId,
                        quantity: delta, // Puede ser + o -, ADJUSTMENT/COUNT acepta signo libre
                        notes: `Ajuste por conteo físico. Reportado: ${item.quantity}, Calculado: ${calculatedStock.toFixed(2)}`,
                        createdBy: "KITCHEN",
                    });
                }
            }
        }
    });

    revalidatePath("/ingest");
    return { success: true };
}

