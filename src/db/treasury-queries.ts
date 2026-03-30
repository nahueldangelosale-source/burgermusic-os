"use server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { z } from "zod";

export const DailyOpexZod = z.object({
  date: z.string(),
  totalDailyAccrual: z.number(),
});

export const LaborCostFlagZod = z.object({
  date: z.string(),
  shift: z.string(),
  laborCost: z.number(),
  grossSales: z.number(),
  ratio: z.number(),
  alertFlag: z.boolean(),
});

export type LaborCostFlag = z.infer<typeof LaborCostFlagZod>;

// ==========================================
// 1. Accrual Diario de OPEX (Costo Fijo Linear)
// ==========================================
export async function getDailyAccrualOpex() {
  const rawSql = sql`
        WITH ActiveOpex AS (
            SELECT SUM(monthly_amount) as total_monthly
            FROM recurring_expenses
        )
        SELECT 
            date('now') as date,
            (total_monthly / 30.0) as total_daily_accrual
        FROM ActiveOpex;
    `;

  try {
    const results = (await db.all(rawSql)) as any[];
    return DailyOpexZod.parse({
      date: String(results[0]?.date || new Date().toISOString().split("T")[0]),
      totalDailyAccrual: Number(results[0]?.total_daily_accrual || 0),
    });
  } catch (e) {
    console.error("Error en OPEX Accrual:", e);
    return { date: new Date().toISOString().split("T")[0], totalDailyAccrual: 0 };
  }
}

// ==========================================
// 2. Umbral Laboral vs Ventas (>25% Flag)
// ==========================================
export async function getLaborCostFlag(timeRange = "-7 days"): Promise<LaborCostFlag[]> {
  // Calculamos el ratio de Nómina contra Venta Bruta O(1) cruzando transactions con labor_costs.
  const rawSql = sql`
        WITH ShiftSales AS (
            SELECT 
                date(created_at) as sale_date,
                CASE WHEN CAST(strftime('%H', created_at) AS INTEGER) < 17 THEN 'Mañana' ELSE 'Noche' END as shift,
                SUM(ABS(quantity) * COALESCE(selling_price, 0)) as gross_sales_cents
            FROM transactions
            JOIN products ON transactions.product_sku = products.id
            WHERE type = 'SALE' AND created_at >= datetime('now', ${timeRange})
            GROUP BY sale_date, shift
        ),
        LaborAgg AS (
            SELECT 
                date,
                shift,
                SUM(cost_amount) as total_labor_cost
            FROM labor_costs
            WHERE date >= date('now', ${timeRange})
            GROUP BY date, shift
        )
        SELECT 
            s.sale_date as date,
            s.shift,
            COALESCE(l.total_labor_cost, 0) as labor_cost,
            (s.gross_sales_cents / 100.0) as gross_sales,
            CASE WHEN s.gross_sales_cents > 0 THEN (COALESCE(l.total_labor_cost, 0) / (s.gross_sales_cents / 100.0)) ELSE 0 END as ratio,
            CASE WHEN (s.gross_sales_cents > 0) AND (COALESCE(l.total_labor_cost, 0) / (s.gross_sales_cents / 100.0) > 0.25) THEN 1 ELSE 0 END as alert_flag
        FROM ShiftSales s
        LEFT JOIN LaborAgg l ON s.sale_date = l.date AND s.shift = l.shift
        ORDER BY s.sale_date DESC;
    `;

  try {
    const results = (await db.all(rawSql)) as any[];
    return results.map((r) =>
      LaborCostFlagZod.parse({
        date: String(r.date),
        shift: String(r.shift),
        laborCost: Number(r.labor_cost),
        grossSales: Number(r.gross_sales),
        ratio: Number(r.ratio),
        alertFlag: Boolean(r.alert_flag),
      }),
    );
  } catch (e) {
    console.error("Error en Labor Cost CTE:", e);
    return [];
  }
}
