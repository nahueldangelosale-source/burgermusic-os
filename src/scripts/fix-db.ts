import { loadEnvConfig } from "@next/env";
import { sql } from "drizzle-orm";
import { db } from "../db";
loadEnvConfig(process.cwd());

async function fix() {
  try {
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS mdm_ingredients (
        id TEXT PRIMARY KEY,
        canonical_name TEXT NOT NULL UNIQUE,
        yield_percentage REAL NOT NULL DEFAULT 1.0
      );
    `);
    console.log("✅ Created mdm_ingredients");
  } catch (e) {
    console.log(e);
  }

  try {
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS bom_recipes (
        id TEXT PRIMARY KEY,
        product_sku TEXT REFERENCES products(id),
        ingredient_id TEXT REFERENCES mdm_ingredients(id),
        theoretical_qty REAL NOT NULL
      );
    `);
    console.log("✅ Created bom_recipes");
  } catch (e) {
    console.log(e);
  }

  process.exit(0);
}

fix();
