import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { raw_materials } from "../db/schema/bom";
import { goods_receipts, inventory_batches } from "../db/schema/traceability";
import { uomConversions } from "../db/schema/uom";

// Tipado seguro de lo que viene desde el Webhook B2B o el Front-End (Interlock)
const ReceiptPayloadSchema = z.object({
  supplierId: z.string(),
  ingredientSku: z.string(),
  receivedUnit: z.string().transform((u) => u.toUpperCase()), // Eg: 'BOX_20KG'
  receivedQty: z.number().positive(),
  totalCostCents: z.number().positive(),
  expirationDate: z.string(),
});

/**
 * Server Action: Ingestión de Recepciones y Extrapolación Dimensional O(1)
 * Combina el lote recién llegado con la matrix UOM para persistirlo en gramos/base atómica.
 */
export async function processGoodsReceipt(payload: z.infer<typeof ReceiptPayloadSchema>) {
  const data = ReceiptPayloadSchema.parse(payload);

  return await db.transaction(async (tx) => {
    // 1. Obtención de Base Unit predefinida
    const [raw] = await tx
      .select({ baseUnit: raw_materials.baseUnit })
      .from(raw_materials)
      .where(eq(raw_materials.id, data.ingredientSku))
      .limit(1);

    if (!raw) {
      throw new Error(
        `SRE Error: Materia prima [${data.ingredientSku}] desconocida en el ecosistema.`,
      );
    }

    // 2. Coerción Atómica O(1) vía UOM Translations (Cero IF/ELSE encadenados en Node.js)
    let multiplier = 1.0;

    if (data.receivedUnit !== raw.baseUnit) {
      const [uom] = await tx
        .select({ multiplier: uomConversions.multiplier })
        .from(uomConversions)
        .where(
          and(
            eq(uomConversions.fromUnit, data.receivedUnit),
            eq(uomConversions.toBaseUnit, raw.baseUnit),
          ),
        )
        .limit(1);

      if (!uom) {
        throw new Error(
          `CRITICAL SRE_UOM_MISSING: Falla al traducir ${data.receivedUnit} hacia ${raw.baseUnit}. Actualice el UOM-Translator antes de continuar.`,
        );
      }
      multiplier = uom.multiplier;
    }

    // Matemática Atómica
    const rawQty = data.receivedQty * multiplier;
    const unitCostCents = Math.round(data.totalCostCents / rawQty);

    // 3. Documento del Remito B2B (Fase 46.1 re-imaginada)
    const receiptId = `RX-${crypto.randomUUID()}`;
    await tx.insert(goods_receipts).values({
      id: receiptId,
      supplier_id: data.supplierId,
      total_cost_cents: data.totalCostCents,
    });

    // 4. Inyección del Batched Inventory Inmutable Listos Para Usar/Mermar
    const batchId = `BATCH-${crypto.randomUUID()}`;
    await tx.insert(inventory_batches).values({
      batch_id: batchId,
      receipt_id: receiptId,
      ingredient_sku: data.ingredientSku,
      supplier_id: data.supplierId,
      raw_qty: rawQty,
      current_qty: rawQty,
      unit_cost_cents: unitCostCents,
      status: "READY",
      expiration_date: data.expirationDate,
    });

    return {
      success: true,
      receiptDocument: receiptId,
      canonicalQtyStored: rawQty,
      canonicalUnit: raw.baseUnit,
      batchId,
    };
  });
}

// Stub SRE para compatibilidad retroactiva del Dashboard
export async function approveRequisition({ prId }: { prId: string }) {
  try {
     return { success: true, error: null };
  } catch (err: any) {
     return { success: false, error: err.message };
  }
}
