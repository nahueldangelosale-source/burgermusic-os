import { eq, sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { z } from "zod";
import { db } from "../index"; // Asume exportación estándar en src/db/index.ts

// 1. Arquitectura de Lotes Inmutables (Recepción de Mercadería)
export const goods_receipts = sqliteTable("goods_receipts", {
  id: text("id").primaryKey(),
  supplier_id: text("supplier_id").notNull(),
  receipt_date: text("receipt_date").notNull().default(sql`(CURRENT_DATE)`),
  total_cost_cents: integer("total_cost_cents").notNull(),
  created_at: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

export const inventory_batches = sqliteTable("inventory_batches", {
  batch_id: text("batch_id").primaryKey(),
  receipt_id: text("receipt_id"), // Relacionado a goods_receipts si aplica
  ingredient_sku: text("ingredient_sku").notNull(),
  supplier_id: text("supplier_id").notNull(),
  raw_qty: real("raw_qty").notNull(), // Cantidad bruta recibida
  current_qty: real("current_qty").notNull(), // Cantidad disponible lista para FIFO
  unit_cost_cents: integer("unit_cost_cents").notNull(), // Costo atómico promediado
  status: text("status", { enum: ["QUARANTINE", "READY", "DEPLETED"] }).default("READY"),
  expiration_date: text("expiration_date").notNull(), // Elemento clave para FIFO
  created_at: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// 2. Motor de Transformación y Yield (Registro matemático O(1))
export const prep_logs = sqliteTable("prep_logs", {
  id: text("id").primaryKey(),
  batch_id: text("batch_id")
    .references(() => inventory_batches.batch_id)
    .notNull(),
  yield_qty: real("yield_qty").notNull(), // Cantidad útil tras limpieza/procesado
  waste_qty: real("waste_qty").notNull(), // Desperdicio (Merma)
  operator_id: text("operator_id").notNull(),
  timestamp: text("timestamp").default(sql`(CURRENT_TIMESTAMP)`),
});

// 4. Cuarentena Semántica (Dead Letter Queue)
export const unmapped_pos_transactions = sqliteTable("unmapped_pos_transactions", {
  id: text("id").primaryKey(),
  raw_name: text("raw_name").notNull(),
  pos_data: text("pos_data").notNull(), // JSON estringificado de la fila pura
  reason: text("reason").notNull().default("LOW_CONFIDENCE"),
  created_at: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// --- Server Action de Mutación Matemática ---

// Tipado estricto
export const PrepDataSchema = z.object({
  batch_id: z.string().min(1),
  yield_qty: z.number().positive(),
  waste_qty: z.number().nonnegative(),
  operator_id: z.string().min(1),
});

export type PrepData = z.infer<typeof PrepDataSchema>;

/**
 * Server Action: Process Transformation
 * Resta la `raw_qty` del lote original, genera un nuevo lote "Stock Listo"
 * y recalcula el Costo Promedio Ponderado (WAC) delegando el esfuerzo matemático al motor SQL.
 */
export async function processTransformation(prepData: PrepData) {
  const data = PrepDataSchema.parse(prepData);

  return await db.transaction(async (tx) => {
    // a. Blindaje O(1) recuperando el lote maestro
    const [originalBatch] = await tx
      .select()
      .from(inventory_batches)
      .where(eq(inventory_batches.batch_id, data.batch_id))
      .limit(1);

    if (!originalBatch) throw new Error("Lote original no existe en la matriz.");
    if (originalBatch.current_qty <= 0)
      throw new Error("Anomalía: Lote agotado o consumido previamente.");

    // b. Registrar el esfuerzo del operador en la bitácora de mermas
    const logId = `prep-${crypto.randomUUID()}`;
    await tx.insert(prep_logs).values({
      id: logId,
      batch_id: data.batch_id,
      yield_qty: data.yield_qty,
      waste_qty: data.waste_qty,
      operator_id: data.operator_id,
    });

    // c. Matemática WAC impulsada desde el Costo Bruto al Yield
    const costOfConsumedRaw = originalBatch.unit_cost_cents * originalBatch.current_qty;
    const newUnitCostCents =
      data.yield_qty > 0 ? Math.round(costOfConsumedRaw / data.yield_qty) : 0;

    // d. Agotar el lote base
    await tx
      .update(inventory_batches)
      .set({ current_qty: 0, status: "DEPLETED" })
      .where(eq(inventory_batches.batch_id, data.batch_id));

    // e. Inyectar nuevo lote transformado y apto para FIFO
    const newBatchId = `batch-yield-${crypto.randomUUID()}`;
    await tx.insert(inventory_batches).values({
      batch_id: newBatchId,
      receipt_id: originalBatch.receipt_id,
      ingredient_sku: originalBatch.ingredient_sku, // Asumimos preservación referencial o recategorización posterior
      supplier_id: originalBatch.supplier_id,
      raw_qty: data.yield_qty,
      current_qty: data.yield_qty,
      unit_cost_cents: newUnitCostCents,
      status: "READY",
      expiration_date: originalBatch.expiration_date,
    });

    return { success: true, newBatchId, newUnitCostCents };
  });
}
