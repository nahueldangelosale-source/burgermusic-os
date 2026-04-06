"use server";

import { db } from "@/db";
import { products, fact_sales } from "@/db/schema";
import { bill_of_materials } from "@/db/schema/bom";
import { inventory_items } from "@/db/schema/supply";
import { eq, sql, isNull, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireManagerSession } from "@/lib/auth-action";
import { ProductUpdateSchema } from "@/schemas/products";
import { withTenant } from "@/lib/tenant-db";
import { z } from "zod";

/**
 * updateProduct
 * ─────────────────────────────────────────────────────────────────────────────
 * Zero-Trust version: Validates session and applies branch isolation.
 */
export async function updateProduct(payload: { id: string, data: z.infer<typeof ProductUpdateSchema> }) {
  const session = await requireManagerSession();
  if (!session.success || !session.data) {
    throw new Error(session.error || "ZERO_TRUST_VIOLATION: Acceso denegado al Catálogo MDM.");
  }
  const { storeId, role } = session.data;
  const tenant = withTenant({ user: { storeId, role } });

  const { id, data } = payload;
  ProductUpdateSchema.parse(data);

  const updatePayload: any = {};
  if (data.name) updatePayload.name = data.name;
  if (data.sku) updatePayload.sku = data.sku;
  if (data.category) updatePayload.category = data.category;
  if (data.price !== undefined) {
    updatePayload.sellingPrice = data.price;
    updatePayload.base_price_cents = data.price;
  }

  await tenant.update(products)
    .set(updatePayload)
    .where(eq(products.id, id));

  revalidatePath("/dashboard/supply");
  return { success: true };
}

/**
 * getProductsPerformance
 */
export async function getProductsPerformance() {
  const session = await requireManagerSession();
  if (!session.success || !session.data) {
    throw new Error(session.error || "ZERO_TRUST_VIOLATION: Acceso denegado.");
  }
  const { storeId, role } = session.data;
  const tenant = withTenant({ user: { storeId, role } });

  try {
    const stats = await tenant.select({
      productSku: fact_sales.productSku,
      totalVolume: sql<number>`sum(${fact_sales.quantity})`,
      totalRevenue: sql<number>`sum(${fact_sales.net_price_cents})`,
    })
    .from(fact_sales)
    .groupBy(fact_sales.productSku);

    return { success: true, data: stats };
  } catch (error: any) {
    console.error("Error fetching performance:", error);
    return { success: false, error: error.message };
  }
}

/**
 * deleteProduct
 * V3.1 Compliance: Soft Delete Only — Zero Hard Deletes
 */
export async function deleteProduct(id: string) {
  const session = await requireManagerSession();
  if (!session.success || !session.data) {
    throw new Error(session.error || "ZERO_TRUST_VIOLATION: Acceso denegado.");
  }
  const { storeId, role } = session.data;
  const tenant = withTenant({ user: { storeId, role } });

  await tenant.update(products)
    .set({ deletedAt: new Date() })
    .where(eq(products.id, id));
  
  revalidatePath("/dashboard/supply");
  return { success: true };
}

/**
 * getProductsWithDynamicCost
 * V3.1 Regla 4: Singularidad de Costos — Costo Dinámico via BOM Engine O(1)
 */
export async function getProductsWithDynamicCost() {
  const session = await requireManagerSession();
  if (!session.success || !session.data) {
    throw new Error(session.error || "ZERO_TRUST_VIOLATION: Acceso denegado.");
  }
  const { storeId, role } = session.data;
  const tenant = withTenant({ user: { storeId, role } });

  try {
    const result = await tenant.select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      category: products.category,
      sellingPrice: products.sellingPrice,
      bomCostCents: sql<number>`COALESCE(SUM(${bill_of_materials.quantity} * ${bill_of_materials.unitMultiplier} * ${inventory_items.cost_per_unit_cents}), 0)`,
    })
    .from(products)
    .leftJoin(bill_of_materials, and(
      eq(bill_of_materials.parentId, products.id),
      isNull(bill_of_materials.deletedAt)
    ))
    .leftJoin(inventory_items, and(
      eq(inventory_items.id, bill_of_materials.childId),
      eq(inventory_items.is_active, true)
    ))
    .where(and(
      sql`${products.isSaleable} = 1`,
      isNull(products.deletedAt)
    ))
    .groupBy(products.id)
    .orderBy(products.name);

    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error fetching products with dynamic cost:", error);
    return { success: false, error: error.message };
  }
}
