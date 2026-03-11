// src/core/stock-engine.ts
// Motor de Stock Perpetuo — Patrón Ledger (Kardex)
// El stock de un SKU = SUM(quantity) de todas sus transacciones.

import { db } from "@/db";
import { transactions, products, type TransactionType } from "@/db/schema";
import { eq, sql, sum } from "drizzle-orm";

// ─── QUERIES ────────────────────────────────────────────────

/**
 * Stock actual de un SKU específico.
 * SELECT SUM(quantity) FROM transactions WHERE product_sku = ?
 */
export async function getCurrentStock(sku: string): Promise<number> {
    const [result] = await db
        .select({ total: sum(transactions.quantity) })
        .from(transactions)
        .where(eq(transactions.productSku, sku));

    return Number(result?.total ?? 0);
}

/**
 * Stock actual de TODOS los SKUs en un solo query.
 * SELECT product_sku, SUM(quantity) FROM transactions GROUP BY product_sku
 */
export async function getAllCurrentStock(): Promise<Map<string, number>> {
    const rows = await db
        .select({
            sku: transactions.productSku,
            total: sum(transactions.quantity),
        })
        .from(transactions)
        .groupBy(transactions.productSku);

    const map = new Map<string, number>();
    for (const row of rows) {
        if (row.sku) {
            map.set(row.sku, Number(row.total ?? 0));
        }
    }
    return map;
}

// ─── TIPOS INTERNOS ─────────────────────────────────────────

// Tipos que siempre producen salida (cantidad negativa)
const OUTBOUND_TYPES: TransactionType[] = ["SALE", "WASTE"];

// Tipos que siempre producen entrada (cantidad positiva)
const INBOUND_TYPES: TransactionType[] = ["RECEIPT"];

// Tipos con signo libre (el caller decide): ADJUSTMENT, COUNT

interface TransactionEntry {
    type: TransactionType;
    productSku: string;
    quantity: number;          // Siempre positivo; la función aplica el signo según type
    costCentsAtTime?: number;
    referenceId?: string;
    notes?: string;
    createdBy?: string;
}

// ─── ESCRITURA ──────────────────────────────────────────────

/**
 * Registra una transacción en el Ledger.
 * Para RECEIPT: quantity se almacena como +positivo.
 * Para SALE/WASTE: quantity se almacena como -negativo (el caller pasa valor absoluto).
 * Para ADJUSTMENT/COUNT: quantity se almacena tal cual (el caller decide el signo).
 *
 * Acepta una transacción de Drizzle (tx) para garantizar ACID dentro de operaciones compuestas.
 */
export async function recordTransaction(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    entry: TransactionEntry
): Promise<void> {
    let signedQuantity: number;

    if (INBOUND_TYPES.includes(entry.type)) {
        // Entradas: siempre positivas
        signedQuantity = Math.abs(entry.quantity);
    } else if (OUTBOUND_TYPES.includes(entry.type)) {
        // Salidas: siempre negativas
        signedQuantity = -Math.abs(entry.quantity);
    } else {
        // ADJUSTMENT / COUNT: el caller decide el signo
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
        createdBy: entry.createdBy ?? null,
    } as any);
}
