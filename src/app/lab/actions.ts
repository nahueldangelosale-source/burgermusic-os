"use server";

import { db } from "@/db";
import { products, recipes } from "@/db/schema";
import { eq, and, not } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getLabData() {
    // 1. Fetch Saleable Products (The Menu)
    const saleableProducts = await db
        .select()
        .from(products)
        .where(eq(products.isSaleable, true));

    // 2. Fetch Ingredients (Raw Materials) - anything NOT saleable
    // Ideally we filter by category, but for now assumption calls for isSaleable=false
    const ingredients = await db
        .select()
        .from(products)
        .where(eq(products.isSaleable, false));

    // 3. Fetch All Recipes (to pre-fill the builder)
    const allRecipes = await db.select().from(recipes);

    // Group recipes by ProductSKU
    const recipeMap: Record<string, { ingredientSku: string; quantity: number }[]> = {};

    for (const r of allRecipes) {
        if (!r.productSku) continue;
        if (!recipeMap[r.productSku]) {
            recipeMap[r.productSku] = [];
        }
        recipeMap[r.productSku].push({
            ingredientSku: r.ingredientSku!,
            quantity: r.quantity
        });
    }

    return {
        products: saleableProducts,
        ingredients: ingredients,
        recipes: recipeMap
    };
}

export async function saveRecipe(productSku: string, newIngredients: { ingredientSku: string; quantity: number }[]) {
    if (!productSku) return { success: false, message: "SKU inválido" };

    try {
        // Transactional replacement
        await db.transaction(async (tx) => {
            // 1. Delete existing recipe lines for this product
            await tx.delete(recipes).where(eq(recipes.productSku, productSku));

            // 2. Insert new lines
            if (newIngredients.length > 0) {
                await tx.insert(recipes).values(
                    newIngredients.map(ing => ({
                        productSku: productSku,
                        ingredientSku: ing.ingredientSku,
                        quantity: ing.quantity
                    }))
                );
            }
        });

        revalidatePath("/lab");
        revalidatePath("/dashboard"); // Updates costs there too
        return { success: true };
    } catch (error) {
        console.error("Error saving recipe:", error);
        return { success: false, message: "Error al guardar la receta" };
    }
}
