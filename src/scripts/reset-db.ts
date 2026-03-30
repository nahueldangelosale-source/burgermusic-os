import { sql } from "drizzle-orm";
import { db } from "../db";

async function wipeDatabase() {
  console.log("🚨 INICIANDO WIPE RÁPIDO DE BASE DE DATOS TURSO (UAT RESET) 🚨");
  try {
    const tables = [
      "outbox_events",
      "ai_audit_logs",
      "payment_gateways_ledger",
      "supplier_metrics",
      "labor_costs",
      "api_keys",
      "sync_state",
      "daily_cash_closures",
      "inventory_snapshots",
      "receptions",
      "petty_cash_transactions",
      "receipt_items",
      "receipts",
      "transactions",
      "price_history",
      "bom_recipes",
      "mdm_ingredients",
      "recipes",
      "proc_po_items",
      "proc_purchase_orders",
      "proc_pr_items",
      "proc_purchase_requisitions",
      "proc_goods_receipts",
      "proc_invoice_receipts",
      "cash_register_transactions",
      "recurring_expenses",
      "accounts_payable",
      "inventory_kardex",
      "purchase_items",
      "purchases",
      "products",
      "suppliers",
      "users",
      "ingredient_quotes",
    ];

    for (const table of tables) {
      try {
        await db.run(sql.raw(`DELETE FROM ${table}`));
        console.log(`✔️ ${table} truncada.`);
      } catch (e: any) {
        // Si la tabla no existe o falla, la ignoramos silenciosamente
        if (e.message && !e.message.includes("no such table")) {
          console.log(`⚠️ ${table} error: ${e.message}`);
        }
      }
    }

    console.log("✅ UAT CANVAS PREPARADO. Base de datos vaciada con éxito.");
    process.exit(0);
  } catch (e) {
    console.error("Fallo general durante WIPE:", e);
    process.exit(1);
  }
}

wipeDatabase();
