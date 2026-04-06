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

  const { supplier_current_accounts, expenses, expense_line_items } = await import("@/db/schema/treasury");

  // Consulta atómica con LEFT JOIN — Regla 1: Inclusión relacional obligatoria
  const rawRows = await db
    .select({
      id: supplier_current_accounts.id,
      supplier_id: supplier_current_accounts.supplier_id,
      supplier_name: sql<string>`COALESCE(${suppliers.name}, 'Proveedor Desconocido')`.as('supplier_name'),
      type: sql<string>`COALESCE(${expenses.expense_type}, 'VARIABLE')`.as('type'),
      invoice_number: sql<string | null>`${expenses.reference_id}`.as('invoice_number'),
      amount_cents: supplier_current_accounts.debt_cents,
      balance_cents: sql<number>`(${supplier_current_accounts.debt_cents} - ${supplier_current_accounts.credit_cents})`.as('balance_cents'),
      due_date: sql<string>`${supplier_current_accounts.due_date}`.as('due_date'),
      li_name: expense_line_items.name,
      li_quantity: expense_line_items.quantity,
      li_unit_price: expense_line_items.unit_price_cents,
      li_total: expense_line_items.total_cents
    })
    .from(supplier_current_accounts)
    .leftJoin(suppliers, sql`${supplier_current_accounts.supplier_id} = ${suppliers.id}`)
    .leftJoin(expenses, sql`${supplier_current_accounts.store_id} = ${expenses.store_id} AND ${supplier_current_accounts.due_date} = ${expenses.created_at}`) // Best effort link
    .leftJoin(expense_line_items, sql`${expenses.id} = ${expense_line_items.expense_id}`)
    .where(sql`${supplier_current_accounts.store_id} = ${storeId} AND ${supplier_current_accounts.deleted_at} IS NULL`)
    .orderBy(sql`${supplier_current_accounts.due_date} ASC`)
    .limit(1000);

  // Hidratación mediante reduce (Regla 1)
  const mapAcc = rawRows.reduce((acc, row) => {
    if (!acc[row.id]) {
      acc[row.id] = {
        id: row.id,
        supplier_id: row.supplier_id,
        supplier_name: row.supplier_name,
        type: row.type,
        invoice_number: row.invoice_number,
        amount_cents: row.amount_cents,
        balance_cents: row.balance_cents,
        due_date: row.due_date ? new Date(Number(row.due_date)).toISOString() : new Date().toISOString(),
        line_items: []
      };
    }
    
    if (row.li_name) {
      acc[row.id].line_items.push({
        name: row.li_name,
        quantity: row.li_quantity,
        unit_price_cents: row.li_unit_price,
        total_cents: row.li_total
      });
    }
    
    return acc;
  }, {} as Record<string, any>);

  const result = Object.values(mapAcc);
  console.log("🔥 [SRE LEDGER CHECK] Total filas (y partidas agrupadas) recuperadas de DB:", result.length);

  return result;
}

export async function getSuppliersList() {
  const result = await db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers);
  return result.map(r => ({ ...r }));
}
