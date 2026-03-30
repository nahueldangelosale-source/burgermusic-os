import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function checkDb() {
  const rows = await db.all(sql`SELECT product_sku, quantity, net_price_cents FROM fact_sales LIMIT 5`);
  console.log(rows);
  process.exit(0);
}

checkDb();
