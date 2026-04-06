"use server";

import { db } from "@/db";
import { inventory_items, purchase_orders, purchase_order_items } from "@/db/schema/supply";
import { lte, eq, and, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireManagerSession } from "@/actions/ProfitabilityEngine"; // Assuming this is available

export async function generatePredictivePOs(storeId: string) {
  // Fail-closed security
  await requireManagerSession();

  // 1. Identificar insumos críticos (O(1) SELECT)
  const criticalItems = await db.select()
    .from(inventory_items)
    .where(
      and(
        eq(inventory_items.store_id, storeId),
        eq(inventory_items.is_active, true),
        lte(inventory_items.current_stock, inventory_items.min_stock_alert)
      )
    );

  if (criticalItems.length === 0) {
    return { success: true, message: "Inventario saludable. No se requiere PO." };
  }

  // 2. Transacción Atómica
  await db.transaction(async (tx) => {
    // Calcular totales para la orden
    let totalEstimatedCents = 0;
    const poItemsToInsert = [];

    const poId = randomUUID();

    for (const item of criticalItems) {
      // Reponer hasta capacity
      const maxCap = item.maximum_capacity || 100;
      const current = item.current_stock || 0;
      const suggestedQty = maxCap > current ? maxCap - current : 1; 

      const expectedCost = item.cost_per_unit_cents || 0;
      const lineCost = Math.round(suggestedQty * expectedCost);
      totalEstimatedCents += lineCost;

      poItemsToInsert.push({
        id: randomUUID(),
        po_id: poId,
        inventory_item_id: item.id,
        suggested_quantity: suggestedQty,
        expected_unit_cost_cents: expectedCost
      });
    }

    // Insertar Cabecera
    await tx.insert(purchase_orders).values({
      id: poId,
      store_id: storeId,
      supplier_id: "DEFAULT_SUPPLIER", // simplificado para el despliegue
      status: "DRAFT_AI",
      total_estimated_cents: totalEstimatedCents,
      generated_by_ai: true,
    });

    // Insertar Líneas
    await tx.insert(purchase_order_items).values(poItemsToInsert);
  });

  return { success: true, message: `Generada 1 Orden de Compra Predictiva con ${criticalItems.length} insumos.` };
}

export async function approvePredictivePO(poId: string) {
  const session = await requireManagerSession();
  const auditorId = session?.user?.id || "MANAGER_SESSION";

  await db.update(purchase_orders)
    .set({ 
      status: "APPROVED", 
      audited_by: auditorId,
      approved_at: new Date().toISOString()
    })
    .where(eq(purchase_orders.id, poId));

  return { success: true };
}

export async function getDraftPOs(storeId: string) {
  return await db.select()
    .from(purchase_orders)
    .where(
      and(
        eq(purchase_orders.store_id, storeId),
        eq(purchase_orders.status, "DRAFT_AI")
      )
    );
}
