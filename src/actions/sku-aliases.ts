"use server";

import { db } from "@/db";
import { sku_aliases } from "@/db/schema";
import { requireManagerSession } from "@/actions/ProfitabilityEngine"; // Asumiendo este path o similar existe
import { randomUUID } from "node:crypto";

export async function saveSkuAlias(rawSku: string, productId: string) {
  const session = await requireManagerSession();
  
  const rawSkuTrimmed = rawSku.trim().toLowerCase();
  if (!rawSkuTrimmed) throw new Error("Raw SKU vacío");

  try {
    await db.insert(sku_aliases).values({
      id: randomUUID(),
      store_id: session.user.storeId || "CENTRO", // Defaulting as usual
      raw_sku: rawSkuTrimmed,
      product_id: productId
    }).onConflictDoNothing(); // La restricción UNIQUE lo protegerá
    return { success: true };
  } catch(e: any) {
    throw new Error("Alias ya existe o fallo DB: " + e.message);
  }
}
