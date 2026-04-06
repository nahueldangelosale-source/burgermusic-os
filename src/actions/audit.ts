"use server";

import { db } from "@/db";
import { inventory_items, stock_movements } from "@/db/schema/supply";
import { item_category_enum, measurement_unit_enum } from "@/db/schema/supply";
import { requireManagerSession, requireReadSession } from "@/lib/auth-utils";
import { eq, and, notInArray, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";

// V3.1 Regla 2: Todas las queries de lectura filtran registros soft-deleted
export async function getInventoryCatalog() {
  const { storeId } = await requireReadSession();

  const result = await db
    .select()
    .from(inventory_items)
    .where(and(
      eq(inventory_items.store_id, storeId),
      eq(inventory_items.is_active, true),
      isNull(inventory_items.deleted_at)
    ));

  return { success: true, data: result };
}

export type AuditPayload = {
  items: Array<{
    item_id: string;
    actual_count: number;
    difference: number;
  }>;
};

// V3.1 Regla 1: Trazabilidad Zero-Trust — audited_by inyectado en reference_id
export async function consolidateAudit(payload: AuditPayload) {
  const { storeId, userId } = await requireManagerSession();

  if (!payload.items || payload.items.length === 0) {
    return { success: false, error: "Empty audit payload." };
  }

  try {
    const auditedAt = new Date().toISOString();

    await db.transaction(async (tx) => {
      for (const item of payload.items) {
        // 1. Actualiza current_stock en inventory_items
        await tx.update(inventory_items)
          .set({ current_stock: item.actual_count, updated_at: auditedAt })
          .where(and(eq(inventory_items.id, item.item_id), eq(inventory_items.store_id, storeId)));

        // 2. Inserta registro en stock_movements con movement_type = 'ADJUST'
        if (item.difference !== 0) {
          await tx.insert(stock_movements)
            .values({
              id: randomUUID(),
              store_id: storeId,
              item_id: item.item_id,
              movement_type: "ADJUST",
              quantity: item.difference,
              reference_id: `AUDIT_DOMINICAL_BY_${userId}_AT_${auditedAt}`
            });
        }
      }
    });

    revalidatePath("/dashboard/supply");
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to consolidate audit.";
    return { success: false, error: msg };
  }
}

// V3.1 Regla 1: Trazabilidad — actor estampado en created_at/updated_at
export async function createInventoryItem(data: { name: string, category: string, measurement_unit: string, cost_per_unit_cents: number }) {
  const { storeId, userId } = await requireManagerSession();

  const auditedAt = new Date().toISOString();

  await db.insert(inventory_items).values({
    id: "INV_" + randomUUID().substring(0, 8).toUpperCase(),
    store_id: storeId,
    name: data.name,
    category: data.category as (typeof item_category_enum)[number],
    measurement_unit: data.measurement_unit as (typeof measurement_unit_enum)[number],
    cost_per_unit_cents: data.cost_per_unit_cents || 0,
    current_stock: 0,
    min_stock_alert: 0,
    is_active: true,
    audited_by: userId,
    audited_at: auditedAt,
    created_at: auditedAt,
    updated_at: auditedAt,
  });

  revalidatePath("/dashboard/supply");
  return { success: true };
}

// V3.1 Regla 2: Soft Delete — PROHIBIDO db.delete() en tablas de catálogo
export async function deleteInventoryItem(id: string) {
  const { storeId, userId } = await requireManagerSession();

  try {
    const auditedAt = new Date().toISOString();

    await db.update(inventory_items)
      .set({ is_active: false, deleted_at: auditedAt, updated_at: auditedAt, audited_by: userId, audited_at: auditedAt })
      .where(and(eq(inventory_items.id, id), eq(inventory_items.store_id, storeId)));

    revalidatePath("/dashboard/supply");
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: msg };
  }
}

// V3.1 Regla 2: Soft Delete on orphaned BOMs — ACID wrapped
export async function cleanOrphanedBOMs() {
  const { storeId } = await requireManagerSession();

  const { bill_of_materials } = await import("@/db/schema/bom");

  await db.transaction(async (tx) => {
    const validItems = await tx
      .select({ id: inventory_items.id })
      .from(inventory_items)
      .where(and(eq(inventory_items.store_id, storeId), eq(inventory_items.is_active, true), isNull(inventory_items.deleted_at)));
    
    const validIds = validItems.map(i => i.id);
    const auditedAt = new Date();

    if (validIds.length > 0) {
      await tx.update(bill_of_materials)
        .set({ deletedAt: auditedAt })
        .where(notInArray(bill_of_materials.childId, validIds));
    } else {
      await tx.update(bill_of_materials)
        .set({ deletedAt: auditedAt });
    }
  });

  return { success: true };
}

// V3.1: seedRealWorldCatalog — Soft Purge + Siembra Atómica con Audit Trail — ACID wrapped
export async function seedRealWorldCatalog() {
  const { storeId, userId } = await requireManagerSession();

  const { bill_of_materials } = await import("@/db/schema/bom");
  const auditedAt = new Date().toISOString();

  // Fase B: Siembra con Audit Trail
  const carnes = ["MEDALLON DE CARNE 110G", "NIRVANA DE CARNE", "NIRVANA DE POLLO"];
  const panes = ["PAN TBP", "PAN LUNATICO", "PAN QUESO GRATINADO", "PAN SANDWICH", "PAN PANCHO", "PAN NIRVANA"];
  const quesos = ["CHEDDAR FETAS", "CHEDDAR POUCH", "JAMON", "QUESO DAMBO", "PROVOLETA", "QUESO PARMESANO", "PANCETA"];
  const congelados = [
    "PAPAS SIMPLOT CRUNCH", "PAPAS NOISETTE", "PAPAS RUSTICAS", 
    "SALCHICHAS UNION GRANADERA", "SALCHICHAS ALEMANAS", "MEDALLONES POLLO CRUNCH SADIA", 
    "NUGGETS", "FINGERS DE POLLO", "RICO SAURIOS", "BASTONES DE MUZZA", "AROS DE CEBOLLA", 
    "MEDALLON NOTCO", "MEDALLON CEB CARAMELIZADA", "FRANUI"
  ];

  const rawPayload = [
    ...carnes.map(name => ({ name, category: "CARNES" })),
    ...panes.map(name => ({ name, category: "PANIFICADOS" })),
    ...quesos.map(name => ({ name, category: "QUESOS_FIAMBRES" })),
    ...congelados.map(name => ({ name, category: "CONGELADOS" }))
  ];

  const payload = rawPayload.map(item => ({
    id: `MDM_${item.name.replace(/[^A-Z0-9]/ig, '').toUpperCase()}`,
    store_id: storeId,
    name: item.name,
    category: item.category as (typeof item_category_enum)[number],
    measurement_unit: "UNIDAD" as (typeof measurement_unit_enum)[number],
    cost_per_unit_cents: 0,
    current_stock: 0,
    min_stock_alert: 0,
    is_active: true,
    audited_by: userId,
    audited_at: auditedAt,
    created_at: auditedAt,
    updated_at: auditedAt,
  }));

  // ACID: Purge + seed MUST be atomic
  await db.transaction(async (tx) => {
    // Fase A: Soft-Purge (Zero Hard Deletes)
    await tx.update(bill_of_materials).set({ deletedAt: new Date() });
    await tx.update(inventory_items)
      .set({ is_active: false, deleted_at: auditedAt, updated_at: auditedAt, audited_by: userId, audited_at: auditedAt })
      .where(eq(inventory_items.store_id, storeId));

    // Fase B: Insert new catalog
    if (payload.length > 0) {
      await tx.insert(inventory_items).values(payload).onConflictDoNothing();
    }
  });

  return { success: true, seeded: payload.length, audited_by: userId, audited_at: auditedAt };
}
