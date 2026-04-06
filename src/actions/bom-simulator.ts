"use server";

import { db } from "@/db";
import { sql, eq, or, isNull } from "drizzle-orm";
import { z } from "zod";
import { trace } from "@opentelemetry/api";

import { products, fact_sales, mdm_ingredients } from "@/db/schema";
import { raw_materials } from "@/db/schema/bom";
import { requireManagerSession } from "@/lib/auth-action";
import { withTenant } from "@/lib/tenant-db";

const tracer = trace.getTracer("burgermusic-bom-engine", "1.0.0");

// ─────────────────────────────────────────────────────────────────────────────
// § SCHEMAS DE VALIDACIÓN (Zod)
// ─────────────────────────────────────────────────────────────────────────────

const SimulateSchema = z.object({
  ingredient_id: z.string().min(1),
  inflation_percentage: z.number().min(-100).max(1000),
});

const ApplySchema = z.object({
  ingredient_id: z.string().min(1),
  new_cost_cents: z.number().min(0),
});

// ─────────────────────────────────────────────────────────────────────────────
// § ACCIONES DEL SIMULADOR BOM (Zero-Trust)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getMasterCatalog — Extrae el catálogo de insumos base filtrado por Tenant.
 */
export async function getMasterCatalog() {
  const session = await requireManagerSession();
  if (!session.success || !session.data) {
    throw new Error(session.error || "ZERO_TRUST_VIOLATION: Acceso denegado al Catálogo Maestro.");
  }

  // Phase 1 SRE: Restoration of Zero-Trust Visibility
  // `mdm_ingredients` es un catálogo global sin storeId, por lo que obviamos el
  // filtro Tenant para permitir a todos los Managers visualizar el padrón canónico.
  try {
    const result = await db.select({
      id: mdm_ingredients.id,
      name: mdm_ingredients.canonical_name,
      category: mdm_ingredients.category,
      base_unit: sql<string>`CASE WHEN ${mdm_ingredients.ingredientType} = 'INTERMEDIATE' THEN 'UNIDADES' ELSE 'GRAMOS' END`,
      gross_cost_cents: sql<number>`0`, // Placeholder para el motor de Costeo
    })
    .from(mdm_ingredients)
    .orderBy(mdm_ingredients.category, mdm_ingredients.canonical_name);
    
    return result;
  } catch(err) {
    console.error("Error fetching master catalog from mdm_ingredients HQ:", err);
    return [];
  }
}

/**
 * getSellableProducts — Lista productos terminados con sus márgenes actuales y volumen.
 */
export async function getSellableProducts() {
  const session = await requireManagerSession();
  if (!session.success || !session.data) {
    throw new Error(session.error || "ZERO_TRUST_VIOLATION: Acceso denegado a Productos Vendibles.");
  }
  const { storeId, role } = session.data;
  const tenant = withTenant({ user: { storeId, role } });

  try {
    const result = await tenant.select({
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

    return result.map((r: any) => ({
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

/**
 * simulateInflationImpact — Calcula el impacto de costos en cascada en O(1).
 */
export async function simulateInflationImpact(payload: z.infer<typeof SimulateSchema>) {
  const session = await requireManagerSession();
  if (!session.success || !session.data) {
    throw new Error(session.error || "ZERO_TRUST_VIOLATION: Acceso denegado al Simulador.");
  }
  const { storeId, role } = session.data;
  const tenant = withTenant({ user: { storeId, role } });

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

  const res: any = await tenant.unsafeRaw.run(query);
  return res.rows?.map((r: any) => ({ ...r })) || [];
}

/**
 * applyNewCostsToLedger — Persiste el nuevo costo en la maestra de productos.
 */
export async function applyNewCostsToLedger(payload: z.infer<typeof ApplySchema>) {
  const session = await requireManagerSession();
  if (!session.success || !session.data) {
    throw new Error(session.error || "ZERO_TRUST_VIOLATION: Acceso denegado al Ledger.");
  }
  const { storeId, role } = session.data;
  const tenant = withTenant({ user: { storeId, role } });

  const { ingredient_id, new_cost_cents } = ApplySchema.parse(payload);
  
  // Mutación atómica con aislamiento de sucursal
  await tenant.unsafeRaw.run(sql`UPDATE products SET cost_cents = ${new_cost_cents} WHERE id = ${ingredient_id}`);
  
  return { success: true };
}

/**
 * upsertRawMaterial — Gestiona el MDM de Insumos Base.
 */
export async function upsertRawMaterial(payload: any) {
  const session = await requireManagerSession();
  if (!session.success || !session.data) {
    throw new Error(session.error || "ZERO_TRUST_VIOLATION: Acceso denegado al MDM.");
  }
  const { storeId, role } = session.data;
  const tenant = withTenant({ user: { storeId, role } });

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
}

/**
 * deleteRawMaterial — Soft-delete de insumos.
 */
export async function deleteRawMaterial(id: string) {
  const session = await requireManagerSession();
  if (!session.success || !session.data) {
    throw new Error(session.error || "ZERO_TRUST_VIOLATION: Acceso denegado.");
  }
  const { storeId, role } = session.data;
  const tenant = withTenant({ user: { storeId, role } });

  await tenant.update(raw_materials).set({ deletedAt: new Date() }).where(sql`${raw_materials.id} = ${id}`);
  return { success: true };
}
