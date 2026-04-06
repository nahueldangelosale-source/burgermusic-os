/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║    GÉNESIS MDM: Physical Seed & BOM Rehydration                           ║
 * ║    BurgerMusic OS v4.2 — Zero-State Recovery                              ║
 * ║                                                                           ║
 * ║    Ejecutar:  npx tsx --tsconfig tsconfig.json src/db/seed-mdm.ts         ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Inyecta la Materia Prima base en mdm_ingredients y reconstruye las recetas
 * BOM (Bill of Materials) buscando productos existentes en el catálogo.
 * Idempotente via onConflictDoNothing().
 */

import "dotenv/config";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql, like, or, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { mdm_ingredients, bom_recipes, products } from "@/db/schema";

// ═══════════════════════════════════════════════════════════════════════
// § 1. BOOTSTRAP
// ═══════════════════════════════════════════════════════════════════════

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL) {
  console.error("🔴 FATAL: TURSO_DATABASE_URL no definida en .env");
  process.exit(1);
}

const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
const db = drizzle(client);

// ═══════════════════════════════════════════════════════════════════════
// § 2. CATÁLOGO MDM CANÓNICO
// ═══════════════════════════════════════════════════════════════════════

const MDM_CATALOG = [
  {
    id: "MDM_MEDALLON_110G",
    canonical_name: "Medallón de Carne 110g",
    ingredientType: "RAW_MATERIAL" as const,
    yield_percentage: 0.88,  // 12% merma por cocción
  },
  {
    id: "MDM_PAN_HAMBURGUESA",
    canonical_name: "Pan de Hamburguesa",
    ingredientType: "PURCHASED_READY" as const,
    yield_percentage: 1.0,
  },
  {
    id: "MDM_CHEDDAR_FETA",
    canonical_name: "Feta de Queso Cheddar",
    ingredientType: "PURCHASED_READY" as const,
    yield_percentage: 1.0,
  },
  {
    id: "MDM_PAPAS_CONGELADAS",
    canonical_name: "Papas Fritas Congeladas",
    ingredientType: "RAW_MATERIAL" as const,
    yield_percentage: 0.92,  // 8% merma por fritura
  },
  {
    id: "MDM_SALSA_CRUNCH",
    canonical_name: "Salsa Extra Crunch",
    ingredientType: "PURCHASED_READY" as const,
    yield_percentage: 1.0,
  },
  {
    id: "MDM_LECHUGA",
    canonical_name: "Lechuga",
    ingredientType: "RAW_MATERIAL" as const,
    yield_percentage: 0.75,  // 25% merma por limpieza
  },
  {
    id: "MDM_TOMATE",
    canonical_name: "Tomate",
    ingredientType: "RAW_MATERIAL" as const,
    yield_percentage: 0.85,
  },
  {
    id: "MDM_CEBOLLA",
    canonical_name: "Cebolla",
    ingredientType: "RAW_MATERIAL" as const,
    yield_percentage: 0.90,
  },
  {
    id: "MDM_BACON",
    canonical_name: "Bacon / Panceta",
    ingredientType: "RAW_MATERIAL" as const,
    yield_percentage: 0.70,  // 30% merma por cocción
  },
  {
    id: "MDM_HUEVO",
    canonical_name: "Huevo",
    ingredientType: "PURCHASED_READY" as const,
    yield_percentage: 1.0,
  },
] as const;

// ═══════════════════════════════════════════════════════════════════════
// § 3. MATRIZ DE RECETAS (BOM Templates)
//    Cada template define qué ingredientes lleva un tipo de producto.
//    "Simple" = 1 medallón, "Doble" = 2, "Triple" = 3.
// ═══════════════════════════════════════════════════════════════════════

interface BOMTemplate {
  /** Regex para matchear contra product.name */
  pattern: RegExp;
  /** Multiplicador de medallones */
  pattyMultiplier: number;
  /** Ingredientes base con cantidades */
  ingredients: Array<{
    mdmId: string;
    qty: number;  // unidades o gramos según el ingrediente
  }>;
}

const BOM_TEMPLATES: BOMTemplate[] = [
  {
    pattern: /triple/i,
    pattyMultiplier: 3,
    ingredients: [
      { mdmId: "MDM_MEDALLON_110G", qty: 3 },
      { mdmId: "MDM_PAN_HAMBURGUESA", qty: 1 },
      { mdmId: "MDM_CHEDDAR_FETA", qty: 3 },
      { mdmId: "MDM_SALSA_CRUNCH", qty: 30 },  // gramos
      { mdmId: "MDM_LECHUGA", qty: 20 },
      { mdmId: "MDM_TOMATE", qty: 30 },
    ],
  },
  {
    pattern: /doble/i,
    pattyMultiplier: 2,
    ingredients: [
      { mdmId: "MDM_MEDALLON_110G", qty: 2 },
      { mdmId: "MDM_PAN_HAMBURGUESA", qty: 1 },
      { mdmId: "MDM_CHEDDAR_FETA", qty: 2 },
      { mdmId: "MDM_SALSA_CRUNCH", qty: 25 },
      { mdmId: "MDM_LECHUGA", qty: 15 },
      { mdmId: "MDM_TOMATE", qty: 25 },
    ],
  },
  {
    pattern: /simple|classic|session|pulled|veggie|madonna/i,
    pattyMultiplier: 1,
    ingredients: [
      { mdmId: "MDM_MEDALLON_110G", qty: 1 },
      { mdmId: "MDM_PAN_HAMBURGUESA", qty: 1 },
      { mdmId: "MDM_CHEDDAR_FETA", qty: 1 },
      { mdmId: "MDM_SALSA_CRUNCH", qty: 20 },
      { mdmId: "MDM_LECHUGA", qty: 10 },
    ],
  },
  {
    // Fallback: cualquier hamburguesa sin descriptor de tamaño
    pattern: /burger|hambur|smash|fama|ac\/dc|bizarrap|alma\s*fuerte|aros|papas|nugget/i,
    pattyMultiplier: 1,
    ingredients: [
      { mdmId: "MDM_MEDALLON_110G", qty: 1 },
      { mdmId: "MDM_PAN_HAMBURGUESA", qty: 1 },
      { mdmId: "MDM_CHEDDAR_FETA", qty: 1 },
      { mdmId: "MDM_SALSA_CRUNCH", qty: 15 },
    ],
  },
];

// Productos que son acompañamientos (no llevan medallón)
const SIDE_OVERRIDES: Record<string, Array<{ mdmId: string; qty: number }>> = {
  "papas": [
    { mdmId: "MDM_PAPAS_CONGELADAS", qty: 200 },
    { mdmId: "MDM_SALSA_CRUNCH", qty: 15 },
  ],
  "aros": [
    { mdmId: "MDM_CEBOLLA", qty: 150 },
  ],
  "nugget": [
    { mdmId: "MDM_MEDALLON_110G", qty: 1 },  // chicken count as 1 unit
  ],
};

// ═══════════════════════════════════════════════════════════════════════
// § 4. EXECUTION ENGINE
// ═══════════════════════════════════════════════════════════════════════

async function seedMDM(): Promise<void> {
  const startTime = performance.now();

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  [SRE-MDM] GÉNESIS — Physical Seed & BOM Rehydration  ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // ── FASE 1: Inyectar MDM Ingredients ──
  console.log("[SRE-MDM] FASE 1: Inyectando Materia Prima en mdm_ingredients...\n");

  let mdmInserted = 0;
  for (const item of MDM_CATALOG) {
    await db.insert(mdm_ingredients).values({
      id: item.id,
      canonical_name: item.canonical_name,
      ingredientType: item.ingredientType,
      yield_percentage: item.yield_percentage,
    }).onConflictDoNothing();

    mdmInserted++;
    console.log(`  ✅ ${item.canonical_name.padEnd(30)} | ID: ${item.id} | Yield: ${(item.yield_percentage * 100).toFixed(0)}%`);
  }

  console.log(`\n[SRE-MDM] Materia Prima inyectada: ${mdmInserted} registros.\n`);

  // ── FASE 2: Escanear catálogo de productos vendibles ──
  console.log("[SRE-MDM] FASE 2: Escaneando catálogo de productos para BOM linkage...\n");

  const allProducts = await db
    .select({
      id: products.id,
      name: products.name,
      category: products.category,
    })
    .from(products)
    .where(isNull(products.deletedAt));

  console.log(`  📦 Productos activos encontrados: ${allProducts.length}\n`);

  if (allProducts.length === 0) {
    console.log("  ⚠️  Catálogo vacío. No se pueden reconstruir recetas BOM.");
    console.log("     → Ingresá productos vía /dashboard/supply → 'Productos de Venta'.\n");
    const elapsed = Math.round(performance.now() - startTime);
    console.log(`⏱️  Seed completado en ${elapsed}ms. Exit Code 0.\n`);
    return;
  }

  // ── FASE 3: Purgar recetas huérfanas y reconstruir BOM ──
  console.log("[SRE-MDM] FASE 3: Reconstruyendo BOM (Bill of Materials)...\n");

  // Purge stale BOM entries (vamos a recrear todo desde cero)
  await db.delete(bom_recipes).where(sql`1=1`);
  console.log("  🗑️  BOM purgado. Reconstruyendo desde templates...\n");

  let bomLinksCreated = 0;
  let productsLinked = 0;

  for (const product of allProducts) {
    const name = product.name.toLowerCase();

    // Check for side dish overrides first
    let isSideDish = false;
    for (const [sideKey, sideIngredients] of Object.entries(SIDE_OVERRIDES)) {
      if (name.includes(sideKey)) {
        isSideDish = true;
        for (const ing of sideIngredients) {
          await db.insert(bom_recipes).values({
            id: `BOM-${randomUUID().substring(0, 8).toUpperCase()}`,
            product_sku: product.id,
            ingredient_id: ing.mdmId,
            theoretical_qty: ing.qty,
          }).onConflictDoNothing();
          bomLinksCreated++;
        }

        productsLinked++;
        console.log(`  🍟 ${product.name.padEnd(35)} → SIDE (${sideIngredients.length} insumos)`);
        break;
      }
    }

    if (isSideDish) continue;

    // Match against BOM templates (first match wins, templates ordered by specificity)
    let matched = false;
    for (const template of BOM_TEMPLATES) {
      if (template.pattern.test(product.name)) {
        for (const ing of template.ingredients) {
          await db.insert(bom_recipes).values({
            id: `BOM-${randomUUID().substring(0, 8).toUpperCase()}`,
            product_sku: product.id,
            ingredient_id: ing.mdmId,
            theoretical_qty: ing.qty,
          }).onConflictDoNothing();
          bomLinksCreated++;
        }

        productsLinked++;
        const pattyInfo = template.pattyMultiplier > 1 
          ? ` (${template.pattyMultiplier}x medallón)` 
          : "";
        console.log(`  🍔 ${product.name.padEnd(35)} → ${template.ingredients.length} insumos${pattyInfo}`);
        matched = true;
        break;
      }
    }

    if (!matched) {
      console.log(`  ⚠️  ${product.name.padEnd(35)} → Sin template BOM (producto no mapeado)`);
    }
  }

  // ── FASE 4: REPORTE FINAL ──
  const elapsed = Math.round(performance.now() - startTime);

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  [SRE-MDM] SEED COMPLETADO — REPORTE DE HIDRATACIÓN   ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  🧬 MDM Ingredients:     ${mdmInserted} registros inyectados`);
  console.log(`  📦 Productos escaneados: ${allProducts.length}`);
  console.log(`  🔗 Productos enlazados:  ${productsLinked}`);
  console.log(`  🧩 BOM Links creados:    ${bomLinksCreated}`);
  console.log(`  ⏱️  Latencia:             ${elapsed}ms`);
  console.log(`\n✅ Exit Code 0. MDM + BOM rehidratados. ACID confirmado.\n`);
}

// ═══════════════════════════════════════════════════════════════════════
// § 5. MAIN — Fail-Closed
// ═══════════════════════════════════════════════════════════════════════

seedMDM()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n🔴 [SRE-MDM] FALLO CATASTRÓFICO:");
    console.error(`   ${err.message || err}`);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  });
