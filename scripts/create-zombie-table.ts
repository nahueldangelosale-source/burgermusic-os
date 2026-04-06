import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const db = drizzle(client);

async function createZombieTable() {
  await db.run(sql`CREATE TABLE IF NOT EXISTS zombie_shift_audits (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    target_date TEXT NOT NULL,
    reported_margin_percent INTEGER NOT NULL,
    reported_revenue_cents INTEGER NOT NULL DEFAULT 0,
    reported_cogs_cents INTEGER NOT NULL DEFAULT 0,
    reported_shrinkage_cents INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PENDING',
    manager_justification TEXT,
    resolved_at TEXT,
    resolved_by TEXT,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
  )`);
  console.log("✅ zombie_shift_audits table created successfully");
  process.exit(0);
}

createZombieTable().catch(e => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
