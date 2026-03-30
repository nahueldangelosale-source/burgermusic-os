import "dotenv/config";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function patch() {
  console.log("Patching products table (item_type)...");
  try {
    await db.run(sql`ALTER TABLE products ADD COLUMN item_type TEXT;`);
  } catch (e: any) {}

  console.log("Patching inventory_kardex table (reference_id)...");
  try {
    await db.run(sql`ALTER TABLE inventory_kardex ADD COLUMN reference_id TEXT;`);
  } catch (e: any) {}

  console.log("Creating transaction_items table...");
  try {
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS transaction_items (
        id TEXT PRIMARY KEY,
        transaction_id INTEGER REFERENCES transactions(id),
        product_sku TEXT REFERENCES products(id),
        quantity REAL NOT NULL,
        frozen_unit_price_cents INTEGER NOT NULL,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      );
    `);
  } catch (e: any) {}

  console.log("Creating recipe_items table...");
  try {
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS recipe_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_sku TEXT NOT NULL REFERENCES products(id),
        ingredient_sku TEXT NOT NULL REFERENCES products(id),
        quantity REAL NOT NULL,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      );
    `);
  } catch (e: any) {}

  console.log("Patch applied.");
  process.exit(0);
}

patch();
