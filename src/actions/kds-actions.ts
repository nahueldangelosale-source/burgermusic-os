"use server";

import { db } from "@/db";
import { fact_sales } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * updateTicketStatus
 * ───────────────────
 * Server Action para el tablero Kanban del KDS con patrón Temporal Airlock.
 * Permite avanzar o deshacer el estado de un ticket y controla el marcador de tiempo (completed_at).
 *
 * @param id          ID del fact_sales (o ticket)
 * @param newStatus   "PREPARING" o "COMPLETED"
 */
export async function updateTicketStatus(id: string, newStatus: "PREPARING" | "COMPLETED") {
  // Fail-Closed: Buscamos el ticket actual para verificar si ya fue mermado
  const existing = await db
    .select({ depleted: fact_sales.depleted })
    .from(fact_sales)
    .where(eq(fact_sales.id, id))
    .limit(1);

  if (!existing.length) {
    throw new Error("KDS_ERROR: Ticket no encontrado.");
  }

  // Si ya fue consolidado/mermado por el CRON, el estado es inmutable.
  if (existing[0].depleted && newStatus === "PREPARING") {
    throw new Error("KDS_ERROR: El ticket ya cruzó el Event Horizon y no puede deshacerse.");
  }

  // Trazabilidad temporal de Airlock
  const timestamp = newStatus === "COMPLETED" ? new Date().toISOString() : null;

  await db
    .update(fact_sales)
    .set({
      status: newStatus,
      completed_at: timestamp,
      // Aunque newStatus sea PREPARING, aseguramos explícitamente maintaining depleted = false
      depleted: false, 
    })
    .where(eq(fact_sales.id, id));

  revalidatePath("/kds");
  return { success: true };
}

/**
 * getKdsTickets
 * ─────────────
 * Obtiene los tickets activos y recientemente completados para el tablero Kanban.
 */
export async function getKdsTickets(storeId: string) {
  const tickets = await db
    .select({
      id: fact_sales.id,
      ticketNumber: fact_sales.ticket_number,
      productSku: fact_sales.productSku,
      quantity: fact_sales.quantity,
      status: fact_sales.status,
      depleted: fact_sales.depleted,
      completedAt: fact_sales.completed_at,
    })
    .from(fact_sales)
    .where(and(eq(fact_sales.storeId, storeId)));

  return tickets.filter(t => t.status === "PREPARING" || (t.status === "COMPLETED" && !t.depleted));
}
