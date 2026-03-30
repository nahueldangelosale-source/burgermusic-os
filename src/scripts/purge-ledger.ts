import { db } from "../db";
import { fact_sales, cash_register_transactions } from "../db/schema";

async function purgeLedger() {
  console.log("======================================================");
  console.log("🛡️  COMMAND CENTER SRE: Transactional Purge Protocol  🛡️");
  console.log("======================================================");
  console.log("\n[INICIANDO] Evaluando conexión con Cúmulo SQLite (Turso)...");
  
  try {
    // 1. Borrado O(1) en cascada de Arqueos de Caja
    console.log("[BORRANDO] Aniquilando registros en cash_register_transactions...");
    await db.delete(cash_register_transactions);
    
    // 2. Borrado O(1) en cascada de Facturación Cruda
    console.log("[BORRANDO] Aniquilando registros en fact_sales...");
    await db.delete(fact_sales);

    console.log("\n======================================================");
    console.log("✅ EJECUCIÓN EXITOSA: El Entorno Transaccional está ESTÉRIL.");
    console.log("   (Las tablas dimensionales como Empleados o Inventario están intactas).");
    console.log("======================================================\n");
    
    process.exit(0);
  } catch (error: any) {
    console.error("\n[⛔ FATAL ERROR] La purga Zero-Trust fue interceptada por el ORM:");
    console.error(error.message);
    process.exit(1);
  }
}

purgeLedger();
