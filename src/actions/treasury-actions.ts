"use server";

import { db } from "@/db";
import { expenses, supplier_current_accounts, expense_line_items } from "@/db/schema/treasury";
import { suppliers } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { randomUUID } from "crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { IngestInvoiceSchema, type IngestInvoicePayload, CreateSupplierSchema, type CreateSupplierPayload } from "./treasury-schemas";

export async function ingestSupplierInvoice(payload: IngestInvoicePayload) {
  // Fail-Closed Guardrail
  const session = await getSession();
  if (!session?.user?.storeId) {
    throw new Error("UNAUTHORIZED_ACCESS: Store ID missing from trusted session context.");
  }
  
  // Type Shadowing (Regla 4)
  const VALID_STORE_ID = session.user.storeId;
  const parsedMap = IngestInvoiceSchema.parse(payload);
  
  // Autocorrector de Paridad Fiscal
  if (parsedMap.net_amount_cents + parsedMap.tax_amount_cents + parsedMap.withholdings_cents !== parsedMap.gross_amount_cents) {
    throw new Error("DATA_INTEGRITY_FAULT: Gross amount does not equal Net + Taxes + Withholdings.");
  }

  // Ejecución Atómica (ACID)
  return await db.transaction(async (tx) => {
    const expenseId = randomUUID();
    const ledgerEntryId = randomUUID();

    await tx.insert(expenses).values({
      id: expenseId,
      store_id: VALID_STORE_ID,
      expense_type: parsedMap.expense_type,
      net_amount_cents: parsedMap.net_amount_cents,
      tax_amount_cents: parsedMap.tax_amount_cents,
      withholdings_cents: parsedMap.withholdings_cents,
      gross_amount_cents: parsedMap.gross_amount_cents,
      reference_id: parsedMap.reference_id ?? null,
    });

    await tx.insert(supplier_current_accounts).values({
      id: ledgerEntryId,
      store_id: VALID_STORE_ID,
      supplier_id: parsedMap.supplier_id,
      debt_cents: parsedMap.gross_amount_cents,
      credit_cents: 0,
      due_date: parsedMap.due_date as any,
      status: "PENDING",
    });

    if (parsedMap.line_items && parsedMap.line_items.length > 0) {
      const lineItemsToInsert = parsedMap.line_items.map((item) => ({
        id: randomUUID(),
        store_id: VALID_STORE_ID,
        expense_id: expenseId,
        name: item.name,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        total_cents: item.total_cents,
      }));
      await tx.insert(expense_line_items).values(lineItemsToInsert);
    }

    revalidatePath('/dashboard/treasury');

    return { 
      success: true, 
      transaction_refs: { expenseId, ledgerEntryId } 
    };
  });
}

export async function createSupplier(payload: CreateSupplierPayload) {
  const session = await getSession();
  if (!session?.user?.storeId) {
    throw new Error("UNAUTHORIZED_ACCESS: Store ID missing from trusted session context.");
  }
  
  const VALID_STORE_ID = session.user.storeId;
  const parsedMap = CreateSupplierSchema.parse(payload);
  
  const newSupplierId = randomUUID();
  
  try {
    await db.insert(suppliers).values({
      id: newSupplierId,
      name: parsedMap.name,
      cuit: parsedMap.cuit,
      active: true,
    });
    
    return {
      success: true,
      supplier: {
        id: newSupplierId,
        name: parsedMap.name,
        cuit: parsedMap.cuit,
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to create supplier in database."
    };
  }
}
