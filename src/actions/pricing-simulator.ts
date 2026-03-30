"use server";

import { db } from "@/db";
import { recipe_items, fact_sales, products } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function simulateMarginImpact(inflationRates: Record<string, number>) {
  // 1. Obtener ventas de los ultimos 30 días (fact_sales) agrupadas por producto
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString().split("T")[0];

  const salesVolume = await db
    .select({
      productSku: fact_sales.productSku,
      totalSold: sql<number>`sum(${fact_sales.quantity})`,
    })
    .from(fact_sales)
    .where(sql`${fact_sales.date} >= ${cutoff}`)
    .groupBy(fact_sales.productSku);

  // 2. Extraer BOM (recipe_items) y Costos Base
  const allRecipes = await db.select({
      productSku: recipe_items.productSku,
      ingredientSku: recipe_items.ingredientSku,
      qty: recipe_items.quantity,
  }).from(recipe_items);

  const allProducts = await db.select().from(products);

  let totalMarginDropCents = 0;
  const recommendedPriceHikes: Record<string, number> = {};

  // 3. Calcular impacto por SKU de producto final O(1)
  for (const sale of salesVolume) {
     const sku = String(sale.productSku);
     const soldQty = Number(sale.totalSold || 0);
     if (soldQty <= 0) continue;

     const productRecipe = allRecipes.filter(r => String(r.productSku) === sku);
     
     let oldTheoreticalCostCents = 0;
     let newTheoreticalCostCents = 0;

     // BOM Explosion iterativa profunda
     for (const r of productRecipe) {
        const ingDetails = allProducts.find(p => p.id === r.ingredientSku);
        const baseCost = ingDetails?.costCents || 0;
        const ingName = String(ingDetails?.name || "").toLowerCase();
        
        let inflationMultiplier = 1;
        // Intercepción: Buscar si algún string de comodity coincide con el ingrediente
        for (const [key, rate] of Object.entries(inflationRates)) {
          if (ingName.includes(key.toLowerCase())) {
             inflationMultiplier = 1 + rate;
          }
        }

        const qty = r.qty;
        oldTheoreticalCostCents += baseCost * qty;
        newTheoreticalCostCents += (baseCost * qty) * inflationMultiplier;
     }

     const impactPerUnit = newTheoreticalCostCents - oldTheoreticalCostCents;
     if (impactPerUnit > 0) {
       totalMarginDropCents += (impactPerUnit * soldQty);
       // Recomendación: Acoplar el alza teórica para proteger NPV
       recommendedPriceHikes[sku] = (recommendedPriceHikes[sku] || 0) + impactPerUnit;
     }
  }

  return {
    success: true,
    projectedMarginDrop: totalMarginDropCents,
    recommendedPriceHikes,
  };
}
