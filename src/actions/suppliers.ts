"use server";

import { suppliers, accounts_payable, supplier_payments } from "@/db/schema";
import { raw_materials } from "@/db/schema/bom";
import { eq, sql, isNull, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { authenticatedAction } from "@/lib/auth-action";
import { SupplierSchema } from "@/schemas/suppliers";
import { withTenant } from "@/lib/tenant-db";
import { z } from "zod";

export const getSuppliers = authenticatedAction(async (_, { user }) => {
  try {
    const tenant = withTenant({ user });
    const rawData = await tenant.select().from(suppliers).where(isNull(suppliers.deletedAt)).all();
    return { success: true, data: rawData };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

export const upsertSupplier = authenticatedAction(async (payload: z.infer<typeof SupplierSchema>, { user }) => {
  const validated = SupplierSchema.parse(payload);
  const tenant = withTenant({ user });

  await tenant.insert(suppliers).values([{
    id: validated.id || `SUP-${randomUUID().substring(0, 8).toUpperCase()}`,
    name: validated.name,
    cuit: validated.cuit || "00-00000000-0",
    cbu: validated.cbu || "",
    contact_info: validated.contact_info || "",
    category: validated.category as any,
    paymentTerms: validated.paymentTerms || "Contado",
    active: validated.active !== undefined ? validated.active : true,
  }]).onConflictDoUpdate({
    target: suppliers.id,
    set: {
      name: validated.name,
      cuit: validated.cuit || "00-00000000-0",
      contact_info: validated.contact_info || "",
      category: validated.category as any,
      paymentTerms: validated.paymentTerms || "Contado",
      active: validated.active !== undefined ? validated.active : true,
    }
  });

  revalidatePath("/dashboard/supply");
  return { success: true };
});

export const deleteSupplier = authenticatedAction(async (id: string, { user }) => {
  const tenant = withTenant({ user });
  await tenant.update(suppliers)
    .set({ deletedAt: new Date() })
    .where(eq(suppliers.id, id));
  revalidatePath("/dashboard/supply");
  return { success: true };
});

export const calculateSupplierScore = authenticatedAction(async (supplierId: string, { user }) => {
  try {
    const tenant = withTenant({ user });
    
    // 1. Rendimiento Histórico Promedio (Yield)
    const materials = await tenant.unsafeRaw.select().from(raw_materials).where(eq(raw_materials.supplierId, supplierId)).all();
    let avgYield = 1.0;
    if (materials.length > 0) {
      const sumYield = (materials as any[]).reduce((acc, current) => acc + current.historicalYieldPct, 0);
      avgYield = sumYield / materials.length;
    }

    // 2. Match Rate de AP
    const aps = await tenant.select().from(accounts_payable).where(eq(accounts_payable.supplier_id, supplierId)).all();
    let matchRate = 1.0;
    if (aps.length > 0) {
      let totalMatchScore = 0;
      aps.forEach((ap: any) => {
          if (ap.invoice_amount > 0) {
              const variance = Math.abs((ap.receipt_amount as number) - (ap.invoice_amount as number)) / (ap.invoice_amount as number);
              const lineMatch = Math.max(0, 1 - variance);
              totalMatchScore += lineMatch;
          } else {
              totalMatchScore += 1.0;
          }
      });
      matchRate = totalMatchScore / aps.length;
    }

    const score = (matchRate * 0.6) + (avgYield * 0.4);
    return { success: true, score: score * 100, yieldPct: avgYield * 100, matchRatePct: matchRate * 100 };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

export const calculateSupplierBalance = authenticatedAction(async (supplierId: string, { user }) => {
  try {
    const tenant = withTenant({ user });
    
    // 1. Suma de Invoices 
    const aps = await tenant.select({
       totalInvoices: sql<number>`SUM(${accounts_payable.invoice_amount})`
    }).from(accounts_payable).where(eq(accounts_payable.supplier_id, supplierId)).all();
    
    const invoiceSum = (aps[0]?.totalInvoices || 0) as number;

    // 2. Suma de Pagos Emitidos
    const payments = await tenant.select({
       totalPayments: sql<number>`SUM(${supplier_payments.amount})`
    }).from(supplier_payments).where(eq(supplier_payments.supplierId, supplierId)).all();

    const paymentSum = (payments[0]?.totalPayments || 0) as number;
    const balanceCents = invoiceSum - paymentSum;

    return { 
       success: true, 
       balanceCents,
       totalBilledCents: invoiceSum,
       totalPaidCents: paymentSum
    };
  } catch(error: any) {
    return { success: false, error: error.message };
  }
});
