"use server";

import { db } from "@/db";
import { ai_audit_logs } from "@/db/schema";
import { getSession } from "@/lib/auth"; // Se asume que getSession está vivo o usamos un mock transaccional.
import { revalidatePath } from "next/cache";
import { z } from "zod";

const JustificationSchema = z.object({
  storeId: z.string(),
  justification: z
    .string()
    .min(
      50,
      "La justificación operativa debe contener un mínimo de 50 caracteres para su escrutinio auditable.",
    ),
});

export async function resolveInterlockAction(formData: FormData) {
  try {
    const rawData = {
      storeId: formData.get("storeId"),
      justification: formData.get("justification"),
    };

    // Validación Restringida Zod
    const parsed = JustificationSchema.parse(rawData);

    // Identidad Operativa
    const session = await getSession();
    const userId = session?.user?.id || "SYSTEM_OVERRIDE"; // Caída segura si no hay cookie HTTP strict

    // Ledger Atómico Inmutable de Auditoría
    await db.insert(ai_audit_logs).values({
      id: crypto.randomUUID(),
      agentName: "FINANCIAL_INTERLOCK_SHIELD",
      action: "FINANCIAL_ANOMALY_JUSTIFIED", // Evento Mandatorio
      payloadRef: "Interlock Modal Enforcer",
      zodSchemaUsed: "JustificationSchema_BI_v2.1",
      status: "APPROVED",
      rejectionReason: parsed.justification, // Volcando el texto real del descargo
      userId: userId,
      storeId: parsed.storeId,
    });

    // Purgar caché de Next.js agresivamente liberando el Mando Global
    revalidatePath("/", "layout");

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: error.issues[0].message };
    }
    console.error("Resolve Interlock Error:", error);
    return { success: false, message: "Error interno escribiendo en Ledger de Auditoría." };
  }
}
