import { db } from "@/db";
import { getInventoryVariance } from "@/db/analytics-queries";
import { ai_audit_logs } from "@/db/schema";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

// Evita que Next.js cachee o convierta esto en estático
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET || "1234"}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Multi-tenant audit: We should loop through all stores or take from query
    const storeId = new URL(request.url).searchParams.get("storeId");
    if (!storeId) return new Response("Missing storeId", { status: 400 });

    const varianceData = await getInventoryVariance(storeId);
    const anomalies: any[] = [];

    for (const item of varianceData) {
      // Lógica 1: Anomalía de Receta Perfecta
      // Varianza EXACTAMENTE 0.00 con ventas registradas (Costo teórico > 0)
      if (item.variance_percentage === 0 && item.theoretical_cost_cents > 0) {
        const log = {
          id: uuidv4(),
          agentName: "FRAUD_AUDITOR_CRON",
          action: "PERFECT_RECIPE_ANOMALY",
          zodSchemaUsed: "VarianceResult",
          status: "REJECTED_BY_GUARDRAIL",
          storeId: storeId,
          payloadRef: JSON.stringify(item),
        };
        // CAST a enum explícito necesario para Drizzle
        await db.insert(ai_audit_logs).values(log as any);
        anomalies.push({ item: item.canonical_name, type: "PERFECT_RECIPE_ANOMALY" });
      }

      // Lógica 2: Varianza Crítica (> 2.0%)
      if (item.alert_level === "CRITICAL") {
        const log = {
          id: uuidv4(),
          agentName: "FRAUD_AUDITOR_CRON",
          action: "CRITICAL_FRAUD_RISK",
          zodSchemaUsed: "VarianceResult",
          status: "REJECTED_BY_GUARDRAIL",
          storeId: storeId,
          payloadRef: JSON.stringify(item),
        };
        await db.insert(ai_audit_logs).values(log as any);
        anomalies.push({ item: item.canonical_name, type: "CRITICAL_FRAUD_RISK" });
      }
    }

    return NextResponse.json({
      success: true,
      anomaliesDetected: anomalies.length,
      anomalies,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
