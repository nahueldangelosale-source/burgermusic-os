"use server";
import { db } from "@/db";
import { accounts_payable } from "@/db/schema";
import { ProcurementStatusEnum, purchase_orders } from "@/db/schema/procurement";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export const MatchResultZod = z.object({
  poId: z.string(),
  newStatus: z.enum(ProcurementStatusEnum),
  reason: z.string().optional(),
});

export async function runThreeWayMatch(poId: string, storeId: string) {
  const rawSql = sql`
        WITH PoTotals AS (
            SELECT po_id, SUM(qty) as po_qty, SUM(qty * frozen_price_cents) as po_expected_amount
            FROM proc_po_items
            WHERE po_id = ${poId}
            GROUP BY po_id
        ),
        GrTotals AS (
            SELECT po_id, SUM(qty_received) as gr_qty 
            FROM proc_goods_receipts
            WHERE po_id = ${poId}
            GROUP BY po_id
        ),
        IrTotals AS (
            SELECT po_id, 
                   MAX(invoice_id) as invoice_id,
                   SUM(invoiced_qty * invoiced_price_cents) as ir_billed_amount,
                   SUM(invoiced_qty) as ir_qty
            FROM proc_invoice_receipts
            WHERE po_id = ${poId}
            GROUP BY po_id
        )
        SELECT 
            PO.po_id,
            PO.po_qty,
            PO.po_expected_amount,
            COALESCE(GR.gr_qty, 0) as gr_qty,
            COALESCE(IR.ir_billed_amount, 0) as ir_billed_amount,
            COALESCE(IR.ir_qty, 0) as ir_qty,
            IR.invoice_id
        FROM PoTotals PO
        LEFT JOIN GrTotals GR ON PO.po_id = GR.po_id
        LEFT JOIN IrTotals IR ON PO.po_id = IR.po_id;
    `;

  try {
    const results = (await db.all(rawSql)) as any[];
    if (results.length === 0)
      return MatchResultZod.parse({ poId, newStatus: "BLOCKED", reason: "PO_NOT_FOUND" });

    const r = results[0];

    let targetStatus: (typeof ProcurementStatusEnum)[number] = "RECEIVED";
    let reason = "ALL_MATCHED";

    const poQty = Number(r.po_qty || 0);
    const grQty = Number(r.gr_qty || 0);
    const poExpectedAmount = Number(r.po_expected_amount || 0);
    const irBilledAmount = Number(r.ir_billed_amount || 0);

    // Lógica de Fricción Positiva Matemática
    if (grQty < poQty) {
      targetStatus = "PARTIALLY_RECEIVED";
      reason = "ALERTA_MERMA_PROVEEDOR";
    } else if (irBilledAmount > poExpectedAmount) {
      targetStatus = "BLOCKED";
      reason = "ALERTA_SOBREPRECIO";
    } else if (grQty >= poQty && irBilledAmount > 0 && irBilledAmount <= poExpectedAmount) {
      targetStatus = "PAYABLE";
    }

    await db.transaction(async (tx) => {
      // Actualizar PO Status
      await tx
        .update(purchase_orders)
        .set({ status: targetStatus })
        .where(eq(purchase_orders.id, poId));

      // Si es PAYABLE, inyectar a Tesorería (Accounts Payable Modulo 13)
      if (targetStatus === "PAYABLE" && r.invoice_id) {
        await tx
          .insert(accounts_payable)
          .values({
            id: `AP-${Date.now()}-${poId}`,
            supplier_id: "PENDING_MATCH", // Se resolverá con la AI
            due_date: new Date().toISOString(), // Fallback inmediato
            po_amount: Math.round(poExpectedAmount),
            receipt_amount: Math.round(irBilledAmount),
            invoice_amount: Math.round(irBilledAmount),
            credit_note_amount: 0,
            status: "PERFECT_MATCH",
            storeId: storeId,
          })
          .onConflictDoNothing();
      }
    });

    return MatchResultZod.parse({
      poId,
      newStatus: targetStatus,
      reason,
    });
  } catch (err: any) {
    console.error("3-Way Match Engine Engine falló:", err);
    return MatchResultZod.parse({ poId, newStatus: "BLOCKED", reason: "MATCH_EXCEPTION" });
  }
}
