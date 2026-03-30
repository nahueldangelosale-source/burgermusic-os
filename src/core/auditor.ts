// src/core/auditor.ts
import { db } from "@/db";
import { inventorySnapshots, products, recipe_items, snapshot_items, transactions } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

export interface AuditItem {
  sku: string;
  name: string;
  theoretical: number; // Lo que dice la receta que gastaste
  real: number; // Lo que dice el inventario (si existe)
  variance: number; // Diferencia
  costLost: number; // Dinero
  status: "OK" | "WARNING" | "CRITICAL" | "NO_DATA";
}

export async function runDailyAudit(date: string): Promise<AuditItem[]> {
  // 1. Obtener Ventas del día
  const dailySales = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.date, date), eq(transactions.type, "SALE")));

  // 2. Obtener Stock Final del día (RECONCILED Snapshot Items)
  const endStockItems = await db
    .select({
      productSku: snapshot_items.rawMaterialId,
      actualCount: snapshot_items.physicalCountPurchaseUnit,
    })
    .from(inventorySnapshots)
    .innerJoin(snapshot_items, eq(inventorySnapshots.id, snapshot_items.snapshotId))
    .where(and(
      eq(inventorySnapshots.date, date),
      eq(inventorySnapshots.status, "RECONCILED")
    ));

  // Mapa de Consumo Teórico (Acumulador)
  const theoreticalUsage = new Map<string, number>();

  // 3. EXPLOSIÓN DE MATERIALES (Receta * Venta)
  for (const sale of dailySales) {
    // Buscar receta
    const productRecipes = await db
      .select()
      .from(recipe_items)
      .where(eq(recipe_items.productSku, sale.productSku));

    if (productRecipes.length > 0) {
      // Tiene receta (ej: Hamburguesa -> Carne + Pan)
      for (const ingredient of productRecipes) {
        if (!ingredient.ingredientSku) continue;
        const qty = ingredient.quantity * sale.quantity;
        const current = theoreticalUsage.get(ingredient.ingredientSku) || 0;
        theoreticalUsage.set(ingredient.ingredientSku, current + qty);
      }
    } else {
      // No tiene receta (ej: Coca Cola), se cuenta directo
      const current = theoreticalUsage.get(sale.productSku) || 0;
      theoreticalUsage.set(sale.productSku, current + sale.quantity);
    }
  }

  // 4. CONSOLIDACIÓN DEL REPORTE
  // Obtenemos todos los insumos que tuvieron movimiento (Teórico o Real)
  const allSkus = new Set([...theoreticalUsage.keys(), ...endStockItems.map((i) => i.productSku || "")]);
  const report: AuditItem[] = [];

  for (const sku of allSkus) {
    const productInfo = await db.query.products.findFirst({ where: eq(products.id, sku) });
    if (!productInfo) continue;

    const teo = theoreticalUsage.get(sku) || 0;

    // Para el consumo REAL, necesitamos: (Stock Ayer + Compras) - Stock Hoy.
    // POR AHORA (MVP): Simplificamos asumiendo que "Real" es lo que falta del stock reportado
    // Nota: Esto se refinará cuando tengamos historial continuo.
    // Si no hay reporte de stock hoy, el consumo real es 0 (o desconocido).
    const stockReport = endStockItems.find((s) => s.productSku === sku);
    const safetyStock = productInfo.safetyStock ?? 0;
    const real = stockReport ? safetyStock - stockReport.actualCount : 0; // Simulacion simple para MVP

    // En realidad, sin stock de ayer, solo podemos mostrar el TEÓRICO vs NADA.
    // Marcamos como "NO_DATA" si no hubo conteo físico hoy.
    const hasAudit = !!stockReport;

    // Cálculo de Varianza (Solo si hay auditoría física)
    const variance = hasAudit ? teo - real : 0;
    const currentCost = productInfo.costCents ?? 0;
    const costLost = variance * (currentCost / 100);

    report.push({
      sku,
      name: productInfo.name,
      theoretical: Number(teo.toFixed(2)),
      real: hasAudit ? Number(real.toFixed(2)) : 0,
      variance: Number(variance.toFixed(2)),
      costLost: Number(costLost.toFixed(2)),
      status: !hasAudit ? "NO_DATA" : Math.abs(variance) > 1 ? "CRITICAL" : "OK",
    });
  }

  // Ordenar: Primero los CRÍTICOS, luego por mayor consumo teórico
  return report.sort((a, b) => {
    if (a.status === "CRITICAL" && b.status !== "CRITICAL") return -1;
    return b.theoretical - a.theoretical;
  });
}
