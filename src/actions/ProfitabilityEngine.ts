"use server";

import { db } from "@/db";
import { getSession } from "@/lib/auth";
import { fact_sales, products } from "@/db/schema";
import { supplier_current_accounts, petty_cash_fund } from "@/db/schema/treasury";
import { inventory_items } from "@/db/schema/supply";
import { sql, eq, desc, asc, lte, and } from "drizzle-orm";

export async function requireManagerSession() {
  const session = await getSession();
  if (!session?.user?.id || (session.user.role !== "MANAGER" && session.user.role !== "OWNER_GLOBAL")) {
    throw new Error("Zero-Trust: Manager clearance required.");
  }
  return session;
}

export async function getProfitabilityKPIs(storeId: string) {
  await requireManagerSession();

  const aggregated = await db
    .select({
      totalRevenue: sql<number>`SUM(${fact_sales.historical_price_cents} * ${fact_sales.quantity})`,
      totalCost: sql<number>`SUM(${fact_sales.historical_cost_cents} * ${fact_sales.quantity})`,
      ticketCount: sql<number>`COUNT(DISTINCT ${fact_sales.ticket_number})`
    })
    .from(fact_sales)
    .where(eq(fact_sales.storeId, storeId));

  const revenues = aggregated[0]?.totalRevenue || 0;
  const costs = aggregated[0]?.totalCost || 0;
  const tickets = aggregated[0]?.ticketCount || 1;

  const grossMargin = revenues - costs;
  const averageTicket = revenues / (tickets === 0 ? 1 : tickets);

  return { grossMargin, averageTicket, revenues, costs };
}

export async function getTopSKUs(storeId: string) {
  await requireManagerSession();

  const skus = await db
    .select({
      productId: fact_sales.productSku,
      absoluteMargin: sql<number>`SUM((${fact_sales.historical_price_cents} - ${fact_sales.historical_cost_cents}) * ${fact_sales.quantity})`
    })
    .from(fact_sales)
    .where(eq(fact_sales.storeId, storeId))
    .groupBy(fact_sales.productSku)
    .orderBy(desc(sql`SUM((${fact_sales.historical_price_cents} - ${fact_sales.historical_cost_cents}) * ${fact_sales.quantity})`))
    .limit(10);

  return skus;
}

export async function getSkuDrillDown(storeId: string, productSku: string) {
  await requireManagerSession();
  
  const sales = await db
    .select({
      date: fact_sales.createdAt,
      price: fact_sales.historical_price_cents,
      cost: fact_sales.historical_cost_cents,
      ticket: fact_sales.ticket_number
    })
    .from(fact_sales)
    .where(and(eq(fact_sales.storeId, storeId), eq(fact_sales.productSku, productSku)))
    .orderBy(desc(fact_sales.createdAt))
    .limit(50);
    
  return sales;
}

export async function getAlertSentinel(storeId: string) {
  await requireManagerSession();

  const [debts, stockOuts, inactiveProducts, bleedingCash] = await Promise.all([
    db.select()
      .from(supplier_current_accounts)
      .where(and(eq(supplier_current_accounts.store_id, storeId), eq(supplier_current_accounts.status, "PENDING")))
      .orderBy(asc(supplier_current_accounts.due_date)),
      
    db.select({ count: sql<number>`COUNT(*)` })
      .from(inventory_items)
      .where(and(
         eq(inventory_items.store_id, storeId),
         lte(inventory_items.current_stock, inventory_items.min_stock_alert),
         eq(inventory_items.is_active, true)
      )),
      
    db.select({ count: sql<number>`COUNT(*)` })
      .from(products)
      .where(eq(products.isSaleable, false)),
      
    db.select()
      .from(petty_cash_fund)
      .where(and(
         eq(petty_cash_fund.store_id, storeId), 
         sql`${petty_cash_fund.current_balance_cents} < 0`
      ))
  ]);

  return {
    debts,
    stockOutsNum: stockOuts[0]?.count || 0,
    inactiveProductsNum: inactiveProducts[0]?.count || 0,
    bleedingCash
  };
}

export async function getSalesTimeline(storeId: string) {
  await requireManagerSession();
  
  const timeline = await db
    .select({
      date: sql<string>`DATE(${fact_sales.date})`,
      revenue: sql<number>`SUM(${fact_sales.historical_price_cents} * ${fact_sales.quantity})`
    })
    .from(fact_sales)
    .where(eq(fact_sales.storeId, storeId))
    .groupBy(sql`DATE(${fact_sales.date})`)
    .orderBy(asc(sql`DATE(${fact_sales.date})`));

  return timeline;
}
