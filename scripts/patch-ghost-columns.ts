import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const db = drizzle(client);

async function patchSchema() {
  console.log("🛠️ Inyectando columnas fantasma en Turso...");
  
  const queries = [
    `ALTER TABLE fact_sales ADD COLUMN ticket_hash TEXT;`,
    `CREATE UNIQUE INDEX IF NOT EXISTS fact_sales_ticket_hash_unique ON fact_sales(ticket_hash);`
  ];

  for (const q of queries) {
    try {
      await db.run(sql.raw(q));
      console.log(`✅ Ejecutado: ${q}`);
    } catch (e: any) {
      if (e.message?.includes("duplicate column") || e.message?.includes("already exists")) {
        console.log(`⚠️ Ignorado (ya existe): ${q}`);
      } else {
        console.error(`❌ Error en ${q}:`, e.message);
      }
    }
  }

  process.exit(0);
}

patchSchema().catch(console.error);
