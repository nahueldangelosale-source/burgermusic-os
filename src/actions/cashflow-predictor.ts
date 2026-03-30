"use server";

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { z } from "zod";

const RunwayDayZod = z.object({
  date: z.string(),
  projected_cash: z.number(),
});

export type RunwayDay = z.infer<typeof RunwayDayZod>;

export async function get30DayRunway(storeId: string): Promise<RunwayDay[]> {
  try {
    // Caja Base = Efectivo Físico + Saldo MP
    const baseCashSql = sql`
            SELECT SUM(cash_in_register) as base_cash 
            FROM (
                SELECT register_num, cash_in_register
                FROM cash_register_transactions 
                WHERE store_id = ${storeId}
                GROUP BY register_num
                HAVING date = MAX(date)
            )
        `;

    const mpClearedSql = sql`
            SELECT SUM(net_amount) as cleared_mp 
            FROM payment_gateways_ledger 
            WHERE status = 'CLEARED' AND store_id = ${storeId}
        `;

    // Cuentas por Cobrar (Liquidaciones pendientes)
    const arSql = sql`
            SELECT SUM(net_amount) as pending_mp 
            FROM payment_gateways_ledger 
            WHERE status = 'PENDING' AND store_id = ${storeId}
        `;

    // Cuentas por Pagar (Facturas Vencimiento 30d)
    const apSql = sql`
            SELECT SUM(amount) as pending_ap 
            FROM accounts_payable 
            WHERE status = 'PENDING' AND store_id = ${storeId}
        `;

    // OPEX
    const opexSql = sql`
            SELECT SUM(monthly_amount)/30.0 as daily_opex 
            FROM recurring_expenses 
            WHERE store_id = ${storeId}
        `;

    // Execution concurrency O(1)
    const [baseCashRows, mpClearedRows, arRows, apRows, opexRows] = await Promise.all([
      db.all(baseCashSql) as any,
      db.all(mpClearedSql) as any,
      db.all(arSql) as any,
      db.all(apSql) as any,
      db.all(opexSql) as any,
    ]);

    const cashInRegisters = Number(baseCashRows[0]?.base_cash || 0);
    const mpCleared = Number(mpClearedRows[0]?.cleared_mp || 0);

    const arPending = Number(arRows[0]?.pending_mp || 0);
    const apPending = Number(apRows[0]?.pending_ap || 0);
    const dailyOpex = Number(opexRows[0]?.daily_opex || 0);

    // State Machine Start Condition
    let currentProj = cashInRegisters + mpCleared + arPending - apPending;

    const projection: RunwayDay[] = [];
    const today = new Date();

    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);

      // Accrual Diario Extracción
      currentProj -= dailyOpex;

      projection.push(
        RunwayDayZod.parse({
          date: d.toISOString().split("T")[0],
          projected_cash: Math.round(currentProj),
        }),
      );
    }

    return projection;
  } catch (e) {
    console.error("Error en Oráculo de Proyección de Caja:", e);
    return [];
  }
}
