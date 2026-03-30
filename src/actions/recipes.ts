"use server";

import { db } from "@/db";
import { bill_of_materials } from "@/db/schema/bom";
import { eq, and, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";

export async function getRecipeForProduct(productId: string) {
  try {
    const rawData = await db
      .select()
      .from(bill_of_materials)
      .where(and(eq(bill_of_materials.parentId, productId), isNull(bill_of_materials.deletedAt)))
      .all();
    return { success: true, data: rawData };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

import { authenticatedAction } from "@/lib/auth-action";
import { RecipeIngredientSchema } from "@/schemas/recipes";

export const addIngredientToRecipe = authenticatedAction(async (payload: z.infer<typeof RecipeIngredientSchema>) => {
  const { productId, ingredientId, qty, unitMultiplier } = (payload as any);
  
  await db.insert(bill_of_materials).values([{
    id: "BOM-" + randomUUID().substring(0, 8).toUpperCase(),
    parentId: productId,
    childId: ingredientId,
    quantity: qty,
    unitMultiplier: unitMultiplier || 1.0,
  }]);
  revalidatePath("/dashboard/supply");
  return { success: true };
});

export const removeIngredientFromRecipe = authenticatedAction(async (recipeId: string) => {
  await db.update(bill_of_materials).set({ deletedAt: new Date() }).where(eq(bill_of_materials.id, recipeId));
  revalidatePath("/dashboard/supply");
  return { success: true };
});

export async function updateRecipeIngredient(
  recipeId: string, 
  newQty: number, 
  unitMultiplier: number,
  rawMaterialId: string, 
  newCostCents: number,
  newBaseUnit?: string
) {
  try {
     const { raw_materials } = await import("@/db/schema/bom");
     
     // 1. Update the underlying raw material (Cost + Unit pivot)
     const materialUpdate: any = { 
       grossCostCents: newCostCents, 
       trueCostPerUnitCents: newCostCents, 
     };
     if (newBaseUnit) {
        materialUpdate.baseUnit = newBaseUnit;
     }

     await db.update(raw_materials)
       .set(materialUpdate)
       .where(eq(raw_materials.id, rawMaterialId));

     // 2. Update the quantity and multiplier in the recipe link (BOM Edge)
     await db.update(bill_of_materials)
       .set({ quantity: newQty, unitMultiplier })
       .where(eq(bill_of_materials.id, recipeId));
        
     revalidatePath("/dashboard/supply");
     return { success: true };
  } catch (error: any) {
     return { success: false, error: error.message };
  }
}
