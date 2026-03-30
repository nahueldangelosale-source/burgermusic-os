import { and, asc, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db";
import { inventory_batches } from "../../db/schema/traceability";

// Contrato de Entrada Zod
const FIFORequestSchema = z.object({
  posTicketId: z.string(),
  productSku: z.string(),
  quantitySold: z.number().positive(),
});

/**
 * Deducción POS vía FIFO.
 * Despliega un CTE (Common Table Expression) en Drizzle `sql` para la Explosión BOM,
 * y ejecuta la deducción secuencial O(N restringida al SKU) iterando lotes FIFO.
 */
export async function processSaleDeductionFIFO(requestData: z.infer<typeof FIFORequestSchema>) {
  const data = FIFORequestSchema.parse(requestData);

  return await db.transaction(async (tx) => {
    // 1. CTE para Explosión BOM usando Drizzle sql``
    // Asume la tabla `bom_recipes` y un campo `ingredient_id`
    const bomExplosion = await tx.all(sql`
      WITH RECURSIVE
      bom_tree AS (
        SELECT 
          ingredient_id, 
          theoretical_qty * ${data.quantitySold} as required_qty
        FROM bom_recipes 
        WHERE product_sku = ${data.productSku}
      )
      SELECT * FROM bom_tree;
    `);

    // 2. Ejecutar Consumo FIFO por Ingrediente
    for (const req of bomExplosion as any[]) {
      let remainingQtyToDeduct = Number.parseFloat(req.required_qty);
      const ingredientSku = req.ingredient_id;

      if (remainingQtyToDeduct <= 0) continue;

      // Recuperación de lotes en cuarentena / orden por Expiration Date (FIFO puro)
      const activeBatches = await tx
        .select()
        .from(inventory_batches)
        .where(
          and(
            eq(inventory_batches.ingredient_sku, ingredientSku),
            gt(inventory_batches.current_qty, 0),
            eq(inventory_batches.status, "READY"),
          ),
        )
        .orderBy(asc(inventory_batches.expiration_date));

      // 3. Iterador de Deducción con manejo de Agotado y Restantes
      for (const batch of activeBatches) {
        if (remainingQtyToDeduct <= 0) break;

        const available = batch.current_qty;

        if (available <= remainingQtyToDeduct) {
          // Lote insuficiente o exacto: Consumo Completo
          remainingQtyToDeduct -= available;
          await tx
            .update(inventory_batches)
            .set({ current_qty: 0, status: "DEPLETED" })
            .where(eq(inventory_batches.batch_id, batch.batch_id));
        } else {
          // Lote superávit: Consumo Parcial
          const newQty = available - remainingQtyToDeduct;
          remainingQtyToDeduct = 0;
          await tx
            .update(inventory_batches)
            .set({ current_qty: newQty })
            .where(eq(inventory_batches.batch_id, batch.batch_id));
        }
      }

      // Alerta de quiebre crítico si no hay materia prima amparando la receta teórica
      if (remainingQtyToDeduct > 0) {
        console.warn(
          `[FIFO BREAK] Discrepancia Crítica en ${ingredientSku}. Faltaron ${remainingQtyToDeduct} unidades teóricas para la venta del ticket ${data.posTicketId}`,
        );
        // TODO: Inyectar alerta a la tabla de anomaly_alerts para el 'Radar de Fuego'.
      }
    }

    return {
      success: true,
      ticketId: data.posTicketId,
      status: "FIFO_BOM_DEDUCTED",
    };
  });
}
