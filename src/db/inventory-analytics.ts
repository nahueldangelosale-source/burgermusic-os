"use server";

import { db } from "@/db";
import { sql } from "drizzle-orm";

function mapRange(range: string): string {
  switch (range) {
    case "30d":
      return "-30 days";
    case "60d":
      return "-60 days";
    case "90d":
      return "-90 days";
    case "ytd":
      return "-1 year"; // Simplified YTD for SQLite
    default:
      return "-30 days";
  }
}

export interface TopSellerResult {
  product_sku: string;
  product_name: string;
  total_sold: number;
  total_revenue_cents: number;
}

export interface ProfitabilityResult {
  product_sku: string;
  product_name: string;
  total_sold: number;
  revenue_per_unit_cents: number;
  bom_cost_cents: number;
  net_margin_cents: number;
  total_profit_generated_cents: number;
}

export async function getTopSellers(range: string): Promise<TopSellerResult[]> {
  const rangeModifier = mapRange(range);

  const rawSql = sql`
        WITH TargetDate AS (
            SELECT datetime('now', ${rangeModifier}) as start_date
        )
        SELECT 
            t.product_sku,
            p.name as product_name,
            SUM(ABS(t.quantity)) as total_sold,
            SUM(ABS(t.quantity) * COALESCE(p.selling_price, 0)) as total_revenue_cents
        FROM transactions t
        JOIN products p ON t.product_sku = p.id
        CROSS JOIN TargetDate
        WHERE t.type = 'SALE' AND t.created_at >= TargetDate.start_date
        GROUP BY t.product_sku
        ORDER BY total_sold DESC
        LIMIT 10;
    `;

  try {
    const results = await db.all(rawSql);
    return results as unknown as TopSellerResult[];
  } catch (e) {
    console.error("Error en getTopSellers CTE:", e);
    return [];
  }
}

export async function getProfitabilityMatrix(range: string): Promise<ProfitabilityResult[]> {
  const rangeModifier = mapRange(range);

  const rawSql = sql`
        WITH TargetDate AS (
            SELECT datetime('now', ${rangeModifier}) as start_date
        ),
        VentasRange AS (
            SELECT 
                t.product_sku, 
                SUM(ABS(t.quantity)) as total_sold,
                MIN(COALESCE(p.selling_price, 0)) as unit_price
            FROM transactions t
            JOIN products p ON t.product_sku = p.id
            CROSS JOIN TargetDate
            WHERE t.type = 'SALE' AND t.created_at >= TargetDate.start_date
            GROUP BY t.product_sku
        ),
        -- Costo Master BOM basado en las Quotes más bajas vigentes
        BOMCosts AS (
            SELECT 
                b.product_sku,
                SUM(b.theoretical_qty * COALESCE(q.price_cents, 0)) as total_bom_cost_cents
            FROM bom_recipes b
            LEFT JOIN (
                SELECT ingredient_sku, MIN(price_cents) as price_cents
                FROM ingredient_quotes
                GROUP BY ingredient_sku
            ) q ON b.ingredient_id = q.ingredient_sku
            GROUP BY b.product_sku
        ),
        Profitability AS (
            SELECT 
                v.product_sku,
                p.name as product_name,
                v.total_sold,
                v.unit_price as revenue_per_unit_cents,
                COALESCE(b.total_bom_cost_cents, 0) as bom_cost_cents,
                (v.unit_price - COALESCE(b.total_bom_cost_cents, 0)) as net_margin_cents,
                ((v.unit_price - COALESCE(b.total_bom_cost_cents, 0)) * v.total_sold) as total_profit_generated_cents
            FROM VentasRange v
            JOIN products p ON v.product_sku = p.id
            LEFT JOIN BOMCosts b ON v.product_sku = b.product_sku
        )

        SELECT * FROM Profitability 
        ORDER BY total_profit_generated_cents DESC 
        LIMIT 10;
    `;

  try {
    const results = await db.all(rawSql);
    return results as unknown as ProfitabilityResult[];
  } catch (e) {
    console.error("Error en getProfitabilityMatrix CTE:", e);
    return [];
  }
}
