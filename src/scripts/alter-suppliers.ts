import { sql } from "drizzle-orm";
import { db } from "../db";

async function alterSuppliers() {
  console.log("Iniciando ALTER TABLE para Suppliers...");
  try {
    // Tolerancia a fallos iterativa: si la columna existe, SQLite atrapa el error pero continuamos.
    const queries = [
      "ALTER TABLE suppliers ADD COLUMN phone TEXT;",
      "ALTER TABLE suppliers ADD COLUMN address TEXT;",
      "ALTER TABLE suppliers ADD COLUMN payment_methods TEXT DEFAULT '[\"TRANSFERENCIA\"]';",
      "ALTER TABLE suppliers ADD COLUMN invoice_type TEXT DEFAULT 'FACTURA';",
    ];

    for (const q of queries) {
      try {
        await db.run(sql.raw(q));
        console.log("Éxito:", q);
      } catch (e: any) {
        console.log("Omitido (posiblemente existente):", q, "->", e.message);
      }
    }

    console.log("Columnas inyectadas correctamente en Turso DB.");
  } catch (error) {
    console.error("Error global:", error);
  }
}

alterSuppliers().then(() => process.exit(0));
