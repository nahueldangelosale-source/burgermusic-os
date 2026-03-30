import { db } from "@/db";
import { sql, and } from "drizzle-orm";
import { trace } from "@opentelemetry/api";
import { withTenant } from "@/lib/tenant-db";
import { getSession } from "@/lib/auth";
import { fact_sales, cash_register_transactions, products } from "@/db/schema";

const tracer = trace.getTracer("burgermusic-data-fetchers", "1.0.0");

async function getTenantContext() {
  const session = await getSession();
  return withTenant({ user: session?.user });
}

export async function getTopLineMetrics(date?: string) {
  const tenant = await getTenantContext();
  const secureDateOrPeriod = date ? date.split("T")[0].trim() : "all";
  
  const query = tenant.select({
    gross_cents: sql`COALESCE(SUM(${fact_sales.net_price_cents}), 0)`,
    items: sql`COALESCE(SUM(${fact_sales.quantity}), 0)`,
    action_count: sql`COUNT(*)`
  })
  .from(fact_sales);

  if (secureDateOrPeriod !== "all") {
    if (secureDateOrPeriod.endsWith("d")) {
      const days = parseInt(secureDateOrPeriod.replace("d", ""));
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const isoStart = startDate.toISOString().split("T")[0];
      query.where(sql`date >= ${isoStart}`);
    } else {
      query.where(sql`date = ${secureDateOrPeriod}`);
    }
  }

  const rawFacts = await query;
  const gross = Math.round((Number(rawFacts[0]?.gross_cents) || 0) / 100);
  const items = Number(rawFacts[0]?.items || 0);
  const actionCount = Number(rawFacts[0]?.action_count || 0);
  const net = Math.round(gross / 1.10); // Ejemplo ajuste IVA
  const avgTicket = actionCount > 0 ? Math.round(gross / actionCount) : 0;

  return { gross, net, avgTicket };
}

export async function getTemporalEvolution(date?: string) {
  const tenant = await getTenantContext();
  const secureDateOrPeriod = date ? date.split("T")[0].trim() : "all";
  
  const query = tenant.select({
    date: fact_sales.date,
    revenue: sql`COALESCE(SUM(${fact_sales.net_price_cents}), 0)`,
    actions: sql`COUNT(*)`
  })
  .from(fact_sales)
  .groupBy(fact_sales.date)
  .orderBy(sql`${fact_sales.date} DESC`);

  if (secureDateOrPeriod !== "all") {
    if (secureDateOrPeriod.endsWith("d")) {
      const days = parseInt(secureDateOrPeriod.replace("d", ""));
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const isoStart = startDate.toISOString().split("T")[0];
      query.where(sql`date >= ${isoStart}`);
      query.limit(days); 
    } else {
      query.where(sql`date = ${secureDateOrPeriod}`);
    }
  } else {
    query.limit(30); // Default all focus on last 30 for chart readability
  }

  const raw = await query;
  const reversed = [...raw].reverse();
  return reversed.map((r: any) => ({
    date: r.date,
    ingresos: Math.round(Number(r.revenue) / 100),
    ordenes: Number(r.actions)
  }));
}

export async function getChannelDistribution() {
  const tenant = await getTenantContext();
  const query = tenant.select({
    name: cash_register_transactions.paymentMethod,
    value: sql`SUM(${cash_register_transactions.amount})`
  })
  .from(cash_register_transactions)
  .groupBy(cash_register_transactions.paymentMethod);
  
  const sqlObj = query.toSQL();
  console.log("DEBUG: ChannelDistribution SQL:", sqlObj.sql, "Params:", sqlObj.params);
  
  const raw = await query;
  
  if (!raw.length) {
     return [];
  }

  return raw.map((r: any) => ({
    name: r.name || "MIXTO",
    value: Math.round(Number(r.value) / 100)
  }));
}


export async function getTopProducts() {
  return tracer.startActiveSpan("getTopProducts.SQL", async (span) => {
    try {
      const tenant = await getTenantContext();
      
      const sumQuantity = sql`SUM(${fact_sales.quantity})`;
      
      const query = tenant.select({
        name: products.name,
        sales: sumQuantity,
        revenue: sql`SUM(${fact_sales.net_price_cents})`,
        total_cost: sql`SUM(${fact_sales.quantity} * COALESCE(${products.costCents}, 0))`
      })
      .from(fact_sales)
      // Usamos fragmento SQL en lugar de eq() para evitar ReferenceErrors
      .innerJoin(products, sql`${fact_sales.productSku} = ${products.id}`)
      .where(sql`${fact_sales.productSku} NOT LIKE 'SRV_%'`)
      .groupBy(products.name)
      .orderBy(sql`${sumQuantity} DESC`)
      .limit(30);

      const sqlObj = (query as any).toSQL();
      console.log("DEBUG: TopProducts SQL:", sqlObj.sql, "Params:", sqlObj.params);
      
      const raw = await query;

      if (!raw.length) return [];

      return raw.map((r: any, i: number) => {
        const rev = Number(r.revenue);
        const cost = Number(r.total_cost);
        const margin = rev > 0 ? Math.round(((rev - cost) / rev) * 100) : 0;
        
        return {
          id: i,
          rank: i + 1,
          name: String(r.name).toUpperCase(),
          category: "Menu / Insumos",
          sales: Number(r.sales),
          revenue: Math.round(rev / 100),
          margin: `${margin}%`
        };
      });
    } catch(err: any) {
      span.recordException(err);
      throw err;
    } finally {
      span.end();
    }
  });
}
