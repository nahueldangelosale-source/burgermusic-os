import { db } from "@/db";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// PROXY DE TELEMETRÍA (OTEL) - Zero-Bloat
// Definición local de la tabla donde el recolector OTel descarga los spans.
// ─────────────────────────────────────────────────────────────────────────────
export const ai_telemetry_ledger = sqliteTable("ai_telemetry_ledger", {
  id: text("id").primaryKey(),
  action_type: text("action_type").notNull(), // 'INVOICE_SCAN' | 'PO_GENERATION'
  model_used: text("model_used").notNull(),
  input_tokens: integer("input_tokens").notNull().default(0),
  output_tokens: integer("output_tokens").notNull().default(0),
  created_at: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

export interface FinOpsMetrics {
  totalInputTokens: number;
  totalOutputTokens: number;
  apiCostUsd: number;
  humanHoursSaved: number;
  humanLaborCostSavedUsd: number;
  roiMultiplier: number;
  burnRateWarning: boolean;
  actionsProcessed: {
    invoices: number;
    purchaseOrders: number;
  };
}

export async function getFinOpsMetrics30Days(): Promise<FinOpsMetrics> {
  // O(1) Fetch Aggregation
  const stats = await db
    .select({
      invoices: sql<number>`SUM(CASE WHEN ${ai_telemetry_ledger.action_type} = 'INVOICE_SCAN' THEN 1 ELSE 0 END)`,
      pos: sql<number>`SUM(CASE WHEN ${ai_telemetry_ledger.action_type} = 'PO_GENERATION' THEN 1 ELSE 0 END)`,
      totalInput: sql<number>`SUM(${ai_telemetry_ledger.input_tokens})`,
      totalOutput: sql<number>`SUM(${ai_telemetry_ledger.output_tokens})`,
    })
    .from(ai_telemetry_ledger)
    .where(sql`${ai_telemetry_ledger.created_at} >= date('now', '-30 days')`);

  const data = stats[0] || { invoices: 0, pos: 0, totalInput: 0, totalOutput: 0 };

  const invoices = data.invoices || 0;
  const pos = data.pos || 0;
  const inputTokens = data.totalInput || 0;
  const outputTokens = data.totalOutput || 0;

  // ─────────────────────────────────────────────────────────────────────────────
  // MATEMÁTICA DE COSTOS (GEMINI 2.5 PRO PRICINGPROXY)
  // Input: $1.25 por Millón | Output: $5.00 por Millón
  // ─────────────────────────────────────────────────────────────────────────────
  const costInput = (inputTokens / 1_000_000) * 1.25;
  const costOutput = (outputTokens / 1_000_000) * 5.00;
  const apiCostUsd = costInput + costOutput;

  // ─────────────────────────────────────────────────────────────────────────────
  // TOTAL STRATEGIC VALUE (TSV)
  // Data Entry Humano: 3 mins por factura | 5 mins por PO
  // Costo labor promedio Manager: $15/hr ($0.25 al minuto)
  // ─────────────────────────────────────────────────────────────────────────────
  const invoiceMins = invoices * 3;
  const poMins = pos * 5;
  const totalMinsSaved = invoiceMins + poMins;
  const humanHoursSaved = totalMinsSaved / 60;
  const humanLaborCostSavedUsd = totalMinsSaved * 0.25;

  // Return of Investment Multiplier
  const roiMultiplier = apiCostUsd > 0 ? (humanLaborCostSavedUsd / apiCostUsd) : 0;

  // Fiebre del Consumo warning (Si quemamos más de $50 USD en un ecosistema chico en 30 días)
  const burnRateWarning = apiCostUsd > 50.0;

  return {
    totalInputTokens: inputTokens,
    totalOutputTokens: outputTokens,
    apiCostUsd,
    humanHoursSaved,
    humanLaborCostSavedUsd,
    roiMultiplier,
    burnRateWarning,
    actionsProcessed: {
      invoices,
      purchaseOrders: pos,
    }
  };
}
