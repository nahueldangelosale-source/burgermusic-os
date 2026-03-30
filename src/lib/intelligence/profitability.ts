import { db } from "@/db";
import { products, recipe_items } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

export interface MenuMarginItem {
  id: string;
  name: string;
  sellingPrice: number; // PVP in cents
  cost: number; // Theoretical Cost in cents (Recursive)
  marginPercent: number;
  targetMargin: number;
  status: "HEALTHY" | "WARNING" | "DANGER";
  isSaleable: boolean;
}

/**
 * Calculates the theoretical cost of a product recursively based on its recipe.
 * Returns cost in CENTS.
 */
async function calculateProductCost(productSku: string, depth = 0): Promise<number> {
  if (depth > 5) return 0; // Prevent infinite loops

  // 1. Get Product Base Info
  const [product] = await db
    .select({ id: products.id, costCents: products.costCents })
    .from(products)
    .where(eq(products.id, productSku));

  if (!product) return 0;

  // 2. Check if it has a recipe (Composite Item)
  const ingredients = await db.select().from(recipe_items).where(eq(recipe_items.productSku, productSku));

  if (ingredients.length === 0) {
    // It's a raw ingredient (or simple product), return its direct cost
    return product.costCents || 0;
  }

  // 3. Recursive Cost Calculation
  let totalCost = 0;
  for (const ingredient of ingredients) {
    if (!ingredient.ingredientSku) continue;

    const unitCost = await calculateProductCost(ingredient.ingredientSku, depth + 1);
    totalCost += unitCost * ingredient.quantity;
  }

  return Math.round(totalCost);
}

export async function calculateMenuMargins(): Promise<MenuMarginItem[]> {
  // 1. Fetch all Saleable Products
  // We use sql to perform the boolean check if needed, but d-orm handles boolean mode usually.
  const saleableProducts = await db.select().from(products).where(eq(products.isSaleable, true));

  const results: MenuMarginItem[] = [];

  for (const product of saleableProducts) {
    // Calculate Theoretical Cost
    const cost = await calculateProductCost(product.id);
    const price = product.sellingPrice || 0;
    const target = product.targetMargin || 30;

    let margin = 0;
    if (price > 0) {
      margin = ((price - cost) / price) * 100;
    } else {
      // If no price, margin is technically -100% or 0 depending on view.
      margin = -100;
    }

    // Determine Status
    let status: "HEALTHY" | "WARNING" | "DANGER" = "HEALTHY";
    if (margin < target) status = "DANGER";
    else if (margin < target + 5) status = "WARNING";

    results.push({
      id: product.id,
      name: product.name,
      sellingPrice: price,
      cost: cost,
      marginPercent: Number.parseFloat(margin.toFixed(2)),
      targetMargin: target,
      status,
      isSaleable: true,
    });
  }

  // Sort by lowest margin first
  return results.sort((a, b) => a.marginPercent - b.marginPercent);
}
