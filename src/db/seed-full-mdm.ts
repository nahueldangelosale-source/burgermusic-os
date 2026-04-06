/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║    MDM CATEGORY REHYDRATION — Full Physical Catalog Seed                   ║
 * ║    BurgerMusic OS v4.2 — Zero-State Recovery                              ║
 * ║                                                                           ║
 * ║    Ejecutar:  npx tsx --tsconfig tsconfig.json src/db/seed-full-mdm.ts    ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Inyecta el catálogo completo categorizado y preparado para manufactura.
 * Idempotente via onConflictDoNothing().
 */

import "dotenv/config";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mdm_ingredients } from "@/db/schema";
import type { MDMCategory, IngredientType } from "@/db/schema";

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
// § 2. CATÁLOGO COMPLETO
// ═══════════════════════════════════════════════════════════════════════

interface CatalogItem {
  id: string;
  name: string;
  category: MDMCategory;
  type: IngredientType;
}

const FULL_CATALOG: CatalogItem[] = [
  // ── CARNES ──
  { id: "MDM_ROAST_BEEF", name: "Roast Beef", category: "CARNES", type: "RAW_MATERIAL" },
  { id: "MDM_TAPA_ASADO", name: "Tapa de Asado", category: "CARNES", type: "RAW_MATERIAL" },
  { id: "MDM_GRASA_VACUNA", name: "Grasa Vacuna", category: "CARNES", type: "RAW_MATERIAL" },
  { id: "MDM_MEDALLON_110G", name: "Medallón de Carne 110g", category: "CARNES", type: "INTERMEDIATE" },
  { id: "MDM_MEDALLON_POLLO_CRUNCH", name: "Medallón de Pollo Crunch", category: "CARNES", type: "PURCHASED_READY" },
  { id: "MDM_BONDIOLA_DESMENUZADA", name: "Bondiola Desmenuzada", category: "CARNES", type: "PURCHASED_READY" },

  // ── PANES ──
  { id: "MDM_PAN_CLASICO", name: "Pan de Hamburguesa Clásico", category: "PANES", type: "PURCHASED_READY" },
  { id: "MDM_PAN_QUESO", name: "Pan de Queso", category: "PANES", type: "PURCHASED_READY" },
  { id: "MDM_PAN_CROISSANT", name: "Pan Croissant", category: "PANES", type: "PURCHASED_READY" },
  { id: "MDM_PAN_PIZZA", name: "Pan de Pizza", category: "PANES", type: "PURCHASED_READY" },

  // ── LACTEOS Y FIAMBRES ──
  { id: "MDM_CHEDDAR_FETA", name: "Feta de Queso Cheddar", category: "LACTEOS_Y_FIAMBRES", type: "PURCHASED_READY" },
  { id: "MDM_CHEDDAR_LIQUIDO", name: "Cheddar Líquido Pouch", category: "LACTEOS_Y_FIAMBRES", type: "PURCHASED_READY" },
  { id: "MDM_BACON", name: "Panceta Ahumada", category: "LACTEOS_Y_FIAMBRES", type: "PURCHASED_READY" },
  { id: "MDM_PROVOLETA", name: "Queso Provoleta", category: "LACTEOS_Y_FIAMBRES", type: "PURCHASED_READY" },
  { id: "MDM_QUESO_DAMBO", name: "Queso Dambo", category: "LACTEOS_Y_FIAMBRES", type: "PURCHASED_READY" },
  { id: "MDM_HUEVO", name: "Huevo", category: "LACTEOS_Y_FIAMBRES", type: "PURCHASED_READY" },
  { id: "MDM_JAMON", name: "Jamón", category: "LACTEOS_Y_FIAMBRES", type: "PURCHASED_READY" },

  // ── VEGETALES ──
  { id: "MDM_CEBOLLA_MORADA", name: "Cebolla Morada", category: "VEGETALES", type: "RAW_MATERIAL" },
  { id: "MDM_CEBOLLA_CRISPY", name: "Cebolla Crispy", category: "VEGETALES", type: "PURCHASED_READY" },
  { id: "MDM_CEBOLLA_CARAMEL", name: "Cebolla Caramelizada", category: "VEGETALES", type: "PURCHASED_READY" },
  { id: "MDM_TOMATE", name: "Tomate", category: "VEGETALES", type: "RAW_MATERIAL" },
  { id: "MDM_LECHUGA", name: "Lechuga", category: "VEGETALES", type: "RAW_MATERIAL" },
  { id: "MDM_MORRON_ASADO", name: "Morrones Asados", category: "VEGETALES", type: "PURCHASED_READY" },
  { id: "MDM_PEPINOS", name: "Pepinos", category: "VEGETALES", type: "PURCHASED_READY" },
  { id: "MDM_RUCULA", name: "Rúcula", category: "VEGETALES", type: "RAW_MATERIAL" },

  // ── SALSAS Y ADEREZOS ──
  { id: "MDM_SALSA_CUARTO", name: "Salsa Cuarto", category: "SALSAS_Y_ADEREZOS", type: "PURCHASED_READY" },
  { id: "MDM_SALSA_BARBACOA", name: "Salsa Barbacoa", category: "SALSAS_Y_ADEREZOS", type: "PURCHASED_READY" },
  { id: "MDM_SALSA_TASTY", name: "Salsa Tasty", category: "SALSAS_Y_ADEREZOS", type: "PURCHASED_READY" },
  { id: "MDM_SALSA_BIG_MAC", name: "Salsa Big Mac", category: "SALSAS_Y_ADEREZOS", type: "PURCHASED_READY" },
  { id: "MDM_SALSA_SWEET_CHILI", name: "Salsa Sweet Chili", category: "SALSAS_Y_ADEREZOS", type: "PURCHASED_READY" },
  { id: "MDM_SALSA_GUACAMOLE", name: "Salsa Guacamole", category: "SALSAS_Y_ADEREZOS", type: "PURCHASED_READY" },

  // ── CONGELADOS ──
  { id: "MDM_PAPAS_CONGELADAS", name: "Papas Fritas", category: "CONGELADOS", type: "PURCHASED_READY" },
  { id: "MDM_AROS_CEBOLLA", name: "Aros de Cebolla", category: "CONGELADOS", type: "PURCHASED_READY" },
  { id: "MDM_NUGGETS", name: "Nuggets de Pollo", category: "CONGELADOS", type: "PURCHASED_READY" },
];

async function seedFullMDM(): Promise<void> {
  const startTime = performance.now();

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  [SRE-MDM] SEED COMPLETO — MDM V4.2 CATEGORIZADO       ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  let inserted = 0;

  for (const item of FULL_CATALOG) {
    await db.insert(mdm_ingredients).values({
      id: item.id,
      canonical_name: item.name,
      category: item.category,
      ingredientType: item.type,
      yield_percentage: 1.0,
    }).onConflictDoNothing();
    
    inserted++;
    console.log(`  ✅ [${item.category.padEnd(17)}] ${item.name.padEnd(30)} → ${item.type}`);
  }

  const elapsed = Math.round(performance.now() - startTime);

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  [SRE-MDM] REPORTE FINAL                               ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  📦 Total Registros procesados: ${inserted}`);
  console.log(`  ⏱️  Latencia: ${elapsed}ms`);
  console.log(`\n✅ Exit Code 0. Catálogo Físico MDM Completo y Categorizado.\n`);
}

seedFullMDM()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n🔴 [SRE-MDM] FALLO CATASTRÓFICO:");
    console.error(`   ${err.message || err}`);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  });
