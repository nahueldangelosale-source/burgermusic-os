import { db } from "../src/db";
import { fact_sales, sales_mapping_dlq, cash_register_transactions } from "../src/db/schema";
import { sql } from "drizzle-orm";

async function hardReset() {
  console.log("[SRE] Iniciando HARD RESET de las tablas de ingesta...");
  try {
    await db.delete(fact_sales);
    console.log("[OK] fact_sales purgada.");
    
    await db.delete(sales_mapping_dlq);
    console.log("[OK] sales_mapping_dlq purgada.");
    
    await db.delete(cash_register_transactions);
    console.log("[OK] cash_register_transactions purgada.");
    
    console.log("[SRE] HARD RESET COMPLETADO CON ÉXITO. Sistema en estado O(0).");
    process.exit(0);
  } catch(error) {
    console.error("[FATAL] Error en Hard Reset:", error);
    process.exit(1);
  }
}

hardReset();
