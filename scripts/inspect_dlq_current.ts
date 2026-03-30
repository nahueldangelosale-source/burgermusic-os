// @ts-nocheck
import { db } from "../src/db";
import { sql } from "drizzle-orm";
import { sales_mapping_dlq } from "../src/schemas/transactions";

async function checkDLQ() {
  const unresolved = await db.all(sql`SELECT raw_name, COUNT(*) as c, SUM(price) as total_price FROM sales_mapping_dlq WHERE resolved = 0 GROUP BY raw_name ORDER BY c DESC`);
  console.log("Unresolved Items in DLQ:");
  console.table(unresolved);
  process.exit(0);
}

checkDLQ();
