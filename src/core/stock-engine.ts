// src/core/stock-engine.ts
// Motor de Stock Perpetuo — Patrón Ledger (Kardex)
// El stock de un SKU = SUM(quantity) de todas sus transacciones.

import { db } from "@/db";
import { type TransactionType, products, transactions } from "@/db/schema";
import { eq, sql, sum } from "drizzle-orm";

// ─── QUERIES ────────────────────────────────────────────────

/**
 * Stock actual de un SKU específico en una sucursal.
 */
export async function getCurrentStock(sku: string, storeId?: string): Promise<number> {
  const filters = [eq(transactions.productSku, sku)];
  if (storeId) filters.push(eq(transactions.storeId, storeId));

  const [result] = await db
    .select({ total: sum(transactions.quantity) })
    .from(transactions)
    .where(and(...filters));

  return Number(result?.total ?? 0);
}

/**
 * Stock actual de TODOS los SKUs en una sucursal.
 */
export async function getAllCurrentStock(storeId?: string): Promise<Map<string, number>> {
  const query = db
    .select({
      sku: transactions.productSku,
      total: sum(transactions.quantity),
    })
    .from(transactions);

  if (storeId) {
    query.where(eq(transactions.storeId, storeId));
  }

  const rows = await query.groupBy(transactions.productSku);

  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.sku) {
      map.set(row.sku, Number(row.total ?? 0));
    }
  }
  return map;
}

// ─── TIPOS INTERNOS ─────────────────────────────────────────
import { and } from "drizzle-orm";

// Tipos que siempre producen salida (cantidad negativa)
const OUTBOUND_TYPES: TransactionType[] = ["SALE", "WASTE"];

// Tipos que siempre producen entrada (cantidad positiva)
const INBOUND_TYPES: TransactionType[] = ["RECEIPT"];

// Tipos con signo libre (el caller decide): ADJUSTMENT, COUNT

interface TransactionEntry {
  type: TransactionType;
  productSku: string;
  quantity: number; // Siempre positivo; la función aplica el signo según type
  costCentsAtTime?: number;
  referenceId?: string;
  notes?: string;
  storeId?: string; // Sucursal
  createdBy?: string;
}

// ─── ESCRITURA ──────────────────────────────────────────────
import { resolveRecipeFootprint } from "@/lib/recipe-parser";

/**
 * Registra una transacción en el Ledger.
 */
export async function recordTransaction(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  entry: TransactionEntry,
): Promise<void> {
  let signedQuantity: number;

  if (INBOUND_TYPES.includes(entry.type)) {
    signedQuantity = Math.abs(entry.quantity);
  } else if (OUTBOUND_TYPES.includes(entry.type)) {
    signedQuantity = -Math.abs(entry.quantity);
  } else {
    signedQuantity = entry.quantity;
  }

  await tx.insert(transactions).values({
    date: new Date().toISOString(),
    type: entry.type,
    productSku: entry.productSku,
    quantity: signedQuantity,
    costCentsAtTime: entry.costCentsAtTime ?? 0,
    referenceId: entry.referenceId ?? null,
    notes: entry.notes ?? null,
    storeId: entry.storeId,
    createdBy: entry.createdBy ?? null,
  } as any);
}

/**
 * Registra múltiples transacciones en el Ledger en una sola operación (Bulk Insert para evitar N+1).
 */
export async function recordTransactionsBatch(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  entries: TransactionEntry[],
): Promise<void> {
  if (entries.length === 0) return;

  const valuesToInsert = entries.map((entry) => {
    let signedQuantity: number;

    if (INBOUND_TYPES.includes(entry.type)) {
      signedQuantity = Math.abs(entry.quantity);
    } else if (OUTBOUND_TYPES.includes(entry.type)) {
      signedQuantity = -Math.abs(entry.quantity);
    } else {
      signedQuantity = entry.quantity;
    }

    return {
      date: new Date().toISOString(),
      type: entry.type,
      productSku: entry.productSku,
      quantity: signedQuantity,
      costCentsAtTime: entry.costCentsAtTime ?? 0,
      referenceId: entry.referenceId ?? null,
      notes: entry.notes ?? null,
      storeId: entry.storeId,
      createdBy: entry.createdBy ?? null,
    } as any;
  });

  await tx.insert(transactions).values(valuesToInsert);
}

/**
 * Explosion Engine (BOM): Procesa una venta del CSV o Webhook y descuenta sus ingredientes en una sucursal.
 * Acumula todas las transacciones necesarias y se delega a `recordTransactionsBatch` (N+1 fixed).
 */
export async function processSaleItem(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  itemName: string,
  storeId: string,
  referenceId?: string,
  createdBy?: string,
): Promise<void> {
  const ingredients = await resolveRecipeFootprint(tx, itemName, 1);

  // Preparar el Bulk Insert para esta itemName
  const entries: TransactionEntry[] = ingredients.map((ingredient) => ({
    type: "SALE",
    productSku: ingredient.sku,
    quantity: ingredient.quantity,
    storeId,
    referenceId,
    createdBy: createdBy || "RECIPE_ENGINE",
    notes: `Auto-deducción (BOM): ${itemName}`,
  }));

  await recordTransactionsBatch(tx, entries);
}
