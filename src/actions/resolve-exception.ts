"use server";

import { db } from "@/db";
import { ai_audit_logs } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/**
 * Closed-Loop de Auditoría - Resolución de Excepciones
 * ────────────────────────────────────────────────────
 * Registra justificaciones de varianza estructural en el
 * ledger inmutable de auditoría y desbloquea la UI.
 */
export async function resolveExceptionAction(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { success: false, message: "Sin autorización." };
  }

  const storeId = formData.get("storeId") as string;
  const justification = formData.get("justification") as string;

  if (!justification || justification.trim().length < 20) {
    return {
      success: false,
      message: "La justificación debe exceder los 20 caracteres obligatorios.",
    };
  }

  try {
    // 1. Zero-Trust Audit Log (Inmutable)
    await db.insert(ai_audit_logs).values({
      id: crypto.randomUUID(),
      agentName: "BI_EXCEPTION_MANAGER",
      action: "EXCEPTION_RESOLVED", // Evento requerido
      payloadRef: "Justification UI",
      zodSchemaUsed: "Varianza_Shrinkage_Form",
      // Aprovechamos rejectionReason para almacenar el descargo del incidente
      status: "APPROVED",
      rejectionReason: justification.trim(),
      userId: session.user.id,
      storeId: storeId || session.user.storeId,
    });

    // 2. Desbloqueo instantáneo con revalidatePath
    // Renderizando de nuevo los Server Components que incluyen el Exception Manager.
    revalidatePath("/", "layout");

    return { success: true, message: "Varianza justificada. Mando Global liberado." };
  } catch (err: any) {
    console.error("Fallo cerrando el loop de auditoría:", err);
    return { success: false, message: "Error escribiendo en el Ledger de Auditoría." };
  }
}
