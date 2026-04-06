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

async function checkRows() {
  const result = await db.all(sql`SELECT count(*) as total FROM fact_sales`);
  console.log("TOTAL ROWS IN FACT_SALES:", result);
  
  const sample = await db.all(sql`SELECT * FROM fact_sales LIMIT 5`);
  console.log("SAMPLE:");
  console.log(sample);
  
  process.exit(0);
}
checkRows().catch(console.error);
