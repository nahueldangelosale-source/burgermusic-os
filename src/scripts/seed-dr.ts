/**
 * BurgerMusic OS — Disaster Recovery Seed Script V3.2
 * ────────────────────────────────────────────────────
 * Repobla transaccionalmente el catálogo base de insumos y productos
 * para restaurar la termodinámica del ecosistema (LPP, BOM, Mermas).
 *
 * Garantías:
 *   - Transaccional (all-or-nothing via db.transaction)
 *   - Idempotente (onConflictDoNothing)
 *   - Inicializa current_stock Y maximum_capacity (requerido por ADC/Sentinel)
 *
 * Ejecución: npx tsx src/scripts/seed-dr.ts
 */
import "dotenv/config";

import { db } from "../db";
import { products } from "../db/schema";
import { inventory_items } from "../db/schema/supply";

const STORE_ID = "centro";

async function seedDisasterRecovery() {
  console.log("🔥 [DR-SEED V3.2] Iniciando Disaster Recovery Seed...\n");

  await db.transaction(async (tx) => {
    // ───────────────────────────────────────────────
    // 1. INSUMOS BASE (inventory_items) — Materia Prima
    //    CRÍTICO: current_stock + maximum_capacity deben ser >0
    //    para que el Motor LPP y el Sentinel ADC no colapsen.
    // ───────────────────────────────────────────────
    const rawMaterials = [
      {
        id: "INV_PAN_HAMBURGUESA",
        name: "Pan de Hamburguesa",
        category: "PANIFICADOS" as const,
        measurement_unit: "UNIDAD" as const,
        current_stock: 200,
        min_stock_alert: 50,
        maximum_capacity: 500,
        cost_per_unit_cents: 15000, // $150.00
      },
      {
        id: "INV_MEDALLON_CARNE",
        name: "Medallón de Carne 120g",
        category: "CARNES" as const,
        measurement_unit: "UNIDAD" as const,
        current_stock: 150,
        min_stock_alert: 40,
        maximum_capacity: 400,
        cost_per_unit_cents: 45000, // $450.00
      },
      {
        id: "INV_CHEDDAR_FETA",
        name: "Cheddar Feta (por unidad)",
        category: "QUESOS_FIAMBRES" as const,
        measurement_unit: "UNIDAD" as const,
        current_stock: 300,
        min_stock_alert: 80,
        maximum_capacity: 600,
        cost_per_unit_cents: 8000, // $80.00
      },
      {
        id: "INV_LECHUGA",
        name: "Lechuga (KG)",
        category: "VEGETALES" as const,
        measurement_unit: "KG" as const,
        current_stock: 25,
        min_stock_alert: 5,
        maximum_capacity: 50,
        cost_per_unit_cents: 120000, // $1200.00/kg
      },
      {
        id: "INV_TOMATE",
        name: "Tomate (KG)",
        category: "VEGETALES" as const,
        measurement_unit: "KG" as const,
        current_stock: 20,
        min_stock_alert: 5,
        maximum_capacity: 40,
        cost_per_unit_cents: 180000, // $1800.00/kg
      },
      {
        id: "INV_BACON",
        name: "Bacon Ahumado (KG)",
        category: "CARNES" as const,
        measurement_unit: "KG" as const,
        current_stock: 15,
        min_stock_alert: 3,
        maximum_capacity: 30,
        cost_per_unit_cents: 950000, // $9500.00/kg
      },
      {
        id: "INV_PAPAS_CONGELADAS",
        name: "Papas Fritas Congeladas (KG)",
        category: "CONGELADOS" as const,
        measurement_unit: "KG" as const,
        current_stock: 50,
        min_stock_alert: 10,
        maximum_capacity: 100,
        cost_per_unit_cents: 350000, // $3500.00/kg
      },
    ];

    for (const mat of rawMaterials) {
      await tx.insert(inventory_items).values({
        ...mat,
        store_id: STORE_ID,
        is_active: true,
      }).onConflictDoNothing();
      console.log(`  ✅ Insumo: ${mat.name} | Stock: ${mat.current_stock}/${mat.maximum_capacity} | LPP: $${(mat.cost_per_unit_cents / 100).toFixed(2)}`);
    }

    // ───────────────────────────────────────────────
    // 2. PRODUCTOS TERMINADOS (products) — Menu Items
    // ───────────────────────────────────────────────
    const menuProducts = [
      {
        id: "PROD_CLASICA",
        sku: "CLASICA",
        name: "Hamburguesa Clásica",
        isSaleable: true,
        costCents: 68000,     // $680.00 (BOM sum)
        sellingPrice: 550000, // $5500.00
        targetMargin: 30,
      },
      {
        id: "PROD_DOBLE_CHEDDAR",
        sku: "DOBLE_CHEDDAR",
        name: "Doble Cheddar",
        isSaleable: true,
        costCents: 98000,     // $980.00
        sellingPrice: 720000, // $7200.00
        targetMargin: 35,
      },
      {
        id: "PROD_VEGGIE",
        sku: "VEGGIE",
        name: "Hamburguesa Veggie",
        isSaleable: true,
        costCents: 55000,     // $550.00
        sellingPrice: 480000, // $4800.00
        targetMargin: 28,
      },
      {
        id: "PROD_BACON_DELUXE",
        sku: "BACON_DELUXE",
        name: "Bacon Deluxe",
        isSaleable: true,
        costCents: 115000,    // $1150.00
        sellingPrice: 850000, // $8500.00
        targetMargin: 32,
      },
    ];

    for (const prod of menuProducts) {
      await tx.insert(products).values({
        ...prod,
        unit: "UNIDAD",
        item_type: "MANUFACTURED",
        category: "HAMBURGUESAS",
      }).onConflictDoNothing();
      console.log(`  ✅ Producto: ${prod.name} | SKU: ${prod.sku} | PVP: $${(prod.sellingPrice / 100).toFixed(2)} | COGS: $${(prod.costCents / 100).toFixed(2)}`);
    }
  });

  console.log("\n🎯 [DR-SEED V3.2] Disaster Recovery completo. Termodinámica restaurada.");
  console.log("   → Ejecuta 'npx drizzle-kit push' si la DB física aún no tiene las tablas.\n");
  process.exit(0);
}

seedDisasterRecovery().catch((err) => {
  console.error("❌ [DR-SEED] FALLA CATASTRÓFICA:", err);
  process.exit(1);
});
