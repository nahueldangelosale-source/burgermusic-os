import { z } from "zod";

export const SupplierSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  cuit: z.string().optional(),
  cbu: z.string().optional(),
  contact_info: z.string().optional(),
  category: z.string().optional(),
  paymentTerms: z.string().optional(),
  paymentMethod: z.enum(["TRANSFERENCIA", "EFECTIVO", "CHEQUE", "CRIPTO"]).optional(),
  leadTime: z.number().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  invoiceType: z.enum(["FACTURA", "REMITO", "AMBAS"]).optional(),
  active: z.boolean().optional(),
});
