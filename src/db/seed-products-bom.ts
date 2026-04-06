/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║    SRE ENGINE: COMERCIAL GENESIS & BOM REHYDRATION                          ║
 * ║    BurgerMusic OS v4.2 — POS Catalog Seed                                   ║
 * ║                                                                           ║
 * ║    Ejecutar:  npx tsx --tsconfig tsconfig.json src/db/seed-products-bom.ts  ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import "dotenv/config";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { randomUUID } from "node:crypto";

import { products, mdm_ingredients } from "@/db/schema";
import { bill_of_materials } from "@/db/schema/bom";

// ═══════════════════════════════════════════════════════════════════════
// § 1. BOOTSTRAP TURSO
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
// § 2. RECETAS TARGET & CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════

const POS_PRODUCTS = [
  { name: "ACDC Doble", sku: "POS-ACDC-DBL" },
  { name: "Mala Fama Doble 220g", sku: "POS-MALA-DBL" },
  { name: "Clasic Doble 220g", sku: "POS-CLSC-DBL" },
  { name: "Charly Simple 110g", sku: "POS-CHRLY-SGL" },
  { name: "Papas con Cheddar", sku: "POS-PAPAS-CHD" },
];

const RECIPES_CONFIG = {
  "ACDC Doble": [
    { canonicalName: "Medallón de Carne 110g", qty: 2 },
    { canonicalName: "Pan de Hamburguesa Clásico", qty: 1 },
    { canonicalName: "Feta de Queso Cheddar", qty: 2 },
    { canonicalName: "Panceta Ahumada", qty: 1 }, // Unidad default o fetas
  ],
  "Mala Fama Doble 220g": [
    { canonicalName: "Medallón de Carne 110g", qty: 2 },
    { canonicalName: "Pan de Hamburguesa Clásico", qty: 1 },
    { canonicalName: "Feta de Queso Cheddar", qty: 2 },
    { canonicalName: "Cebolla Caramelizada", qty: 1 }, // Porcion 1
  ],
  "Clasic Doble 220g": [
    { canonicalName: "Medallón de Carne 110g", qty: 2 },
    { canonicalName: "Pan de Hamburguesa Clásico", qty: 1 },
    { canonicalName: "Feta de Queso Cheddar", qty: 2 },
  ],
  "Charly Simple 110g": [
    { canonicalName: "Medallón de Carne 110g", qty: 1 },
    { canonicalName: "Pan de Hamburguesa Clásico", qty: 1 },
    { canonicalName: "Feta de Queso Cheddar", qty: 1 },
  ],
  "Papas con Cheddar": [
    { canonicalName: "Papas Fritas", qty: 250 },           // Gramos
    { canonicalName: "Cheddar Líquido Pouch", qty: 50 },     // Gramos
    { canonicalName: "Panceta Ahumada", qty: 30 },         // Gramos
  ],
};

// ═══════════════════════════════════════════════════════════════════════
// § 2.5 DICCIONARIO DE COERCIÓN SEMÁNTICA O(1)
//   Resuelve Impedance Mismatch entre nombres de receta y MDM canónico.
//   Si una clave aparece en el mapa, se muta ANTES de buscar el UUID.
// ═══════════════════════════════════════════════════════════════════════

const SEMANTIC_COERCION_MAP: Record<string, string> = {
  // POS / Receta                 → MDM Canonical
  "Papas Fritas":                  "Papas Fritas",
  "Papas":                         "Papas Fritas",
  "Papas Fritas Congeladas":       "Papas Fritas",
  "Panceta":                       "Panceta Ahumada",
  "Bacon":                         "Panceta Ahumada",
  "Cheddar":                       "Feta de Queso Cheddar",
  "Cheddar Feta":                  "Feta de Queso Cheddar",
  "Cheddar Liquido":               "Cheddar Líquido Pouch",
  "Pan":                           "Pan de Hamburguesa Clásico",
  "Pan Hamburguesa":               "Pan de Hamburguesa Clásico",
  "Medallon":                      "Medallón de Carne 110g",
  "Medallon de Carne":             "Medallón de Carne 110g",
  "Medallon 110":                  "Medallón de Carne 110g",
  "Nuggets":                       "Nuggets de Pollo",
  "Cebolla":                       "Cebolla Morada",
  "Cebolla Caramelizada":          "Cebolla Caramelizada",
};

/**
 * resolveCanonicalName — O(1) Semantic Bridge
 * Si el nombre existe en el diccionario, retorna el valor canónico.
 * De lo contrario, retorna el nombre original (passthrough).
 */
function resolveCanonicalName(input: string): string {
  // Intentar match exacto (case-insensitive)
  for (const [key, value] of Object.entries(SEMANTIC_COERCION_MAP)) {
    if (key.toLowerCase() === input.toLowerCase()) {
      return value;
    }
  }
  return input;
}

// ═══════════════════════════════════════════════════════════════════════
// § 3. EJECUCIÓN (DATA SEEDING BOM)
// ═══════════════════════════════════════════════════════════════════════

async function seedProductsBOM() {
  const startTime = performance.now();
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  [SRE-BOM] COMERCIAL GENESIS & BOM REHYDRATION         ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // 1. Obtener Base Line de MDM
  const mdmDb = await db.select().from(mdm_ingredients).all();
  if (mdmDb.length === 0) {
    console.error("🔴 Fatal: La tabla mdm_ingredients está vacía. Falla Cerrada.");
    process.exit(1);
  }

  // 2. Fetch Catalog Actual
  const currentProducts = await db.select().from(products).all();
  const currentBomRows = await db.select().from(bill_of_materials).all();

  console.log(`[SRE-BOM] Sincronizando catálogo de ${POS_PRODUCTS.length} productos POS...`);

  let newProductsCount = 0;
  let newBomCount = 0;

  for (const posProd of POS_PRODUCTS) {
    // --- INSERT PRODUCT ---
    let prodEntity = currentProducts.find(p => p.name.toLowerCase() === posProd.name.toLowerCase());
    
    if (!prodEntity) {
      const newId = `PRD-${randomUUID().substring(0, 10).toUpperCase()}`;
      await db.insert(products).values({
        id: newId,
        sku: posProd.sku,
        name: posProd.name,
        isSaleable: true,            // Debe aparecer en POS / Analytics
        unit: "UNIDAD",
        item_type: "MANUFACTURED",
        category: "BURGERS",         // Opcional
      }).onConflictDoNothing();
      
      console.log(`  ✅ [PRODUCT] Creado: ${posProd.name} (${newId})`);
      
      // Update our local cache object so we can map BOM correctly
      prodEntity = { id: newId, name: posProd.name } as any;
      newProductsCount++;
    } else {
      console.log(`  🔹 [PRODUCT] Existente: ${posProd.name} (${prodEntity.id})`);
    }

    // --- EXPLOSIÓN BOM ---
    const recipeConfig = RECIPES_CONFIG[posProd.name as keyof typeof RECIPES_CONFIG];
    if (!recipeConfig || !prodEntity) continue;

    console.log(`      ↳ Empalmando ${recipeConfig.length} enlaces moleculares...`);

    for (const link of recipeConfig) {
      // Phase 1: Semantic Coercion (Anti-Drift) — Resolve variant names to MDM canonical
      const coercedName = resolveCanonicalName(link.canonicalName);
      if (coercedName !== link.canonicalName) {
        console.log(`        🔄 [COERCION] "${link.canonicalName}" → "${coercedName}"`);
      }

      // Find UUID in MDM by coerced canonical name
      const mdmMatch = mdmDb.find(m => m.canonical_name.toLowerCase() === coercedName.toLowerCase());
      if (!mdmMatch) {
         console.warn(`        ⚠️ [SRE-WARN] MDM Ingredient No Encontrado: "${coercedName}" (original: "${link.canonicalName}"). Esquivando.`);
         continue;
      }

      // Check if this explicit link already exists
      const existingLink = currentBomRows.find(b => b.parentId === prodEntity!.id && b.childId === mdmMatch.id);
      
      if (!existingLink) {
         await db.insert(bill_of_materials).values({
            id: `BOM-${randomUUID().substring(0, 8).toUpperCase()}`,
            parentId: prodEntity.id,
            childId: mdmMatch.id,
            quantity: link.qty,
            unitMultiplier: 1.0,
         }).onConflictDoNothing();
         newBomCount++;
         console.log(`        ➕ [BOM] Enlazado: ${mdmMatch.canonical_name} x${link.qty}`);
      } else {
         console.log(`        ⚡ [BOM] Ya enlazado: ${mdmMatch.canonical_name}`);
      }
    }
  }

  const elapsed = Math.round(performance.now() - startTime);

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  [SRE-BOM] INYECCIÓN CULMINADA                         ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  🍔 Productos Creados:    ${newProductsCount}`);
  console.log(`  💥 Enlaces Moleculares:  ${newBomCount}`);
  console.log(`  ⏱️  Latencia:            ${elapsed}ms`);
  console.log(`\n✅ Exit Code 0. El catálogo POS está vivo y termodinámicamente ligado al MDM.\n`);
}

seedProductsBOM()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n🔴 [SRE-BOM] FALLO CATASTRÓFICO DURANTE SEEDING:");
    console.error(err.message || err);
    process.exit(1);
  });
