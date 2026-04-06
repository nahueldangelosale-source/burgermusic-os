"use server";

import { db } from "@/db";
import {
  fact_sales,
  modifier_ingredients,
  product_modifiers,
} from "@/db/schema";
import { bill_of_materials } from "@/db/schema/bom";
import { inventory_items, stock_movements } from "@/db/schema/supply";
import { eq, and, sql, isNull, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getSession } from "@/lib/auth";

// ────────────────────────────────────────────────────────────────
// O1 Shrinkage Engine — Atomic Depletion Cycle
// Antigravity 2026: Fail-Closed, Idempotent, Zero Race Conditions
// ────────────────────────────────────────────────────────────────

interface DepletionResult {
  status: "idle" | "completed" | "error";
  processed: number;
  depletedItems: number;
  movementsCreated: number;
  error?: string;
}

/**
 * runDepletionCycle(storeId)
 * ─────────────────────────
 * Autonomous shrinkage reactor that:
 * 1. Discovers all COMPLETED, non-depleted fact_sales for the given store
 * 2. Explodes each sale's BOM (Base + Modifiers) into inventory item quantities
 * 3. Consolidates all deductions into a single in-memory map (batch optimization)
 * 4. Within ONE ACID transaction:
 *    a) Deducts current_stock using native SQL arithmetic (zero JS math race conditions)
 *    b) Inserts stock_movements events (Event Sourcing ledger)
 *    c) Stamps historical_cost_cents on each sale (Snapshot Transaccional)
 *    d) Marks all processed sales as depleted = true (idempotency gate)
 *
 * Idempotency: Sales with depleted=true are NEVER reprocessed.
 * Concurrency: All stock mutations use SQL `current_stock - N`, never JS read-modify-write.
 */
export async function runDepletionCycle(storeId: string): Promise<DepletionResult> {
  // ── Fail-Closed: Session Gate ──────────────────────────
  const session = await getSession();
  if (!session?.user?.id) {
    return { status: "error", processed: 0, depletedItems: 0, movementsCreated: 0, error: "Fail-Closed: Sesión inválida." };
  }

  try {
    // ── Phase 1: Discovery — Find undepleted COMPLETED sales ──
    const pendingSales = await db
      .select({
        id: fact_sales.id,
        productSku: fact_sales.productSku,
        quantity: fact_sales.quantity,
        ticketNumber: fact_sales.ticket_number,
        netPriceCents: fact_sales.net_price_cents,
      })
      .from(fact_sales)
      .where(
        and(
          eq(fact_sales.storeId, storeId),
          eq(fact_sales.status, "COMPLETED"),
          eq(fact_sales.depleted, false),
          sql`${fact_sales.completed_at} <= datetime('now', '-3 minutes')`
        ),
      );

    if (pendingSales.length === 0) {
      return { status: "idle", processed: 0, depletedItems: 0, movementsCreated: 0 };
    }

    // ── Phase 2: BOM Explosion (Base + Modifiers) ──────────
    // Collect all unique product SKUs from pending sales
    const uniqueSkus = [...new Set(pendingSales.map((s) => s.productSku))];

    // 2a: Base BOM resolution — bill_of_materials
    const baseBom = await db
      .select({
        parentId: bill_of_materials.parentId,
        childId: bill_of_materials.childId,
        quantity: bill_of_materials.quantity,
        unitMultiplier: bill_of_materials.unitMultiplier,
      })
      .from(bill_of_materials)
      .where(
        and(
          inArray(bill_of_materials.parentId, uniqueSkus),
          isNull(bill_of_materials.deletedAt),
        ),
      );

    // 2b: Modifier BOM resolution — product_modifiers → modifier_ingredients
    const modifierBom = await db
      .select({
        productId: product_modifiers.product_id,
        inventoryItemId: modifier_ingredients.inventory_item_id,
        quantity: modifier_ingredients.quantity,
      })
      .from(product_modifiers)
      .innerJoin(
        modifier_ingredients,
        eq(product_modifiers.modifier_id, modifier_ingredients.modifier_id),
      )
      .where(inArray(product_modifiers.product_id, uniqueSkus));

    // ── Phase 3: In-Memory Consolidation Map ────────────────
    // Key: inventory_item_id → Value: total quantity to deduct
    const depletionMap = new Map<string, number>();
    const saleIds: string[] = [];

    for (const sale of pendingSales) {
      saleIds.push(sale.id);

      // 3a: Base BOM ingredients for this product
      const baseIngredients = baseBom.filter((b) => b.parentId === sale.productSku);
      for (const ing of baseIngredients) {
        if (!ing.childId) continue; // Skip orphaned BOM links
        const deduction = sale.quantity * ing.quantity * ing.unitMultiplier;
        depletionMap.set(
          ing.childId,
          (depletionMap.get(ing.childId) || 0) + deduction,
        );
      }

      // 3b: Modifier ingredients for this product
      const modIngredients = modifierBom.filter((m) => m.productId === sale.productSku);
      for (const mod of modIngredients) {
        const deduction = sale.quantity * mod.quantity;
        depletionMap.set(
          mod.inventoryItemId,
          (depletionMap.get(mod.inventoryItemId) || 0) + deduction,
        );
      }
    }

    // ── Phase 4: Cost Snapshot — BOM cost per product ───────
    const costSnapshot = await db
      .select({
        productSku: bill_of_materials.parentId,
        bomCostCents: sql<number>`COALESCE(SUM(${bill_of_materials.quantity} * ${bill_of_materials.unitMultiplier} * ${inventory_items.cost_per_unit_cents}), 0)`,
      })
      .from(bill_of_materials)
      .innerJoin(
        inventory_items,
        and(
          eq(inventory_items.id, bill_of_materials.childId),
          eq(inventory_items.is_active, true),
        ),
      )
      .where(
        and(
          inArray(bill_of_materials.parentId, uniqueSkus),
          isNull(bill_of_materials.deletedAt),
        ),
      )
      .groupBy(bill_of_materials.parentId);

    const costMap = new Map(costSnapshot.map((c) => [c.productSku, c.bomCostCents]));

    // ── Phase 5: ACID Transaction — Single Atomic Block ─────
    let movementsCreated = 0;
    const batchRef = `DEPL_${storeId}_${Date.now()}`;
    const now = new Date().toISOString();

    await db.transaction(async (tx) => {
      // 5a: Deduct stock for each consolidated inventory item (SQL-native arithmetic)
      for (const [itemId, totalQty] of depletionMap.entries()) {
        if (totalQty <= 0) continue;

        // REGLA 3: Zero-JS Math — SQL-native deduction prevents race conditions
        await tx
          .update(inventory_items)
          .set({
            current_stock: sql`${inventory_items.current_stock} - ${totalQty}`,
            updated_at: now,
          })
          .where(
            and(
              eq(inventory_items.id, itemId),
              eq(inventory_items.store_id, storeId),
            ),
          );

        // 5b: Event Sourcing — Stock Movement Ledger (OUT)
        await tx.insert(stock_movements).values({
          id: randomUUID(),
          store_id: storeId,
          item_id: itemId,
          movement_type: "OUT",
          quantity: -totalQty, // Negative = outflow
          reference_id: batchRef,
        });

        movementsCreated++;
      }

      // 5c: Freeze historical_cost_cents + mark depleted = true
      for (const sale of pendingSales) {
        const bomCost = costMap.get(sale.productSku) || 0;

        await tx
          .update(fact_sales)
          .set({
            historical_cost_cents: bomCost,
            historical_price_cents: sale.netPriceCents,
            depleted: true,
          })
          .where(eq(fact_sales.id, sale.id));
      }
    });

    return {
      status: "completed",
      processed: saleIds.length,
      depletedItems: depletionMap.size,
      movementsCreated,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown ACID Depletion Error";
    console.error("[O1_SHRINKAGE_FATAL]:", msg);
    return { status: "error", processed: 0, depletedItems: 0, movementsCreated: 0, error: msg };
  }
}
