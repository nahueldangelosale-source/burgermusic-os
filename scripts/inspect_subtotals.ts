import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function checkSubtotals() {
  const topRows = await db.all(sql`SELECT date, raw_name, quantity, net_price_cents FROM fact_sales ORDER BY net_price_cents DESC LIMIT 20`);
  console.log("Top single rows by value:");
  console.log(topRows);
  process.exit(0);
}

checkSubtotals();
