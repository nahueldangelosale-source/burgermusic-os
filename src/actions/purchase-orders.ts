"use server";

import { db } from "@/db";
import { purchase_orders, po_items, supplier_metrics, suppliers, ai_audit_logs } from "@/db/schema";
import { randomUUID } from "crypto";
import { eq, sql, isNull, and } from "drizzle-orm";
import { authenticatedAction } from "@/lib/auth-action";
import { withTenant } from "@/lib/tenant-db";
import { PurchaseOrderSchema } from "@/schemas/treasury";
import type { PurchaseOrderInput } from "@/schemas/treasury";

/**
 * Purchase Orders Module — Server Actions Nativas
 * 
 * Gestión de Órdenes de Compra anclada al storeId de la sesión.
 * Calcula costo proyectado, persiste en purchase_orders + po_items,
 * y registra métricas del proveedor.
 * 
 * Split Architecture:
 * - `internalCreatePurchaseOrder`: Headless, bypass sesión. Para Cron/Worker.
 * - `createPurchaseOrder`: Wrapper autenticado para UI.
 */

// --- HEADLESS: Crear PO sin sesión (para Cron / Watchdog) ---
export async function internalCreatePurchaseOrder(
  storeId: string,
  payload: PurchaseOrderInput,
  options?: { is_autonomous?: boolean; agent_name?: string }
) {
  const validated = PurchaseOrderSchema.parse(payload);

  // 1. Cálculo del costo proyectado total (centavos)
  const totalEstimated = validated.items.reduce(
    (acc, item) => acc + Math.round(item.quantity * item.unit_cost * 100),
    0
  );

  // 2. Generar IDs
  const poId = `PO-${randomUUID()}`;
  const today = new Date().toISOString().split("T")[0];

  // 3. Persistir la orden — SIEMPRE DRAFT en modo autónomo
  await db.insert(purchase_orders).values({
    id: poId,
    supplier_id: validated.supplier_id,
    status: "DRAFT",
    total_estimated: totalEstimated,
    order_date: today,
    delivery_date: validated.delivery_date || null,
  });

  // 4. Persistir ítems del detalle
  const itemRows = validated.items.map(item => ({
    id: `POI-${randomUUID()}`,
    po_id: poId,
    product_id: item.product_id,
    quantity_suggested: item.quantity,
    quantity_ordered: item.quantity,
    unit_cost_snapshot: Math.round(item.unit_cost * 100),
  }));

  if (itemRows.length > 0) {
    await db.insert(po_items).values(itemRows);
  }

  // 5. AI Audit Log (Trazabilidad Zero-Trust)
  if (options?.is_autonomous) {
    await db.insert(ai_audit_logs).values({
      id: `WATCHDOG-${randomUUID()}`,
      agentName: options.agent_name || "INVENTORY_WATCHDOG",
      action: "CREATE_DRAFT_PO",
      zodSchemaUsed: "PurchaseOrderSchema",
      status: "APPROVED",
      payloadRef: JSON.stringify({ poId, supplier: validated.supplier_id, items: validated.items.length, totalEstimated }),
      storeId,
    });
  }

  return {
    success: true,
    poId,
    totalEstimatedCents: totalEstimated,
    itemCount: validated.items.length,
    is_autonomous: options?.is_autonomous ?? false,
  };
}

// --- Server Action: Crear Orden de Compra (Autenticada) ---
export const createPurchaseOrder = authenticatedAction(
  async (payload: PurchaseOrderInput, { user, storeId }) => {
    return internalCreatePurchaseOrder(storeId, payload, { is_autonomous: false });
  }
);

// --- Server Action: Listar Órdenes de Compra ---
export const listPurchaseOrders = authenticatedAction(async (_: void, { user }) => {
  const tenant = withTenant({ user });

  const orders = await tenant
    .select({
      id: purchase_orders.id,
      supplier_id: purchase_orders.supplier_id,
      status: purchase_orders.status,
      total_estimated: purchase_orders.total_estimated,
      order_date: purchase_orders.order_date,
      delivery_date: purchase_orders.delivery_date,
    })
    .from(purchase_orders)
    .innerJoin(suppliers, eq(purchase_orders.supplier_id, suppliers.id))
    .where(isNull(suppliers.deletedAt))
    .orderBy(sql`${purchase_orders.created_at} DESC`)
    .limit(50);

  return orders;
});

// --- Server Action: Actualizar Estado de PO ---
export const updatePurchaseOrderStatus = authenticatedAction(
  async (
    payload: { poId: string; status: "DRAFT" | "SENT" | "RECEIVED" | "CANCELLED" },
    { user }
  ) => {
    const tenant = withTenant({ user });

    await tenant
      .update(purchase_orders)
      .set({ status: payload.status })
      .where(sql`${purchase_orders.id} = ${payload.poId}`);

    // Si se marca como RECEIVED, actualizar métricas de lead time
    if (payload.status === "RECEIVED") {
      const [order] = await tenant
        .select({
          supplier_id: purchase_orders.supplier_id,
          order_date: purchase_orders.order_date,
        })
        .from(purchase_orders)
        .where(sql`${purchase_orders.id} = ${payload.poId}`)
        .limit(1);

      if (order?.order_date) {
        const orderDate = new Date(order.order_date);
        const now = new Date();
        const leadTimeHours = Math.round(
          (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60)
        );

        await tenant
          .update(supplier_metrics)
          .set({ leadTimeHours, isOnTime: leadTimeHours <= 48 })
          .where(sql`${supplier_metrics.poId} = ${payload.poId}`);
      }
    }

    return { success: true, poId: payload.poId, newStatus: payload.status };
  }
);
