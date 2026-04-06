"use server";

import { db } from "@/db";
import { fact_sales } from "@/db/schema";
import { cash_register_closures } from "@/db/schema/treasury";
import { zombie_shift_audits } from "@/db/schema/finance";
import { requireReadSession } from "@/lib/auth-utils";
import { eq, and, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

// ─────────────────────────────────────────────────────────────
// P&L Reactor V2.0 — Zombie Shift Interceptor
// Antigravity 2026: Closed-Loop Financial Governance
// ─────────────────────────────────────────────────────────────

export interface DailyPnL {
  targetDate: string;
  revenue: number;
  cogs: number;
  grossMargin: number;
  shrinkage: number;
  netMargin: number;
  marginPercent: number;
  isZombie: boolean;
  channelBreakdown: Array<{ method: string; total_cents: number }>;
  pendingAuditId: string | null;
}

export async function generateDailyPnL(targetDate?: string): Promise<DailyPnL> {
  const { storeId } = await requireReadSession();
  const dateStr = targetDate || new Date().toISOString().split("T")[0];

  // ═══════════════════════════════════════════════════════════
  // AGREGACIONES CONCURRENTES O(1) — Promise.all
  // ═══════════════════════════════════════════════════════════
  const [salesAgg, shrinkageAgg, channelBreakdown] = await Promise.all([
    db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(${fact_sales.net_price_cents}), 0)`,
        totalCogs: sql<number>`COALESCE(SUM(${fact_sales.historical_cost_cents}), 0)`,
      })
      .from(fact_sales)
      .where(
        and(
          eq(fact_sales.storeId, storeId),
          eq(fact_sales.date, dateStr),
        )
      ),

    db
      .select({
        totalShrinkage: sql<number>`COALESCE(SUM(ABS(${cash_register_closures.difference_cents})), 0)`,
      })
      .from(cash_register_closures)
      .where(
        and(
          eq(cash_register_closures.store_id, storeId),
          eq(cash_register_closures.closed_at, dateStr),
          sql`${cash_register_closures.difference_cents} < 0`,
        )
      ),

    db
      .select({
        method: cash_register_closures.payment_method,
        total_cents: sql<number>`COALESCE(SUM(${cash_register_closures.total_cents}), 0)`,
      })
      .from(cash_register_closures)
      .where(
        and(
          eq(cash_register_closures.store_id, storeId),
          eq(cash_register_closures.closed_at, dateStr),
        )
      )
      .groupBy(cash_register_closures.payment_method),
  ]);

  const revenue = Number(salesAgg[0]?.totalRevenue) || 0;
  const cogs = Number(salesAgg[0]?.totalCogs) || 0;
  const grossMargin = revenue - cogs;
  const shrinkage = Number(shrinkageAgg[0]?.totalShrinkage) || 0;
  const netMargin = grossMargin - shrinkage;
  const marginPercent = revenue > 0 ? (netMargin / revenue) * 100 : 0;
  const isZombie = marginPercent < 15;

  // ═══════════════════════════════════════════════════════════
  // ZOMBIE SHIFT INTERCEPTOR — Closed-Loop Governance
  // ═══════════════════════════════════════════════════════════
  let pendingAuditId: string | null = null;

  if (isZombie && revenue > 0) {
    // Check if audit already exists for this store+date
    const existing = await db
      .select({ id: zombie_shift_audits.id, status: zombie_shift_audits.status })
      .from(zombie_shift_audits)
      .where(
        and(
          eq(zombie_shift_audits.store_id, storeId),
          eq(zombie_shift_audits.target_date, dateStr),
        )
      )
      .limit(1);

    if (existing.length === 0) {
      // No audit exists → create PENDING
      const auditId = "ZOMBIE_" + randomUUID().substring(0, 12).toUpperCase();
      await db.insert(zombie_shift_audits).values({
        id: auditId,
        store_id: storeId,
        target_date: dateStr,
        reported_margin_percent: Math.round(marginPercent * 100), // basis points
        reported_revenue_cents: revenue,
        reported_cogs_cents: cogs,
        reported_shrinkage_cents: shrinkage,
        status: "PENDING",
      });
      pendingAuditId = auditId;
    } else if (existing[0].status === "PENDING") {
      // Audit exists and is still PENDING → return its ID (idempotent)
      pendingAuditId = existing[0].id;
    }
    // If status === "RESOLVED", we do NOT overwrite → idempotency preserved
  }

  return {
    targetDate: dateStr,
    revenue,
    cogs,
    grossMargin,
    shrinkage,
    netMargin,
    marginPercent,
    isZombie,
    pendingAuditId,
    channelBreakdown: channelBreakdown.map(c => ({
      method: c.method,
      total_cents: Number(c.total_cents) || 0,
    })),
  };
}

// ─────────────────────────────────────────────────────────────
// RESOLVE ZOMBIE AUDIT — Manager Justification Lock
// ─────────────────────────────────────────────────────────────

export async function resolveZombieAudit(auditId: string, justification: string): Promise<{ success: boolean; error?: string }> {
  const { storeId } = await requireReadSession();

  if (!justification || justification.trim().length < 50) {
    return { success: false, error: "La justificación debe tener mínimo 50 caracteres." };
  }

  const audit = await db
    .select()
    .from(zombie_shift_audits)
    .where(
      and(
        eq(zombie_shift_audits.id, auditId),
        eq(zombie_shift_audits.store_id, storeId),
      )
    )
    .limit(1);

  if (audit.length === 0) {
    return { success: false, error: "Auditoría no encontrada." };
  }

  if (audit[0].status === "RESOLVED") {
    return { success: false, error: "Esta auditoría ya fue resuelta." };
  }

  await db
    .update(zombie_shift_audits)
    .set({
      status: "RESOLVED",
      manager_justification: justification.trim(),
      resolved_at: new Date().toISOString(),
    })
    .where(eq(zombie_shift_audits.id, auditId));

  revalidatePath("/dashboard/cfo");

  return { success: true };
}

// ─────────────────────────────────────────────────────────────
// Range P&L — For multi-day analysis
// ─────────────────────────────────────────────────────────────

export async function generateRangePnL(startDate: string, endDate: string): Promise<{
  revenue: number;
  cogs: number;
  grossMargin: number;
  shrinkage: number;
  netMargin: number;
  marginPercent: number;
  isZombie: boolean;
}> {
  const { storeId } = await requireReadSession();

  const [salesAgg, shrinkageAgg] = await Promise.all([
    db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(${fact_sales.net_price_cents}), 0)`,
        totalCogs: sql<number>`COALESCE(SUM(${fact_sales.historical_cost_cents}), 0)`,
      })
      .from(fact_sales)
      .where(
        and(
          eq(fact_sales.storeId, storeId),
          sql`${fact_sales.date} >= ${startDate}`,
          sql`${fact_sales.date} <= ${endDate}`,
        )
      ),

    db
      .select({
        totalShrinkage: sql<number>`COALESCE(SUM(ABS(${cash_register_closures.difference_cents})), 0)`,
      })
      .from(cash_register_closures)
      .where(
        and(
          eq(cash_register_closures.store_id, storeId),
          sql`${cash_register_closures.closed_at} >= ${startDate}`,
          sql`${cash_register_closures.closed_at} <= ${endDate}`,
          sql`${cash_register_closures.difference_cents} < 0`,
        )
      ),
  ]);

  const revenue = Number(salesAgg[0]?.totalRevenue) || 0;
  const cogs = Number(salesAgg[0]?.totalCogs) || 0;
  const grossMargin = revenue - cogs;
  const shrinkage = Number(shrinkageAgg[0]?.totalShrinkage) || 0;
  const netMargin = grossMargin - shrinkage;
  const marginPercent = revenue > 0 ? (netMargin / revenue) * 100 : 0;

  return {
    revenue,
    cogs,
    grossMargin,
    shrinkage,
    netMargin,
    marginPercent,
    isZombie: marginPercent < 15,
  };
}
