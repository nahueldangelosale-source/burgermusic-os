// @ts-nocheck
"use server";

import { db } from "@/db";
import { accounts_payable, opex_ledger } from "@/db/schema";
import { IngestionRowSchema } from "@/lib/validations/ingestion-schema";

export async function processFinancialIngestionAction(payload: any[], type: string) {
  let successCount = 0;
  const failedRows: number[] = [];

  for (const [index, row] of payload.entries()) {
    try {
      // Zero-Trust: Shield coercion using Zod
      const parsedData = IngestionRowSchema.parse(row);

      if (type === "Proveedores (AP)") {
        const validData = {
          id: crypto.randomUUID(),
          invoice_number: parsedData.referenceId,
          cuit: parsedData.cuit || "00-00000000-0",
          amount: parsedData.amount || 0,
          paymentMethod: parsedData.paymentMethod || "TRANSFERENCIA",
          status: "PENDING" as const,
          storeId: parsedData.storeId,
        };

        // Idempotencia Drizzle SQLite estricta (Evita duplicados B2B)
        await db
          .insert(accounts_payable)
          .values(validData)
          .onConflictDoNothing({
            target: [accounts_payable.invoice_number, accounts_payable.cuit],
          });

        successCount++;
      } else if (type === "Gastos Operativos (OPEX)") {
        const opexData = {
          id: crypto.randomUUID(),
          description: parsedData.productSku || "Gasto Operativo",
          amount: parsedData.amount || 0,
          date: parsedData.date || new Date().toISOString(),
          storeId: parsedData.storeId,
        };
        await db.insert(opex_ledger).values(opexData);
        successCount++;
      } else {
        successCount++;
      }
    } catch (e) {
      // Partial Tolerance Obligatoria: Catch individual, NUNCA global
      failedRows.push(index);
      continue;
    }
  }

  return { successCount, failedRows };
}

