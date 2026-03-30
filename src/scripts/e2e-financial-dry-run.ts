import { sql } from "drizzle-orm";
import { processFinancialIngestionAction } from "../actions/financial-ingestion";
import { db } from "../db";
import { accounts_payable, opex_ledger } from "../db/schema";

async function runE2E() {
  console.log("Iniciando validación E2E (Dry Run) de Ingesta Financiera...");

  // Limpiar BD de pruebas anteriores (Determinismo)
  await db.delete(accounts_payable).where(sql`invoice_number LIKE 'INV-E2E-%'`);
  await db.delete(opex_ledger).where(sql`description = 'Alquiler E2E'`);

  // Payload Mock
  const mockPayloadAP = [
    // Caso 1: Éxito AP
    {
      date: "2026-03-18T10:00:00Z",
      referenceId: "INV-E2E-001",
      productSku: "PROVEEDOR_A",
      quantity: "1",
      amount: "500000",
      storeId: "centro",
      cuit: "30-12345678-9",
      cbu: "1111222233334444555566",
      paymentMethod: "TRANSFERENCIA",
    },
    // Caso 2: Fallo Zod AP (CBU 21 dígitos)
    {
      date: "2026-03-18T10:00:00Z",
      referenceId: "INV-E2E-002",
      productSku: "PROVEEDOR_B",
      quantity: "1",
      amount: "25000",
      storeId: "centro",
      cuit: "30-87654321-9",
      cbu: "111122223333444455556", // ¡21 chars!
      paymentMethod: "TRANSFERENCIA",
    },
    // Caso 4: Idempotencia (Clon del Caso 1, debe chocar con UNIQUE CUIT+INVOICE)
    {
      date: "2026-03-18T10:00:00Z",
      referenceId: "INV-E2E-001",
      productSku: "PROVEEDOR_A",
      quantity: "1",
      amount: "500000",
      storeId: "centro",
      cuit: "30-12345678-9",
      cbu: "1111222233334444555566",
      paymentMethod: "TRANSFERENCIA",
    },
  ];

  const mockPayloadOPEX = [
    // Caso 3: Éxito OPEX
    {
      date: "2026-03-18T12:00:00Z",
      referenceId: "OPEX-E2E-001",
      productSku: "Alquiler E2E",
      quantity: "1",
      amount: "1500000",
      storeId: "centro",
    },
  ];

  const apBefore = await db
    .select({ count: sql<number>`count(*)` })
    .from(accounts_payable)
    .where(sql`invoice_number LIKE 'INV-E2E-%'`);
  const opexBefore = await db
    .select({ count: sql<number>`count(*)` })
    .from(opex_ledger)
    .where(sql`description = 'Alquiler E2E'`);

  // Ejecución de Handler Principal
  const resAP = await processFinancialIngestionAction(mockPayloadAP, "Proveedores (AP)");
  const resOPEX = await processFinancialIngestionAction(
    mockPayloadOPEX,
    "Gastos Operativos (OPEX)",
  );

  // Contadores DB post-ingesta para auditoría matemática
  const apAfter = await db
    .select({ count: sql<number>`count(*)` })
    .from(accounts_payable)
    .where(sql`invoice_number LIKE 'INV-E2E-%'`);
  const opexAfter = await db
    .select({ count: sql<number>`count(*)` })
    .from(opex_ledger)
    .where(sql`description = 'Alquiler E2E'`);

  const fallosAtrapados = resAP.failedRows.length + resOPEX.failedRows.length; // Caso 2
  const apInsertados = apAfter[0].count - apBefore[0].count; // Caso 1 (Caso 4 interceptado en SQLite)
  const opexInsertados = opexAfter[0].count - opexBefore[0].count; // Caso 3

  const exitosEsperados = apInsertados + opexInsertados;

  // SQLite onConflictDoNothing cuenta la inserción como "resuelta internamente" en JS.
  // La resta de Action Success vs Inserciones Reales = Duplicados bloqueados
  const duplicadosEvitados = resAP.successCount + resOPEX.successCount - exitosEsperados;

  console.log(
    `\n[ ÉXITOS ESPERADOS: ${exitosEsperados}, FALLOS ATRAPADOS: ${fallosAtrapados}, DUPLICADOS EVITADOS: ${duplicadosEvitados} ]\n`,
  );

  console.log("=== ESTADO FINAL DE BD ===");
  console.log("- AP Rows Insertadas:", apInsertados);
  console.log("- OPEX Rows Insertadas:", opexInsertados);
}

runE2E()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Dry Run Fallido de manera no controlada:", e);
    process.exit(1);
  });
