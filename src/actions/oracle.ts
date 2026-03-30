"use server";

import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function getCashflowRunway(current_balance_cents: number, storeId: string) {
  // Lógica O(1) CTE Predictivo a 30 días
  // US 3.2: Mapa de Liquidez.
  // Prohibido iterar arreglos para calcular balances iterativos. Cálculo Window Function DB-side.
  
  const windowQuery = sql`
    WITH RECURSIVE
      dates(d, n) AS (
        SELECT date('now', 'localtime'), 1
        UNION ALL
        SELECT date(d, '+1 day'), n + 1 FROM dates WHERE n < 30
      ),
      total_active_opex AS (
        SELECT COALESCE(SUM(daily_accrual_amount), 0) as daily_total
        FROM opex_ledger
        WHERE store_id = ${storeId} AND type != 'EXTRAORDINARY'
      ),
      daily_ap AS (
        SELECT due_date, SUM(invoice_amount - credit_note_amount) as ap_cost
        FROM accounts_payable
        WHERE status IN ('PERFECT_MATCH', 'PENDING')
        GROUP BY due_date
      ),
      daily_gw AS (
        -- US 3.3: Integración de Dinero en Tránsito (Mercado Pago / Gateways)
        SELECT settlement_date, SUM(amount) as gw_income
        FROM gateway_settlements
        WHERE status = 'PENDING'
        GROUP BY settlement_date
      ),
      daily_deltas AS (
        SELECT 
          dates.d as calendar_date,
          COALESCE(daily_gw.gw_income, 0) 
            + 15000000 -- Ingreso diario promedio simulado (150k ARS)
            - (SELECT daily_total FROM total_active_opex) 
            - COALESCE(daily_ap.ap_cost, 0) as net_delta
        FROM dates
        LEFT JOIN daily_ap ON dates.d = daily_ap.due_date
        LEFT JOIN daily_gw ON dates.d = daily_gw.settlement_date
      )
    SELECT 
      calendar_date as date,
      ${current_balance_cents} + SUM(net_delta) OVER (ORDER BY calendar_date ASC) as balance
    FROM daily_deltas
    ORDER BY calendar_date ASC
  `;

  const finalRes: any = await db.run(windowQuery);
  const finalRows = finalRes.rows || finalRes;

  // Sanitización obligatoria plana para el Server Component Boundary
  return finalRows.map((r: any) => ({
    date: r.date,
    balance: r.balance
  }));
}

export async function getDailyBreakevenPoint(storeId: string) {
  // US 3.1: Visualización del Punto de Equilibrio Diario O(1)
  const query = sql`
    SELECT COALESCE(SUM(daily_accrual_amount), 0) as breakeven 
    FROM opex_ledger 
    WHERE store_id = ${storeId} AND type != 'EXTRAORDINARY'
  `;
  const res: any = await db.run(query);
  const rows = res.rows || res;
  return rows[0]?.breakeven ?? 0;
}
