import "dotenv/config";
import { db } from "../db";
import { fact_sales, products, transactions, system_alerts, users } from "../db/schema";
import { sql, eq, and, gte, inArray, desc } from "drizzle-orm";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

/**
 * [DIRECTIVA SRE P0] - AUTONOMOUS MARGIN SENTINEL (CLOSED-LOOP)
 * ───────────────────────────────────────────────────────────
 * Autor: Principal AI Architect & FinOps Engineer
 * Objetivo: Auditoría de rentabilidad y bloqueo de operaciones por anomalías.
 * Motor: Push Compute to DB + LLM Reasoning.
 */

async function main() {
  console.log("[INFO] Iniciando Auditoría Sentinel: Autonomous Margin Audit...");

  // Discovery de sucursales activas (Aislando por Tenant)
  const activeStores = await db
    .selectDistinct({ storeId: users.storeId })
    .from(users);

  for (const store of activeStores) {
    const VALID_STORE_ID: string = store.storeId;
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    console.log(`[INFO] Auditando sucursal: ${VALID_STORE_ID}`);

    try {
      // REGLA 1: PUSH COMPUTE TO DB (Categorical Margins)
      const margins = await db
        .select({
          category: products.category,
          revenue: sql<number>`SUM(${fact_sales.net_price_cents})`,
          cogs: sql<number>`SUM(${fact_sales.quantity} * ${products.costCents})`,
        })
        .from(fact_sales)
        .innerJoin(products, eq(fact_sales.productSku, products.id))
        .where(
          and(
            eq(fact_sales.storeId, VALID_STORE_ID),
            gte(fact_sales.date, yesterday)
          )
        )
        .groupBy(products.category);

      // Rule 1.1: Calculate Shrinkage
      const shrinkageResult = await db
        .select({
          wasteCost: sql<number>`SUM(ABS(${transactions.quantity}) * ${transactions.costCentsAtTime})`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.storeId, VALID_STORE_ID),
            inArray(transactions.type, ["WASTE", "ADJUSTMENT"]),
            gte(transactions.date, yesterday)
          )
        );

      const totalRevenue = margins.reduce((acc, m) => acc + (m.revenue || 0), 0);
      const totalWaste = shrinkageResult[0]?.wasteCost || 0;
      const shrinkagePct = totalRevenue > 0 ? (totalWaste / totalRevenue) * 100 : 0;

      // REGLA 2: RAZONAMIENTO AGÉNTICO (CAUSAL TRACING)
      const auditPayload = {
        storeId: VALID_STORE_ID,
        date: today,
        categories: margins.map(m => ({
          name: m.category,
          margin: m.revenue > 0 ? ((m.revenue - m.cogs) / m.revenue) * 100 : 0,
          revenue: m.revenue / 100, // a pesos
        })),
        shrinkage: shrinkagePct,
      };

      console.log(`[INFO] Telemetría Generada para LLM:`, JSON.stringify(auditPayload));

      const { object: analysis } = await generateObject({
        model: google("gemini-1.5-pro"),
        schema: z.object({
          isAnomaly: z.boolean(),
          severity: z.enum(["CRITICAL", "WARNING", "INFO"]),
          reason: z.string(),
          impactedCategory: z.string().optional(),
          suggestion: z.string(),
        }),
        prompt: `Actúa como un Auditor Financiero Implacable para BurgerMusic OS. 
        Analiza los siguientes datos de rentabilidad de las últimas 24 horas para la sucursal ${VALID_STORE_ID}:
        ${JSON.stringify(auditPayload, null, 2)}

        REGLAS DE DECISIÓN CRÍTICAS:
        1. Si el margen de 'CARNES' es menor al 60%, marca ANOMALÍA CRÍTICA.
        2. Si la Merma (Shrinkage) es mayor al 3%, marca ANOMALÍA CRÍTICA.
        3. El margen se calcula como (Revenue - COGS) / Revenue.

        Tu respuesta debe ser un objeto JSON estructurado indicando si hay anomalía, la severidad, la razón técnica y una sugerencia táctica.`,
      });

      // REGLA 3: FRICCIÓN POSITIVA Y CLOSED-LOOP
      if (analysis.isAnomaly && analysis.severity === "CRITICAL") {
        const ALERT_ID = `SENTINEL-${VALID_STORE_ID}-${today.replace(/-/g, "")}`;
        
        console.log(`[ALERT] Anomalía Crítica detectada en ${VALID_STORE_ID}: ${analysis.reason}`);

        await db.insert(system_alerts).values({
          id: ALERT_ID,
          storeId: VALID_STORE_ID,
          type: analysis.impactedCategory === "Shrinkage" ? "SHRINKAGE_ALARM" : "MARGIN_ANOMALY",
          severity: "CRITICAL",
          details: {
            category: analysis.impactedCategory,
            actualValue: analysis.impactedCategory === "Shrinkage" ? shrinkagePct : 0, // Simplified for brevity
            threshold: analysis.impactedCategory === "Shrinkage" ? 3 : 60,
            reasoning: analysis.reason,
            suggestion: analysis.suggestion,
          },
          isLocked: true, // ESTE BLOQUEO ES LA FRICCIÓN POSITIVA
        }).onConflictDoUpdate({
           target: system_alerts.id,
           set: { details: sql`excluded.details`, createdAt: sql`CURRENT_TIMESTAMP` }
        });
      }
    } catch (error) {
      console.error(`[ERROR] Fallo en auditoría de sucursal ${store.storeId}:`, error);
    }
  }

  console.log("[SUCCESS] Auditoría Sentinel completada.");
  process.exit(0);
}

main();
