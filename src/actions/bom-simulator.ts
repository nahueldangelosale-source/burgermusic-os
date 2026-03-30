"use server";

import { db } from "@/db";
import { sql, eq, or, isNull } from "drizzle-orm";
import { z } from "zod";
import { trace } from "@opentelemetry/api";

import { products, fact_sales } from "@/db/schema";
import { raw_materials, sellable_products } from "@/db/schema/bom";

const tracer = trace.getTracer("burgermusic-bom-engine", "1.0.0");

export async function getMasterCatalog() {
  try {
    const result = await db.select({
      id: raw_materials.id,
      name: raw_materials.name,
      category: raw_materials.category,
      base_unit: raw_materials.baseUnit,
      gross_cost_cents: raw_materials.grossCostCents,
    })
    .from(raw_materials)
    .where(isNull(raw_materials.deletedAt))
    .orderBy(raw_materials.name);
    
    return result;
  } catch(err) {
    console.error("Error fetching master catalog from raw_materials HQ:", err);
    return [];
  }
}

export async function getSellableProducts() {
  try {
    const result = await db.select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      category: products.category,
      price: products.sellingPrice,
      margin: products.costCents,
      monthlySalesTarget: sql<number>`COALESCE(SUM(${fact_sales.quantity}), 0)`
    })
    .from(products)
    .leftJoin(fact_sales, or(eq(fact_sales.productSku, products.id), eq(fact_sales.productSku, products.sku)))
    .where(sql`${products.isSaleable} = 1`)
    .groupBy(products.id)
    .orderBy(products.id);

    return result.map(r => ({
      ...r,
      margin: Number(r.margin) || 0,
      price: Number(r.price) || 0,
      monthlySalesTarget: Number(r.monthlySalesTarget) || 0
    }));
  } catch (err: any) {
    console.error("Error fetching sellable products via QB:", err);
    return [];
  }
}

const SimulateSchema = z.object({
  ingredient_id: z.string().min(1),
  inflation_percentage: z.number().min(-100).max(1000),
});

export async function simulateInflationImpact(payload: z.infer<typeof SimulateSchema>) {
  const { ingredient_id, inflation_percentage } = SimulateSchema.parse(payload);
  const multiplier = 1 + (inflation_percentage / 100);

  // CTE Predictivo O(1) de Impacto Inflacionario a través de la red BOM
  const query = sql`
    WITH affected_recipes AS (
      SELECT r.product_sku, r.quantity, p.cost_cents as current_ingredient_cost
      FROM recipe_items r
      JOIN products p ON r.ingredient_sku = p.id
      WHERE r.ingredient_sku = ${ingredient_id}
    ),
    recipe_costs AS (
      SELECT r.product_sku, SUM(r.quantity * ing.cost_cents) as total_cost
      FROM recipe_items r
      JOIN products ing ON r.ingredient_sku = ing.id
      GROUP BY r.product_sku
    )
    SELECT 
      sellable.id as product_id,
      sellable.name as product_name,
      sellable.selling_price as price,
      rc.total_cost as current_cost,
      (sellable.selling_price - rc.total_cost) * 1.0 / NULLIF(sellable.selling_price, 0) * 100 as current_margin_pct,
      
      -- Nuevo costo simulado de la receta
      rc.total_cost + (ar.quantity * ar.current_ingredient_cost * (${multiplier} - 1)) as simulated_cost,
      
      -- Nuevo margen simulado
      (sellable.selling_price - (rc.total_cost + (ar.quantity * ar.current_ingredient_cost * (${multiplier} - 1)))) * 1.0 / NULLIF(sellable.selling_price, 0) * 100 as simulated_margin_pct
      
    FROM affected_recipes ar
    JOIN products sellable ON ar.product_sku = sellable.id
    JOIN recipe_costs rc ON sellable.id = rc.product_sku
    WHERE sellable.is_saleable = 1
  `;

  const res: any = await db.run(query);
  return res.rows?.map((r: any) => ({ ...r })) || [];
}

const ApplySchema = z.object({
  ingredient_id: z.string().min(1),
  new_cost_cents: z.number().min(0),
});

import { authenticatedAction } from "@/lib/auth-action";
import { withTenant } from "@/lib/tenant-db";

export const applyNewCostsToLedger = authenticatedAction(async (payload: z.infer<typeof ApplySchema>, { user }) => {
  const { ingredient_id, new_cost_cents } = ApplySchema.parse(payload);
  const tenant = withTenant({ user });
  
  // Mutación atómica con aislamiento de sucursal
  await tenant.unsafeRaw.run(sql`UPDATE products SET cost_cents = ${new_cost_cents} WHERE id = ${ingredient_id}`);
  
  return { success: true };
});

export const upsertRawMaterial = authenticatedAction(async (payload: any, { user }) => {
  const tenant = withTenant({ user });
  const rawId = payload.id || `RAW-${payload.name?.replace(/\s+/g, '-').toUpperCase().slice(0, 15)}-${Math.random().toString(36).substring(7).toUpperCase()}`;
  
  await tenant.insert(raw_materials).values([{
    id: rawId,
    supplierId: "UNKNOWN",
    name: payload.name?.toUpperCase() || "SIN NOMBRE",
    category: payload.category || "INGREDIENTES",
    baseUnit: payload.baseUnit || "UNIT",
    grossCostCents: payload.grossCostCents || 0,
    historicalYieldPct: payload.historicalYieldPct || 1.0,
    trueCostPerUnitCents: payload.grossCostCents || 0,
  }]).onConflictDoUpdate({
    target: raw_materials.id,
    set: {
      name: payload.name?.toUpperCase(),
      category: payload.category,
      baseUnit: payload.baseUnit,
      grossCostCents: payload.grossCostCents,
      historicalYieldPct: payload.historicalYieldPct,
      trueCostPerUnitCents: payload.grossCostCents,
    }
  });

  return { success: true };
});

export const deleteRawMaterial = authenticatedAction(async (id: string, { user }) => {
  const tenant = withTenant({ user });
  await tenant.update(raw_materials).set({ deletedAt: new Date() }).where(sql`${raw_materials.id} = ${id}`);
  return { success: true };
});
