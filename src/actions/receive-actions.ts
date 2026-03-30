"use server";
import { db } from "@/db";
import { runThreeWayMatch } from "@/db/matching-engine";
import { goods_receipts, po_items, purchase_orders } from "@/db/schema/procurement";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const ReceivePayload = z.object({
  supplierId: z.string(),
  ingredientSku: z.string(),
  qtyText: z.string(),
  storeId: z.string(),
});

export async function submitBlindReception(payload: any) {
  const { supplierId, ingredientSku, qtyText, storeId } = ReceivePayload.parse(payload);
  const qty = Number.parseFloat(qtyText);

  // Zod-level numerical constraint
  if (isNaN(qty) || qty < 0) return { success: false, error: "INVALID_NEGATIVE_WEIGHT" };

  try {
    let matchedPoId = "";

    await db.transaction(async (tx) => {
      // Buscar la primera orden de compra pasible de recepcionar
      // Edge note: in production, order status could also be PARTIALLY_RECEIVED
      const openPos = await tx
        .select()
        .from(purchase_orders)
        .where(
          and(eq(purchase_orders.supplierId, supplierId), eq(purchase_orders.status, "PO_EMITTED")),
        );

      for (const po of openPos) {
        const items = await tx
          .select()
          .from(po_items)
          .where(and(eq(po_items.poId, po.id), eq(po_items.ingredientSku, ingredientSku)));
        if (items.length > 0) {
          matchedPoId = po.id;
          break;
        }
      }

      if (!matchedPoId)
        throw new Error("ORPHAN_RECEIPT_BLOCKED: No hay PO emitida para este Proveedor/Insumo");

      // Matchear e insertar recibo ciego
      await tx.insert(goods_receipts).values({
        id: `GR-${Date.now()}-${Math.random()}`,
        poId: matchedPoId,
        ingredientSku,
        qtyReceived: qty,
        storeId,
      });
    });

    // Background Fire-and-Forget 3-Way Match Verification
    runThreeWayMatch(matchedPoId, storeId).catch(console.error);

    return { success: true };
  } catch (e: any) {
    console.error("Blind Reception Failed:", e);
    return { success: false, error: e.message };
  }
}
