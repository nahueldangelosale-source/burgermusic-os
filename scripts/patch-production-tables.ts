import "dotenv/config";
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

async function patchSchema() {
  console.log("🔧 Inyectando tablas de producción...");

  await client.execute(`
    CREATE TABLE IF NOT EXISTS production_batches (
      id TEXT PRIMARY KEY NOT NULL,
      store_id TEXT NOT NULL,
      produced_ingredient_id TEXT NOT NULL,
      quantity_produced INTEGER NOT NULL,
      total_cost_cents INTEGER NOT NULL,
      cost_per_unit_cents INTEGER NOT NULL,
      yield_factor REAL NOT NULL DEFAULT 8.1,
      notes TEXT,
      created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
    )
  `);
  console.log("  ✅ production_batches");

  await client.execute(`
    CREATE TABLE IF NOT EXISTS production_batch_inputs (
      id TEXT PRIMARY KEY NOT NULL,
      batch_id TEXT NOT NULL,
      ingredient_id TEXT NOT NULL,
      quantity_used_grams INTEGER NOT NULL,
      unit_cost_cents INTEGER NOT NULL,
      created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
    )
  `);
  console.log("  ✅ production_batch_inputs");

  try {
    await client.execute(`ALTER TABLE mdm_ingredients ADD COLUMN ingredient_type TEXT NOT NULL DEFAULT 'PURCHASED_READY'`);
    console.log("  ✅ ingredient_type columna añadida a mdm_ingredients");
  } catch (e: any) {
    if (e.message?.includes("duplicate column")) {
      console.log("  ⏭️  ingredient_type ya existe (skip)");
    } else {
      throw e;
    }
  }

  console.log("\n✅ [ZERO-DRIFT] Tablas de producción sincronizadas.");
  process.exit(0);
}

patchSchema().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
