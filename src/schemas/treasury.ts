import { z } from "zod";

// --- ITEM DE FACTURA ---
export const InvoiceItemSchema = z.object({
  description: z.string().min(1, "Descripción requerida"),
  quantity: z.number().positive("Cantidad debe ser positiva"),
  unit_price: z.number().min(0, "Precio unitario inválido"),
  total: z.number().min(0, "Total inválido"),
});

// --- FACTURA / REMITO COMPLETO ---
export const InvoiceSchema = z.object({
  supplier_id: z.string().min(1, "Proveedor requerido"),
  invoice_number: z.string().min(1, "Número de factura/remito requerido"),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD requerido"),
  subtotal: z.number().min(0),
  tax_amount: z.number().min(0).default(0),
  total: z.number().positive("Total debe ser positivo"),
  items: z.array(InvoiceItemSchema).min(1, "Mínimo 1 ítem requerido"),
});

// --- MANUAL INVOICE (Misma forma, validación más estricta) ---
export const ManualInvoiceSchema = InvoiceSchema.extend({
  notes: z.string().optional(),
  payment_method: z.enum(["TRANSFERENCIA", "EFECTIVO", "CHEQUE", "CRIPTO"]).default("TRANSFERENCIA"),
});

// --- PURCHASE ORDER SCHEMA ---
export const PurchaseOrderItemSchema = z.object({
  product_id: z.string().min(1, "Producto requerido"),
  quantity: z.number().positive("Cantidad debe ser positiva"),
  unit_cost: z.number().min(0, "Costo unitario inválido"),
});

export const PurchaseOrderSchema = z.object({
  supplier_id: z.string().min(1, "Proveedor requerido"),
  items: z.array(PurchaseOrderItemSchema).min(1, "Mínimo 1 ítem requerido"),
  notes: z.string().optional(),
  delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// --- Tipo exports ---
export type InvoiceInput = z.infer<typeof InvoiceSchema>;
export type ManualInvoiceInput = z.infer<typeof ManualInvoiceSchema>;
export type PurchaseOrderInput = z.infer<typeof PurchaseOrderSchema>;
