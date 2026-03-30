import "dotenv/config";
import { db } from "../db";
import { products, recipe_items, transactions, sales_mapping_dlq, inventory_kardex } from "../db/schema";
import { raw_materials } from "../db/schema/bom";
import { TransactionExplosionEngine } from "../services/explosion-engine";
import { eq, sql, and } from "drizzle-orm";

/**
 * RESOLVE-DLQ-ITEMS (DLQ Drainer & 1:1 COGS Mapping)
 * ──────────────────────────────────────────────────
 * Resolves the quarantine in sales_mapping_dlq by:
 * 1. Hydrating extension products/ingredients.
 * 2. Implementing fuzzy matching for multipliers ("6 empanadas").
 * 3. Re-exploding through the BOM engine.
 * 
 * Standard: Antigravity 2026 (Zero-Trust)
 */

// ═══════════════════════════════════════════════════
// 1. ZERO-TRUST CLI VALIDATION
// ═══════════════════════════════════════════════════
const storeIdArg = process.argv.find((a) => a.startsWith("--store-id="));
const storeId = storeIdArg?.split("=")[1];

if (!storeId) {
  console.error("❌ SRE FATAL: Missing --store-id argument.");
  console.error("Usage: npx tsx src/scripts/resolve-dlq-items.ts --store-id=STORE001");
  process.exit(1);
}

/**
 * ═══════════════════════════════════════════════════
 * 1.1. SRE ZERO-TRUST TYPE SHADOWING
 * ═══════════════════════════════════════════════════
 */
const VALID_STORE_ID: string = storeId;

// ═══════════════════════════════════════════════════
// 2. EXTENSION DICTIONARY (Golden Record)
// ═══════════════════════════════════════════════════
const EXTENSION_MANUFACTURED = [
  { sku: "COCA_15L", name: "Coca Cola 1.5 Lts", cost_cents: 120000, purchaseUnit: "UNIDAD", recipeUnit: "UNIDAD", conversionFactor: 1 },
  { sku: "COCA_ZERO_15L", name: "Coca Cola Zero 1.5 Lts", cost_cents: 120000, purchaseUnit: "UNIDAD", recipeUnit: "UNIDAD", conversionFactor: 1 },
  { sku: "EMPANADA_CARNE", name: "Empanada de Carne", cost_cents: 45000, purchaseUnit: "UNIDAD", recipeUnit: "UNIDAD", conversionFactor: 1 },
  { sku: "EMPANADA_JYQ", name: "Empanada de Jamon y Queso", cost_cents: 45000, purchaseUnit: "UNIDAD", recipeUnit: "UNIDAD", conversionFactor: 1 },
  { sku: "FRANUI_LECHE", name: "franui Chocolate con leche + chocolate blanco", cost_cents: 250000, purchaseUnit: "CAJA", recipeUnit: "UNIDAD", conversionFactor: 1 },
  { sku: "AROS_CEBOLLA_6", name: "Aros de Cebolla 6 unid.", cost_cents: 65000, purchaseUnit: "PORCION", recipeUnit: "UNIDAD", conversionFactor: 1 },
  { sku: "ANDES_RUBIA", name: "Andes Rubia", cost_cents: 95000, purchaseUnit: "UNIDAD", recipeUnit: "UNIDAD", conversionFactor: 1 }
];

// Fuzzy matching map for DLQ names to hydrated SKUs
const FUZZY_MAP: Record<string, string> = {
  "EMPANADA DE CARNE": "COGS-EMPANADA_CARNE",
  "EMPANADA DE JAMON Y QUESO": "COGS-EMPANADA_JYQ",
  "EMPANADAS": "COGS-EMPANADA_CARNE", // Default
  "COCA COLA 1.5 LTS": "COGS-COCA_15L",
  "COCA COLA ZERO 1.5 LTS": "COGS-COCA_ZERO_15L",
  "FRANUI": "COGS-FRANUI_LECHE",
  "AROS DE CEBOLLA": "COGS-AROS_CEBOLLA_6",
  "ANDES RUBIA": "COGS-ANDES_RUBIA",
};

// ═══════════════════════════════════════════════════
// 3. ATOMIC DRAIN RUNTIME
// ═══════════════════════════════════════════════════
async function run() {
  console.log(`🚀 DLQ Drainer — Store: [${VALID_STORE_ID}]\n`);

  await db.transaction(async (tx) => {
    // PHASE 1: HYDRATE GENOME (Raw Materials & 1:1 Recipes)
    for (const ext of EXTENSION_MANUFACTURED) {
      const rawId = `RAW-${ext.sku}`;
      const productSku = `COGS-${ext.sku}`;

      // 1a. Raw Material
      await tx.insert(raw_materials).values({
        id: rawId,
        supplierId: "UNKNOWN",
        name: ext.name.toUpperCase(),
        category: "EXTENSIONS",
        baseUnit: ext.recipeUnit,
        purchaseUnit: ext.purchaseUnit,
        recipeUnit: ext.recipeUnit,
        conversionFactor: ext.conversionFactor,
        grossCostCents: ext.cost_cents,
        trueCostPerUnitCents: Math.round(ext.cost_cents / ext.conversionFactor),
      }).onConflictDoUpdate({
        target: raw_materials.id,
        set: { grossCostCents: ext.cost_cents, trueCostPerUnitCents: Math.round(ext.cost_cents / ext.conversionFactor) },
      });

      // 1b. Material Mirror in Products (FK Integrity for Kardex)
      await tx.insert(products).values({
        id: rawId,
        sku: rawId,
        name: `[MAT] ${ext.name.toUpperCase()}`,
        category: "INGREDIENTES",
        item_type: "MANUFACTURED",
        isSaleable: false,
        costCents: Math.round(ext.cost_cents / ext.conversionFactor),
      }).onConflictDoNothing();

      // 1c. Product (Representing the sellable item for COGS linking)
      await tx.insert(products).values({
        id: productSku,
        sku: productSku,
        name: ext.name.toUpperCase(),
        category: "EXTENSIONS",
        item_type: "MANUFACTURED",
        isSaleable: true,
        costCents: ext.cost_cents,
      }).onConflictDoUpdate({
        target: products.id,
        set: { costCents: ext.cost_cents },
      });

      // 1c. 1:1 Recipe Linking
      await tx.insert(recipe_items).values({
        productSku,
        ingredientSku: rawId,
        quantity: 1,
      }).onConflictDoNothing();
    }
    console.log(`[INFO] Genoma expandido. ${EXTENSION_MANUFACTURED.length} mapeos COGS inyectados.`);

    // PHASE 2: SYSTEM LINK (Satisfy FK Constraints for Explosion Engine)
    const resolverSku = "SYSTEM-DLQ-RESOLVER";
    await tx.insert(products).values({
      id: resolverSku,
      sku: resolverSku,
      name: "DLQ RESOLUTION PARENT",
      category: "SYSTEM",
      item_type: "MANUFACTURED",
      isSaleable: false,
    }).onConflictDoNothing();

    const [parentTx] = await tx.insert(transactions).values({
      date: new Date().toISOString().split("T")[0],
      type: "ADJUSTMENT",
      productSku: resolverSku,
      quantity: 0,
      notes: "DLQ Re-reconciliation Batch",
      storeId: VALID_STORE_ID,
      referenceId: `DLQ-BATCH-${Date.now()}`,
    }).returning({ id: transactions.id });

    if (!parentTx?.id) {
      throw new Error("SRE FATAL: Failed to obtain parentTx.id for DLQ resolution batch.");
    }

    // PHASE 3: DRAIN DLQ
    const pending = await tx.select().from(sales_mapping_dlq).where(eq(sales_mapping_dlq.resolved, false));
    console.log(`[INFO] Procesando ${pending.length} ítems en DLQ...`);

    let resolvedCount = 0;
    let residualCount = 0;

    for (const dlqItem of pending) {
      // 3a. Capture raw name, remove PROD prefix and clean delimiters
      let rawName = dlqItem.raw_name.toUpperCase()
        .replace(/^PROD-/, "")
        .replace(/[-_]/g, " ");
      
      let multiplier = 1;
      let matchedSku: string | null = null;

      // 3b. Fuzzy Matcher (Multiplier): Only if it STARTS with a number
      const multiplierMatch = rawName.match(/^(\d+)\s+(.+)$/);
      if (multiplierMatch) {
        multiplier = parseInt(multiplierMatch[1], 10);
        rawName = multiplierMatch[2];
      }

      // 3c. Pattern Matching in FUZZY_MAP
      for (const [key, sku] of Object.entries(FUZZY_MAP)) {
        if (rawName.includes(key.toUpperCase())) {
          matchedSku = sku;
          break;
        }
      }

      if (matchedSku) {
        const totalQty = dlqItem.quantity * multiplier;
        
        try {
          // Re-explode through engine using the valid parentTx.id
          await TransactionExplosionEngine.explode(
            parentTx.id,
            VALID_STORE_ID,
            [{ sku: matchedSku, quantity: totalQty, unitPriceCents: dlqItem.price }],
            tx
          );

          // Update kardex entries created by this specific explosion to have descriptive reference
          await tx.update(inventory_kardex)
            .set({ referenceId: `DLQ-RESOLVED-${dlqItem.id}` })
            .where(eq(inventory_kardex.referenceId, `TICKET-${parentTx.id}`));

          // PHYSICAL DELETE from DLQ
          await tx.delete(sales_mapping_dlq).where(eq(sales_mapping_dlq.id, dlqItem.id));
          resolvedCount++;
        } catch (err) {
          console.error(`[ERROR] Explosion failed for ${rawName}:`, err);
          residualCount++;
        }
      } else {
        console.warn(`[WARN] DLQ Residual: ${dlqItem.raw_name}`);
        residualCount++;
      }
    }

    console.log(`\n════════════════════════════════════════`);
    console.log(`[INFO] Drenaje completado.`);
    console.log(`[INFO] Resueltos:  ${resolvedCount}`);
    console.log(`[INFO] Residuales: ${residualCount}`);
    console.log(`════════════════════════════════════════`);
  });

  console.log(`\n✅ RESOLUTION COMPLETE.`);
}

run().catch((err) => {
  console.error("❌ FATAL RESOLUTION FAILURE:", err);
  process.exit(1);
});
