import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function run() {
  const result = await db.all(sql`SELECT COUNT(*) as actions, SUM(net_price_cents) as gross_cents FROM fact_sales`);
  console.log("Global Fact Sales:", result);
}
run();
