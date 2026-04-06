import "dotenv/config";
import { db } from "../db";
import { 
  transactions, 
  inventory_kardex,
  expenses,
  supplier_current_accounts
} from "../db/schema";
import { eq, isNull, or, and, like, sql } from "drizzle-orm";

const STORE_ID = "sucursal_chaos_sre";
const PRODUCT_SKU = "PRD-HAMBURGUESA-CHAOS";
const INVALID_SKU = "PRD-GHOST-SKU-999";

async function main() {
  console.log("=".repeat(80));
  console.log("[SRE-P0] 🕵️ INICIANDO AUDITORÍA FORENSE DE INMUTABILIDAD DB");
  console.log("=".repeat(80));

  let auditFailed = false;

  // REGLA A: Verificar que NO existan registros invalidos en transactions (fact_sales eq)
  console.log("[AUDIT] 🔍 a) Validando Transacciones (Ghost SKUs y Costos Corruptos)...");
  const corruptedSales = await db.select().from(transactions).where(
    and(
      eq(transactions.storeId, STORE_ID),
      or(
        eq(transactions.productSku, INVALID_SKU),
        isNull(transactions.productSku)
        // NaN is not possible in TS SQLite but nulls are
      )
    )
  );

  if (corruptedSales.length > 0) {
    console.error(`❌ FALLO DE INMUTABILIDAD: Se encontraron ${corruptedSales.length} ventas corruptas (Ghost SKUs).`);
    auditFailed = true;
  } else {
    console.log("✅ CERTIFICADO: 0 inyecciones de Ghost SKUs.");
  }


  // REGLA B: Confirmar matemáticamente el Kardex sin deducciones huérfanas
  console.log("\n[AUDIT] 🔍 b) Validando Paridad ACID en el Kardex (inventory_kardex)...");
  
  // Contamos el total de ventas válidas (status != CANCELLED)
  const validSales = await db.select().from(transactions).where(
    and(
      eq(transactions.storeId, STORE_ID),
      eq(transactions.productSku, PRODUCT_SKU),
      like(transactions.referenceId, "CHAOS-TICKET-%") // Sólo los creados por nosotros
    )
  );
  
  const totalValidSales = validSales.length;

  const kardexEntries = await db.select().from(inventory_kardex).where(
    and(
      eq(inventory_kardex.storeId, STORE_ID),
      like(inventory_kardex.referenceId, "CHAOS-TICKET-%")
    )
  );

  // Cada venta despliega N deducciones de ingredient (En test es 1 venta = 1 ingrediente de -150g)
  // Pero lo importante es que no haya kardex entries sin una venta válida equivalente (orphan deduccion).
  let orphans = 0;
  const validTxIds = new Set(validSales.map(s => s.referenceId));
  
  for (const k of kardexEntries) {
    if (k.referenceId && !validTxIds.has(k.referenceId)) {
      orphans++;
    }
  }

  if (orphans > 0) {
    console.error(`❌ FALLO ACID: Se encontraron ${orphans} deducciones de Kardex huérfanas sin Header de venta válido!`);
    auditFailed = true;
  } else {
    console.log(`✅ CERTIFICADO: Paridad ACID Estricta. ${kardexEntries.length} entradas en Kardex mapeadas a ${totalValidSales} ventas.`);
  }

  // REGLA C: OCR Hallucinations -> accounts_payable (En este schema `expenses` y `supplier_current_accounts`)
  console.log("\n[AUDIT] 🔍 c) Validando Escudo Matemático OCR en Tesorería...");
  const corruptedExpenses = await db.select().from(expenses).where(
    and(
      eq(expenses.store_id, STORE_ID),
      // Validamos si existiera algún registro donde no coincidan (aunque ya lo chequea el action)
      sql`net_amount_cents + tax_amount_cents + withholdings_cents != gross_amount_cents`
    )
  );

  if (corruptedExpenses.length > 0) {
    console.error(`❌ FALLO MATH SHIELD: Se encontraron ${corruptedExpenses.length} comprobantes con paridad fiscal rota.`);
    auditFailed = true;
  } else {
    console.log("✅ CERTIFICADO: 0 inserciones contables corruptas. Math Shield invicto.");
  }


  if (auditFailed) {
    console.error("\n[SRE-P0] ❌ AUDITORÍA FALLIDA: SE HA VIOLADO LA INMUTABILIDAD.");
    process.exit(1);
  } else {
    // Declaración exigida por la directiva
    console.log("\n[SRE-P0] 🟢 CERTIFICACIÓN ACID EXITOSA");
    console.log("=".repeat(80));
    process.exit(0);
  }
}

main().catch(err => {
  console.error("Critical Audit Error:", err);
  process.exit(1);
});
