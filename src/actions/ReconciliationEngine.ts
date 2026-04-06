"use server";

import { db } from "@/db";
import { fact_sales } from "@/db/schema";
import { cash_register_closures } from "@/db/schema/treasury";
import { sql, and, eq } from "drizzle-orm";
// Assume requireManagerSession exists in actions/ProfitabilityEngine or lib/auth-utils.
import { requireManagerSession } from "@/actions/ProfitabilityEngine";

export async function getShiftReconciliation(storeId: string, date: string, shift: string) {
  await requireManagerSession();

  const [theoreticalQuery, physicalQuery] = await Promise.all([
    db.select({
      total: sql<number>`SUM(${fact_sales.net_price_cents})`.mapWith(Number)
    })
    .from(fact_sales)
    .where(
      and(
        eq(fact_sales.storeId, storeId),
        eq(fact_sales.date, date),
        eq(fact_sales.shift, shift)
      )
    ),
    db.select({
      total: sql<number>`SUM(${cash_register_closures.total_cents})`.mapWith(Number)
    })
    .from(cash_register_closures)
    .where(
      and(
        eq(cash_register_closures.store_id, storeId),
        eq(cash_register_closures.closed_at, date),
        eq(cash_register_closures.shift, shift)
      )
    )
  ]);

  const theoreticalRevenue = theoreticalQuery[0]?.total || 0;
  const physicalRevenue = physicalQuery[0]?.total || 0;

  const delta_cents = physicalRevenue - theoreticalRevenue;
  const TOLERANCE_CENTS = 50000;

  if (Math.abs(delta_cents) > TOLERANCE_CENTS) {
    return {
      anomaly_detected: true,
      expected_cents: theoreticalRevenue,
      actual_cents: physicalRevenue,
      delta_cents
    };
  }

  return { anomaly_detected: false };
}
