import { sql } from "drizzle-orm";
import { db } from "../db";

async function runGenesisAudit() {
  console.log("\n========================================================");
  console.log("🚀 [ZERO-TRUST] CERTIFICACIÓN DE GÉNESIS & ETL TELEMETRÍA 🚀");
  console.log("========================================================\n");

  try {
    await db.transaction(async (tx) => {
      console.log("⏳ [1/3] Evaluando fact_sales (total_sales_revenue)...");
      const salesRes = (await tx.all(
        sql`SELECT SUM(net_price_cents) as total_sales_revenue FROM fact_sales`,
      )) as any[];
      const totalSales = salesRes[0]?.total_sales_revenue;

      console.log("⏳ [2/3] Evaluando bom_recipes (bom_recipes_mapped)...");
      const bomRes = (await tx.all(
        sql`SELECT COUNT(*) as bom_recipes_mapped FROM bom_recipes`,
      )) as any[];
      const totalBom = bomRes[0]?.bom_recipes_mapped;

      console.log("⏳ [3/3] Evaluando cash_register_transactions (cashflow_anomalies)...");
      const cashRes = (await tx.all(
        sql`SELECT SUM(diferencias_cents) as cashflow_anomalies FROM cash_register_transactions`,
      )) as any[];
      const totalAnomalies = cashRes[0]?.cashflow_anomalies;

      console.log("\n📊 --- MATRIZ DE TELEMETRÍA --- 📊");
      console.log(
        `> Ingresos Brutos (Fact Sales):    $${totalSales != null ? (Number(totalSales) / 100).toLocaleString("es-AR") : "0.00"}`,
      );
      console.log(`> Recetas BOM Mapeadas:            ${totalBom || 0} items`);
      console.log(
        `> Anomalías Cashflow Detectadas:   $${totalAnomalies != null ? (Number(totalAnomalies) / 100).toLocaleString("es-AR") : "0.00"}`,
      );
      console.log("----------------------------------\n");

      if (totalSales === null || totalSales === undefined || Number(totalSales) === 0) {
        console.error(
          "❌ ERROR FATAL: Fallo Crítico de Ingesta ETL. (total_sales_revenue = 0 | NULL)",
        );
        console.error(
          "El Ledger transaccional está vacío o desconfigurado. Bloqueando despliegue.\n",
        );
        throw new Error("ETL_CRITICAL_FAILURE");
      }
    });

    console.log("✅ Certificación de Génesis: EXITOSA. El Data Warehouse está sincronizado.");
    process.exit(0);
  } catch (error: any) {
    console.error("❌ EXCEPCIÓN DE SISTEMA: Fallo al ejecutar la auditoría O(1).");
    console.error(error.message);
    process.exit(1);
  }
}

runGenesisAudit();
