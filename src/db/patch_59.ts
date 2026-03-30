import { db } from "./index";
import { sql } from "drizzle-orm";

async function run() {
  try {
    await db.run(sql`ALTER TABLE fact_sales ADD COLUMN store_id TEXT DEFAULT 'centro';`);
    console.log("✅ Columna store_id agregada con éxito a fact_sales.");
  } catch (e: any) {
    if (e.message.includes("duplicate column name")) {
      console.log("⚠️ La columna store_id ya existe en fact_sales.");
    } else {
      console.error("❌ Error DB:", e.message);
    }
  }
}
run();
