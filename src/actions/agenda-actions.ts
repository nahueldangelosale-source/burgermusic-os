"use server";

import { db } from "@/db";
import { agenda_items } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function addAgendaItem(data: { title: string; type?: "TASK" | "NOTE" | "EVENT"; dueDate?: string }) {
  try {
    const id = crypto.randomUUID();
    await db.insert(agenda_items).values({
      id,
      title: data.title,
      type: data.type || "TASK",
      dueDate: data.dueDate || null,
      isCompleted: false,
    });
    revalidatePath("/dashboard/command-center");
    return { success: true };
  } catch (error) {
    console.error("[AGENDA_ACTION_ERROR]", error);
    return { success: false, error: "Fallo estructural en inserción SQL." };
  }
}

export async function toggleAgendaStatus(id: string, currentStatus: boolean) {
  try {
    await db.update(agenda_items)
      .set({ isCompleted: !currentStatus })
      .where(eq(agenda_items.id, id));
    revalidatePath("/dashboard/command-center");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Fallo mutando el estado booliano." };
  }
}

export async function deleteAgendaItem(id: string) {
  try {
    await db.delete(agenda_items).where(eq(agenda_items.id, id));
    revalidatePath("/dashboard/command-center");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Fallo al purgar el registro." };
  }
}
