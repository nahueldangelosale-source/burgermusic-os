"use server";

import { db } from "@/db";
import { system_alerts, ai_audit_logs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { revalidatePath } from "next/cache";

/**
 * [DIRECTIVA SRE P0] - TRIBUNAL ALGORÍTMICO (AGENT-AS-A-JUDGE)
 * ───────────────────────────────────────────────────────────
 * Autor: Principal AI Architect & FinOps Engineer
 * Objetivo: Evaluar justificaciones humanas mediante IA y liberar bloqueos operativos.
 */

const ResolveAnomalySchema = z.object({
  alertId: z.string(),
  justification: z.string().min(20, "La justificación debe tener al menos 20 caracteres."),
});

export async function resolveAnomaly(formData: z.infer<typeof ResolveAnomalySchema>) {
  // 1. Zero-Trust Auth & Tenant Isolation
  const session = await getSession();
  if (!session?.user?.storeId) {
    throw new Error("UNAUTHORIZED: Sesión inválida o falta StoreId");
  }

  const VALID_STORE_ID: string = session.user.storeId;
  const { alertId, justification } = ResolveAnomalySchema.parse(formData);

  // 2. Fetch the Alert Context
  const alert = await db.query.system_alerts.findFirst({
    where: and(
      eq(system_alerts.id, alertId),
      eq(system_alerts.storeId, VALID_STORE_ID)
    ),
  });

  if (!alert || !alert.isLocked) {
    throw new Error("NOT_FOUND: Alerta no encontrada o no está bloqueada.");
  }

  // 3. AI Judicial Evaluation (Agent-as-a-Judge)
  const JudgmentSchema = z.object({
      approved: z.boolean(),
      reasoning: z.string(),
    });
  type Judgment = z.infer<typeof JudgmentSchema>;

  const result = await generateObject({
    model: google("gemini-1.5-pro"),
    schema: JudgmentSchema,
    prompt: `Actúa como un Juez Algorítmico FinOps para BurgerMusic OS. 
    Debes evaluar la siguiente justificación para una anomalía financiera crítica.
    
    DETALLES DE LA ALERTA:
    - Tipo: ${alert.type}
    - Severidad: ${alert.severity}
    - Hallazgos del Sentinel: ${JSON.stringify(alert.details)}
    
    JUSTIFICACIÓN DEL GERENTE:
    "${justification}"
    
    REGLAS DE JUICIO:
    - APRUEBA si la justificación es técnica, razonable y proporcional al desvío (ej. falla de equipo masiva, error de ingesta verificado, evento especial).
    - RECHAZA si la justificación es vaga, insuficiente o no explica la causalidad (ej. "no sé qué pasó", "lo arreglo luego").
    
    Responde con un booleano 'approved' y un 'reasoning' técnico que se guardará en el log de auditoría.`,
  });
  const judgment: Judgment = result.object as Judgment;

  // 4. Atomic Resolution & Audit Trail
  await db.transaction(async (tx) => {
    // Audit log de la decisión de la IA
    await tx.insert(ai_audit_logs).values({
      id: crypto.randomUUID(),
      agentName: "AGENT_AS_A_JUDGE",
      action: judgment.approved ? "RESOLVE_LOCK" : "MAINTAIN_LOCK",
      zodSchemaUsed: "ResolveAnomalyJudgement",
      status: judgment.approved ? "APPROVED" : "REJECTED_BY_GUARDRAIL",
      rejectionReason: judgment.approved ? null : judgment.reasoning,
      storeId: VALID_STORE_ID,
      userId: session.user.id,
    });

    if (judgment.approved) {
      await tx
        .update(system_alerts)
        .set({
          isLocked: false,
          isResolved: true,
          justification: justification,
          resolvedBy: session.user.id,
        })
        .where(eq(system_alerts.id, alertId));
    }
  });

  revalidatePath("/dashboard/cashier");
  
  return {
    success: judgment.approved,
    message: judgment.approved 
      ? "Tribunal Algorítmico: Justificación Aceptada. Sistema Desbloqueado." 
      : `Tribunal Algorítmico: Justificación Rechazada. Motivo: ${judgment.reasoning}`,
  };
}
