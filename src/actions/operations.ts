"use server";

import { db } from "@/db";
import { checklists } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * Operación Atómica de Cierre de Checklists (Edge-First Latency)
 * Marca tareas de limpieza/mantenimiento como completadas desde el Kiosco.
 */
export async function completeKitchenChecklist(store_id: string, task_id: string, employee_id: string) {
  try {
    const timestamp = new Date().toISOString();
    
    // SQLite Atomic update
    await db
      .update(checklists)
      .set({
        is_completed: true,
        completed_by: employee_id,
        timestamp: timestamp
      })
      .where(
        and(
          eq(checklists.id, task_id),
          eq(checklists.store_id, store_id)
        )
      )
      .run();

    // UX Instantánea: Revalida la capa visual sin recargas
    revalidatePath("/kitchen");

    return { success: true, timestamp };
  } catch (error) {
    console.error("completeKitchenChecklist ERR:", error);
    return { success: false, error: "Aislamiento roto: Falla de base de datos." };
  }
}
