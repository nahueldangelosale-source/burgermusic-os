import { sql } from "drizzle-orm";
import { db } from "../src/db";

async function dropLegacyTables() {
  console.log("🚨 DROPPING LEGACY PURCHASES TABLES 🚨");
  try {
    await db.run(sql.raw(`DROP TABLE IF EXISTS purchase_items`));
    console.log("✔️ purchase_items dropped.");
    await db.run(sql.raw(`DROP TABLE IF EXISTS purchases`));
    console.log("✔️ purchases dropped.");
    console.log("✅ Tables dropped. Ready for drizzle-kit push.");
    process.exit(0);
  } catch (e: any) {
    console.error("Error dropping tables:", e);
    process.exit(1);
  }
}

dropLegacyTables();
