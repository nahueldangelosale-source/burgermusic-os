import { z } from "zod";

export const IngestInvoiceSchema = z.object({
  supplier_id: z.string().min(1, "El proveedor es obligatorio"),
  expense_type: z.enum(["FIXED", "VARIABLE", "EXTRAORDINARY", "PAYROLL", "TAXES"]),
  line_items: z.array(z.object({ 
    name: z.string().min(1), 
    quantity: z.number().positive(), 
    unit_price_cents: z.number().nonnegative(), 
    total_cents: z.number().nonnegative() 
  })).optional().default([]),
  net_amount_cents: z.number().int().nonnegative(),
  tax_amount_cents: z.number().int().nonnegative(),
  withholdings_cents: z.number().int().nonnegative(),
  gross_amount_cents: z.number().int().positive(),
  due_date: z.coerce.date(), // Mutación fuerte a objeto Date (Evita Type Shadowing de Strings en Frontend Airlock)
  reference_id: z.string().optional().nullable(),
});

export type IngestInvoicePayload = z.infer<typeof IngestInvoiceSchema>;

export const CreateSupplierSchema = z.object({
  name: z.string().min(1, "El nombre comercial es obligatorio"),
  cuit: z.string().min(1, "El CUIT o NIF es obligatorio")
});

export type CreateSupplierPayload = z.infer<typeof CreateSupplierSchema>;
