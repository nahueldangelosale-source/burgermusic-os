"use server";

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "@/db";
import { products, inventorySnapshots } from "@/db/schema";
import { InventoryReportSchema } from "@/agents/translator/schema";
import { revalidatePath } from "next/cache";
import { DetectedItem } from "@/agents/translator/types";

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

// 2. Accion de Guardado (Base de Datos)
export async function saveInventory(items: DetectedItem[]) {
    // Guardamos solo los items validos
    for (const item of items) {
        if (item.matchedSkuId) {
            await db.insert(inventorySnapshots).values({
                productSku: item.matchedSkuId,
                actualCount: item.quantity,
                rawInput: item.rawInput,
                reportedBy: "WebApp User",
                // schema defaults handled by database
            } as any);
        }
    }

    revalidatePath("/ingest");
    return { success: true };
}
