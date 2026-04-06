/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║    ACL GENESIS V2: Supplier Item Mappings for Raw Material Yield          ║
 * ║    BurgerMusic OS v4.2 — Yield Station Dependency                         ║
 * ║                                                                           ║
 * ║    Ejecutar:  npx tsx --tsconfig tsconfig.json src/db/seed-acl-v2.ts      ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import "dotenv/config";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { randomUUID } from "node:crypto";

import { suppliers, mdm_ingredients } from "@/db/schema";
import { supplier_item_mappings, supplier_ingredients } from "@/db/schema/supply";

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
// § 2. CONFIGURACIÓN DE REHIDRATACIÓN ACL
// ═══════════════════════════════════════════════════════════════════════

interface AclV2Mapping {
  supplierRegex: RegExp;
  mdmId: string;
  supplierItemName: string; // Nombre sucio de factura
  conversionFactor: number; // Factor hacia UNIDAD BASE MDM (Gramos)
  
  // Extra fields for Procurement Daemon (DRAFT POs)
  lppCents: number;
  isPreferred: boolean;
  leadTimeHours: number;
  purchaseUnit: string;
  moq: number;
}

const MAPPINGS: AclV2Mapping[] = [
  {
    supplierRegex: /av[ií]cola|lan[uú]s|frigor/i,
    mdmId: "MDM_ROAST_BEEF",
    supplierItemName: "ROAST BEEF MEDIA RES",
    conversionFactor: 1000, 
    lppCents: 580000, // $5.800 / KG
    isPreferred: true,
    leadTimeHours: 48,
    purchaseUnit: "KG",
    moq: 20, // Minimo 20KG
  },
  {
    supplierRegex: /av[ií]cola|lan[uú]s|frigor/i,
    mdmId: "MDM_TAPA_ASADO",
    supplierItemName: "TAPA DE ASADO PRIMERA",
    conversionFactor: 1000, 
    lppCents: 620000, // $6.200 / KG
    isPreferred: true,
    leadTimeHours: 48,
    purchaseUnit: "KG",
    moq: 15,
  },
  {
    supplierRegex: /don mart[ií]n|granja|albean/i, // Don Martin for grasa
    mdmId: "MDM_GRASA_VACUNA",
    supplierItemName: "GRASA REFINADA PREMIUM CAJA 5KG",
    conversionFactor: 5000, // 1 caja = 5000 gramos
    lppCents: 1500000, // $15.000 la caja
    isPreferred: true,
    leadTimeHours: 24,
    purchaseUnit: "CAJA_5KG",
    moq: 2, // Minimo 2 Cajas
  }
];

// ═══════════════════════════════════════════════════════════════════════
// § 3. EXECUTION
// ═══════════════════════════════════════════════════════════════════════

async function seedAclV2(): Promise<void> {
  const startTime = performance.now();

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  [SRE-ACL] V2 GÉNESIS — Yield Raw Materials Bridge     ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const allSuppliers = await db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers);
  if (allSuppliers.length === 0) {
    console.error("🔴 No hay proveedores en la DB.");
    process.exit(1);
  }

  const allMDM = await db.select({ id: mdm_ingredients.id, name: mdm_ingredients.canonical_name }).from(mdm_ingredients);
  if (allMDM.length === 0) {
    console.error("🔴 No hay ingredientes MDM. Falla cerrada.");
    process.exit(1);
  }

  let mappedCount = 0;

  for (const m of MAPPINGS) {
    const supplier = allSuppliers.find(s => m.supplierRegex.test(s.name));
    const ingredient = allMDM.find(i => i.id === m.mdmId);

    if (!supplier) {
      console.log(`  ⚠️  Proveedor no encontrado para la regex ${m.supplierRegex.source}`);
      continue;
    }
    if (!ingredient) {
      console.log(`  ⚠️  Ingrediente MDM ${m.mdmId} NO encontrado (se requiere DB actualizada)`);
      continue;
    }

    // 1. Inyectar `supplier_item_mappings` (Para Ingesta/Traducción de facturas y OCR)
    await db.insert(supplier_item_mappings).values({
      id: `SIM-${randomUUID().substring(0, 8).toUpperCase()}`,
      supplierId: supplier.id,
      internalIngredientId: ingredient.id,
      supplierItemName: m.supplierItemName,
      conversionFactor: m.conversionFactor,
    }).onConflictDoNothing();

    // 2. Inyectar `supplier_ingredients` (Para el Demonio de Compras / Kardex)
    await db.insert(supplier_ingredients).values({
      id: `SI-${randomUUID().substring(0, 8).toUpperCase()}`,
      supplier_id: supplier.id,
      ingredient_id: ingredient.id,
      last_purchase_price_cents: m.lppCents,
      is_preferred: m.isPreferred,
      lead_time_hours: m.leadTimeHours,
      purchase_unit: m.purchaseUnit,
      min_order_qty: m.moq
    }).onConflictDoNothing();

    console.log(`  ✅ [MAPPED] ${supplier.name.padEnd(25)} → ${ingredient.name.padEnd(25)} | Factor: ${m.conversionFactor}`);
    mappedCount++;
  }

  const elapsed = Math.round(performance.now() - startTime);

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  [SRE-ACL] V2 COMPLETADO                               ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  🔗 Total Enlaces Forjados: ${mappedCount}`);
  console.log(`  ⏱️  Latencia: ${elapsed}ms`);
  console.log(`\n✅ Exit Code 0. ACL V2 rehidratado y Demonio de Compras destrabado.\n`);
}

seedAclV2()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n🔴 [SRE-ACL] FALLO CATASTRÓFICO:");
    console.error(`   ${err.message || String(err)}`);
    process.exit(1);
  });
