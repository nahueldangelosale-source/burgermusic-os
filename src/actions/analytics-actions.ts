"use server";

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║    BURN RATE KINETICS — O(1) Consumption Engine                           ║
 * ║    BurgerMusic OS v4.2 — SQLite Analytic Functions                        ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// § TIPOS DE RESPUESTA (Zod-Enforced)
// ─────────────────────────────────────────────────────────────────────────────
const BurnRateSchema = z.object({
  burnRate7d: z.number(),
  burnRate30d: z.number(),
  burnRate60d: z.number(),
  burnRate90d: z.number(),
});

export type BurnRateMetrics = z.infer<typeof BurnRateSchema>;

/**
 * getHistoricalBurnRate
 * ─────────────────────────────────────────────────────────────────────────────
 * Extrae el consumo diario promedio absoluto en ventanas N-day usando
 * funciones analíticas puras de SQLite. CERO extracción de arrays a JS.
 *
 * Fuente: stock_movements WHERE movement_type = 'OUT'
 * El campo `quantity` en movimientos OUT se almacena como valor positivo;
 * representando las unidades consumidas (ventas, merma).
 */
export async function getHistoricalBurnRate(ingredientId: string): Promise<BurnRateMetrics> {
  // Queries the inventory_kardex table where SALE movements have negative quantity
  const result = await db.all<{
    burn_7d: number;
    burn_30d: number;
    burn_60d: number;
    burn_90d: number;
  }>(sql`
    SELECT
      COALESCE(
        SUM(CASE WHEN k.updated_at >= date('now', '-7 days') THEN ABS(k.quantity) ELSE 0 END) / 7.0,
        0
      ) AS burn_7d,
      COALESCE(
        SUM(CASE WHEN k.updated_at >= date('now', '-30 days') THEN ABS(k.quantity) ELSE 0 END) / 30.0,
        0
      ) AS burn_30d,
      COALESCE(
        SUM(CASE WHEN k.updated_at >= date('now', '-60 days') THEN ABS(k.quantity) ELSE 0 END) / 60.0,
        0
      ) AS burn_60d,
      COALESCE(
        SUM(CASE WHEN k.updated_at >= date('now', '-90 days') THEN ABS(k.quantity) ELSE 0 END) / 90.0,
        0
      ) AS burn_90d
    FROM inventory_kardex k
    WHERE k.product_sku = ${ingredientId}
      AND k.movement_type = 'SALE'
  `);

  const row = result[0] || { burn_7d: 0, burn_30d: 0, burn_60d: 0, burn_90d: 0 };

  return BurnRateSchema.parse({
    burnRate7d: Number(row.burn_7d),
    burnRate30d: Number(row.burn_30d),
    burnRate60d: Number(row.burn_60d),
    burnRate90d: Number(row.burn_90d),
  });
}

/**
 * IngredientTelemetry — Estructura de retorno para el componente KardexTelemetry
 */
export interface IngredientTelemetry {
  id: string;
  name: string;
  category: string;
  burnRate: BurnRateMetrics;
  totalConsumed90d: number;
  currentBalance: number;
  autonomyDays: number;
}

/**
 * getBulkBurnRates — Fetches burn rate telemetry for the Top 5 Critical Ingredients.
 * Computes: Burn Rate (7/30/60/90d), Current Balance, and Autonomy Days.
 * Optimized: Single CTE query per ingredient, batched.
 */
export async function getBulkBurnRates(): Promise<IngredientTelemetry[]> {
  // Critical Ingredients (hardcoded IDs from seed-full-mdm.ts)
  const CRITICAL_INGREDIENTS = [
    { id: "MDM_MEDALLON_110G",  name: "Medallón 110g",   category: "CARNES" },
    { id: "MDM_PAN_CLASICO",    name: "Pan Clásico",     category: "PANES" },
    { id: "MDM_CHEDDAR_FETA",   name: "Cheddar Feta",    category: "LÁCTEOS" },
    { id: "MDM_PAPAS_CONGELADAS", name: "Papas Fritas",  category: "CONGELADOS" },
    { id: "MDM_BACON",          name: "Panceta Ahumada", category: "FIAMBRES" },
  ];

  const results: IngredientTelemetry[] = [];

  for (const ing of CRITICAL_INGREDIENTS) {
    try {
      const burnRate = await getHistoricalBurnRate(ing.id);

      // Current balance: sum of all kardex movements for this ingredient
      const balanceResult = await db.all<{ balance: number }>(sql`
        SELECT COALESCE(SUM(quantity), 0) AS balance
        FROM inventory_kardex
        WHERE product_sku = ${ing.id}
      `);
      const currentBalance = Number(balanceResult[0]?.balance ?? 0);

      // Total consumed in 90 days
      const consumed90d = burnRate.burnRate90d * 90;

      // Autonomy: days of stock remaining at current 7d burn rate
      const autonomyDays = burnRate.burnRate7d > 0
        ? Math.round(Math.abs(currentBalance) / burnRate.burnRate7d)
        : currentBalance > 0 ? 999 : 0;

      results.push({
        id: ing.id,
        name: ing.name,
        category: ing.category,
        burnRate,
        totalConsumed90d: Math.round(consumed90d * 100) / 100,
        currentBalance: Math.round(currentBalance * 100) / 100,
        autonomyDays,
      });
    } catch (err) {
      console.error(`[BurnRate] Error fetching telemetry for ${ing.id}:`, err);
      results.push({
        id: ing.id,
        name: ing.name,
        category: ing.category,
        burnRate: { burnRate7d: 0, burnRate30d: 0, burnRate60d: 0, burnRate90d: 0 },
        totalConsumed90d: 0,
        currentBalance: 0,
        autonomyDays: 0,
      });
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// § SUPPLIER DIRECTORY QUERIES (Zero-Trust Server Actions)
// ─────────────────────────────────────────────────────────────────────────────
import { suppliers, mdm_ingredients } from "@/db/schema";
import {
  supplier_skus,
  supplier_item_mappings,
} from "@/db/schema/supply";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";

/**
 * getB2BDirectory — Lista proveedores con conteo de SKUs mapeados vs totales.
 */
export async function getB2BDirectory() {
  const allSuppliers = await db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      cuit: suppliers.cuit,
      phone: suppliers.phone,
      email: suppliers.email,
      paymentTerms: suppliers.paymentTerms,
    })
    .from(suppliers)
    .where(eq(suppliers.active, true));

  const enriched = [];

  for (const s of allSuppliers) {
    const skus = await db
      .select({ id: supplier_skus.id, skuName: supplier_skus.skuName })
      .from(supplier_skus)
      .where(eq(supplier_skus.supplierId, s.id));

    const mappings = await db
      .select({ id: supplier_item_mappings.id })
      .from(supplier_item_mappings)
      .where(eq(supplier_item_mappings.supplierId, s.id));

    enriched.push({
      ...s,
      totalSkus: skus.length,
      mappedSkus: mappings.length,
      unmappedSkus: skus.length - mappings.length,
      skus,
    });
  }

  return enriched;
}

/**
 * getSupplierSkusWithMappings — Drill-down de un proveedor
 */
export async function getSupplierSkusWithMappings(supplierId: string) {
  const skus = await db
    .select({
      id: supplier_skus.id,
      skuName: supplier_skus.skuName,
    })
    .from(supplier_skus)
    .where(eq(supplier_skus.supplierId, supplierId));

  const mappings = await db
    .select({
      id: supplier_item_mappings.id,
      supplierItemName: supplier_item_mappings.supplierItemName,
      internalIngredientId: supplier_item_mappings.internalIngredientId,
      conversionFactor: supplier_item_mappings.conversionFactor,
    })
    .from(supplier_item_mappings)
    .where(eq(supplier_item_mappings.supplierId, supplierId));

  // Cruzar SKUs con sus mappings existentes
  return skus.map((sku) => {
    const mapping = mappings.find(
      (m) => m.supplierItemName === sku.skuName
    );
    return {
      ...sku,
      isMapped: !!mapping,
      mappingId: mapping?.id ?? null,
      mdmIngredientId: mapping?.internalIngredientId ?? null,
      conversionFactor: mapping?.conversionFactor ?? null,
    };
  });
}

/**
 * getMdmIngredientsCatalog — Catálogo MDM para el selector de mapeo
 */
export async function getMdmIngredientsCatalog() {
  return db
    .select({ id: mdm_ingredients.id, name: mdm_ingredients.canonical_name })
    .from(mdm_ingredients);
}

/**
 * saveSkuMapping — Persiste un mapeo ACL (Fricción Positiva)
 */
const SaveMappingInput = z.object({
  supplierId: z.string().min(1),
  supplierItemName: z.string().min(1),
  mdmIngredientId: z.string().min(1),
  conversionFactor: z.number().int().positive(),
});

export async function saveSkuMapping(input: z.infer<typeof SaveMappingInput>) {
  const parsed = SaveMappingInput.parse(input);

  await db
    .insert(supplier_item_mappings)
    .values({
      id: crypto.randomUUID(),
      supplierId: parsed.supplierId,
      supplierItemName: parsed.supplierItemName,
      internalIngredientId: parsed.mdmIngredientId,
      conversionFactor: parsed.conversionFactor,
    })
    .onConflictDoNothing();

  return { success: true };
}
