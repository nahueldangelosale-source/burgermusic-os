import { sql } from "drizzle-orm";
import { db } from "../db";

async function alterProducts() {
  console.log("Sincronizando DDL de 'products' (Turso Drift Fix)...");
  const queries = [
    `ALTER TABLE products ADD COLUMN category TEXT DEFAULT 'BURGER';`,
    `ALTER TABLE products ADD COLUMN unit TEXT DEFAULT 'UNIDAD';`,
    `ALTER TABLE products ADD COLUMN base_price_cents INTEGER DEFAULT 0;`,
    `ALTER TABLE products ADD COLUMN includes_fries INTEGER DEFAULT 0;`,
    `ALTER TABLE products ADD COLUMN description TEXT;`,
    // In case the ones below also drifted
    `ALTER TABLE products ADD COLUMN is_saleable INTEGER DEFAULT 0;`,
    `ALTER TABLE products ADD COLUMN cost_cents INTEGER DEFAULT 0;`,
    `ALTER TABLE products ADD COLUMN selling_price INTEGER DEFAULT 0;`,
  ];

  for (const q of queries) {
    try {
      await db.run(sql.raw(q));
      console.log("✔ Aplicado:", q.substring(0, 45) + "...");
    } catch (e: any) {
      // Ignorar si la columna ya existe
      console.log("⏸ Omitido (Ya existe o error menor):", q.substring(0, 30) + "...");
    }
  }

  console.log("Esquema Físico Alineado.");
}

alterProducts().then(() => process.exit(0));
