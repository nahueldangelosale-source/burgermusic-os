"use server";

import { db } from "@/db";
import { opex_ledger, accounts_payable, fact_supplier_ledger, suppliers } from "@/db/schema";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

const OpexSchema = z.object({
  store_id: z.string(),
  type: z.enum(["FIXED", "VARIABLE", "EXTRAORDINARY"]),
  description: z.string().min(3),
  total_amount: z.number().positive(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

export async function injectOpex(payload: z.infer<typeof OpexSchema>) {
  const data = OpexSchema.parse(payload);
  
  let daily_accrual_amount = 0;
  
  if (data.type === "FIXED" && data.end_date) {
    const start = new Date(data.start_date);
    const end = new Date(data.end_date);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const days = Math.max(Math.ceil(diffTime / (1000 * 60 * 60 * 24)), 1);
    daily_accrual_amount = Math.round(data.total_amount / days);
  } else if (data.type === "EXTRAORDINARY") {
    daily_accrual_amount = 0; // Excluido del Margen Bruto, resta directo liquidéz
  } else {
    daily_accrual_amount = data.total_amount; // Variable de un día
  }

  await db.insert(opex_ledger).values({
    id: randomUUID(),
    store_id: data.store_id,
    type: data.type,
    description: data.description,
    total_amount: data.total_amount,
    daily_accrual_amount,
    start_date: data.start_date,
    end_date: data.end_date ?? null,
  });

  return { success: true };
}

export async function getThreeWayMatch() {
  // Cálculo O(1) de fraude/disputa mediante motor SQL, sin .map()
  const result = await db
    .select({
      id: accounts_payable.id,
      supplier_id: accounts_payable.supplier_id,
      po_amount: accounts_payable.po_amount,
      receipt_amount: accounts_payable.receipt_amount,
      invoice_amount: accounts_payable.invoice_amount,
      credit_note_amount: accounts_payable.credit_note_amount,
      due_date: accounts_payable.due_date,
      status: accounts_payable.status,
      dynamic_status: sql<string>`
        CASE 
          WHEN ((${accounts_payable.invoice_amount} - ${accounts_payable.credit_note_amount}) - ${accounts_payable.receipt_amount}) > 0 THEN 'DISPUTE'
          WHEN ((${accounts_payable.invoice_amount} - ${accounts_payable.credit_note_amount}) = ${accounts_payable.receipt_amount}) THEN 'PERFECT_MATCH'
          ELSE ${accounts_payable.status}
        END
      `.as('dynamic_status'),
      delta: sql<number>`((${accounts_payable.invoice_amount} - ${accounts_payable.credit_note_amount}) - ${accounts_payable.receipt_amount})`.as('delta')
    })
    .from(accounts_payable)
    .orderBy(accounts_payable.due_date);

  // Sanitizar a objeto plano puro para React Server Components
  return result.map(r => ({ ...r }));
}

export async function admitCreditNote(apId: string, creditNoteCents: number) {
  // Acción de resolución que inserta una NC para desbloquear una AP en disputa (US 2.3)
  const zId = z.string().parse(apId);
  const zAmount = z.number().positive().parse(creditNoteCents);

  await db.update(accounts_payable)
    .set({ credit_note_amount: sql`${accounts_payable.credit_note_amount} + ${zAmount}` })
    .where(sql`${accounts_payable.id} = ${zId}`);
    
  return { success: true };
}
export async function getSupplierLedger() {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  const storeId = session?.user?.storeId;
  if (!storeId) throw new Error("Unauthorized: Missing Store ID in session");

  // Consulta atómica con filtrado por storeId
  const result = await db
    .select({
      id: fact_supplier_ledger.id,
      supplier_id: fact_supplier_ledger.supplier_id,
      supplier_name: suppliers.name,
      type: fact_supplier_ledger.type,
      invoice_number: fact_supplier_ledger.invoice_number,
      description: fact_supplier_ledger.description,
      amount_cents: fact_supplier_ledger.amount_cents,
      balance_cents: fact_supplier_ledger.balance_cents,
      date: fact_supplier_ledger.date,
    })
    .from(fact_supplier_ledger)
    .innerJoin(suppliers, sql`${fact_supplier_ledger.supplier_id} = ${suppliers.id}`)
    .where(sql`${fact_supplier_ledger.storeId} = ${storeId}`)
    .orderBy(sql`${fact_supplier_ledger.date} DESC`)
    .limit(500);

  return result.map(r => ({ ...r }));
}

export async function getSuppliersList() {
  const result = await db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers);
  return result.map(r => ({ ...r }));
}
