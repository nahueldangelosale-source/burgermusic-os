"use server";

import { db } from "@/db";
import { sql } from "drizzle-orm";

interface VarianceResult {
  ingredient_id: string;
  canonical_name: string;
  theoretical_cost_cents: number;
  real_cost_cents: number;
  variance_percentage: number;
  alert_level: "CRITICAL" | "PROFIT" | "NEUTRAL" | "PENDING";
}

export async function getInventoryVariance(storeId: string): Promise<VarianceResult[]> {
  // Escudo Zero-Trust: Restringir operaciones en bases SQLite sin validación
  const safeStoreId = storeId.replace(/[^a-zA-Z0-9_-]/g, "");

  // CTE (Common Table Expression) en SQL nativo cruzado desde Drizzle
  // Calcula teóricos desde las ventas (Kardex Inverso O(1)) y lo contrasta con el Real
  const rawSql = sql`
        WITH 
        FilteredTransactions AS (
            SELECT type, product_sku, quantity, cost_cents_at_time
            FROM transactions
            WHERE store_id = ${safeStoreId}
        ),
        
        -- 1. Ventas Explosivas por Receta Canónica (Costos Teóricos)
        TheoreticalCosts AS (
            SELECT 
                b.ingredient_id,
                SUM(ABS(t.quantity) * b.theoretical_qty * COALESCE(t.cost_cents_at_time, 0)) as total_theoretical_cost
            FROM FilteredTransactions t
            INNER JOIN bom_recipes b ON b.product_sku = t.product_sku
            WHERE t.type = 'SALE'
            GROUP BY b.ingredient_id
        ),
        
        -- 2. Entradas - Mermas - Manuales (Costos Reales/Stock Físico Consumido)
        -- Para calcular el costo de inventario real (Varianza), 
        -- el Costo Real Consumido = (Compras - Ajustes - Stock Físico)
        -- De manera sintética (proxy contable): medimos los recibos netos Vs el ajuste en transactions
        ActualCosts AS (
            SELECT 
                b.ingredient_id,
                SUM(ABS(t.quantity) * COALESCE(t.cost_cents_at_time, 0)) as total_actual_cost
            FROM FilteredTransactions t
            INNER JOIN bom_recipes b ON b.product_sku = t.product_sku
            WHERE t.type != 'SALE' AND t.type != 'RECEIPT' -- Simplificación Patrón Consumo Real
            GROUP BY b.ingredient_id
        ),

        -- 3. Motor de Varianza
        VarianceEngine AS (
            SELECT 
                m.id as ingredient_id,
                m.canonical_name,
                COALESCE(t.total_theoretical_cost, 0) as theoretical_cost_cents,
                COALESCE(a.total_actual_cost, 0) as real_cost_cents,
                CASE 
                    WHEN COALESCE(t.total_theoretical_cost, 0) > 0 
                    THEN ((COALESCE(a.total_actual_cost, 0) - t.total_theoretical_cost) / CAST(t.total_theoretical_cost AS REAL)) * 100
                    ELSE 0 
                END as variance_pct
            FROM mdm_ingredients m
            LEFT JOIN TheoreticalCosts t ON t.ingredient_id = m.id
            LEFT JOIN ActualCosts a ON a.ingredient_id = m.id
        )

        SELECT 
            *,
            CASE 
                WHEN theoretical_cost_cents = 0 AND real_cost_cents = 0 THEN 'PENDING'
                WHEN variance_pct > 2.0 THEN 'CRITICAL'
                WHEN variance_pct < -0.5 THEN 'PROFIT'
                ELSE 'NEUTRAL'
            END as alert_level
        FROM VarianceEngine
        ORDER BY variance_pct DESC;
    `;

  try {
    const results = await db.all(rawSql);
    return results as unknown as VarianceResult[];
  } catch (e) {
    console.error("AvT CTE Error:", e);
    return [];
  }
}
