import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function checkDLQ() {
  const dlqSum = await db.all(sql`SELECT SUM(price) as s FROM sales_mapping_dlq`);
  const topMisses = await db.all(sql`SELECT raw_name, SUM(price) as total_price, COUNT(*) as c FROM sales_mapping_dlq GROUP BY raw_name ORDER BY total_price DESC LIMIT 20`);
  
  console.log("Remaining DLQ Cents:", (dlqSum[0] as any).s);
  console.log("Top Misses by Volume:", topMisses);
  process.exit(0);
}

checkDLQ();
