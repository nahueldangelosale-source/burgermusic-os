import { sql } from "drizzle-orm";
import { db } from "../db";

async function createIngredientQuotesTable() {
  console.log("Iniciando DDL para Motor de Arbitraje...");
  try {
    const queries = [
      `CREATE TABLE IF NOT EXISTS ingredient_quotes (
            id TEXT PRIMARY KEY,
            supplier_id TEXT NOT NULL,
            ingredient_sku TEXT NOT NULL,
            price_cents INTEGER NOT NULL,
            updated_at INTEGER DEFAULT (strftime('%s', 'now')),
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
            FOREIGN KEY (ingredient_sku) REFERENCES products(id)
        );`,
      `CREATE UNIQUE INDEX IF NOT EXISTS supplier_ingredient_idx ON ingredient_quotes (supplier_id, ingredient_sku);`,
      `CREATE UNIQUE INDEX IF NOT EXISTS suppliers_cuit_unique_idx ON suppliers (cuit);`,
    ];

    for (const q of queries) {
      try {
        await db.run(sql.raw(q));
        console.log("Exito DDL:", q.substring(0, 50) + "...");
      } catch (e: any) {
        console.log("Omitido/Fallo DDL:", q.substring(0, 50) + "...", "->", e.message);
      }
    }

    console.log("Motor de Arbitraje inyectado en Turso DB exitosamente.");
  } catch (error) {
    console.error("Error global:", error);
  }
}

createIngredientQuotesTable().then(() => process.exit(0));
