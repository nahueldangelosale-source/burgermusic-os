// biome-ignore all: legacy script
// scripts/migrate-ledger.ts
// Migración: Convierte datos existentes al patrón Ledger con signos correctos.
// Ejecutar: npx tsx scripts/migrate-ledger.ts

import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { db } from "../src/db";
import { transactions } from "../src/db/schema";

async function migrateLedger() {
  console.log("🔄 Iniciando migración Ledger...\n");

  // 1. Renombrar PURCHASE → RECEIPT
  const purchaseResult = await db.run(
    sql`UPDATE transactions SET type = 'RECEIPT' WHERE type = 'PURCHASE'`,
  );
  console.log(`✅ Paso 1: Renombrado PURCHASE → RECEIPT`);

  // 2. Convertir cantidades de SALE a negativas (solo las que aún son positivas)
  const saleResult = await db.run(
    sql`UPDATE transactions SET quantity = quantity * -1 WHERE type = 'SALE' AND quantity > 0`,
  );
  console.log(`✅ Paso 2: Cantidades de SALE convertidas a negativas`);

  // 3. Agregar costCentsAtTime a transacciones que no lo tengan
  //    Usamos el costo actual del producto como mejor estimación retroactiva
  const txRows = await db.select().from(transactions);
  let costUpdated = 0;

  for (const tx of txRows) {
    if (!tx.costCentsAtTime || tx.costCentsAtTime === 0) {
      await db.run(
        sql`UPDATE transactions 
                    SET cost_cents_at_time = (
                        SELECT COALESCE(cost_cents, 0) FROM products WHERE id = ${tx.productSku}
                    )
                    WHERE id = ${tx.id}`,
      );
      costUpdated++;
    }
  }
  console.log(`✅ Paso 3: costCentsAtTime retroactivo aplicado a ${costUpdated} transacciones`);

  // 4. Verificación final
  const summary = await db.run(
    sql`SELECT type, COUNT(*) as cnt, SUM(quantity) as total_qty FROM transactions GROUP BY type`,
  );
  console.log("\n📊 Resumen post-migración:");
  console.log(summary);

  console.log("\n✅ Migración Ledger completada exitosamente.");
  process.exit(0);
}

migrateLedger().catch((err) => {
  console.error("❌ Error en migración:", err);
  process.exit(1);
});
