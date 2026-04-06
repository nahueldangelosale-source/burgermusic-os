import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function run() {
  const res = await db.run(sql`PRAGMA table_info('fact_sales');`);
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}
run().catch(console.error);
