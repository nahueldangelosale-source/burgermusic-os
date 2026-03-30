import { db } from "@/db";
import { ai_audit_logs } from "@/db/schema";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { internalCreatePurchaseOrder } from "@/actions/purchase-orders";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Inventory Watchdog — Vercel Cron Endpoint
 * K-MAPE Loop: Monitor → Analyze → Plan → Execute
 * 
 * Ciclo:
 *  1. MONITOR — Consulta O(1) SQL: inventory_kardex vs products.safetyStock
 *  2. ANALYZE — Filtra insumos con déficit real (currentStock <= safetyStock)
 *  3. PLAN    — Recupera supplier_id y último costo del fact_supplier_ledger
 *  4. EXECUTE — Genera PO DRAFT vía internalCreatePurchaseOrder
 * 
 * Fricción Positiva: Las POs generadas son SIEMPRE DRAFT.
 * El C-Level debe aprobarlas manualmente desde el Bento Grid.
 */

// --- STEP 2: O(1) SQL Deficit Query ---
async function getDeficitProducts(): Promise<DeficitRow[]> {
  const deficitQuery = sql`
    WITH CurrentStock AS (
      SELECT 
        ik.store_id,
        ik.product_sku,
        SUM(ik.quantity) AS current_stock
      FROM inventory_kardex ik
      GROUP BY ik.store_id, ik.product_sku
    ),
    LastCost AS (
      SELECT 
        fsl.supplier_id,
        fsl.store_id,
        -- Extraemos el último costo pagado por proveedor
        fsl.amount_cents AS last_cost_cents,
        ROW_NUMBER() OVER (
          PARTITION BY fsl.supplier_id, fsl.store_id 
          ORDER BY fsl.date DESC
        ) AS rn
      FROM fact_supplier_ledger fsl
      WHERE fsl.type = 'INVOICE'
    )
    SELECT 
      cs.store_id,
      cs.product_sku,
      p.name AS product_name,
      cs.current_stock,
      COALESCE(p.safety_stock, 0) AS safety_stock,
      COALESCE(p.supplier_id, '') AS supplier_id,
      COALESCE(lc.last_cost_cents, p.cost_cents, 0) AS last_cost_cents
    FROM CurrentStock cs
    JOIN products p ON cs.product_sku = p.id
    LEFT JOIN LastCost lc ON lc.supplier_id = p.supplier_id 
      AND lc.store_id = cs.store_id
      AND lc.rn = 1
    WHERE cs.current_stock <= COALESCE(p.safety_stock, 0)
      AND COALESCE(p.safety_stock, 0) > 0
      AND COALESCE(p.supplier_id, '') != ''
      AND p.deleted_at IS NULL
    ORDER BY (COALESCE(p.safety_stock, 0) - cs.current_stock) DESC;
  `;

  return (await db.all(deficitQuery)) as DeficitRow[];
}

type DeficitRow = {
  store_id: string;
  product_sku: string;
  product_name: string;
  current_stock: number;
  safety_stock: number;
  supplier_id: string;
  last_cost_cents: number;
};

// --- MAIN HANDLER ---
export async function GET(request: Request) {
  // 1. Vercel Cron Secret Authentication
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (
    cronSecret &&
    authHeader !== `Bearer ${cronSecret}` &&
    request.headers.get("x-vercel-cron") !== "1"
  ) {
    return NextResponse.json(
      { error: "Unauthorized / Mando Global Lock" },
      { status: 401 }
    );
  }

  const runId = `WATCHDOG-RUN-${randomUUID().slice(0, 8)}`;
  const startMs = Date.now();

  try {
    console.log(`[K-MAPE] ⏱️ ${runId} — Iniciando Ciclo Watchdog Autónomo`);

    // --- MONITOR + ANALYZE ---
    const deficits = await getDeficitProducts();
    console.log(`[K-MAPE] 📊 ${deficits.length} insumos en déficit detectados`);

    if (deficits.length === 0) {
      return NextResponse.json({
        status: "nominal",
        message: "Inventario dentro de parámetros. Sin acciones requeridas.",
        runId,
        latencyMs: Date.now() - startMs,
      });
    }

    // --- PLAN: Agrupar déficits por (storeId, supplierId) ---
    const grouped = new Map<string, { storeId: string; supplierId: string; items: DeficitRow[] }>();

    for (const row of deficits) {
      const key = `${row.store_id}::${row.supplier_id}`;
      if (!grouped.has(key)) {
        grouped.set(key, { storeId: row.store_id, supplierId: row.supplier_id, items: [] });
      }
      grouped.get(key)!.items.push(row);
    }

    // --- EXECUTE: Generar PO DRAFTs ---
    let draftsCreated = 0;
    const results: { poId: string; supplier: string; items: number }[] = [];

    for (const [, group] of grouped) {
      try {
        // Calcular cantidad sugerida: reorderPoint - currentStock (mínimo 1 unidad)
        const poItems = group.items.map(item => ({
          product_id: item.product_sku,
          quantity: Math.max(1, Math.ceil(item.safety_stock - item.current_stock)),
          unit_cost: item.last_cost_cents / 100, // Convertir centavos a unidades
        }));

        const result = await internalCreatePurchaseOrder(
          group.storeId,
          {
            supplier_id: group.supplierId,
            items: poItems,
          },
          {
            is_autonomous: true,
            agent_name: "INVENTORY_WATCHDOG_CRON",
          }
        );

        if (result.success) {
          draftsCreated++;
          results.push({ poId: result.poId, supplier: group.supplierId, items: result.itemCount });
          console.log(`[K-MAPE] ✅ DRAFT PO generada: ${result.poId} | Proveedor: ${group.supplierId} | Ítems: ${result.itemCount}`);
        }
      } catch (poError: any) {
        console.error(`[K-MAPE] ❌ Error al generar PO para ${group.supplierId}: ${poError.message}`);
        
        // Log de fallo en ai_audit_logs (Fail-Closed)
        await db.insert(ai_audit_logs).values({
          id: `WATCHDOG-FAIL-${randomUUID()}`,
          agentName: "INVENTORY_WATCHDOG_CRON",
          action: "CREATE_DRAFT_PO_FAILED",
          zodSchemaUsed: "PurchaseOrderSchema",
          status: "REJECTED_BY_GUARDRAIL",
          rejectionReason: poError.message,
          payloadRef: JSON.stringify({ supplier: group.supplierId, itemCount: group.items.length }),
          storeId: group.storeId,
        });
      }
    }

    const latencyMs = Date.now() - startMs;

    console.log(`[K-MAPE] 🏁 Ciclo completado en ${latencyMs}ms | DRAFTs: ${draftsCreated} | Déficits: ${deficits.length}`);

    return NextResponse.json({
      status: "executed",
      runId,
      latencyMs,
      deficitsFound: deficits.length,
      draftsCreated,
      results,
    });
  } catch (e: any) {
    console.error(`[K-MAPE] 💀 Error Fatal en Watchdog: ${e.message}`);
    return NextResponse.json(
      { error: "Internal Server Error", details: e.message, runId },
      { status: 500 }
    );
  }
}
