"use server";

import { db } from "@/db";
import { ai_audit_logs, recipe_items } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateRecipeQuantity(
  productId: string,
  ingredientId: string,
  newQty: number,
  userId: string,
  storeId: string,
) {
  if (isNaN(newQty) || newQty < 0) return { success: false, error: "Tolerancia Invalida" };

  try {
    await db.transaction(async (tx) => {
      // 1. Obtención Inmutable
      const [current] = await tx
        .select({ quantity: recipe_items.quantity })
        .from(recipe_items)
        .where(and(eq(recipe_items.productSku, productId), eq(recipe_items.ingredientSku, ingredientId)));

      if (!current) throw new Error("Fallo de cruce relacional");

      const oldQty = current.quantity;

      // 2. Mutación Atómica
      await tx
        .update(recipe_items)
        .set({ quantity: newQty })
        .where(and(eq(recipe_items.productSku, productId), eq(recipe_items.ingredientSku, ingredientId)));

      // 3. Event Sourcing Estricto (AI Audit Ledger)
      await tx.insert(ai_audit_logs).values({
        id: crypto.randomUUID(),
        agentName: "BOM_DRILLDOWN_AGENT",
        action: "BOM_RECIPE_MUTATION",
        payloadRef: JSON.stringify({
          productId,
          ingredientId,
          oldQty,
          newQty,
          timestamp: new Date().toISOString(),
        }),
        zodSchemaUsed: "BOM_DrillDown_Mutation",
        status: "APPROVED",
        userId,
        storeId,
      });
    });

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    console.error("BOM Mutation Error:", error);
    return { success: false, error: "Bloqueo Atómico Activado" };
  }
}
