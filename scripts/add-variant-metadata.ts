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

async function addVariantMetadata() {
  try {
    await db.run(sql`ALTER TABLE fact_sales ADD COLUMN variant_metadata TEXT`);
    console.log("✅ variant_metadata column added to fact_sales");
  } catch (e: any) {
    if (e.message?.includes("duplicate column") || e.message?.includes("already exists")) {
      console.log("⚠️ variant_metadata column already exists in fact_sales.");
    } else {
      throw e;
    }
  }
  process.exit(0);
}

addVariantMetadata().catch(e => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
