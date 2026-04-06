/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║    IGNITE-DAEMON: Procurement Cycle Cold-Start Detonator                   ║
 * ║    BurgerMusic OS v4.2 — Zero-State Stress Test                           ║
 * ║                                                                           ║
 * ║    Ejecutar:  npx tsx --tsconfig tsconfig.json src/scripts/ignite-daemon.ts║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Este script bypasea cookies/Next.js y opera directamente contra Turso
 * para testear el motor de reabastecimiento autónomo en frío (Kardex = 0).
 *
 * Lógica Termodinámica:
 *   threshold = (burnRate × leadTimeDays) + safetyStock
 *   deficit   = threshold - currentStock (siempre 0 en Zero-State)
 *   → Genera POs en DRAFT consolidadas por proveedor
 */

import "dotenv/config";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

// ── Schema Imports (vía @/ alias — resuelto por tsconfig.json paths) ──
import { mdm_ingredients, inventory_kardex, suppliers } from "@/db/schema";
import {
  supplier_ingredients,
  purchase_orders,
  purchase_order_items,
} from "@/db/schema/supply";

// ═══════════════════════════════════════════════════════════════════════
// § 1. BOOTSTRAP: Conexión directa a Turso (sin Next.js runtime)
// ═══════════════════════════════════════════════════════════════════════

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL) {
  console.error("🔴 FATAL: TURSO_DATABASE_URL no definida en .env");
  process.exit(1);
}

console.log(`[BOOTSTRAP] Conectando a Turso: ${TURSO_URL.substring(0, 30)}...`);
const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
const db = drizzle(client);

// ═══════════════════════════════════════════════════════════════════════
// § 2. CONSTANTES TERMODINÁMICAS
// ═══════════════════════════════════════════════════════════════════════

const STORE_ID = "STR_DEFAULT";
const DEFAULT_BURN_RATE_GRAMS = 5000;     // Consumo diario estimado (g)
const DEFAULT_SAFETY_STOCK_GRAMS = 10000; // Reserva mínima de seguridad (g)

// ═══════════════════════════════════════════════════════════════════════
// § 3. MOTOR TERMODINÁMICO
// ═══════════════════════════════════════════════════════════════════════

async function runProcurementCycle(): Promise<void> {
  const startTime = performance.now();

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  [SRE-DAEMON] IGNITION — Procurement Cycle Cold-Start  ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  console.log(`[SRE-DAEMON] Store ID:       ${STORE_ID}`);
  console.log(`[SRE-DAEMON] Burn Rate:      ${DEFAULT_BURN_RATE_GRAMS}g/día`);
  console.log(`[SRE-DAEMON] Safety Stock:   ${DEFAULT_SAFETY_STOCK_GRAMS}g`);
  console.log(`[SRE-DAEMON] Analizando MDM...\n`);

  // ── FASE 1: Extraer estado de stock absoluto ──
  // LEFT JOIN al Kardex: stock actual (0 si no existe = Zero-State)
  // LEFT JOIN a supplier_ingredients: proveedor preferido + LPP
  // LEFT JOIN a suppliers: nombre legible para la traza
  const rawStatus = await db
    .select({
      ingredientId: mdm_ingredients.id,
      ingredientName: mdm_ingredients.canonical_name,
      ingredientType: mdm_ingredients.ingredientType,
      currentStock: sql<number>`COALESCE(SUM(${inventory_kardex.quantity}), 0)`,
      supplierId: supplier_ingredients.supplier_id,
      supplierName: sql<string>`COALESCE(${suppliers.name}, '⚠️ SIN_PROVEEDOR')`,
      leadTimeHours: supplier_ingredients.lead_time_hours,
      unitPriceCents: supplier_ingredients.last_purchase_price_cents,
      purchaseUnit: supplier_ingredients.purchase_unit,
      minOrderQty: supplier_ingredients.min_order_qty,
    })
    .from(mdm_ingredients)
    .leftJoin(
      inventory_kardex,
      eq(inventory_kardex.productSku, mdm_ingredients.id)
    )
    .leftJoin(
      supplier_ingredients,
      sql`${supplier_ingredients.ingredient_id} = ${mdm_ingredients.id} AND ${supplier_ingredients.is_preferred} = 1`
    )
    .leftJoin(suppliers, eq(suppliers.id, supplier_ingredients.supplier_id))
    .groupBy(mdm_ingredients.id);

  console.log(`[SRE-DAEMON] MDM Escaneado: ${rawStatus.length} ingredientes detectados.\n`);

  if (rawStatus.length === 0) {
    console.log("━".repeat(60));
    console.log("⚠️  [SRE-DAEMON] MDM VACÍO — 0 ingredientes registrados.");
    console.log("   El Demonio de Compras no puede operar sin catálogo base.");
    console.log("   → Ejecutá 'Ejecutar MDM Seed & Limpieza' en /dashboard/supply");
    console.log("━".repeat(60));
    process.exit(0);
  }

  // ── FASE 2: Evaluar déficit termodinámico por ingrediente ──
  const draftsBySupplier: Record<
    string,
    {
      supplierName: string;
      items: Array<{
        ingredientId: string;
        ingredientName: string;
        orderQtyGrams: number;
        priceCents: number;
        purchaseUnit: string;
      }>;
    }
  > = {};

  let deficitCount = 0;
  let healthyCount = 0;
  let orphanCount = 0;

  console.log("┌─────────────────────────────────────────────────────────────────────────┐");
  console.log("│  ANÁLISIS TERMODINÁMICO POR INGREDIENTE                                │");
  console.log("├─────────────────────────────────────────────────────────────────────────┤");

  for (const item of rawStatus) {
    const leadTimeDays = (item.leadTimeHours || 24) / 24;
    const threshold = (DEFAULT_BURN_RATE_GRAMS * leadTimeDays) + DEFAULT_SAFETY_STOCK_GRAMS;
    const currentStock = item.currentStock || 0;

    if (currentStock >= threshold) {
      healthyCount++;
      continue;
    }

    // ── DÉFICIT DETECTADO ──
    const deficitGrams = Math.ceil(threshold - currentStock);

    if (!item.supplierId) {
      orphanCount++;
      console.log(`│  ⚠️  HUÉRFANO: ${(item.ingredientName || item.ingredientId).padEnd(25)} | Gap: ${deficitGrams}g | Sin proveedor ACL │`);
      continue;
    }

    deficitCount++;
    console.log(`│  🔴 DÉFICIT: ${(item.ingredientName || item.ingredientId).padEnd(28)} | Stock: ${String(currentStock).padStart(6)}g | Safety: ${DEFAULT_SAFETY_STOCK_GRAMS}g | Gap: ${deficitGrams}g │`);

    // Consolidar por proveedor para generar POs agrupadas
    if (!draftsBySupplier[item.supplierId]) {
      draftsBySupplier[item.supplierId] = {
        supplierName: item.supplierName || "DESCONOCIDO",
        items: [],
      };
    }

    // MOQ enforcement: si el déficit es menor al MOQ, subir al MOQ
    const moqGrams = (item.minOrderQty || 1) * 1000;
    const finalQty = Math.max(deficitGrams, moqGrams);

    draftsBySupplier[item.supplierId].items.push({
      ingredientId: item.ingredientId,
      ingredientName: item.ingredientName,
      orderQtyGrams: finalQty,
      priceCents: item.unitPriceCents || 0,
      purchaseUnit: item.purchaseUnit || "KG",
    });
  }

  console.log("└─────────────────────────────────────────────────────────────────────────┘\n");

  console.log(`[SRE-DAEMON] Resumen Termodinámico:`);
  console.log(`  ✅ Healthy (stock OK):        ${healthyCount}`);
  console.log(`  🔴 Déficit Extremo:           ${deficitCount}`);
  console.log(`  ⚠️  Huérfanos (sin ACL):       ${orphanCount}`);
  console.log(`  📦 Proveedores a impactar:    ${Object.keys(draftsBySupplier).length}\n`);

  // Early exit si no hay déficit con proveedor asignado
  if (Object.keys(draftsBySupplier).length === 0) {
    console.log("✅ [SRE-DAEMON] No hay déficit cubierto por proveedores. El sistema está en equilibrio (o todos son huérfanos).");
    const elapsed = Math.round(performance.now() - startTime);
    console.log(`⏱️  Ciclo completado en ${elapsed}ms. Exit Code 0.\n`);
    return;
  }

  // ── FASE 3: INYECCIÓN ACID DE POs EN DRAFT ──
  console.log("━".repeat(60));
  console.log("[SRE-DAEMON] FASE 3: Inyectando Órdenes de Compra (ACID)...\n");

  const draftPOIds: string[] = [];

  await db.transaction(async (tx) => {
    for (const [supplierId, bundle] of Object.entries(draftsBySupplier)) {
      const poId = `PO-DAEMON-${randomUUID().substring(0, 8).toUpperCase()}`;

      let totalCents = 0;
      const lineItems: Array<{
        id: string;
        poId: string;
        ingredientId: string;
        quantityGrams: number;
        unitPriceCents: number;
      }> = [];

      for (const line of bundle.items) {
        // Precio por KG → calcular total por cantidad en gramos
        const lineTotal = Math.round((line.orderQtyGrams / 1000) * line.priceCents);
        totalCents += lineTotal;

        lineItems.push({
          id: `POL-${randomUUID().substring(0, 8).toUpperCase()}`,
          poId,
          ingredientId: line.ingredientId,
          quantityGrams: line.orderQtyGrams,
          unitPriceCents: line.priceCents,
        });

        console.log(
          `  📋 ${line.ingredientName.padEnd(28)} → ${String(line.orderQtyGrams).padStart(8)}g @ $${(line.priceCents / 100).toFixed(2)}/${line.purchaseUnit}`
        );
      }

      // ── INSERT PO Header (estado innegociable: DRAFT) ──
      await tx.insert(purchase_orders).values({
        id: poId,
        store_id: STORE_ID,
        supplierId: supplierId,
        status: "DRAFT",
        totalAmountCents: totalCents,
      });

      // ── INSERT Line Items ──
      if (lineItems.length > 0) {
        await tx.insert(purchase_order_items).values(lineItems);
      }

      draftPOIds.push(poId);

      console.log(
        `\n  [SRE-DAEMON] Generando PO (DRAFT) hacia "${bundle.supplierName}" por $${(totalCents / 100).toLocaleString("es-AR")} ARS.`
      );
      console.log(`  └─ PO ID: ${poId} | ${lineItems.length} líneas\n`);
    }
  });

  // ── FASE 4: REPORTE FINAL ──
  const elapsed = Math.round(performance.now() - startTime);

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  [SRE-DAEMON] CICLO COMPLETADO — REPORTE FINOPS        ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  📦 POs Generadas:      ${draftPOIds.length}`);
  console.log(`  🔒 Estado:             DRAFT (Human-in-the-Loop requerido)`);
  console.log(`  ⏱️  Latencia Total:     ${elapsed}ms`);
  console.log(`  🆔 PO IDs:`);
  for (const id of draftPOIds) {
    console.log(`     └─ ${id}`);
  }
  console.log(`\n✅ Exit Code 0. Operaciones ACID confirmadas en Turso.\n`);
}

// ═══════════════════════════════════════════════════════════════════════
// § 4. MAIN — Fail-Closed Entry Point
// ═══════════════════════════════════════════════════════════════════════

runProcurementCycle()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n🔴 [SRE-DAEMON] FALLO CATASTRÓFICO:");
    console.error(`   ${err.message || err}`);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  });
