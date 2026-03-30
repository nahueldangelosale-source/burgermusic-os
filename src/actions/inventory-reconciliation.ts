"use server";

import { db } from "@/db";
import { 
  inventorySnapshots, 
  snapshot_items, 
  inventory_kardex 
} from "@/db/schema";
import { raw_materials } from "@/db/schema/bom";
import { eq, sql, sum } from "drizzle-orm";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { DraftSnapshotSchema } from "@/lib/inventory";

/**
 * Reconcile Snapshot (Antigravity 2026 Standard)
 * ──────────────────────────────────────────────
 * Atomic engine for inventory variance resolution.
 * Enforces Zero-Trust via Idempotency and ACID transactions.
 */
export async function reconcileSnapshot(snapshotId: string) {
  try {
    // 1. REGLA DE IDEMPOTENCIA (Zero-Trust)
    const [snapshot] = await db
      .select({ status: inventorySnapshots.status, storeId: inventorySnapshots.storeId })
      .from(inventorySnapshots)
      .where(eq(inventorySnapshots.id, snapshotId))
      .limit(1);

    if (!snapshot) throw new Error(`SnapshotNotFound: ID [${snapshotId}] no existe.`);
    if (snapshot.status === "RECONCILED") {
      throw new Error(`IdempotencyViolation: Snapshot [${snapshotId}] ya fue reconciliado.`);
    }

    // 2. MOTOR DE RECONCILIACIÓN ATÓMICA
    return await db.transaction(async (tx) => {
      // 2a. Recuperar items del snapshot cruza con UOM de raw_materials
      const items = await tx
        .select({
          rawMaterialId: snapshot_items.rawMaterialId,
          physicalCountPurchaseUnit: snapshot_items.physicalCountPurchaseUnit,
          conversionFactor: raw_materials.conversionFactor,
          name: raw_materials.name,
        })
        .from(snapshot_items)
        .innerJoin(raw_materials, eq(snapshot_items.rawMaterialId, raw_materials.id))
        .where(eq(snapshot_items.snapshotId, snapshotId));

      const adjustments = [];

      for (const item of items) {
        if (item.rawMaterialId === null) continue;

        // 2b. Calcular Saldo Teórico (Kardex)
        const [theoreticalResult] = await tx
          .select({ current: sum(inventory_kardex.quantity) })
          .from(inventory_kardex)
          .where(eq(inventory_kardex.productSku, item.rawMaterialId));
        
        const theoreticalQty = Number(theoreticalResult?.current || 0);

        // 2c. Calcular Saldo Físico (Recipe Units)
        const actualRecipeUnits = item.physicalCountPurchaseUnit * (item.conversionFactor || 1);

        // 2d. Cálculo de Varianza (Merma)
        const variance = actualRecipeUnits - theoreticalQty;

        // 2e. Preparar Ajuste si hay discrepancia
        if (Math.abs(variance) > 0.000001) {
          adjustments.push({
            id: randomUUID(),
            storeId: snapshot.storeId,
            productSku: item.rawMaterialId,
            quantity: variance, // El delta necesario para llegar al valor físico
            referenceId: `RECONCILE-${snapshotId}`,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          });
        }
      }

      // 3. COMMIT DE AJUSTES EN BATCH
      if (adjustments.length > 0) {
        await tx.insert(inventory_kardex).values(adjustments as any);
      }

      // 4. SELLAR SNAPSHOT
      await tx
        .update(inventorySnapshots)
        .set({ status: "RECONCILED" })
        .where(eq(inventorySnapshots.id, snapshotId));

      try {
        revalidatePath("/dashboard/inventory");
      } catch (e) {
        // Ignored if called from outside Next.js (e.g. test script)
      }

      return { 
        success: true, 
        adjustmentsApplied: adjustments.length,
        snapshotId 
      };
    });
  } catch (error: any) {
    console.error("[SRE-RECONCILIATION] ❌ Error:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Draft Inventory Snapshot (Kitchen Command Center)
 * ────────────────────────────────────────────────
 * Atomic intake of physical counts into a DRAFT state.
 * No Kardex impact until management reconciliation.
 */
export async function draftInventorySnapshot(rawPayload: any) {
  try {
    const data = DraftSnapshotSchema.parse(rawPayload);

    return await db.transaction(async (tx) => {
      const snapshotId = `SNAP-DRAFT-${randomUUID().slice(0, 8)}`;
      
      // 1. Crear Snapshot principal en 'DRAFT'
      await tx.insert(inventorySnapshots).values({
        id: snapshotId,
        storeId: data.storeId,
        reportedBy: data.reportedBy,
        status: "DRAFT",
      });

      // 2. Batch insert de los items contados (en unidad de compra)
      const itemsToInsert = data.items.map(item => ({
        id: randomUUID(),
        snapshotId: snapshotId,
        rawMaterialId: item.rawMaterialId,
        physicalCountPurchaseUnit: item.count,
      }));

      if (itemsToInsert.length > 0) {
        await tx.insert(snapshot_items).values(itemsToInsert as any);
      }

      try {
        revalidatePath("/dashboard/treasury"); // Manager review area
      } catch (e) {
        // Ignored in test environment
      }

      return { 
        success: true, 
        snapshotId 
      };
    });
  } catch (error: any) {
    console.error("[SRE-DRAFT-SNAPSHOT] ❌ Error:", error.message);
    return { success: false, error: error.message };
  }
}
