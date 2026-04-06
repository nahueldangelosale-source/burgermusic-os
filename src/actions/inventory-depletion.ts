"use server";

import { db } from "@/db";
import { bill_of_materials } from "@/db/schema/bom";
import { fact_sales } from "@/db/schema";
import { inventory_items, stock_movements } from "@/db/schema/supply";
import { eq, inArray, and, sql, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";

/**
 * V4.0 Closed-Loop Depletion Engine — NLP Variant-Aware
 *
 * Regla 3: Transacción ACID obligatoria.
 * - JOIN fact_sales → bill_of_materials → inventory_items
 * - Deduce current_stock atómicamente
 * - Registra movimiento en stock_movements (Event Sourcing)
 * - Marca fact_sales.depleted = true para idempotencia
 * - Congela historical_cost_cents en fact_sales (Snapshot Transaccional)
 * - V4.0: Lee variant_metadata para deducir medallones extra
 */

// SKU del insumo "Medallón de Carne 110g" — Constante de Negocio
const MEAT_PATTY_KEYWORDS = ["medallon", "medallón", "carne 110", "medallon 110", "pattie", "medallón de carne"];

export async function depleteInventoryForSales(saleIds: string[], storeId: string) {
  if (!saleIds || saleIds.length === 0) return { success: true, message: "No sales to deplete." };

  try {
    // Fase 1: Agregación SQL Masiva — JOIN O(1) empujado a LibSQL
    // Solo BOMs activos (isNull(deletedAt)) para V3.1 compliance
    const depletionAgg = await db
      .select({
        itemId: bill_of_materials.childId,
        totalQty: sql<number>`SUM(${fact_sales.quantity} * ${bill_of_materials.quantity} * ${bill_of_materials.unitMultiplier})`
      })
      .from(fact_sales)
      .innerJoin(
        bill_of_materials,
        and(
          eq(fact_sales.productSku, bill_of_materials.parentId),
          isNull(bill_of_materials.deletedAt)
        )
      )
      .where(and(
        inArray(fact_sales.id, saleIds),
        eq(fact_sales.storeId, storeId)
      ))
      .groupBy(bill_of_materials.childId);

    // Fase 2: Calcular costo BOM dinámico por cada venta para snapshot
    const costSnapshot = await db
      .select({
        productSku: bill_of_materials.parentId,
        bomCostCents: sql<number>`COALESCE(SUM(${bill_of_materials.quantity} * ${bill_of_materials.unitMultiplier} * ${inventory_items.cost_per_unit_cents}), 0)`
      })
      .from(bill_of_materials)
      .innerJoin(inventory_items, and(
        eq(inventory_items.id, bill_of_materials.childId),
        eq(inventory_items.is_active, true)
      ))
      .where(isNull(bill_of_materials.deletedAt))
      .groupBy(bill_of_materials.parentId);

    const costMap = new Map(costSnapshot.map(c => [c.productSku, c.bomCostCents]));

    // ═══════════════════════════════════════════════════════════
    // FASE 2.5: NLP Variant Patty Aggregation
    // Pre-scan sales for extra patty deductions from variant_metadata
    // ═══════════════════════════════════════════════════════════
    const salesWithVariants = await db
      .select({
        id: fact_sales.id,
        quantity: fact_sales.quantity,
        variant_metadata: fact_sales.variant_metadata,
      })
      .from(fact_sales)
      .where(and(
        inArray(fact_sales.id, saleIds),
        eq(fact_sales.storeId, storeId),
      ));

    // Resolve the meat patty inventory item ID
    const allStoreItems = await db
      .select({ id: inventory_items.id, name: inventory_items.name })
      .from(inventory_items)
      .where(and(
        eq(inventory_items.store_id, storeId),
        eq(inventory_items.is_active, true),
      ));

    const meatPattyItem = allStoreItems.find(item => {
      const lower = (item.name || "").toLowerCase();
      return MEAT_PATTY_KEYWORDS.some(kw => lower.includes(kw));
    });

    // Aggregate total extra patties needed across all sales in this batch
    let totalExtraPattyUnits = 0;
    for (const sale of salesWithVariants) {
      if (!sale.variant_metadata) continue;
      try {
        const meta = JSON.parse(sale.variant_metadata);
        if (meta.extraPatties && meta.extraPatties > 0) {
          totalExtraPattyUnits += meta.extraPatties * (sale.quantity || 1);
        }
      } catch (_) {
        // Malformed JSON — Fail-Closed: skip
      }
    }

    // Fase 3: Transacción ACID Determinista
    await db.transaction(async (tx) => {
      const ts = new Date().toISOString();
      const batchRef = `SALES_BATCH_${Date.now()}`;

      // 3a: Deducir stock físico por insumo (BOM normal deduction)
      for (const req of depletionAgg) {
        if (!req.itemId || !req.totalQty) continue;

        await tx.update(inventory_items)
          .set({
            current_stock: sql`${inventory_items.current_stock} - ${req.totalQty}`,
            updated_at: ts
          })
          .where(and(
            eq(inventory_items.id, req.itemId),
            eq(inventory_items.store_id, storeId)
          ));

        await tx.insert(stock_movements).values({
          id: randomUUID(),
          store_id: storeId,
          item_id: req.itemId,
          movement_type: "OUT",
          quantity: -req.totalQty,
          reference_id: batchRef
        });
      }

      // 3b: EXTRA PATTY DEDUCTION (NLP Variant Engine)
      if (totalExtraPattyUnits > 0 && meatPattyItem) {
        await tx.update(inventory_items)
          .set({
            current_stock: sql`${inventory_items.current_stock} - ${totalExtraPattyUnits}`,
            updated_at: ts,
          })
          .where(and(
            eq(inventory_items.id, meatPattyItem.id),
            eq(inventory_items.store_id, storeId)
          ));

        await tx.insert(stock_movements).values({
          id: randomUUID(),
          store_id: storeId,
          item_id: meatPattyItem.id,
          movement_type: "OUT",
          quantity: -totalExtraPattyUnits,
          reference_id: `${batchRef}_EXTRA_PATTIES`,
        });

        console.log(`[DEPLETION] Extra patty deduction: ${totalExtraPattyUnits} units of "${meatPattyItem.name}"`);
      }

      // 3c: Congelar historical_cost_cents en cada fact_sale (Snapshot Transaccional)
      for (const saleId of saleIds) {
        const sale = await tx.select({ productSku: fact_sales.productSku, netPrice: fact_sales.net_price_cents, qty: fact_sales.quantity, variantMeta: fact_sales.variant_metadata })
          .from(fact_sales)
          .where(eq(fact_sales.id, saleId))
          .limit(1);

        if (sale.length > 0) {
          const bomCost = costMap.get(sale[0].productSku) || 0;

          // Dynamic COGS: add patty surcharge from variant_metadata
          let pattySurcharge = 0;
          if (sale[0].variantMeta) {
            try {
              const meta = JSON.parse(sale[0].variantMeta);
              if (meta.extraPatties === 1) pattySurcharge = 300000;
              if (meta.extraPatties === 2) pattySurcharge = 630000;
            } catch (_) { /* Fail-Closed */ }
          }

          await tx.update(fact_sales)
            .set({
              historical_cost_cents: bomCost + pattySurcharge,
              historical_price_cents: sale[0].netPrice,
              depleted: true
            })
            .where(eq(fact_sales.id, saleId));
        }
      }
    });

    return {
      success: true,
      depletedItemsCount: depletionAgg.length,
      snapshotFrozen: saleIds.length,
      extraPattyUnits: totalExtraPattyUnits,
    };
  } catch (error: any) {
    console.error("Critical ACID Depletion Error:", error);
    return { success: false, error: error.message };
  }
}
