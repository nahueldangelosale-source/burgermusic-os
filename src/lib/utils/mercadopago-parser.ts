import { db } from "@/db";
import { payment_gateways_ledger } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

// Phase 32.1 - Motor Zero-Trust Mercado Pago
export const MP_SettlementSchema = z.object({
  operation_id: z.string().min(1),
  date: z.string().datetime().optional(),

  // Coerción estricta a enteros en centavos
  gross_amount_cents: z.preprocess((val) => Math.round(Number(val) * 100), z.number().int()),
  commission_cents: z.preprocess((val) => Math.round(Number(val) * 100), z.number().int()),
  tax_cents: z.preprocess((val) => Math.round(Number(val) * 100), z.number().int()),
});

type MPPayload = z.infer<typeof MP_SettlementSchema>;

export async function processMPSettlement(rawPayload: any) {
  const parsed = MP_SettlementSchema.safeParse(rawPayload);

  if (!parsed.success) {
    throw new Error(`Rigor Matemático MP Fallido: ${parsed.error.message}`);
  }
  const data = parsed.data;

  // Aritmética Estricta Deducida O(1)
  const net_amount_cents = data.gross_amount_cents - (data.commission_cents + data.tax_cents);

  // Idempotencia O(1): Evitar duplicar saldos a favor consultando el Ledger
  const existingTx = await db
    .select()
    .from(payment_gateways_ledger)
    .where(eq(payment_gateways_ledger.transactionReference, data.operation_id));

  if (existingTx.length > 0) {
    // Retorno silencioso si el bloque ya fue procesado
    return { status: "already_processed", operation_id: data.operation_id };
  }

  // Inserción Atómica
  await db.insert(payment_gateways_ledger).values({
    id: uuidv4(),
    gateway: "MERCADO_PAGO",
    transactionReference: data.operation_id,
    date: data.date || new Date().toISOString(),
    grossAmount: data.gross_amount_cents,
    feeAmount: data.commission_cents,
    taxAmount: data.tax_cents,
    netAmount: net_amount_cents,
    releaseDate: new Date().toISOString(),
    status: "CLEARED",
    storeId: "", // Should be injected per-call
  });

  return {
    status: "success",
    operation_id: data.operation_id,
    net_amount_cents,
  };
}
