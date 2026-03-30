"use server";

import crypto from "crypto";
import { db } from "@/db";
import { products, transactions } from "@/db/schema";
import type { ParsedRow } from "@/lib/utils/csv-mapper";
import { inArray } from "drizzle-orm";
import { processConsumption } from "./bom-processor";

/**
 * Fase 21.12 - Ingesta Masiva Pivotada y Batching en el Edge
 * Complejidad Espacial Limitada: Lotes SECUENCIALES O(n/chunk)
 */
export async function ingestHistoricalSales(payload: ParsedRow[]) {
  const CHUNK_SIZE = 500;
  const failedBatches: number[] = [];
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  const storeId = session?.user?.storeId;
  if (!storeId) throw new Error("Unauthorized: Tenant missing in session");

  // 1. Mapeo Único O(u) de Mapeo Descriptivo -> SKU para Evitar Saturar el Pool
  const uniqueItems = Array.from(new Set(payload.map((r) => r.item)));
  const productMap = new Map<string, string>();

  for (let i = 0; i < uniqueItems.length; i += 100) {
    const batchMap = uniqueItems.slice(i, i + 100);
    const productsFound = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(inArray(products.name, batchMap));
    productsFound.forEach((p) => productMap.set(p.name, p.id));
  }

  // Auto-Stubbing Zero-Trust: Si el historial tiene productos no registrados, los inyectamos al vuelo.
  const missingNames = uniqueItems.filter((name) => !productMap.has(name));
  if (missingNames.length > 0) {
    const stubbedProducts = missingNames.map((name) => ({
      id: crypto.randomUUID(),
      name: name,
      isSaleable: true,
      costCents: 0,
      sellingPrice: 0,
    }));

    for (let i = 0; i < stubbedProducts.length; i += 100) {
      await db
        .insert(products)
        .values(stubbedProducts.slice(i, i + 100))
        .onConflictDoNothing();
    }

    stubbedProducts.forEach((p) => productMap.set(p.name, p.id));
  }

  // 2. Transacciones por Lotes (Evitando Limit de Memory Heap en el Edge y sqlite pool limits)
  for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
    const chunk = payload.slice(i, i + CHUNK_SIZE);
    const consumptionPayload: Record<string, number> = {};

    try {
      await db.transaction(async (tx) => {
        const inserts: any[] = [];

        for (const row of chunk) {
          const productId = productMap.get(row.item);

          // Solo registramos movimiento si el producto principal existe
          if (productId) {
            inserts.push({
              date: row.date,
              type: "SALE",
              productSku: productId,
              quantity: -Math.abs(row.qty), // Salida estricta de Kardex
              referenceId: `HIST-BOX-${row.box}`,
              storeId: storeId,
              notes: `Venta Histórica (Valor Unitario centavos: ${Math.round(row.price_cents / row.qty)})`,
            });
          }

          // Aritmética de Lotes para el Motor BOM
          consumptionPayload[row.item] = (consumptionPayload[row.item] || 0) + row.qty;
        }

        if (inserts.length > 0) {
          await tx.insert(transactions).values(inserts);
        }
      });

      // Motor BOM deductivo (Se llama FUERA de la transacción superior ya que SQLite no soporta nested transactions)
      const bomResult = await processConsumption(storeId, consumptionPayload);
      if (!bomResult.success) {
        console.error(`BOM Deduction Warning on Chunk ${i / CHUNK_SIZE}`);
      }
    } catch (error) {
      console.error(`Error de Ingesta en el lote ${i / CHUNK_SIZE}`, error);
      failedBatches.push(i / CHUNK_SIZE);
      // Fail-Safe parcial: Almacena el número de lote fallido y el bucle sigue vivo.
    }
  }

  return { success: true, totalProcessed: payload.length, failedBatches };
}
