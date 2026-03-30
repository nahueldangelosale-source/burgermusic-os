import "dotenv/config";
import { db } from "../src/db";
import { 
  inventorySnapshots, 
  snapshot_items, 
  inventory_kardex,
  products
} from "../src/db/schema";
import { raw_materials } from "../src/db/schema/bom";
import { eq, sql } from "drizzle-orm";
import { draftInventorySnapshot } from "../src/actions/inventory-reconciliation";

const STORE_ID = "sucursal_kitchen_sre";
const TEST_SKU = "MAT-PAN-TEST";

async function main() {
  console.log("=".repeat(60));
  console.log("[SRE-KITCHEN-TEST] 🧪 Iniciando Simulación de Conteo Ciego");
  console.log("=".repeat(60));

  // 1. SETUP: Asegurar que el insumo existe
  console.log("[SRE-KITCHEN-TEST] 🔨 Preparando Master Data...");
  await db.insert(raw_materials).values({
    id: TEST_SKU,
    supplierId: "SUP-TEST",
    name: "Pan de Papa (Test)",
    baseUnit: "UNIDAD",
    purchaseUnit: "BOLSA",
    recipeUnit: "UNIDAD",
    conversionFactor: 12,
    grossCostCents: 5000,
    trueCostPerUnitCents: 416.66,
  }).onConflictDoNothing();

  // 2. CAPTURAR STOCK TEÓRICO PREVIO (Para verificar que NO cambia)
  const [initialStock] = await db
    .select({ total: sql<number>`SUM(quantity)` })
    .from(inventory_kardex)
    .where(eq(inventory_kardex.productSku, TEST_SKU));
  
  const initialQty = Number(initialStock?.total || 0);
  console.log(`[SRE-KITCHEN-TEST] 📊 Stock Teórico Inicial: ${initialQty} unidades`);

  // 3. EJECUCIÓN: Simular envío de Cocina (10 bolsas)
  console.log("[SRE-KITCHEN-TEST] 🚀 Enviando Conteo Ciego: 10 Bolsas");
  const payload = {
    storeId: STORE_ID,
    reportedBy: "SRE_KITCHEN_BOT",
    items: [
      { rawMaterialId: TEST_SKU, count: 10 }
    ]
  };

  const result = await draftInventorySnapshot(payload);

  if (result.success && 'snapshotId' in result) {
    console.log(`[SRE-KITCHEN-TEST] ✅ Éxito: Snapshot DRAFT creado [${result.snapshotId}]`);

    // 4. VERIFICACIÓN DB: Snapshot en estado DRAFT
    const [snapshot] = await db
      .select()
      .from(inventorySnapshots)
      .where(eq(inventorySnapshots.id, result.snapshotId!));
    
    console.log(`[SRE-KITCHEN-TEST] 🔍 Estado del Snapshot: ${snapshot.status}`);
    if (snapshot.status !== "DRAFT") {
      console.error("❌ ERROR: El snapshot debería estar en DRAFT");
      process.exit(1);
    }

    // 5. VERIFICACIÓN DB: Items guardados
    const items = await db
      .select()
      .from(snapshot_items)
      .where(eq(snapshot_items.snapshotId, result.snapshotId!));
    
    console.log(`[SRE-KITCHEN-TEST] 🔍 Items en Snapshot: ${items.length}`);
    if (items[0].physicalCountPurchaseUnit !== 10) {
      console.error("❌ ERROR: La cantidad contada es incorrecta");
      process.exit(1);
    }

    // 6. VERIFICACIÓN KARDEX: No debe haber cambios
    const [finalStock] = await db
      .select({ total: sql<number>`SUM(quantity)` })
      .from(inventory_kardex)
      .where(eq(inventory_kardex.productSku, TEST_SKU));
    
    const finalQty = Number(finalStock?.total || 0);
    console.log(`[SRE-KITCHEN-TEST] 📊 Stock Teórico Final: ${finalQty} unidades`);

    if (initialQty === finalQty) {
      console.log("[SRE-KITCHEN-TEST] ✨ AISLAMIENTO ZERO-TRUST CONFIRMADO (Kardex intacto)");
    } else {
      console.error("❌ ERROR: El Kardex fue alterado prematuramente");
      process.exit(1);
    }
  } else {
    const errorMsg = 'error' in result ? result.error : "Unknown error";
    console.error("[SRE-KITCHEN-TEST] ❌ Fallo en Server Action:", errorMsg);
    process.exit(1);
  }

  console.log("\n[SRE-KITCHEN-TEST] 🏁 SIMULACIÓN FINALIZADA CON ÉXITO.");
  console.log("=".repeat(60));
  process.exit(0);
}

main().catch(console.error);
