import "dotenv/config";
import { db } from "../src/db";
import { 
  inventorySnapshots, 
  snapshot_items, 
  inventory_kardex,
  suppliers,
  products
} from "../src/db/schema";
import { raw_materials } from "../src/db/schema/bom";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { reconcileSnapshot } from "../src/actions/inventory-reconciliation";

const STORE_ID = "sucursal_sre_test";
const TEST_SKU = "MAT-HARINA-TEST";

async function main() {
  console.log("=".repeat(60));
  console.log("[SRE-UOM-TEST] 🧪 Iniciando Simulación de Varianza UOM");
  console.log("=".repeat(60));

  // 1. SETUP: Crear Insumo con Factor de Conversión (1 Bolsa = 25kg = 25000g)
  console.log("[SRE-UOM-TEST] 🔨 Preparando Master Data...");
  
  await db.insert(suppliers).values({
    id: "SUP-TEST-UOM",
    name: "Proveedor Harina SRE",
    cuit: "20-99999999-9",
    active: true,
  }).onConflictDoNothing();

  await db.insert(raw_materials).values({
    id: TEST_SKU,
    supplierId: "SUP-TEST-UOM",
    name: "Harina 000 (Test)",
    baseUnit: "GRAMOS",
    purchaseUnit: "BOLSA",
    recipeUnit: "GRAMOS",
    conversionFactor: 25000,
    grossCostCents: 150000,
    trueCostPerUnitCents: 0.006,
  }).onConflictDoUpdate({
    target: raw_materials.id,
    set: { conversionFactor: 25000, baseUnit: "GRAMOS" }
  });

  // 2. STOCK TEÓRICO: Inyectar 10.000g (0.4 bolsas) en Kardex
  console.log("[SRE-UOM-TEST] 📉 Inyectando stock teórico: 10,000g");
  await db.delete(inventory_kardex).where(eq(inventory_kardex.productSku, TEST_SKU));
  await db.insert(inventory_kardex).values({
    id: randomUUID(),
    storeId: STORE_ID,
    productSku: TEST_SKU,
    quantity: 10000, // Gramos
    referenceId: "INITIAL-STOCK-TEST",
  });

  // 3. SNAPSHOT: El humano cuenta 1 BOLSA física
  console.log("[SRE-UOM-TEST] 📸 Creando Snapshot DRAFT (Humano cuenta 1 BOLSA)...");
  const snapshotId = `SNAP-${randomUUID().slice(0, 8)}`;
  await db.insert(inventorySnapshots).values({
    id: snapshotId,
    storeId: STORE_ID,
    reportedBy: "SRE_BOT",
    status: "DRAFT",
  });

  await db.insert(snapshot_items).values({
    id: randomUUID(),
    snapshotId: snapshotId,
    rawMaterialId: TEST_SKU,
    physicalCountPurchaseUnit: 1, // 1 Bolsa = 25,000g
  });

  // 4. EJECUCIÓN: Reconciliar
  console.log(`[SRE-UOM-TEST] 🚀 Disparando Reconciliación: ${snapshotId}`);
  const result = await reconcileSnapshot(snapshotId);
  if (result.success && 'adjustmentsApplied' in result) {
    console.log(`[SRE-UOM-TEST] ✅ Éxito: ${result.adjustmentsApplied} ajustes aplicados.`);
    
    // 5. VALIDACIÓN FÍSICA: El Kardex debe tener +15,000g de ajuste para llegar a 25,000g
    const [finalStock] = await db
      .select({ total: sql<number>`SUM(quantity)` })
      .from(inventory_kardex)
      .where(eq(inventory_kardex.productSku, TEST_SKU));
    
    console.log(`[SRE-UOM-TEST] 📊 Stock Final en Kardex: ${finalStock.total}g`);
    
    if (Math.abs(Number(finalStock.total) - 25000) < 0.001) {
      console.log("[SRE-UOM-TEST] ✨ RECONCILIACIÓN MATEMÁTICA CORRECTA (1 Bolsa = 25,000g)");
    } else {
      console.error(`[SRE-UOM-TEST] ❌ FALLO MATEMÁTICO: Se esperaba 25,000g, se obtuvo ${finalStock.total}g`);
      process.exit(1);
    }
  } else {
    const errorMsg = 'error' in result ? result.error : "Unknown error";
    console.error("[SRE-UOM-TEST] ❌ Fallo en Server Action:", errorMsg);
    process.exit(1);
  }

  // 6. PRUEBA DE IDEMPOTENCIA
  console.log("[SRE-UOM-TEST] 🛡️ Validando Idempotencia (Re-intento)...");
  const secondAttempt = await reconcileSnapshot(snapshotId);
  if (!secondAttempt.success && 'error' in secondAttempt && secondAttempt.error?.includes("IdempotencyViolation")) {
    console.log("[SRE-UOM-TEST] ✅ ESCUDO DE IDEMPOTENCIA FUNCIONANDO.");
  } else {
    console.error("[SRE-UOM-TEST] ❌ VIOLACIÓN DE IDEMPOTENCIA: No lanzó error o fue exitoso.");
    process.exit(1);
  }

  console.log("\n[SRE-UOM-TEST] 🏁 TODAS LAS PRUEBAS FINALIZADAS CON ÉXITO.");
  console.log("=".repeat(60));
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
