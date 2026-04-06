"use server";

import { db } from "@/db";
import { purchase_orders } from "@/db/schema/supply";
import { eq, and } from "drizzle-orm";
import { requireManagerSession } from "@/lib/auth-utils";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * POSITIVE FRICTION (APPROVAL VAULT)
 * ─────────────────────────────────────────────────────────────────────────────
 * Muta un estado DRAFT generado por el demonio a APPROVED.
 * Implementa Zero-Trust y bloqueos de idempontencia en O(1) vía SQLite.
 */
export async function approvePurchaseOrder(poId: string) {
  // 1. Autenticación Estricta
  const { userId } = await requireManagerSession();

  try {
    // 2. Idempotencia & Race Condition Lock (Turso Atomicity)
    const result = await db.update(purchase_orders)
      .set({ 
        status: "APPROVED",
        // Aquí podríamos registrar audite_by: userId si añadimos el field
      })
      .where(
        and(
          eq(purchase_orders.id, poId),
          eq(purchase_orders.status, "DRAFT") // Solo podemos aprobar un DRAFT
        )
      )
      .returning({ id: purchase_orders.id });

    if (result.length === 0) {
      // 3. Falla Cerrado por Mutación Inválida
      return { 
        success: false, 
        message: "PO_STATE_INVALID: La orden no existe, ya fue procesada o carece de estado DRAFT." 
      };
    }

    return { 
      success: true, 
      poId: result[0].id, 
      message: "Capital Autorizado. PO marcada como APPROVED." 
    };
  } catch (error: any) {
    console.error("[PO_APPROVAL_ERROR]", error);
    return { success: false, message: "Error catastrófico en la capa de persistencia." };
  }
}
