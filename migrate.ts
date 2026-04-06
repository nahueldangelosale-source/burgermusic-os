import { db } from "./src/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Dropping conflicts...");
  // Drop goods_receipts related tables
  await db.run(sql`DROP TABLE IF EXISTS supplier_claims;`);
  await db.run(sql`DROP TABLE IF EXISTS goods_receipt_items;`);
  await db.run(sql`DROP TABLE IF EXISTS goods_receipts;`);
  
  // Also proc_goods_receipts just in case
  await db.run(sql`DROP TABLE IF EXISTS proc_goods_receipts;`);
  
  console.log("Done dropping!");
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
