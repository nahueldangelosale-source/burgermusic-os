/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║    ACL GENESIS: Anti-Corruption Layer Seed (Supplier ↔ MDM Bridge)        ║
 * ║    BurgerMusic OS v4.2 — Closed-Loop Supply Chain                         ║
 * ║                                                                           ║
 * ║    Ejecutar:  npx tsx --tsconfig tsconfig.json src/db/seed-acl.ts         ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Consulta el Directorio de Proveedores existente, lo cruza con el MDM,
 * y forja el puente B2B inyectando `supplier_ingredients` con precios LPP,
 * lead times y el flag `is_preferred`.
 *
 * Idempotente via onConflictDoNothing() (unique constraint en supplier_id + ingredient_id).
 */

import "dotenv/config";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { suppliers, mdm_ingredients } from "@/db/schema";
import { supplier_ingredients } from "@/db/schema/supply";

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
// § 2. MAPEO ESTRATÉGICO: Proveedor → Ingrediente MDM
//
//    Cada entry define:
//    - supplierMatch: regex para matchear contra suppliers.name
//    - ingredientMdmId: FK a mdm_ingredients.id
//    - lpp: Last Purchase Price en centavos (per unit/KG)
//    - purchaseUnit: unidad de compra
//    - leadTimeHours: lead time operativo
//    - isPreferred: proveedor preferido para este ingrediente
//    - moq: Minimum Order Quantity
// ═══════════════════════════════════════════════════════════════════════

interface ACLMapping {
  supplierMatch: RegExp;
  ingredientMdmId: string;
  lpp: number;
  purchaseUnit: string;
  leadTimeHours: number;
  isPreferred: boolean;
  moq: number;
}

const ACL_MAPPINGS: ACLMapping[] = [
  // ── CARNES ──
  {
    supplierMatch: /av[ií]cola|lan[uú]s|carne|frigor/i,
    ingredientMdmId: "MDM_MEDALLON_110G",
    lpp: 250000,       // $2.500 / KG
    purchaseUnit: "KG",
    leadTimeHours: 48,
    isPreferred: true,
    moq: 10,            // 10 KG mín
  },
  {
    supplierMatch: /av[ií]cola|lan[uú]s|carne|frigor/i,
    ingredientMdmId: "MDM_BACON",
    lpp: 450000,       // $4.500 / KG
    purchaseUnit: "KG",
    leadTimeHours: 48,
    isPreferred: true,
    moq: 5,
  },

  // ── PANIFICADOS ──
  {
    supplierMatch: /arte.*pan|panaderia|panader[ií]a/i,
    ingredientMdmId: "MDM_PAN_HAMBURGUESA",
    lpp: 12000,        // $120 / unidad
    purchaseUnit: "UNIDAD",
    leadTimeHours: 12,
    isPreferred: true,
    moq: 15,           // Caja de 15
  },

  // ── SALSAS & CONDIMENTOS ──
  {
    supplierMatch: /felu|condimento|salsa/i,
    ingredientMdmId: "MDM_SALSA_CRUNCH",
    lpp: 180000,       // $1.800 / KG (balde de 15KG)
    purchaseUnit: "KG",
    leadTimeHours: 72,
    isPreferred: true,
    moq: 15,           // Balde mínimo
  },

  // ── QUESOS ──
  {
    supplierMatch: /albean|l[aá]cteo|queso|felu/i,
    ingredientMdmId: "MDM_CHEDDAR_FETA",
    lpp: 380000,       // $3.800 / KG
    purchaseUnit: "KG",
    leadTimeHours: 48,
    isPreferred: true,
    moq: 5,
  },

  // ── CONGELADOS ──
  {
    supplierMatch: /simplot|mccain|congelado|distribu|felu/i,
    ingredientMdmId: "MDM_PAPAS_CONGELADAS",
    lpp: 220000,       // $2.200 / KG
    purchaseUnit: "KG",
    leadTimeHours: 72,
    isPreferred: true,
    moq: 10,           // Bolsa de 10KG
  },

  // ── VERDURAS ──
  {
    supplierMatch: /verdur|mart[ií]n|hortaliz|granja/i,
    ingredientMdmId: "MDM_LECHUGA",
    lpp: 80000,        // $800 / KG
    purchaseUnit: "KG",
    leadTimeHours: 24,
    isPreferred: true,
    moq: 3,
  },
  {
    supplierMatch: /verdur|mart[ií]n|hortaliz|granja/i,
    ingredientMdmId: "MDM_TOMATE",
    lpp: 120000,       // $1.200 / KG
    purchaseUnit: "KG",
    leadTimeHours: 24,
    isPreferred: true,
    moq: 5,
  },
  {
    supplierMatch: /verdur|mart[ií]n|hortaliz|granja/i,
    ingredientMdmId: "MDM_CEBOLLA",
    lpp: 60000,        // $600 / KG
    purchaseUnit: "KG",
    leadTimeHours: 24,
    isPreferred: true,
    moq: 5,
  },

  // ── HUEVOS ──
  {
    supplierMatch: /av[ií]cola|granja|huevo/i,
    ingredientMdmId: "MDM_HUEVO",
    lpp: 8000,         // $80 / unidad (maple)
    purchaseUnit: "UNIDAD",
    leadTimeHours: 48,
    isPreferred: true,
    moq: 30,           // Maple de 30
  },
];

// ═══════════════════════════════════════════════════════════════════════
// § 3. EXECUTION
// ═══════════════════════════════════════════════════════════════════════

async function seedACL(): Promise<void> {
  const startTime = performance.now();

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  [SRE-ACL] GÉNESIS — Anti-Corruption Layer Seed        ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // ── FASE 1: Cargar proveedores existentes ──
  const allSuppliers = await db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers);
  console.log(`[SRE-ACL] Proveedores en directorio: ${allSuppliers.length}\n`);

  if (allSuppliers.length === 0) {
    console.log("⚠️  No hay proveedores registrados. Registrá proveedores en /dashboard/supply → 'Directorio Proveedores'.");
    process.exit(0);
  }

  for (const s of allSuppliers) {
    console.log(`  📋 ${s.name.padEnd(35)} | ID: ${s.id}`);
  }

  // ── FASE 2: Verificar MDM ingredients ──
  const allMDM = await db.select({ id: mdm_ingredients.id, name: mdm_ingredients.canonical_name }).from(mdm_ingredients);
  console.log(`\n[SRE-ACL] Ingredientes MDM: ${allMDM.length}\n`);

  if (allMDM.length === 0) {
    console.log("🔴 MDM vacío. Ejecutá seed-mdm.ts primero.");
    process.exit(1);
  }

  // ── FASE 3: Resolver y construir mapeos ──
  console.log("[SRE-ACL] Resolviendo mapeos Proveedor → Ingrediente...\n");

  let linksCreated = 0;
  let skipped = 0;
  const resolvedPairs = new Set<string>(); // Para evitar duplicados

  for (const mapping of ACL_MAPPINGS) {
    // Encontrar el primer proveedor que matchea
    const supplier = allSuppliers.find(s => mapping.supplierMatch.test(s.name));

    if (!supplier) {
      console.log(`  ⚠️  Sin match para ingrediente ${mapping.ingredientMdmId} (regex: ${mapping.supplierMatch.source})`);
      skipped++;
      continue;
    }

    // Verificar que el ingrediente MDM existe
    const mdmExists = allMDM.find(m => m.id === mapping.ingredientMdmId);
    if (!mdmExists) {
      console.log(`  🔴 MDM ID ${mapping.ingredientMdmId} no encontrado. Skip.`);
      skipped++;
      continue;
    }

    // Evitar duplicados en la misma ejecución
    const pairKey = `${supplier.id}::${mapping.ingredientMdmId}`;
    if (resolvedPairs.has(pairKey)) continue;
    resolvedPairs.add(pairKey);

    // INSERT con idempotencia
    await db.insert(supplier_ingredients).values({
      id: `SI-${randomUUID().substring(0, 8).toUpperCase()}`,
      supplier_id: supplier.id,
      ingredient_id: mapping.ingredientMdmId,
      last_purchase_price_cents: mapping.lpp,
      is_preferred: mapping.isPreferred,
      lead_time_hours: mapping.leadTimeHours,
      purchase_unit: mapping.purchaseUnit,
      min_order_qty: mapping.moq,
    }).onConflictDoNothing();

    linksCreated++;
    console.log(
      `  ✅ ${supplier.name.padEnd(30)} → ${(mdmExists.name).padEnd(25)} | LPP: $${(mapping.lpp / 100).toLocaleString("es-AR")} / ${mapping.purchaseUnit} | Lead: ${mapping.leadTimeHours}h | Preferred: ${mapping.isPreferred ? "SÍ" : "NO"}`
    );
  }

  // ── REPORTE FINAL ──
  const elapsed = Math.round(performance.now() - startTime);

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  [SRE-ACL] SEED COMPLETADO — PUENTE B2B FORJADO       ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  🔗 Links creados:        ${linksCreated}`);
  console.log(`  ⚠️  Skipped (sin match):  ${skipped}`);
  console.log(`  ⏱️  Latencia:             ${elapsed}ms`);
  console.log(`\n✅ Exit Code 0. ACL forjado. El Demonio de Compras puede generar POs.\n`);
}

seedACL()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n🔴 [SRE-ACL] FALLO CATASTRÓFICO:");
    console.error(`   ${err.message || err}`);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  });
