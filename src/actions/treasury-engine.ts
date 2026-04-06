"use server";

import { db } from "@/db";
import { supplier_current_accounts, expenses, petty_cash_fund, treasury_accounts } from "@/db/schema/treasury";
import { fact_sales, suppliers } from "@/db/schema";
import { requireReadSession, requireManagerSession } from "@/lib/auth-utils";
import { eq, and, sql, isNull, gte, lte } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Treasury Engine V3.2 — Dashboard Data Plane
// Antigravity 2026: Zero Placeholders, Dynamic Aggregation
// ─────────────────────────────────────────────────────────────

export interface TreasuryChartData {
  debtBars: Array<{ label: string; overdue: number; upcoming: number }>;
  cashFlowArea: Array<{ date: string; inflow: number; outflow: number; net: number }>;
  opexPie: Array<{ name: string; value: number }>;
  alerts: TreasuryAlert[];
  pettyCash: { balance_cents: number; fund_name: string } | null;
  treasuryAccounts: Array<{ id: string; account_name: string; account_type: string; balance_cents: number }>;
}

export interface TreasuryAlert {
  type: "CRITICAL" | "WARNING" | "INFO";
  message: string;
  code: string;
}

const TreasuryAlertSchema = z.object({
  petty_cash_low: z.boolean(),
  tax_deadline_imminent: z.boolean(),
  overdue_count: z.number(),
});

export async function getTreasuryDashboardData(): Promise<TreasuryChartData> {
  const { storeId } = await requireReadSession();
  const now = new Date();
  const nowISO = now.toISOString();

  // ── 1. Debt Bars: Overdue vs Upcoming ────────────────────────
  const allAP = await db
    .select({
      id: supplier_current_accounts.id,
      debt_cents: supplier_current_accounts.debt_cents,
      credit_cents: supplier_current_accounts.credit_cents,
      due_date: supplier_current_accounts.due_date,
      status: supplier_current_accounts.status,
    })
    .from(supplier_current_accounts)
    .where(
      and(
        eq(supplier_current_accounts.store_id, storeId),
        isNull(supplier_current_accounts.deleted_at),
      ),
    );

  let overdueTotal = 0;
  let upcomingTotal = 0;
  let overdueCount = 0;

  for (const ap of allAP) {
    const balance = ap.debt_cents - ap.credit_cents;
    if (balance <= 0) continue;

    const dueTimestamp = ap.due_date ? new Date(ap.due_date).getTime() : 0;
    if (dueTimestamp < now.getTime()) {
      overdueTotal += balance;
      overdueCount++;
    } else {
      upcomingTotal += balance;
    }
  }

  const debtBars = [
    { label: "Deuda Vencida", overdue: overdueTotal, upcoming: 0 },
    { label: "Deuda a Vencer", overdue: 0, upcoming: upcomingTotal },
  ];

  // ── 2. Cash Flow Area: 30-day projection ─────────────────────
  // Inflows: 7-day moving average of fact_sales, projected forward
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split("T")[0];
  const todayStr = nowISO.split("T")[0];

  const recentSales = await db
    .select({
      totalInflow: sql<number>`COALESCE(SUM(${fact_sales.net_price_cents}), 0)`,
      dayCount: sql<number>`COUNT(DISTINCT ${fact_sales.date})`,
    })
    .from(fact_sales)
    .where(
      and(
        eq(fact_sales.storeId, storeId),
        gte(fact_sales.date, sevenDaysAgo),
        lte(fact_sales.date, todayStr),
      ),
    );

  const totalInflow7d = recentSales[0]?.totalInflow ?? 0;
  const activeDays = Math.max(recentSales[0]?.dayCount ?? 1, 1);
  const dailyAvgInflow = Math.round(totalInflow7d / activeDays);

  // Outflows: AP due dates in next 30 days
  const outflowMap = new Map<string, number>();
  for (const ap of allAP) {
    const balance = ap.debt_cents - ap.credit_cents;
    if (balance <= 0) continue;
    const dueDate = ap.due_date ? new Date(ap.due_date) : null;
    if (!dueDate) continue;
    const key = dueDate.toISOString().split("T")[0];
    outflowMap.set(key, (outflowMap.get(key) || 0) + balance);
  }

  const cashFlowArea: TreasuryChartData["cashFlowArea"] = [];
  let runningNet = 0;

  for (let i = 0; i < 30; i++) {
    const date = new Date(now.getTime() + i * 86400000);
    const dateStr = date.toISOString().split("T")[0];
    const outflow = outflowMap.get(dateStr) || 0;
    const inflow = dailyAvgInflow;
    runningNet += inflow - outflow;

    cashFlowArea.push({
      date: dateStr,
      inflow: Math.round(inflow / 100),
      outflow: Math.round(outflow / 100),
      net: Math.round(runningNet / 100),
    });
  }

  // ── 3. OPEX vs COGS Pie ──────────────────────────────────────
  const expenseAgg = await db
    .select({
      expenseType: expenses.expense_type,
      total: sql<number>`COALESCE(SUM(${expenses.gross_amount_cents}), 0)`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.store_id, storeId),
        isNull(expenses.deleted_at),
      ),
    )
    .groupBy(expenses.expense_type);

  const opexPie = expenseAgg.map((e) => ({
    name: e.expenseType,
    value: Math.round(e.total / 100),
  }));

  // ── 4. Petty Cash & Treasury Accounts ────────────────────────
  const pettyCashResult = await db
    .select()
    .from(petty_cash_fund)
    .where(eq(petty_cash_fund.store_id, storeId))
    .limit(1);

  const pettyCash = pettyCashResult[0]
    ? { balance_cents: pettyCashResult[0].current_balance_cents, fund_name: pettyCashResult[0].fund_name }
    : null;

  const accountsResult = await db
    .select({
      id: treasury_accounts.id,
      account_name: treasury_accounts.account_name,
      account_type: treasury_accounts.account_type,
      balance_cents: treasury_accounts.balance_cents,
    })
    .from(treasury_accounts)
    .where(eq(treasury_accounts.store_id, storeId));

  // ── 5. Alert Sentinel ────────────────────────────────────────
  const alerts: TreasuryAlert[] = [];

  // 5a: Low petty cash (< $50,000 = 5000000 cents)
  if (pettyCash && pettyCash.balance_cents < 5000000) {
    alerts.push({
      type: "CRITICAL",
      message: `Caja Chica en nivel crítico: $${(pettyCash.balance_cents / 100).toFixed(2)}. Reponer urgente.`,
      code: "PETTY_CASH_LOW",
    });
  }

  // 5b: Tax deadline < 48 hours
  const in48h = new Date(now.getTime() + 48 * 3600000);
  for (const ap of allAP) {
    const balance = ap.debt_cents - ap.credit_cents;
    if (balance <= 0) continue;
    const dueDate = ap.due_date ? new Date(ap.due_date) : null;
    if (!dueDate) continue;
    if (dueDate.getTime() > now.getTime() && dueDate.getTime() <= in48h.getTime()) {
      alerts.push({
        type: "WARNING",
        message: `Vencimiento inminente (<48h): $${(balance / 100).toFixed(2)} - vence ${dueDate.toISOString().split("T")[0]}`,
        code: "DEADLINE_IMMINENT",
      });
    }
  }

  // 5c: Overdue count
  if (overdueCount > 0) {
    alerts.push({
      type: "CRITICAL",
      message: `${overdueCount} facturas vencidas por un total de $${(overdueTotal / 100).toFixed(2)}`,
      code: "OVERDUE_AP",
    });
  }

  return {
    debtBars,
    cashFlowArea,
    opexPie,
    alerts,
    pettyCash,
    treasuryAccounts: accountsResult,
  };
}

// ─────────────────────────────────────────────────────────────
// Idempotent Seeder — Topología de Liquidez Inicial
// ─────────────────────────────────────────────────────────────

export async function seedTreasuryTopology() {
  const { storeId, userId } = await requireManagerSession();
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    // Petty Cash Fund — idempotent via onConflictDoNothing
    await tx
      .insert(petty_cash_fund)
      .values({
        id: `PCF_${storeId}_DEFAULT`,
        store_id: storeId,
        fund_name: "Caja Chica Centro",
        current_balance_cents: 5000000, // $50,000.00
        last_replenished_at: now,
        audited_by: userId,
        audited_at: now,
      })
      .onConflictDoNothing();

    // Treasury Accounts — Banco Nación
    await tx
      .insert(treasury_accounts)
      .values({
        id: `TA_${storeId}_BANCO_NACION`,
        store_id: storeId,
        account_name: "Banco Nación",
        account_type: "BANK",
        balance_cents: 0,
        audited_by: userId,
        audited_at: now,
      })
      .onConflictDoNothing();

    // Treasury Accounts — Caja Fuerte
    await tx
      .insert(treasury_accounts)
      .values({
        id: `TA_${storeId}_CAJA_FUERTE`,
        store_id: storeId,
        account_name: "Caja Fuerte Local",
        account_type: "SAFE",
        balance_cents: 0,
        audited_by: userId,
        audited_at: now,
      })
      .onConflictDoNothing();
  });

  return { success: true, seeded_at: now, audited_by: userId };
}
