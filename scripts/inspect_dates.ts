import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function checkDates() {
  const topRows = await db.all(sql`SELECT date, SUM(net_price_cents) / 100 as total FROM fact_sales GROUP BY date`);
  console.log("Daily Totals:", topRows);
  process.exit(0);
}

checkDates();
