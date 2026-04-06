"use server";

import { db } from "@/db";
import { petty_cash_transactions, suppliers } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const CreateExpenseSchema = z.object({
  amount: z.number().positive("El monto debe ser numérico y positivo."),
  reason: z.string().min(3, "El concepto debe tener al menos 3 caracteres."),
  supplierId: z.string().min(1, "Debes seleccionar un proveedor válido."),
  costCenter: z.enum(["Cocina", "Salón", "Logística", "Administración", "Mantenimiento"]),
  expenseDate: z.string().min(1, "Debes seleccionar una fecha."),
});

export async function getExpenses() {
  try {
    const session = await getSession();
    if (!session?.user || !["OWNER_GLOBAL", "MANAGER"].includes(session.user.role)) {
      return { success: false, error: "Unauthorized." };
    }

    const data = await db
      .select({
        id: petty_cash_transactions.id,
        amount: petty_cash_transactions.amount,
        reason: petty_cash_transactions.reason,
        costCenter: petty_cash_transactions.costCenter,
        expenseDate: petty_cash_transactions.expenseDate,
        supplierName: suppliers.name,
      })
      .from(petty_cash_transactions)
      .leftJoin(suppliers, eq(petty_cash_transactions.supplierId, suppliers.id))
      .orderBy(desc(petty_cash_transactions.createdAt));

    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function createExpense(formData: z.infer<typeof CreateExpenseSchema>) {
  try {
    const session = await getSession();
    if (!session?.user || !["OWNER_GLOBAL", "MANAGER", "RECEIVER"].includes(session.user.role)) {
      return { success: false, error: "Unauthorized to record expenses." };
    }

    const parsed = CreateExpenseSchema.parse(formData);

    await db.insert(petty_cash_transactions).values({
      id: uuidv4(),
      amount: -Math.abs(parsed.amount), // Se guarda en negativo por convención contable
      reason: parsed.reason,
      supplierId: parsed.supplierId,
      costCenter: parsed.costCenter,
      expenseDate: parsed.expenseDate,
      storeId: session.user.storeId,
    });

    // Trigger cache invalidation para el Command Center (Phase 11 Requirement)
    revalidatePath("/dashboard/command-center");

    return { success: true };
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0].message };
    }
    return { success: false, error: e.message };
  }
}
