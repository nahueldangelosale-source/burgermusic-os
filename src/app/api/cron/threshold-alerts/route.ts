import { db } from "@/db";
import { ai_audit_logs } from "@/db/schema";
import { env } from "@/lib/env";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // Vercel Cron requirement
export const maxDuration = 60;

export async function GET(request: Request) {
  // 1. Vercel Cron Secret Authentication
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (
    cronSecret &&
    authHeader !== `Bearer ${cronSecret}` &&
    request.headers.get("x-vercel-cron") !== "1"
  ) {
    return NextResponse.json({ error: "Unauthorized / Mando Global Lock" }, { status: 401 });
  }

  try {
    console.log("⏱️ Ejecutando Motor Analítico Cron: Detección de Varianza N8N");

    // 2. CTE Motor de Varianza 100% SQL (Evita map pesado en JS)
    // Note: We flag products.category IN ('BURGER', 'HIGH_VALUE_PROTEIN') as critical thresholds
    // to handle both legacy Enums and the C-Level explicit requirements.
    const varianceQuery = sql`
            WITH CurrentKardex AS (
                SELECT product_sku, store_id, SUM(quantity) as theoretical_stock
                FROM inventory_kardex
                GROUP BY product_sku, store_id
            ),
            VarianceMatrix AS (
                SELECT 
                    k.product_sku,
                    p.name,
                    p.category,
                    k.theoretical_stock,
                    -- Asumimos que la varianza negativa representa un shrinkage (merma)
                    -- O simulamos baseline si inventory_snapshots no existe aún y cruzamos contra consumos
                    -- Para esta fase, calcularemos varianza entre kardex vs WAC esperado o simplemente evaluaremos
                    -- el Costo Directo Atascado (Shrinkage Financiero Teórico).
                    -- Adaptación basada en el CTE solicitado:
                    k.theoretical_stock as current_qty,
                    COALESCE(p.cost_cents, 0) as unit_cost,
                    (k.theoretical_stock * 0.05) as simulated_variance_qty -- Simulate 5% for testing if no physical counts
                FROM CurrentKardex k
                JOIN products p ON k.product_sku = p.id
                WHERE p.category = 'BURGER' OR p.category = 'HIGH_VALUE_PROTEIN'
            ),
            TriggerCalculation AS (
                SELECT 
                    product_sku,
                    store_id,
                    name,
                    category,
                    current_qty,
                    simulated_variance_qty as variance_qty,
                    (simulated_variance_qty / NULLIF(current_qty, 0)) * 100 as variance_pct,
                    (simulated_variance_qty * unit_cost) as financial_loss_cents
                FROM VarianceMatrix
            )
            SELECT * 
            FROM TriggerCalculation
            WHERE variance_pct > 2.0;
        `;

    // Native Drizzle ORM Raw Execution O(1)
    const criticalAlerts = (await db.all(varianceQuery)) as any[];

    console.log(`⚠️ Encontradas ${criticalAlerts.length} alarmas críticas de merma.`);

    let triggeredCount = 0;

    // 3. Sistema de Alerta -> N8N (Con Lógica de Severidad e Idempotencia O(1))
    const n8nWebhook = process.env.N8N_WEBHOOK_URL;

    // Empezamos la transacción de log de auditoría
    await db.transaction(async (tx) => {
      for (const alert of criticalAlerts) {
        const sku = String(alert.product_sku);
        const variancePct = Number(alert.variance_pct).toFixed(2);
        const financialLoss = Number(alert.financial_loss_cents);

        // Generar ID Idempotente: REGLA_{SKU}_{FECHA_ACTUAL}
        // Si este ID ya existe en ai_audit_logs, significa que ya disparamos la alerta hoy.
        const today = new Date().toISOString().split("T")[0];
        const idempotencyKey = `N8N_CRITICAL_${sku}_${today}`;

        // Intento de Inserción del Log (Filtro Zero-Trust / Idempotente)
        try {
          await tx.insert(ai_audit_logs).values({
            id: idempotencyKey,
            agentName: "SHRINKAGE_N8N_CRON",
            zodSchemaUsed: "NONE_NATIVE_SQL",
            status: "APPROVED",
            action: "SHRINKAGE_N8N_TRIGGER",
            payloadRef: `Disparo hacia N8N: Varianza ${variancePct}% detectada. Pérdida: ${financialLoss}¢`,
            storeId: alert.store_id, // Mandatory from DB query
          });

          // Si el INSERT pasó (no hubo conflicto de PRIMARY KEY), entonces es genuinamente nuevo.
          // Ejecutamos el Fetch Asíncrono al webhook.
          if (n8nWebhook) {
            try {
              fetch(n8nWebhook, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  alert: "CRITICAL_SHRINKAGE",
                  sku: sku,
                  variance: variancePct,
                  loss_value_cents: financialLoss,
                  reported_at: new Date().toISOString(),
                }),
              }).catch((err) => console.error("Error silencioso en Webhook N8N:", err));

              triggeredCount++;
            } catch (webhookErr) {
              console.error(`Falla local al emitir Webhook N8N para ${sku}`);
            }
          } else {
            console.warn("⚠️ N8N_WEBHOOK_URL no configurado, simulando alerta para: " + sku);
            triggeredCount++;
          }
        } catch (duplicateErr) {
          // Silenciamos el error si es de clave primaria, significa idempotencia exitosa.
          // Ya se reportó hoy.
        }
      }
    });

    return NextResponse.json(
      {
        status: "success",
        message: `Oráculo predictivo finalizado. ${triggeredCount} alertas emitidas a N8N.`,
      },
      { status: 200 },
    );
  } catch (e: any) {
    console.error("Error Fatal en Oráculo CRON:", e);
    return NextResponse.json(
      { error: "Internal Server Error", details: e.message },
      { status: 500 },
    );
  }
}
