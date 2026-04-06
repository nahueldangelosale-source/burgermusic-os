import * as dotenv from "dotenv";
dotenv.config();

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";

async function forensicAudit() {
  const client = createClient({ 
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN 
  });
  const db = drizzle(client);

  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   AUDITORÍA FORENSE POST-MIGRACIÓN V3.1         ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`DB URL: ${process.env.TURSO_DATABASE_URL}`);
  
  // 1. Conteo total de filas en fact_sales
  const countResult = await db.all(sql`SELECT COUNT(*) as total FROM fact_sales`);
  console.log(`\n[FACT_SALES] Total registros: ${(countResult[0] as any).total}`);

  // 2. Verificar que las nuevas columnas existen
  const sampleRows = await db.all(sql`
    SELECT id, historical_cost_cents, historical_price_cents, depleted, status, ticket_number, payment_method
    FROM fact_sales LIMIT 3
  `);
  console.log("\n[SAMPLE] Primeros 3 registros con columnas V3.1:");
  for (const row of sampleRows as any[]) {
    console.log(`  ID: ${row.id} | hist_cost: ${row.historical_cost_cents} | hist_price: ${row.historical_price_cents} | depleted: ${row.depleted} | status: ${row.status}`);
  }

  // 3. Verificar integridad de columnas legacy
  const integrityCheck = await db.all(sql`
    SELECT 
      SUM(CASE WHEN date IS NULL THEN 1 ELSE 0 END) as null_dates,
      SUM(CASE WHEN product_sku IS NULL THEN 1 ELSE 0 END) as null_skus,
      SUM(CASE WHEN net_price_cents IS NULL THEN 1 ELSE 0 END) as null_prices
    FROM fact_sales
  `);
  const ic = integrityCheck[0] as any;
  console.log(`\n[INTEGRITY] NULLs en columnas legacy: dates=${ic.null_dates}, skus=${ic.null_skus}, prices=${ic.null_prices}`);

  // 4. Verificar tablas de modificadores creadas
  const tableCheck = await db.all(sql`
    SELECT name FROM sqlite_master WHERE type='table' AND name IN ('modifiers', 'modifier_ingredients', 'product_modifiers')
  `);
  console.log(`\n[MODIFIERS ARCHITECTURE] Tablas creadas: ${(tableCheck as any[]).map((t: any) => t.name).join(', ') || 'NINGUNA'}`);

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   AUDITORÍA FORENSE COMPLETA                     ║");
  console.log("╚══════════════════════════════════════════════════╝");

  process.exit(0);
}

forensicAudit().catch(e => { console.error("FATAL:", e); process.exit(1); });
