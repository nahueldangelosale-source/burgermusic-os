"use server";

import { db } from "@/db";
import { opex_ledger } from "@/db/schema";
import { authenticatedAction } from "@/lib/auth-action";
import { withTenant } from "@/lib/tenant-db";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";

const TaxConfigSchema = z.object({
  description: z.string().min(2, "Descripción requerida"),
  calculationType: z.enum(["FIXED", "PERCENTAGE"]),
  fixedAmount: z.number().min(0).optional(),
  percentageRate: z.number().min(0).max(100).optional(),
});

export const upsertTaxConfig = authenticatedAction(async (formData: FormData, { user }) => {
  // Parsing nativo de FormData
  const data = {
    description: formData.get("description") as string,
    calculationType: formData.get("calculationType") as "FIXED" | "PERCENTAGE",
    fixedAmount: Number(formData.get("fixedAmount") || 0),
    percentageRate: Number(formData.get("percentageRate") || 0),
  };

  const validated = TaxConfigSchema.parse(data);
  const tenant = withTenant({ user });

  // Inyección Zero-Trust via withTenant
  const safeDesc = validated.description.replace(/\s+/g, '-').toUpperCase().slice(0, 15);
  await tenant.insert(opex_ledger).values([{
    id: `TAX-${safeDesc}-${randomUUID().substring(0, 6).toUpperCase()}`,
    store_id: user.storeId,
    type: "TAX",
    description: validated.description,
    total_amount: validated.calculationType === "FIXED" ? validated.fixedAmount! * 100 : 0,
    calculation_type: validated.calculationType,
    percentage_rate: validated.calculationType === "PERCENTAGE" ? validated.percentageRate : 0,
    start_date: new Date().toISOString().split("T")[0],
    daily_accrual_amount: 0,
  }]);

  revalidatePath("/dashboard/treasury");
  return { success: true, message: "Parámetro fiscal devengado exitosamente." };
});
