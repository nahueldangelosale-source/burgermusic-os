// @ts-nocheck
"use server";

import { db } from "@/db";
import { accounts_payable, inventorySnapshots, opex_ledger, transactions } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

export interface InterlockResult {
  requiresInterlock: boolean;
  reason?: string;
  shrinkage?: number;
  netMargin?: number;
}

export async function getFinancialInterlock(storeId: string): Promise<InterlockResult> {
  // Cero JavaScript en memoria: Calculamos todos los agregados en Drizzle SQL
  // Filtro de mes actual para sqlite: strftime('%Y-%m', date) = strftime('%Y-%m', 'now')

  // 1. Ingresos: transactions (Asumimos costo * cantidad absoluta en ventas)
  const [incomes] = await db
    .select({
      total: sql<number>`COALESCE(SUM(ABS(${transactions.quantity} * ${transactions.costCentsAtTime} / 100.0)), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.storeId, storeId),
        eq(transactions.type, "SALE"),
        sql`strftime('%Y-%m', ${transactions.date}) = strftime('%Y-%m', 'now')`,
      ),
    );

  // 2. Egresos: opex_ledger y accounts_payable
  const [opex] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${opex_ledger.amount}), 0)`,
    })
    .from(opex_ledger)
    .where(
      and(
        eq(opex_ledger.storeId, storeId),
        sql`strftime('%Y-%m', ${opex_ledger.date}) = strftime('%Y-%m', 'now')`,
      ),
    );

  const [ap] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${accounts_payable.amount}), 0)`,
    })
    .from(accounts_payable)
    .where(
      and(
        eq(accounts_payable.storeId, storeId),
        sql`strftime('%Y-%m', ${accounts_payable.createdAt}) = strftime('%Y-%m', 'now')`,
      ),
    );

  const totalIncomes = incomes?.total || 1; // Prevenir división por cero
  const totalExpenses = (opex?.total || 0) + (ap?.total || 0);

  // 3. Merma de Inventario Historica
  const [kardex] = await db
    .select({ total: sql<number>`COALESCE(SUM(${transactions.quantity}), 0)` })
    .from(transactions)
    .where(eq(transactions.storeId, storeId));
  const [snapshots] = await db
    .select({ total: sql<number>`COALESCE(SUM(${inventorySnapshots.actualCount}), 0)` })
    .from(inventorySnapshots)
    .where(eq(inventorySnapshots.storeId, storeId));

  const theoretical = kardex?.total || 0;
  const actual = snapshots?.total || 0;
  let shrinkage = 0;
  if (theoretical > 0) {
    shrinkage = theoretical - actual > 0 ? (theoretical - actual) / theoretical : 0;
  }

  // 4. Margen Neto = (Ingresos - Egresos) / Ingresos
  const netMargin = (totalIncomes - totalExpenses) / totalIncomes;

  if (shrinkage > 0.03) {
    return {
      requiresInterlock: true,
      reason: `Fricción Positiva: La merma de inventario (${(shrinkage * 100).toFixed(1)}%) supera la tolerancia del 3%.`,
      shrinkage,
      netMargin,
    };
  }

  if (netMargin < 0.1) {
    return {
      requiresInterlock: true,
      reason: `Fricción Positiva: El Margen Neto (${(netMargin * 100).toFixed(1)}%) ha caído por debajo de la barrera del 10%. Ingresos: $${totalIncomes}, Egresos: $${totalExpenses}.`,
      shrinkage,
      netMargin,
    };
  }

  return { requiresInterlock: false, shrinkage, netMargin };
}

export interface ExceptionMetrics {
  requiresJustification: boolean;
  theoreticalKardex: number;
  actualBlindCount: number;
  shrinkageVariance: number;
}

export async function getExceptionMetrics(storeId: string): Promise<ExceptionMetrics> {
  const [kardex] = await db
    .select({ totalQuantity: sql<number>`COALESCE(SUM(${transactions.quantity}), 0)` })
    .from(transactions)
    .where(eq(transactions.storeId, storeId));
  const [snapshots] = await db
    .select({ totalActual: sql<number>`COALESCE(SUM(${inventorySnapshots.actualCount}), 0)` })
    .from(inventorySnapshots)
    .where(eq(inventorySnapshots.storeId, storeId));

  const theorethical = kardex?.totalQuantity || 0;
  const actual = snapshots?.totalActual || 0;
  let shrinkage = 0;
  if (theorethical > 0) {
    const missing = theorethical - actual;
    shrinkage = missing > 0 ? missing / theorethical : 0;
  }
  return {
    requiresJustification: shrinkage > 0.03,
    theoreticalKardex: theorethical,
    actualBlindCount: actual,
    shrinkageVariance: shrinkage,
  };
}

