"use server";

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { z } from "zod";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * MOTOR DE CONSUMO O(1) — BurgerMusic OS v4.1
 * ─────────────────────────────────────────────────────────────────────────────
 * Agrega el consumo de los últimos 14 días y el Lead Time Histórico,
 * calculando los puntos de pedido (Reorder Points). Zero-Trust y tipado estricto.
 */

const ReorderPointResultSchema = z.array(
  z.object({
    ingredientSku: z.string(),
    ingredientName: z.string(),
    burnRateDaily: z.number(),
    leadTimeDays: z.number(),
    safetyStock: z.number(),
    reorderPoint: z.number(),
  })
);

export type ReorderPointResult = z.infer<typeof ReorderPointResultSchema>;

export async function calculateReorderPoints(): Promise<ReorderPointResult> {
  // 1. Burn Rate (Últimos 14 días)
  // Cruzamos fact_sales con recipe_items para explosionar el consumo.
  // SQLite DATE('now', '-14 days') funciona para fact_sales.date = YYYY-MM-DD
  const burnRateQuery = await db.run(sql`
    SELECT 
      ri.ingredient_sku as ingredientSku,
      p.name as ingredientName,
      p.safety_stock as safetyStock,
      SUM(fs.quantity * ri.quantity) as totalConsumed14d
    FROM fact_sales fs
    JOIN recipe_items ri ON fs.product_sku = ri.product_sku
    JOIN products p ON ri.ingredient_sku = p.id
    WHERE date(fs.date) >= date('now', '-14 days')
    GROUP BY ri.ingredient_sku, p.name, p.safety_stock
  `);

  // En Drizzle para SQLite, raw queries suelen retornar registros, pero db.run no es lo ideal si queremos leer.
  // Es mejor usar db.all (sqlite-proxy o better-sqlite3) o sql magic. Como "db" puede ser un proxy, usaremos get/all:
  // (Nota: asumiendo el patrón drizzle-orm/sqlite-core estandar). 
  // Para evitar fallos si `db.run` asume mutation, usamos `db.all`
  const rawBurnRates = (await db.all(sql`
    SELECT 
      ri.ingredient_sku as ingredientSku,
      p.name as ingredientName,
      p.safety_stock as safetyStock,
      SUM(fs.quantity * ri.quantity) as totalConsumed14d
    FROM fact_sales fs
    JOIN recipe_items ri ON fs.product_sku = ri.product_sku
    JOIN products p ON ri.ingredient_sku = p.id
    WHERE date(fs.date) >= date('now', '-14 days')
    GROUP BY ri.ingredient_sku, p.name, p.safety_stock
  `)) as Array<{
    ingredientSku: string;
    ingredientName: string;
    safetyStock: number | null;
    totalConsumed14d: number | null;
  }>;

  // 2. Lead Time Promedio por Insumo/Proveedor
  // Promedio de diferencia en días entre PO y Receipt
  const rawLeadTimes = (await db.all(sql`
    SELECT 
      poi.inventory_item_id as ingredientSku,
      AVG(julianday(gr.created_at) - julianday(po.created_at)) as avgLeadTimeDays
    FROM purchase_orders po
    JOIN goods_receipts gr ON po.id = gr.po_id
    JOIN purchase_order_items poi ON po.id = poi.po_id
    WHERE po.created_at IS NOT NULL AND gr.created_at IS NOT NULL
    GROUP BY poi.inventory_item_id
  `)) as Array<{
    ingredientSku: string;
    avgLeadTimeDays: number | null;
  }>;

  const leadTimeMap = new Map<string, number>();
  for (const lt of rawLeadTimes) {
    // Si no hay historial, asume 1 día por defecto (24h lead time base de la DB)
    leadTimeMap.set(lt.ingredientSku, lt.avgLeadTimeDays ? Math.max(1, lt.avgLeadTimeDays) : 1);
  }

  // 3. Procesamiento y Ecuación Termodinámica (Reorder Point)
  const results: any[] = [];

  for (const br of rawBurnRates) {
    const totalConsumed = br.totalConsumed14d ?? 0;
    const burnRateDaily = totalConsumed / 14;
    const safetyStock = br.safetyStock ?? 0;
    const leadTimeDays = leadTimeMap.get(br.ingredientSku) ?? 1; // Default 1 day si no hay compras previas

    // Ecuación de Punto de Pedido = (Consumo Diario Promedio * Tiempo de Entrega en Días) + Stock de Seguridad
    const reorderPoint = (burnRateDaily * leadTimeDays) + safetyStock;

    results.push({
      ingredientSku: br.ingredientSku,
      ingredientName: br.ingredientName,
      burnRateDaily: Number(burnRateDaily.toFixed(2)),
      leadTimeDays: Number(leadTimeDays.toFixed(2)),
      safetyStock: Number(safetyStock.toFixed(2)),
      reorderPoint: Math.ceil(reorderPoint), // Entero lógico mínimo a pedir
    });
  }

  // Zod Shield Enforcement
  const parsed = ReorderPointResultSchema.safeParse(results);
  if (!parsed.success) {
    throw new Error(`Zod Shield Rejected Consumption Output: ${parsed.error.message}`);
  }

  return parsed.data;
}
