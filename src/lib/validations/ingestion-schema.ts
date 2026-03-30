import { z } from "zod";

/**
 * Escudo de Coerción - Ingestion Schema
 * ─────────────────────────────────────
 * Obligatorio: Limpieza financiera estricta antes de la lógica de procesamiento.
 */

export const IngestionRowSchema = z.object({
  date: z.string(),
  referenceId: z.string().min(1, "Referencia vacía"),
  productSku: z.string().min(1, "SKU vacío"),

  // Transformación exacta requerida para limpieza financiera (strings a floats puros)
  quantity: z.string().transform((val) => Number.parseFloat(val.replace(/[^0-9.-]+/g, ""))),
  amount: z.string().transform((val) => Number.parseFloat(val.replace(/[^0-9.-]+/g, ""))),

  storeId: z.string(),
  supplier: z.string().optional().default(""),
  cuit: z
    .string()
    .regex(/^\d{2}-\d{8}-\d{1}$/, "Formato CUIT inválido")
    .optional(),
  cbu: z.string().length(22, "El CBU debe tener exactamente 22 dígitos").optional(),
  paymentMethod: z.enum(["TRANSFERENCIA", "EFECTIVO", "CHEQUE", "CRIPTO"]).optional(),
  type: z.string().default("SALE"),
});

export type IngestionRow = z.infer<typeof IngestionRowSchema>;
