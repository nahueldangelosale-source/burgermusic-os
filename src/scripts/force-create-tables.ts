import { sql } from "drizzle-orm";
import { db } from "../db";

async function forceCreate() {
  await db.run(sql`CREATE TABLE IF NOT EXISTS accounts_payable (
    id TEXT PRIMARY KEY,
    cuit TEXT NOT NULL,
    invoice_number TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT,
    status TEXT DEFAULT 'PENDING',
    store_id TEXT DEFAULT 'centro',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await db.run(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS ap_invoice_cuit_idx ON accounts_payable (invoice_number, cuit)`,
  );

  await db.run(sql`CREATE TABLE IF NOT EXISTS opex_ledger (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    store_id TEXT DEFAULT 'centro',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  console.log("Tablas forzadas exitosamente.");
}

forceCreate()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
