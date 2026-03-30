import "dotenv/config";
import { db } from "../db";
import { sql } from "drizzle-orm";

async function migrate() {
  try {
    console.log("🛠️  Applying manual migration: ADD COLUMN store_id to sales_mapping_dlq...");
    // Since it's SQLite, we might need to handle NOT NULL if the table is empty
    await db.run(sql`ALTER TABLE sales_mapping_dlq ADD COLUMN store_id TEXT NOT NULL DEFAULT 'SYSTEM'`);
    console.log("✅ Column added successfully.");
  } catch (err) {
    console.warn("⚠️  Migration might have already been applied or failed:", err);
  }
}

migrate();
