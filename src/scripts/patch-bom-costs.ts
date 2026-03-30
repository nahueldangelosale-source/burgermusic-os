import "dotenv/config";
import { db } from "../db";
import { products, recipe_items } from "../db/schema";
import { raw_materials } from "../db/schema/bom";
import { eq, sql } from "drizzle-orm";

/**
 * PATCH-BOM-COSTS (Antigravity 2026 — P0 Remediation)
 * ────────────────────────────────────────────────────
 * Deterministic patch for raw_materials costs and recipe_items.
 * Fixes 100% gross margin anomaly caused by $0 cost seeding.
 */

// ═══════════════════════════════════════════════════
// 1. ZERO-TRUST CLI VALIDATION
// ═══════════════════════════════════════════════════
const storeIdArg = process.argv.find((a) => a.startsWith("--store-id="));
const storeId = storeIdArg?.split("=")[1];

if (!storeId) {
  console.error("❌ FATAL: Missing --store-id argument.");
  console.error("Usage: npx tsx src/scripts/patch-bom-costs.ts --store-id=STORE001");
  process.exit(1);
}

// ═══════════════════════════════════════════════════
// 2. HARDCODED COST DICTIONARY (C-Level Approved)
// ═══════════════════════════════════════════════════
const MATERIAS_PRIMAS = [
  { sku: "PAN_HAMBURGUESA", name: "Pan de Hamburguesa", cost_cents: 25000, purchaseUnit: "UNIDAD", recipeUnit: "UNIDAD", conversionFactor: 1 },
  { sku: "MEDALLON_110G", name: "Medallón de Carne", cost_cents: 65000, purchaseUnit: "UNIDAD", recipeUnit: "GRAMOS", conversionFactor: 110 },
  { sku: "CHEDDAR_FETA", name: "Feta de Cheddar", cost_cents: 15000, purchaseUnit: "PAQUETE", recipeUnit: "UNIDAD", conversionFactor: 48 },
  { sku: "PANCETA_AHUMADA", name: "Panceta Ahumada", cost_cents: 30000, purchaseUnit: "KILO", recipeUnit: "PORCION", conversionFactor: 20 },
  { sku: "CEBOLLA_CRISPY", name: "Cebolla Crispy", cost_cents: 10000, purchaseUnit: "KILO", recipeUnit: "PORCION", conversionFactor: 40 },
  { sku: "SALSA_MFA", name: "Salsa Mala Fama", cost_cents: 5000, purchaseUnit: "LITRO", recipeUnit: "PORCION", conversionFactor: 50 },
];

// ═══════════════════════════════════════════════════
// 3. DETERMINISTIC BOM RECIPE MAP
//    Keys = exact product SKU IDs in the database
// ═══════════════════════════════════════════════════
const RECETAS_CORE: Record<string, { displayName: string; ingredients: Record<string, number> }> = {
  "PROD-CLASSIC": {
    displayName: "Classic (base recipe)",
    ingredients: { PAN_HAMBURGUESA: 1, MEDALLON_110G: 110, CHEDDAR_FETA: 2 },
  },
  "PROD-MALA-FAMA": {
    displayName: "Mala Fama (base recipe)",
    ingredients: { PAN_HAMBURGUESA: 1, MEDALLON_110G: 110, CHEDDAR_FETA: 2, PANCETA_AHUMADA: 1, SALSA_MFA: 1 },
  },
  "PROD-AC/DC": {
    displayName: "AC/DC",
    ingredients: { PAN_HAMBURGUESA: 1, MEDALLON_110G: 220, CHEDDAR_FETA: 4, CEBOLLA_CRISPY: 1 },
  },
  "PROD-CHARLY": {
    displayName: "Charly",
    ingredients: { PAN_HAMBURGUESA: 1, MEDALLON_110G: 220, CHEDDAR_FETA: 4 },
  },
  "PROD-DUKO": {
    displayName: "Duko",
    ingredients: { PAN_HAMBURGUESA: 1, MEDALLON_110G: 220, CHEDDAR_FETA: 4 },
  },
  "PROD-THE-BEATLES": {
    displayName: "The Beatles",
    ingredients: { PAN_HAMBURGUESA: 1, MEDALLON_110G: 220, CHEDDAR_FETA: 4 },
  },
  "PROD-GORILLAZ": {
    displayName: "Gorillaz",
    ingredients: { PAN_HAMBURGUESA: 1, MEDALLON_110G: 220, CHEDDAR_FETA: 4 },
  },
  "PROD-RED-HOT": {
    displayName: "Red Hot",
    ingredients: { PAN_HAMBURGUESA: 1, MEDALLON_110G: 110, CHEDDAR_FETA: 2 },
  },
  "PROD-RESIDENTE": {
    displayName: "Residente",
    ingredients: { PAN_HAMBURGUESA: 1, MEDALLON_110G: 110, CHEDDAR_FETA: 2 },
  },
  "PROD-ROLLING-STONES": {
    displayName: "Rolling Stones",
    ingredients: { PAN_HAMBURGUESA: 1, MEDALLON_110G: 110, CHEDDAR_FETA: 2 },
  },
};

// ═══════════════════════════════════════════════════
// 4. ATOMIC PATCH RUNTIME
// ═══════════════════════════════════════════════════
async function run() {
  console.log(`🔧 Patch BOM Costs — Store: [${storeId}]\n`);

  await db.transaction(async (tx) => {

    // ── PHASE 1: Upsert Raw Materials with Real Costs ──
    for (const mat of MATERIAS_PRIMAS) {
      const rawId = `RAW-${mat.sku}`;

      // Mirror in products for FK integrity
      await tx.insert(products).values({
        id: rawId,
        sku: rawId,
        name: mat.name.toUpperCase(),
        category: "INGREDIENTES",
        item_type: "MANUFACTURED",
        isSaleable: false,
        costCents: mat.cost_cents,
      }).onConflictDoUpdate({
        target: products.id,
        set: {
          name: mat.name.toUpperCase(),
          costCents: mat.cost_cents,
        },
      });

      // Upsert raw_materials with cost + UOM
      await tx.insert(raw_materials).values({
        id: rawId,
        supplierId: "UNKNOWN",
        name: mat.name.toUpperCase(),
        category: "INGREDIENTES",
        baseUnit: mat.recipeUnit,
        purchaseUnit: mat.purchaseUnit,
        recipeUnit: mat.recipeUnit,
        conversionFactor: mat.conversionFactor,
        grossCostCents: mat.cost_cents,
        trueCostPerUnitCents: Math.round(mat.cost_cents / mat.conversionFactor),
      }).onConflictDoUpdate({
        target: raw_materials.id,
        set: {
          name: mat.name.toUpperCase(),
          grossCostCents: mat.cost_cents,
          trueCostPerUnitCents: Math.round(mat.cost_cents / mat.conversionFactor),
          purchaseUnit: mat.purchaseUnit,
          recipeUnit: mat.recipeUnit,
          conversionFactor: mat.conversionFactor,
        },
      });
    }
    console.log(`[INFO] Costos actualizados. ${MATERIAS_PRIMAS.length} materias primas patcheadas.`);

    // ── PHASE 2: Purge existing recipe_items (Soft Delete) ──
    await tx.update(recipe_items).set({ deletedAt: new Date() });
    console.log(`[INFO] recipe_items existentes marcados como deletedAt (inmutabilidad forense).`);

    // ── PHASE 3: Rebuild Deterministic BOM ──
    for (const [productSku, recipe] of Object.entries(RECETAS_CORE)) {
      // Defensive parent product creation
      await tx.insert(products).values({
        id: productSku,
        sku: productSku,
        name: recipe.displayName.toUpperCase(),
        category: "HAMBURGUESAS",
        item_type: "MANUFACTURED",
        isSaleable: true,
      }).onConflictDoNothing();

      // Insert recipe items
      const ingredientEntries = Object.entries(recipe.ingredients);
      for (const [matSku, quantity] of ingredientEntries) {
        const rawId = `RAW-${matSku}`;

        await tx.insert(recipe_items).values({
          productSku,
          ingredientSku: rawId,
          quantity,
        }).onConflictDoUpdate({
          target: [recipe_items.productSku, recipe_items.ingredientSku],
          set: { quantity, deletedAt: null },
        });
      }

      console.log(`[INFO] Receta "${recipe.displayName}" ensamblada exitosamente con ${ingredientEntries.length} ingredientes.`);
    }

    // ── PHASE 4: Propagate costs to sellable products ──
    for (const [productSku, recipe] of Object.entries(RECETAS_CORE)) {
      let totalCostCents = 0;

      for (const [matSku, quantity] of Object.entries(recipe.ingredients)) {
        const mat = MATERIAS_PRIMAS.find((m) => m.sku === matSku);
        if (mat) {
          const unitCost = mat.cost_cents / mat.conversionFactor;
          totalCostCents += Math.round(unitCost * quantity);
        }
      }

      await tx.update(products).set({ costCents: totalCostCents }).where(eq(products.id, productSku));
      console.log(`[INFO] Costo propagado: "${recipe.displayName}" -> $${(totalCostCents / 100).toFixed(2)}`);
    }
  });

  console.log(`\n✅ PATCH COMPLETE. BOM & UOM layer is now financially consistent.`);
}

run().catch((err) => {
  console.error("❌ FATAL PATCH FAILURE:", err);
  process.exit(1);
});
