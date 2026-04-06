import { db } from "@/db";
import { fact_sales, products } from "@/db/schema";
import { cash_register_closures } from "@/db/schema/treasury";
import { desc, eq, sql } from "drizzle-orm";

// 1. Consumo de Productos O(1)
export async function getTopProducts() {
  const result = await db.select({
    productId: products.sku,
    productName: products.name,
    totalQuantity: sql<number>`SUM(${fact_sales.quantity})`.mapWith(Number)
  })
  .from(fact_sales)
  .innerJoin(products, eq(fact_sales.productSku, products.sku))
  .groupBy(products.sku, products.name)
  .orderBy(desc(sql`SUM(${fact_sales.quantity})`));

  return result;
}

// 2. Canales Financieros O(1)
export async function getFinancialChannels() {
  const result = await db.select({
    method: cash_register_closures.payment_method,
    total: sql<number>`SUM(${cash_register_closures.total_cents})`.mapWith(Number)
  })
  .from(cash_register_closures)
  .groupBy(cash_register_closures.payment_method)
  .orderBy(desc(sql`SUM(${cash_register_closures.total_cents})`));

  return result;
}

// 3. Evolución Temporal (para Grafico de Area)
export async function getTemporalEvolution() {
  const result = await db.select({
    date: fact_sales.date,
    revenue: sql<number>`SUM(${fact_sales.net_price_cents})`.mapWith(Number),
    net: sql<number>`SUM(${fact_sales.net_price_cents} - ${fact_sales.historical_cost_cents})`.mapWith(Number)
  })
  .from(fact_sales)
  .groupBy(fact_sales.date)
  .orderBy(fact_sales.date);
  
  return result;
}
