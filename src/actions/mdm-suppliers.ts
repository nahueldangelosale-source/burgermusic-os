"use server";

import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { desc, isNull } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const CreateSupplierSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  cuit: z.string().optional(),
  cbu: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  category: z.enum(["Insumos", "Servicios", "Mantenimiento", "Otros"]),
  paymentTerms: z.string().min(1, "Debes especificar los términos de pago"),
  paymentMethods: z.array(z.string()).min(1, "Debes seleccionar al menos un método de pago"),
  invoiceType: z.enum(["FACTURA", "REMITO", "AMBAS"]),
  leadTime: z.number().min(0, "El tiempo de entrega no puede ser negativo"),
  frequency: z.string().optional(),
  contact_info: z.string().optional(),
});

export async function getSuppliers() {
  try {
    const session = await getSession();
    if (!session?.user || !["OWNER_GLOBAL", "MANAGER"].includes(session.user.role)) {
      return { success: false, error: "Unauthorized." };
    }

    const data = await db.select().from(suppliers).where(isNull(suppliers.deletedAt));
    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function createSupplier(formData: z.infer<typeof CreateSupplierSchema>) {
  try {
    const session = await getSession();
    if (!session?.user || !["OWNER_GLOBAL", "MANAGER"].includes(session.user.role)) {
      return { success: false, error: "Unauthorized." };
    }

    const parsed = CreateSupplierSchema.parse(formData);

    await db.insert(suppliers).values({
      id: uuidv4(),
      name: parsed.name,
      cuit: parsed.cuit || "",
      cbu: parsed.cbu || "",
      phone: parsed.phone || "",
      address: parsed.address || "",
      paymentMethods: parsed.paymentMethods,
      invoiceType: parsed.invoiceType,
      contact_info: parsed.contact_info,
      category: parsed.category,
      paymentTerms: parsed.paymentTerms,
      leadTime: parsed.leadTime,
      frequency: parsed.frequency,
      active: true,
    });

    return { success: true };
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.errors[0].message };
    }
    return { success: false, error: e.message };
  }
}
