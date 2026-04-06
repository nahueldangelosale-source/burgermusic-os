import "dotenv/config";
import { rawIngestSalesCSV } from "../src/actions/sales-sync";
import { db } from "../src/db";
import { fact_sales } from "../src/db/schema";
import { desc } from "drizzle-orm";

const RUST_TEST_CSV = `FechaCaja;NroCaja;Descripcion;Suma de Cantidad; Suma de Precio
;;Cerveza Andes Roja;1;" $ 3.000,00 "
;;Charly Doble 220g;3;" $ 44.100,00 "
15/01/2026;1;Charly Simple 110g;2;" $ 23.400,00 "
;;Clasic Doble 220g;10;" $ 141.000,00 "
;;Clasic Simple 110g;9;" $ 99.900,00 "
;;Coca Cola 1.5 Lts;5;" $ 10.500,00 "`;

async function runAudit() {
  console.log("🚀 [SRE AUDIT] Iniciando inyección artificial ACID al motor de ventas...");
  
  // Simulated tenant storeId (usually "STORE_OWNER_1")
  const storeId = "STORE_OWNER_1";

  const result = await rawIngestSalesCSV(RUST_TEST_CSV, storeId);
  console.log("📝 [ETL RESULTADO BRUTO]:", JSON.stringify(result, null, 2));

  // Verify in DB
  const ventas = await db.select()
                         .from(fact_sales)
                         .orderBy(desc(fact_sales.createdAt))
                         .limit(5);

  console.log("🗄️  [ULTIMAS 5 VENTAS FÍSICAS EN TURSO]:");
  ventas.forEach(v => {
    console.log(` - ID: ${v.id.slice(0, 15)} | Fecha: ${v.date} | Desc: ${v.raw_name} | Qty: ${v.quantity} | NetPrice: ${v.net_price_cents} | NLP Meta: ${v.variant_metadata}`);
  });

  process.exit(0);
}

runAudit().catch(console.error);
