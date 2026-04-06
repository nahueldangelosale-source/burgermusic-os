/**
 * BurgerMusic OS — Hard Reset: Sales Entropy Purge V1.0
 * ─────────────────────────────────────────────────────
 * ACID transaction purge of fact_sales and cash_register_closures.
 * Required to eliminate duplicated data from ETL cross-contamination.
 *
 * Execution: npx tsx src/scripts/purge-sales.ts
 */
import "dotenv/config";

import { db } from "../db";
import { fact_sales } from "../db/schema";
import { cash_register_closures } from "../db/schema/treasury";
import { sql } from "drizzle-orm";

async function purgeSalesEntropy() {
  console.log("🔥 [PURGE V1.0] Iniciando Hard Reset de Entropía Financiera...\n");

  await db.transaction(async (tx) => {
    // 1. Purge cash_register_closures
    const closuresResult = await tx.delete(cash_register_closures).returning({ id: cash_register_closures.id });
    console.log(`  ✅ cash_register_closures: ${closuresResult.length} registros eliminados.`);

    // 2. Purge fact_sales
    const salesResult = await tx.delete(fact_sales).returning({ id: fact_sales.id });
    console.log(`  ✅ fact_sales: ${salesResult.length} registros eliminados.`);

    // 3. Reset auto-incremental counters if applicable
    try {
      await tx.run(sql`DELETE FROM sqlite_sequence WHERE name IN ('fact_sales', 'cash_register_closures');`);
      console.log(`  ✅ Secuencias SQLite reiniciadas (si aplicaban).`);
    } catch(e) {
      // Ignore if sqlite_sequence does not exist
    }
  });

  console.log("\n🎯 [PURGE V1.0] Hard Reset completo. Base de datos limpia.");
  console.log("   → Procede a re-ingestar con los embudos aislados.\n");
  process.exit(0);
}

purgeSalesEntropy().catch((err) => {
  console.error("❌ [PURGE] FALLA CATASTRÓFICA:", err);
  process.exit(1);
});
