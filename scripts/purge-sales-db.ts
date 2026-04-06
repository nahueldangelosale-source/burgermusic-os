import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const db = drizzle(client);

async function purgeSales() {
  console.log("Purging fact_sales and sales_mapping_dlq to reset ETL state...");
  await db.run(sql`DELETE FROM fact_sales`);
  await db.run(sql`DELETE FROM sales_mapping_dlq`);
  console.log("State clean! The DB is ready for a fresh CSV import.");
  process.exit(0);
}
purgeSales();
