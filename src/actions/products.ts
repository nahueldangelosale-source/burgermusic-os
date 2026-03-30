"use server";

import { db } from "@/db";
import { products, fact_sales } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { authenticatedAction } from "@/lib/auth-action";
import { ProductUpdateSchema } from "@/schemas/products";
import { withTenant } from "@/lib/tenant-db";
import { z } from "zod";

export const updateProduct = authenticatedAction(async (payload: { id: string, data: z.infer<typeof ProductUpdateSchema> }, { user }) => {
  const { id, data } = payload;
  ProductUpdateSchema.parse(data);
  const tenant = withTenant({ user });

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
});

export async function getProductsPerformance() {
  try {
    const stats = await db.select({
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
