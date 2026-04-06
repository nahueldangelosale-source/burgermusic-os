"use server";

import { db } from "@/db";
import { 
  supplier_claims,
  goods_receipts,
  goods_receipt_items,
  purchase_orders,
  inventory_items
} from "@/db/schema/supply";
import { eq, isNull, and, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireManagerSession } from "@/actions/ProfitabilityEngine";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { revalidatePath } from "next/cache";

/**
 * processPendingClaims 
 * Motor de Disputas tolerante a fallos (Patrón Outbox/Cron)
 * Busca recibos DISPUTED sin reclamo asociado y genera el borrador de IA.
 * Si falla, simplemente se reintentará en el próximo ciclo (Idempotencia).
 */
export async function processPendingClaims() {
  await requireManagerSession();

  // Buscar Recibos DISPUTED que aún no tienen un Supplier Claim
  const pendingReceipts = await db
    .select({
      receipt_id: goods_receipts.id,
      po_id: goods_receipts.po_id,
      supplier_id: goods_receipts.supplier_id,
      date: goods_receipts.receipt_date,
    })
    .from(goods_receipts)
    .leftJoin(supplier_claims, eq(goods_receipts.id, supplier_claims.receipt_id))
    .where(
      and(
        eq(goods_receipts.status, "DISPUTED"),
        isNull(supplier_claims.id)
      )
    );

  const results = { processed: 0, failed: 0 };

  for (const receipt of pendingReceipts) {
    try {
      // Obtener items con varianza negativa
      const items = await db
        .select({
          name: inventory_items.name,
          expected: goods_receipt_items.expected_quantity,
          actual: goods_receipt_items.actual_received_quantity,
          variance: goods_receipt_items.variance_quantity
        })
        .from(goods_receipt_items)
        .innerJoin(inventory_items, eq(goods_receipt_items.inventory_item_id, inventory_items.id))
        .where(
          and(
            eq(goods_receipt_items.receipt_id, receipt.receipt_id),
            sql`${goods_receipt_items.variance_quantity} < 0`
          )
        );

      if (items.length === 0) continue;

      const missingDetailsText = items.map(
        i => `- ${i.name}: Solicitadas ${i.expected}, Recibidas ${i.actual} (Faltante: ${Math.abs(i.variance)})`
      ).join("\n");

      // Invocación a Gemini 2.0 Flash
      const { text: draft } = await generateText({
        model: google("gemini-2.0-flash"),
        system: "Actúa como auditor financiero y SRE de abastecimiento. Debes redactar un reclamo formal pero profesional y conciso para un proveedor indicando diferencias de mercancía enviada. Exhorte el envío del faltante o la pronta emisión de una Nota de Crédito. Falla a favor de la empresa.",
        prompt: `Orden de Compra: ${receipt.po_id}\nProveedor: ${receipt.supplier_id}\nFecha de recepción: ${receipt.date}\nFaltantes detectados en la recepción:\n${missingDetailsText}`,
      });

      // Inserción Atómica
      await db.transaction(async (tx) => {
        await tx.insert(supplier_claims).values({
          id: randomUUID(),
          receipt_id: receipt.receipt_id,
          po_id: receipt.po_id,
          status: "DISPUTED",
          missing_details: missingDetailsText,
          ai_claim_draft: draft,
        });
      });

      results.processed++;
    } catch (e) {
      console.error(`[ClaimAgent] Fallo al procesar claim para recibo ${receipt.receipt_id}:`, e);
      results.failed++;
    }
  }

  if (results.processed > 0) {
    revalidatePath("/dashboard/command-center");
  }

  return results;
}

export async function getPendingClaims() {
  await requireManagerSession();

  const claims = await db
    .select({
      id: supplier_claims.id,
      po_id: supplier_claims.po_id,
      missing_details: supplier_claims.missing_details,
      ai_claim_draft: supplier_claims.ai_claim_draft,
      status: supplier_claims.status,
      created_at: supplier_claims.created_at,
    })
    .from(supplier_claims)
    .where(eq(supplier_claims.status, "DISPUTED"));
    
  return claims;
}

export async function sendClaim(claimId: string) {
  await requireManagerSession();

  await db.update(supplier_claims)
    .set({ 
      status: "CLAIM_SENT",
      resolved_at: sql`(CURRENT_TIMESTAMP)`
    })
    .where(eq(supplier_claims.id, claimId));

  revalidatePath("/dashboard/command-center");
  return { success: true };
}
