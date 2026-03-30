/**
 * src/lib/recipe-parser.ts
 * Motor de Explosión de Recetas (BOM) - v3.1 Database Driven
 */
import type { db } from "@/db";
import { recipe_items } from "@/db/schema";
import { eq } from "drizzle-orm";

export type IngredientRequirement = {
  sku: string;
  quantity: number;
};

/**
 * Consulta la base de datos para obtener el BOM real de un producto.
 * Soporta fracciones (ej: queso, masa de pizza).
 */
export async function resolveRecipeFootprint(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  productSku: string,
  multiplierQty = 1,
): Promise<IngredientRequirement[]> {
  // Fallback/Safety: In real systems, the POS string should map cleanly to a productSku.
  // For this migration, we format basic POS strings (e.g. "Pizza Muzzarella")
  // to match a potential DB SKU (e.g. "PIZZA_MUZZARELLA").
  const normalizedSku = productSku.trim().toUpperCase().replace(/\s+/g, "_");

  const recipeComponents = await tx
    .select({
      ingredientSku: recipe_items.ingredientSku,
      quantity: recipe_items.quantity,
    })
    .from(recipe_items)
    .where(eq(recipe_items.productSku, normalizedSku));

  if (!recipeComponents.length) {
    console.warn(`[BOM Engine] No recipe found for SKU: ${normalizedSku}. Assumed raw item.`);
    // Note: If no recipe exists, it might be a direct sale of a raw item (like a soda).
    return [{ sku: normalizedSku, quantity: multiplierQty }];
  }

  return recipeComponents.map((component) => ({
    sku: component.ingredientSku!, // DB schema defines this as text, should be populated
    quantity: component.quantity * multiplierQty,
  }));
}
