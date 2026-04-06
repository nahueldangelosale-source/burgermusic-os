import { db } from "../src/db"; 
import { sales_mapping_dlq, fact_sales } from "../src/db/schema"; 
import { sql } from "drizzle-orm";

async function auditLedger() {
  console.log("\x1b[36m\n🛡️ [SRE] Iniciando Auditoría Forense Zero-Trust del Ledger...\x1b[0m\n");

  try {
    // 1. Auditoría de Deuda Técnica (Purgatorio DLQ)
    const dlqResult = await db.select({ count: sql<number>`count(*)` })
      .from(sales_mapping_dlq)
      .where(sql`resolved = 0 OR resolved IS FALSE`);

    const orphansCount = dlqResult[0]?.count || 0;

    if (orphansCount > 0) {
      console.log(`\x1b[31m❌ [ALERTA DE DEUDA]: ${orphansCount} Activos Zombies detectados en el Purgatorio (DLQ).\x1b[0m`);
    } else {
      console.log(`\x1b[32m✅ [ZERO-DEBT CONFIRMED]: 0 Registros Huérfanos. Purgatorio inmaculado.\x1b[0m`);
    }

    // 2. Agregación del Total Strategic Value (TSV) - Fuerza Bruta O(1)
    const tsvResult = await db.select({ total_cents: sql<number>`sum(net_price_cents)` })
      .from(fact_sales);

    const totalCents = tsvResult[0]?.total_cents || 0;
    const totalArs = (totalCents / 100).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

    console.log(`\x1b[33m🔥 [TSV RECOVERED]: ${totalArs} ARS asimilados en el Ledger inmutable.\x1b[0m\n`);
    
    console.log("\x1b[32m✅ Auditoría Finalizada con Exit Code 0.\x1b[0m");
    process.exit(0);

  } catch (error) {
    console.error("\x1b[31m❌ [FATAL ERROR] Falla en la validación del Ledger:\x1b[0m", error);
    process.exit(1);
  }
}

auditLedger();
