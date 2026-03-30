import { db } from "../src/db";
import { sql } from "drizzle-orm";
import { sales_mapping_dlq, fact_sales } from "../src/db/schema";

async function checkDLQ() {
  const dlqCount = await db.all(sql`SELECT COUNT(*) as c FROM sales_mapping_dlq`);
  const salesCount = await db.all(sql`SELECT COUNT(*) as c FROM fact_sales`);
  
  const dlqSum = await db.all(sql`SELECT SUM(price) as s FROM sales_mapping_dlq`);
  const salesSum = await db.all(sql`SELECT SUM(net_price_cents) as s FROM fact_sales`);
  
  const res = await db.select().from(sales_mapping_dlq).limit(10);
  console.log("DLQ Records:", res);

  console.log("DLQ Rows:", (dlqCount[0] as any).c, "| Valid Rows:", (salesCount[0] as any).c);
  console.log("DLQ Cents:", (dlqSum[0] as any).s, "| Valid Cents:", (salesSum[0] as any).s);
  
  const topMisses = await db.all(sql`SELECT raw_name, COUNT(*) as c FROM sales_mapping_dlq GROUP BY raw_name ORDER BY c DESC LIMIT 10`);
  console.log("Top SKU Misses:", topMisses);
  process.exit(0);
}

checkDLQ();
