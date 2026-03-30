import { db } from "../src/db";
import { products } from "../src/db/schema";
import { sql, eq } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config();

async function audit() {
  console.log("ENV URL:", process.env.TURSO_DATABASE_URL);
  
  const pdrCount = await db.run(sql`SELECT count(*) as c FROM products WHERE id LIKE 'PDR_%'`);
  console.log("PDR Products found:", pdrCount.rows[0].c);
  
  const allCount = await db.run(sql`SELECT count(*) as c FROM products`);
  console.log("Total Products found:", allCount.rows[0].c);

  const samples = await db.run(sql`SELECT id FROM products ORDER BY id DESC LIMIT 5`);
  console.log("Latest IDs:", JSON.stringify(samples.rows));

  process.exit(0);
}

audit();
