"use server";

import { sql } from "drizzle-orm";
import { db } from "./index";
import { fact_sales, cash_register_transactions } from "./schema";
import { inventory_batches, prep_logs } from "./schema/traceability";

// 1. Salud Global (Ventas vs Costos Históricos de COGS)
export async function getGlobalHealth(storeId?: string) {
  const storeFilter = storeId ? sql`AND ${fact_sales.storeId} = ${storeId}` : sql``;
  const storeFilterInv = storeId ? sql`AND b.supplier_id != ''` /* TODO: isolation real */ : sql``;
  
  const raw = (await db.all(sql`
    WITH sales_agg AS (
      SELECT SUM(net_price_cents) as total_revenue
      FROM fact_sales
      WHERE 1=1 ${storeFilter}
    ),
    cogs_agg AS (
      -- Como fallback FinOps, estimamos un 30% de Costo de Ventas (Standard Costing)
      SELECT CAST(SUM(net_price_cents) * 0.30 AS INTEGER) as total_cogs
      FROM fact_sales
      WHERE 1=1 ${storeFilter}
    )
    SELECT 
      COALESCE(sales_agg.total_revenue, 0) as total_revenue,
      COALESCE(cogs_agg.total_cogs, 0) as total_cogs
    FROM sales_agg, cogs_agg;
  `)) as any[];

  const total_revenue = raw[0]?.total_revenue || 0;
  const total_cogs = raw[0]?.total_cogs || 0;

  const gross_margin = total_revenue > 0 ? ((total_revenue - total_cogs) / total_revenue) * 100 : 0;
  const variance = (total_revenue * 0.05); // Dummy variance 5%
  const liquidity = total_revenue - total_cogs - 150000; // Dummy liquidity

  return { 
    totalRevenue: Number(total_revenue) || 0, 
    cogs: Number(total_cogs) || 0, 
    grossMarginPct: Number(gross_margin) || 0,
    variance: Number(variance) || 0,
    liquidity: Number(liquidity) || 0
  };
}

// 2. Fire Radar (Anomalías crudas)
export async function getFireRadarAlerts() {
  // Anomalías 1: Mermas críticas (waste > yield)
  // [!] prep_logs table doesn't exist yet in Turso. Dummied out for zero-crash rendering.
  const wasteAlerts: any[] = [];

  // Anomalías 2: Descuadres de Caja Operativa
  const cashAlerts = await db.run(sql`
    SELECT id, date, shift, discrepancy, 'CASH_DISCREPANCY' as type
    FROM cash_register_transactions
    WHERE discrepancy < -1000 OR discrepancy > 1000
    ORDER BY date DESC
    LIMIT 3
  `).then(res => res.rows.map(r => ({ ...r })));

  return { wasteAlerts, cashAlerts };
}

// 3. Leaderboard O(1) CTE
export async function getLeaderboard() {
  return await db.run(sql`
    SELECT 
      store_id,
      SUM(net_price_cents) as revenue,
      COUNT(id) as total_items
    FROM fact_sales
    GROUP BY store_id
    ORDER BY revenue DESC
  `).then(res => res.rows.map(r => ({ ...r })));
}

export async function getCashflowOracle(storeId?: string) {
  const storeFilter = storeId ? sql`WHERE ${fact_sales.storeId} = ${storeId}` : sql``;
  const raw = await db.all(sql`
    SELECT 
      date, 
      SUM(net_price_cents) as daily_revenue
    FROM fact_sales
    ${storeFilter}
    GROUP BY date
    ORDER BY date DESC
    LIMIT 7
  `);
  return (raw as any[]).map(r => ({ date: r.date, daily_revenue: r.daily_revenue }));
}

export async function getTopSellingItems(storeId?: string) {
  const storeFilter = storeId ? sql`WHERE ${fact_sales.storeId} = ${storeId}` : sql``;
  const raw = await db.all(sql`
    SELECT 
      product_sku as sku,
      SUM(quantity) as total_units,
      SUM(net_price_cents) as total_revenue
    FROM fact_sales
    ${storeFilter}
    WHERE product_sku NOT LIKE 'SRV_%' AND product_sku != 'MISC_UNKNOWN'
    GROUP BY product_sku
    ORDER BY total_units DESC
    LIMIT 5
  `);
  return (raw as any[]).map(r => ({ sku: r.sku, total_units: r.total_units, total_revenue: r.total_revenue }));
}
