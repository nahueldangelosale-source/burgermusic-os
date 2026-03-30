import { z } from "zod";

export const RecipeIngredientSchema = z.object({
  productId: z.string(),
  ingredientId: z.string(),
  qty: z.number().positive(),
  unitMultiplier: z.number().optional(),
});

export const RecipeUpdateSchema = z.object({
  recipeId: z.string(),
  newQty: z.number().positive(),
  rawMaterialId: z.string(),
  newCostCents: z.number().min(0),
  newUnit: z.string(),
});
