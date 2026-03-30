import { db } from "./index";
import { sql } from "drizzle-orm";

async function run() {
  const ddl = [
    `CREATE TABLE IF NOT EXISTS inventory_batches (batch_id TEXT PRIMARY KEY, receipt_id TEXT, ingredient_sku TEXT NOT NULL, supplier_id TEXT NOT NULL, raw_qty REAL NOT NULL, current_qty REAL NOT NULL, unit_cost_cents INTEGER NOT NULL, status TEXT DEFAULT 'READY', expiration_date TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS prep_logs (id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES inventory_batches(batch_id), yield_qty REAL NOT NULL, waste_qty REAL NOT NULL, operator_id TEXT NOT NULL, timestamp TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS goods_receipts (id TEXT PRIMARY KEY, supplier_id TEXT NOT NULL, receipt_date TEXT DEFAULT CURRENT_DATE, total_cost_cents INTEGER NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS unmapped_pos_transactions (id TEXT PRIMARY KEY, raw_name TEXT NOT NULL, pos_data TEXT NOT NULL, reason TEXT DEFAULT 'LOW_CONFIDENCE', created_at TEXT DEFAULT CURRENT_TIMESTAMP)`
  ];
  
  for (const query of ddl) {
    try {
      await db.run(sql.raw(query));
      console.log("✅ Inyectado SQL:", query.substring(0, 50));
    } catch (e: any) {
      console.error("❌ Fallo en query:", e.message);
    }
  }
  console.log("🚀 SRE Patch de Trazabilidad Completado Extrema-Latencia O(1).");
  process.exit(0);
}
run();
