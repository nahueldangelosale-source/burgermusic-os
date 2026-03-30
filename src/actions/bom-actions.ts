"use server";

import { db } from "@/db";
import { ai_audit_logs, bom_recipes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getSession } from "@/lib/auth";

export async function updateRecipeBOM(
  recipeId: string,
  ingredientId: string,
  newTheoreticalQty: number,
) {
  const session = await getSession();
  if (!session?.user?.storeId) throw new Error("Unauthorized: Tenant missing in session");

  // Zero-Trust Atomic Transaction
  // Garantizamos que las mutaciones BOM dejen Trazabilidad Positiva en la Audítoria de IA.
  await db.transaction(async (tx) => {
    const currentMatrix = await tx.select().from(bom_recipes).where(eq(bom_recipes.id, recipeId));

    if (currentMatrix.length === 0) {
      throw new Error(`Integridad Rota: Recipe Hash ${recipeId} no detectada en la Matrix.`);
    }

    const currentRecipe = currentMatrix[0];
    const oldQty = currentRecipe.theoretical_qty;

    // 1. Mutar Tensor de Receta
    await tx
      .update(bom_recipes)
      .set({ theoretical_qty: newTheoreticalQty })
      .where(eq(bom_recipes.id, recipeId));

    // 2. Trazabilidad de Fricción Positiva
    await tx.insert(ai_audit_logs).values({
      id: uuidv4(),
      agentName: "BOM_MUTATION_CLIENT",
      action: "UPDATE_RECIPE_BOM",
      zodSchemaUsed: "BOMUpdateBoundary",
      status: "APPROVED",
      storeId: session.user.storeId,
      payloadRef: JSON.stringify({
        recipeId,
        ingredientId,
        oldQty,
        newQty: newTheoreticalQty,
        delta: newTheoreticalQty - oldQty,
      }),
    });
  });

  return { success: true };
}
