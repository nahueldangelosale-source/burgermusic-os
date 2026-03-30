import { sql } from "drizzle-orm";
import { db } from "../db";

async function fixIndex() {
  console.log("Fixing Turso missing index to unblock Drizzle...");
  try {
    await db.run(
      sql.raw(`CREATE TABLE IF NOT EXISTS "mdm_ingredients" ("id" text, "canonical_name" text);`),
    );
    await db.run(
      sql.raw(
        `CREATE INDEX IF NOT EXISTS "mdm_ingredients_canonical_name_unique" ON "mdm_ingredients" ("canonical_name");`,
      ),
    );
    console.log("✅ Dummy Index created successfully.");
    process.exit(0);
  } catch (e) {
    console.error("Error creating index:", e);
    process.exit(1);
  }
}
fixIndex();
