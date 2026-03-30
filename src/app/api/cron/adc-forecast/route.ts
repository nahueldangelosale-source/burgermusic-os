import { db } from "@/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Agente Autónomo ADC (Cron de Vercel)
 * Predicción diaria de quiebre de inventario extrapolando el Consumo Promedio (ADC).
 */
export async function GET(req: Request) {
  // Validación de Entorno CRON estricta (Zero-Trust RBAC)
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "SRE BLOCK: Unauthorized Execution" }, { status: 401 });
  }

  try {
    // Matemática Lógica Pura empujada a la Capa Base (SQLite)
    await db.run(sql`
      WITH adc_calc AS (
        -- Consumo Promedio Diario (ADC) últimos 14 días
        SELECT 
          product_sku as sku,
          SUM(quantity) / 14.0 as adc
        FROM fact_sales
        WHERE date >= date('now', '-14 days')
        GROUP BY product_sku
      ),
      current_inventory AS (
        -- Instantánea Crítica (Snapshot O(1))
        SELECT 
          ingredient_sku as sku,
          SUM(current_qty) as stock_actual,
          MIN(24) as lead_time_horas -- Mock fallback (debería leerse del CRM Proveedor)
        FROM inventory_batches
        WHERE status = 'READY'
        GROUP BY ingredient_sku
      )
      -- Drizzle / SQLite Upsert Atómico para la Cuadrícula Forecast
      INSERT INTO purchase_suggestions (id, sku, suggested_qty, status, created_at)
      SELECT 
        hex(randomblob(16)),
        c.sku,
        (a.adc * 7), -- Pronóstico Extrapolado (Pedido para 7 días)
        'Riesgo de Quiebre (ADC)',
        date('now')
      FROM current_inventory c
      JOIN adc_calc a ON c.sku = a.sku
      WHERE a.adc > 0 
        -- Regla Táctica de Suministro SRE
        AND (c.stock_actual / a.adc) <= (c.lead_time_horas / 24.0)
      -- Blindaje Dual Idempotente preventivo
      ON CONFLICT(sku, created_at) DO NOTHING;
    `);

    return NextResponse.json({ success: true, exitCode: 0, status: "Forecast Computed Cleanly" });
  } catch (error: any) {
    console.error("ADC Cron Orchestration SRE Failure:", error);
    return NextResponse.json({ error: error.message, exitCode: 1 }, { status: 500 });
  }
}
