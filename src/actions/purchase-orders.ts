"use server";

import { db } from "@/db";
import { purchase_orders, purchase_order_items, purchase_order_status_enum } from "@/db/schema/supply";
import { supplier_metrics, suppliers, ai_audit_logs } from "@/db/schema";
import { randomUUID } from "crypto";
import { eq, sql, isNull, and } from "drizzle-orm";
import { requireManagerSession } from "@/lib/auth-action";
import { withTenant } from "@/lib/tenant-db";
import { PurchaseOrderSchema } from "@/schemas/treasury";
import type { PurchaseOrderInput } from "@/schemas/treasury";

/**
 * Purchase Orders Module — Server Actions Nativas (V3.2 Canonical)
 * 
 * Consolidado contra el esquema canónico en `supply.ts`.
 * Todas las operaciones usan `purchase_orders` + `purchase_order_items`
 * con `store_id` obligatorio para aislamiento Zero-Trust.
 */

// --- HEADLESS: Crear PO sin sesión (para Cron / Watchdog) ---
export async function internalCreatePurchaseOrder(
  storeId: string,
  payload: PurchaseOrderInput,
  options?: { is_autonomous?: boolean; agent_name?: string }
) {
  const validated = PurchaseOrderSchema.parse(payload);

  // 1. Cálculo del costo proyectado total (centavos)
  const totalEstimatedCents = validated.items.reduce(
    (acc, item) => acc + Math.round(item.quantity * item.unit_cost * 100),
    0
  );

  // 2. Generar IDs
  const poId = `PO-${randomUUID()}`;

  // 3. Persistir la orden
  await db.insert(purchase_orders).values({
    id: poId,
    store_id: storeId,
    supplierId: validated.supplier_id,
    status: "DRAFT",
    totalAmountCents: totalEstimatedCents,
  });

  // 4. Persistir ítems del detalle (contra purchase_order_items canónico)
  const itemRows = validated.items.map(item => ({
    id: `POI-${randomUUID()}`,
    poId: poId,
    ingredientId: item.product_id,
    quantityGrams: item.quantity,
    unitPriceCents: Math.round(item.unit_cost * 100),
  }));

  if (itemRows.length > 0) {
    await db.insert(purchase_order_items).values(itemRows);
  }

  // 5. AI Audit Log (Trazabilidad Zero-Trust)
  if (options?.is_autonomous) {
    await db.insert(ai_audit_logs).values({
      id: `WATCHDOG-${randomUUID()}`,
      agentName: options.agent_name || "INVENTORY_WATCHDOG",
      action: "CREATE_DRAFT_PO",
      zodSchemaUsed: "PurchaseOrderSchema",
      status: "APPROVED",
      payloadRef: JSON.stringify({ poId, supplier: validated.supplier_id, items: validated.items.length, totalEstimatedCents }),
      storeId,
    });
  }

  return {
    success: true,
    poId,
    totalEstimatedCents,
    itemCount: validated.items.length,
    is_autonomous: options?.is_autonomous ?? false,
  };
}

// --- Server Action: Crear Orden de Compra (Autenticada) ---
export async function createPurchaseOrder(payload: PurchaseOrderInput) {
  const session = await requireManagerSession();
  if (!session.success || !session.data) {
    throw new Error(session.error || "ZERO_TRUST_VIOLATION: Acceso denegado.");
  }
  return internalCreatePurchaseOrder(session.data.storeId, payload, { is_autonomous: false });
}

// --- Server Action: Listar Órdenes de Compra ---
export async function listPurchaseOrders() {
  const session = await requireManagerSession();
  if (!session.success || !session.data) {
    throw new Error(session.error || "ZERO_TRUST_VIOLATION: Acceso denegado.");
  }
  const { storeId, role } = session.data;
  const tenant = withTenant({ user: { storeId, role } });

  const orders = await tenant
    .select({
      id: purchase_orders.id,
      store_id: purchase_orders.store_id,
      supplier_id: purchase_orders.supplierId,
      status: purchase_orders.status,
      total_estimated_cents: purchase_orders.totalAmountCents,
      created_at: purchase_orders.createdAt,
    })
    .from(purchase_orders)
    .innerJoin(suppliers, eq(purchase_orders.supplierId, suppliers.id))
    .where(isNull(suppliers.deletedAt))
    .orderBy(sql`${purchase_orders.createdAt} DESC`)
    .limit(50);

  // Fix: map statuses explicitly if client expects DRAFT_AI
  return orders.map((o: any) => ({ 
    ...o,
    status: o.status === 'DRAFT' ? 'DRAFT_AI' : o.status
  }));
}

// --- Server Action: Actualizar Estado de PO ---
export async function updatePurchaseOrderStatus(
  payload: { poId: string; status: typeof purchase_order_status_enum[number] | "DRAFT_AI" }
) {
  const session = await requireManagerSession();
  if (!session.success || !session.data) {
    throw new Error(session.error || "ZERO_TRUST_VIOLATION: Acceso denegado.");
  }
  const { storeId, role } = session.data;
  const tenant = withTenant({ user: { storeId, role } });

  const actualStatus = payload.status === "DRAFT_AI" ? "DRAFT" : payload.status as typeof purchase_order_status_enum[number];

  await tenant
    .update(purchase_orders)
    .set({ status: actualStatus })
    .where(eq(purchase_orders.id, payload.poId));

  // Si se marca como FULFILLED, actualizar métricas de lead time
  if (actualStatus === "FULFILLED") {
    const [order] = await tenant
      .select({
        supplierId: purchase_orders.supplierId,
        createdAt: purchase_orders.createdAt,
      })
      .from(purchase_orders)
      .where(eq(purchase_orders.id, payload.poId))
      .limit(1);

    if (order?.createdAt) {
      const createdDate = new Date(order.createdAt);
      const now = new Date();
      const leadTimeHours = Math.round(
        (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60)
      );

      await tenant
        .update(supplier_metrics)
        .set({ leadTimeHours, isOnTime: leadTimeHours <= 48 })
        .where(sql`${supplier_metrics.poId} = ${payload.poId}`);
    }
  }

  return { success: true, poId: payload.poId, newStatus: payload.status };
}
