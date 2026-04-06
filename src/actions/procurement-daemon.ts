"use server";

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║    AUTONOMIC PROCUREMENT DAEMON — BurgerMusic OS v4.1                      ║
 * ║    Reabastecimiento Autónomo con Fricción Positiva (Zero-Trust)              ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import { db } from "@/db";
import { inventory_kardex, mdm_ingredients } from "@/db/schema";
import { supplier_ingredients, purchase_orders, purchase_order_items } from "@/db/schema/supply";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";

export const DraftPOResultSchema = z.object({
  success: z.boolean(),
  draftPOIds: z.array(z.string()),
  message: z.string()
});

export type DraftPOResult = z.infer<typeof DraftPOResultSchema>;

export async function runReplenishmentCycle(
  defaultBurnRateGrams: number = 5000, 
  defaultSafetyStockGrams: number = 10000
): Promise<DraftPOResult> {
  const storeId = "STR_DEFAULT"; // Contexto asilado por defecto en la demo autónoma

  try {
    // ──────── FASE 2: MOTOR TERM-DINÁMICO EN O(1) ────────
    // Extracción de estado absoluto directamente en SQLite para Zero-Latency
    // Se usa INNER JOIN hacia Kardex porque solo abastecemos lo transaccionado.
    const rawStatus = await db
      .select({
        ingredientId: mdm_ingredients.id,
        currentStock: sql<number>`COALESCE(${inventory_kardex.quantity}, 0)`,
        supplierId: supplier_ingredients.supplier_id,
        leadTimeHours: supplier_ingredients.lead_time_hours,
        unitPriceCents: supplier_ingredients.last_purchase_price_cents
      })
      .from(mdm_ingredients)
      .leftJoin(inventory_kardex, eq(inventory_kardex.productSku, mdm_ingredients.id))
      .leftJoin(supplier_ingredients, 
        sql`${supplier_ingredients.ingredient_id} = ${mdm_ingredients.id} AND ${supplier_ingredients.is_preferred} = 1`
      );

    // Agrupamiento por Supplier para consolidar Órdenes de Compra
    const draftsBySupplier: Record<string, Array<{ ingredientId: string, orderQty: number, price: number }>> = {};

    for (const item of rawStatus) {
      if (!item.supplierId) continue; // No se puede comprar a nade, falta ACL del supplier. (Fail-Closed)

      const leadTimeDays = (item.leadTimeHours || 24) / 24;
      
      // Filtro Termodinámico
      const thermodynamicThreshold = (defaultBurnRateGrams * leadTimeDays) + defaultSafetyStockGrams;

      if (item.currentStock < thermodynamicThreshold) {
        // Cálculo O(1) del deficit
        const deficitQtyGrams = thermodynamicThreshold - item.currentStock;
        
        if (!draftsBySupplier[item.supplierId]) {
          draftsBySupplier[item.supplierId] = [];
        }

        draftsBySupplier[item.supplierId].push({
          ingredientId: item.ingredientId,
          orderQty: Math.ceil(deficitQtyGrams),
          price: item.unitPriceCents || 0
        });
      }
    }

    const draftPOIds: string[] = [];

    // ──────── FASE 3: INYECCIÓN ZERO-TRUST A LA MATRIZ ────────
    await db.transaction(async (tx) => {
      for (const [supplierId, items] of Object.entries(draftsBySupplier)) {
        
        const poId = `PO-AI-${randomUUID()}`;
        
        let totalCents = 0;
        const lineInserts = [];

        for (const line of items) {
          const lineTotal = line.orderQty * line.price;
          totalCents += lineTotal;

          lineInserts.push({
            id: `POL-${randomUUID()}`,
            poId,
            ingredientId: line.ingredientId,
            quantityGrams: line.orderQty,
            unitPriceCents: line.price
          });
        }

        // Falla Cerrado: Estado innegociable en DRAFT
        await tx.insert(purchase_orders).values({
          id: poId,
          store_id: storeId,
          supplierId: supplierId,
          status: "DRAFT", // Nunca APPROVED.
          totalAmountCents: totalCents
        });

        await tx.insert(purchase_order_items).values(lineInserts);

         draftPOIds.push(poId);
      }
    });

    return {
      success: true,
      draftPOIds,
      message: `Ciclo termodinámico completado. ${draftPOIds.length} POs en DRAFT.`
    };

  } catch (error: any) {
    console.error("[PROCUREMENT_DAEMON_FATAL]", error);
    // Fail-Closed
    return {
      success: false,
      draftPOIds: [],
      message: "Excepción catastrófica en el ciclo de reabastecimiento."
    };
  }
}
