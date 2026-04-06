"use server";

import { db } from "@/db";
import { 
  inventory_items, 
  purchase_orders, 
  purchase_order_items, 
  goods_receipts, 
  goods_receipt_items 
} from "@/db/schema/supply";
import { accounts_payable } from "@/db/schema";
import { eq, sql, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireManagerSession } from "@/actions/ProfitabilityEngine";

type ActualItemReceived = { inventory_item_id: string; actual_received_quantity: number };

export async function processGoodsReceipt(poId: string, actualItemsReceived: ActualItemReceived[], documentUrl?: string) {
  const session = await requireManagerSession();
  const auditorId = session?.user?.id || "MANAGER_SESSION";

  return await db.transaction(async (tx) => {
    // 1. Obtener la PO y sus items originales
    const po = await tx.select().from(purchase_orders).where(eq(purchase_orders.id, poId)).get();
    if (!po) throw new Error("Purchase Order no encontrada");
    if (po.status === "FULFILLED") throw new Error("La orden ya fue procesada");

    const poItems = await tx.select().from(purchase_order_items).where(eq(purchase_order_items.po_id, poId));

    let isDisputed = false;
    let totalRealDebtCents = 0;
    const receiptItemsToInsert = [];

    const receiptId = randomUUID();

    // 2. Computar Varianza y LPP 
    for (const poItem of poItems) {
      const receivedInput = actualItemsReceived.find(a => a.inventory_item_id === poItem.inventory_item_id);
      const actualQty = receivedInput ? receivedInput.actual_received_quantity : 0;
      
      const variance = actualQty - poItem.suggested_quantity;
      if (variance !== 0) {
        isDisputed = true; // Si hay varianza, es DISPUTED
      }

      totalRealDebtCents += Math.round(actualQty * poItem.expected_unit_cost_cents);

      receiptItemsToInsert.push({
        id: randomUUID(),
        receipt_id: receiptId,
        inventory_item_id: poItem.inventory_item_id,
        expected_quantity: poItem.suggested_quantity,
        actual_received_quantity: actualQty,
        variance_quantity: variance,
      });

      // 5. Update Inventory (Atomic) & LPP
      if (actualQty > 0) {
        await tx.update(inventory_items)
          .set({
            current_stock: sql`${inventory_items.current_stock} + ${actualQty}`,
            cost_per_unit_cents: poItem.expected_unit_cost_cents // LPP (Last Purchase Price) overwrite
          })
          .where(eq(inventory_items.id, poItem.inventory_item_id));
      }
    }

    // 3 y 4. Insertar Goods Receipt
    await tx.insert(goods_receipts).values({
      id: receiptId,
      po_id: poId,
      store_id: po.store_id,
      supplier_id: po.supplier_id || "UNKNOWN_SUPPLIER",
      receipt_date: new Date().toISOString(),
      status: isDisputed ? "DISPUTED" : "MATCHED",
      document_url: documentUrl,
      audited_by: auditorId,
    });

    // Insertar Items del Remito
    if (receiptItemsToInsert.length > 0) {
      await tx.insert(goods_receipt_items).values(receiptItemsToInsert);
    }

    // 6. Mutar estado de la PO
    await tx.update(purchase_orders)
      .set({ status: "FULFILLED" })
      .where(eq(purchase_orders.id, poId));

    // 7. Inyectar deuda real en accounts_payable
    await tx.insert(accounts_payable).values({
      id: randomUUID(),
      supplier_id: po.supplier_id || "UNKNOWN_SUPPLIER",
      storeId: po.store_id, // CamelCase required by schema
      po_amount: po.total_estimated_cents,
      receipt_amount: totalRealDebtCents,
      invoice_amount: 0,
      credit_note_amount: 0,
      status: isDisputed ? "DISPUTE" : "PENDING",
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // +30 days fallback
    });

    return { 
      success: true, 
      status: isDisputed ? "DISPUTED" : "MATCHED", 
      debtInjectedCents: totalRealDebtCents,
      receiptId
    };
  });
}
