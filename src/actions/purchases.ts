"use server";

import { db } from "@/db";
import { purchases, purchase_items } from "@/db/schema";
import { inventory_items, stock_movements } from "@/db/schema/supply";
import { requireManagerSession } from "@/lib/auth-utils";
import { PurchaseIngestSchema } from "@/schemas";
import { eq, and, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

// Re-export types from centralized schema registry
export type { PurchaseIngestPayload, PurchaseItemPayload } from "@/schemas";

// ────────────────────────────────────────────
// LPP Reactor — ACID Closed-Loop Server Action
// ────────────────────────────────────────────

export async function ingestPurchaseInvoice(payload: unknown) {
  // ── Fail-Closed: Session Gate ──────────────────────────────
  const { userId, storeId } = await requireManagerSession();

  // ── Zod Enforcement Layer ─────────────────────────────────
  const parseResult = PurchaseIngestSchema.safeParse(payload);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join(" | ");
    return { success: false as const, error: `Zod Shield Rejection: ${errorMsg}` };
  }

  const validated = parseResult.data;

  // Server-side truth: compute total from line items (never trust client totals)
  const computedTotalCents = validated.items.reduce(
    (acc, item) => acc + item.total_line_cents,
    0,
  );

  try {
    const purchaseId = `PUR-${randomUUID()}`;
    const now = new Date().toISOString();

    const result = await db.transaction(async (tx) => {
      // ── Step 1: INSERT Purchase Header ─────────────────────
      await tx.insert(purchases).values({
        id: purchaseId,
        store_id: storeId,
        supplier_id: validated.supplier_id ?? null,
        supplier_name: validated.supplier_name,
        invoice_number: validated.invoice_number ?? null,
        total_cents: computedTotalCents,
        status: "COMPLETED",
        audited_at: now,
        audited_by: userId,
      });

      // ── Step 2: FOR EACH item → LPP Reactor Sequence ──────
      for (const item of validated.items) {
        const itemId = `PURI-${randomUUID()}`;

        // 2a: INSERT purchase line item
        await tx.insert(purchase_items).values({
          id: itemId,
          store_id: storeId,
          purchase_id: purchaseId,
          inventory_item_id: item.inventory_item_id,
          quantity: item.quantity,
          total_line_cents: item.total_line_cents,
        });

        // 2b: LPP Calculation (in-memory, deterministic)
        const newUnitCost = Math.round(item.total_line_cents / item.quantity);

        // 2c: Motor LPP — UPDATE MDM (inventory_items)
        //     Mutates cost_per_unit_cents + increments stock atomically
        await tx
          .update(inventory_items)
          .set({
            current_stock: sql`${inventory_items.current_stock} + ${item.quantity}`,
            cost_per_unit_cents: newUnitCost,
            updated_at: now,
            audited_at: now,
            audited_by: userId,
          })
          .where(
            and(
              eq(inventory_items.id, item.inventory_item_id),
              eq(inventory_items.store_id, storeId),
            ),
          );

        // 2d: Event Sourcing — Stock Movement Ledger
        await tx.insert(stock_movements).values({
          id: randomUUID(),
          store_id: storeId,
          item_id: item.inventory_item_id,
          movement_type: "IN",
          quantity: item.quantity,
          reference_id: purchaseId,
        });
      }

      return {
        purchaseId,
        itemCount: validated.items.length,
        totalCents: computedTotalCents,
      };
    });

    revalidatePath("/dashboard/supply");
    revalidatePath("/dashboard/purchases");

    return { success: true as const, ...result };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown ACID Transaction Error";
    console.error("[COMPRAS_HUB_FATAL]:", msg);
    return { success: false as const, error: msg };
  }
}
