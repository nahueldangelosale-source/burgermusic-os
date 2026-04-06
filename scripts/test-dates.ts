import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const db = drizzle(client);

async function auditDates() {
  const dates = await db.all(sql`SELECT date, count(*) as count FROM fact_sales GROUP BY date ORDER BY date ASC`);
  console.log("DATES IN DB:");
  console.table(dates);
  
  process.exit(0);
}
auditDates();
