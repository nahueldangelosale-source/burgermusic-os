import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function checkClassicMapping() {
  const unlinked = await db.all(sql`SELECT raw_name, COUNT(*) as c FROM fact_sales WHERE product_sku = 'PRD_CLASSIC' GROUP BY raw_name ORDER BY c DESC`);
  console.log("Items mapped to PRD_CLASSIC (Unlinked Default):");
  console.table(unlinked);
  process.exit(0);
}

checkClassicMapping();
