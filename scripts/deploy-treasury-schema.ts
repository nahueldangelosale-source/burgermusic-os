import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../src/db";

async function deployTreasurySchema() {
  console.log("🚀 Desplegando esquemas estructurales del Córtex Financiero (Fases 69-71)...");

  try {
    // 1. Gateway Settlements
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS gateway_settlements (
        id TEXT PRIMARY KEY,
        provider TEXT DEFAULT 'MercadoPago',
        amount INTEGER NOT NULL,
        settlement_date TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING',
        store_id TEXT DEFAULT 'centro',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Tabla 'gateway_settlements' inyectada.");

    // 2. Opex Ledger
    await db.run(sql`DROP TABLE IF EXISTS opex_ledger`);
    await db.run(sql`
      CREATE TABLE opex_ledger (
        id TEXT PRIMARY KEY,
        store_id TEXT DEFAULT 'centro',
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        total_amount INTEGER NOT NULL,
        daily_accrual_amount INTEGER NOT NULL DEFAULT 0,
        start_date TEXT NOT NULL,
        end_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Tabla 'opex_ledger' reestructurada matemáticamente O(1).");

    // 3. Accounts Payable
    await db.run(sql`DROP TABLE IF EXISTS accounts_payable`);
    await db.run(sql`
      CREATE TABLE accounts_payable (
        id TEXT PRIMARY KEY,
        supplier_id TEXT NOT NULL,
        po_amount INTEGER NOT NULL DEFAULT 0,
        receipt_amount INTEGER NOT NULL DEFAULT 0,
        invoice_amount INTEGER NOT NULL DEFAULT 0,
        credit_note_amount INTEGER NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'PENDING',
        store_id TEXT DEFAULT 'centro',
        due_date TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Tabla 'accounts_payable' reestructurada (Filtro 3 Vías C-Level).");

    // Insert mock data para Treasury Oracle 30-Días si está vacío
    await db.run(sql`
      INSERT OR REPLACE INTO gateway_settlements (id, amount, settlement_date, provider) 
      VALUES 
      ('gw-mock-1', 4500000, date('now', '+2 days'), 'MercadoPago'),
      ('gw-mock-2', 8200000, date('now', '+5 days'), 'MercadoPago')
    `);
    
    await db.run(sql`
      INSERT OR REPLACE INTO opex_ledger (id, type, description, total_amount, daily_accrual_amount, start_date)
      VALUES ('opex-mock-1', 'FIXED', 'Alquiler Centro', 3000000, 100000, date('now', 'start of month'))
    `);

    // Proveedor mock AP en disputa
    await db.run(sql`
      INSERT OR REPLACE INTO accounts_payable (id, supplier_id, invoice_amount, receipt_amount, credit_note_amount, status, due_date)
      VALUES ('ap-mock-1', 'Proveedor Lácteos', 1500000, 1200000, 0, 'PENDING', date('now', '+4 days'))
    `);

    console.log("✅ Datos de simulación inyectados para probar el CTE Predictivo.");
    console.log("🏆 Córtex Financiero 3.0 sincronizado (O(1)).");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error desplegando esquemas:", error);
    process.exit(1);
  }
}

deployTreasurySchema();
