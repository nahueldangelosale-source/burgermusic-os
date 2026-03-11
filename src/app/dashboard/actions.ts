"use server";

import { db } from "@/db";
import { products, recipes, transactions, inventorySnapshots } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getAllCurrentStock } from "@/core/stock-engine";

interface AuditItem {
    id: string; // SKU
    name: string;
    unit: string;
    cost: number;
    purchases: number; // Added for Phase D
    theoretical: number;
    real: number;
    variance: number;
    status: "CRITICAL" | "PROFIT" | "PENDING" | "NEUTRAL";
}

interface AuditSummary {
    totalSales: number;
    totalVarianceCost: number;
    stockEffectiveness: number;
    lastAuditDate: string | null;
    items: AuditItem[];
}

export async function getAuditData(): Promise<AuditSummary> {
    // 1. Fetch Basic Catalogs
    const allProducts = await db.select().from(products);
    const allRecipes = await db.select().from(recipes);

    // Map Recipe Dependencies: ProductSKU -> [IngredientSKU, Qty]
    const recipeMap = new Map<string, { ingredientSku: string; quantity: number }[]>();
    for (const r of allRecipes) {
        if (!r.productSku || !r.ingredientSku) continue;
        const list = recipeMap.get(r.productSku) || [];
        list.push({ ingredientSku: r.ingredientSku, quantity: r.quantity });
        recipeMap.set(r.productSku, list);
    }

    // 2. Fetch REAL stock from Ledger (SUM of all transactions)
    const stockMap = await getAllCurrentStock();

    // 3. Fetch Transactions
    const allTransactions = await db
        .select()
        .from(transactions);

    const sales = allTransactions.filter(t => t.type === "SALE");

    // 4. Calculate Theoretical Usage
    const theoreticalUsage = new Map<string, number>(); // IngredientSKU -> Qty Used

    for (const sale of sales) {
        if (!sale.productSku) continue;
        const ingredients = recipeMap.get(sale.productSku);

        if (ingredients) {
            // It's a composed dish (Burger)
            for (const ing of ingredients) {
                const current = theoreticalUsage.get(ing.ingredientSku) || 0;
                theoreticalUsage.set(ing.ingredientSku, current + (ing.quantity * sale.quantity));
            }
        } else {
            // It's a direct sale item (Soda?)
            const current = theoreticalUsage.get(sale.productSku) || 0;
            theoreticalUsage.set(sale.productSku, current + sale.quantity);
        }
    }

    // 5. Build the Audit Report
    const items: AuditItem[] = [];
    let itemsTotalVarianceCost = 0;

    const relevantSkus = new Set([...theoreticalUsage.keys(), ...stockMap.keys()]);

    for (const sku of relevantSkus) {
        const product = allProducts.find(p => p.id === sku);
        if (!product) continue;

        // Stock real del Ledger (SUM de transacciones)
        const real = stockMap.get(sku) ?? 0;

        // Calculate PURCHASES (solo entradas positivas)
        const productPurchases = allTransactions
            .filter(t => t.productSku === sku && t.type === 'RECEIPT')
            .reduce((sum, t) => sum + t.quantity, 0);

        const totalOut = theoreticalUsage.get(sku) || 0;

        // FORMULA: Theoretical Stock = Purchases - Usage (teórico)
        const theoreticalStock = productPurchases - totalOut;
        const variance = real - theoreticalStock;

        const costCents = product.costCents || 0;
        const cost = costCents / 100;
        const varianceValue = variance * cost;

        itemsTotalVarianceCost += varianceValue;

        let status: "CRITICAL" | "PROFIT" | "NEUTRAL" | "PENDING" = "NEUTRAL";

        if (real === 0 && productPurchases === 0) status = "PENDING";
        else if (variance < -0.5) status = "CRITICAL";
        else if (variance > 0.5) status = "PROFIT";

        if (varianceValue < -100) status = "CRITICAL";

        items.push({
            id: sku,
            name: product.name,
            unit: product.unit,
            cost: cost,
            purchases: Number(productPurchases.toFixed(2)),
            theoretical: Number(theoreticalStock.toFixed(2)),
            real: Number(real.toFixed(2)),
            variance: Number(variance.toFixed(2)),
            status: status,
        });
    }

    // 6. Calculate real KPIs
    const totalSalesRevenue = sales.reduce((acc, sale) => {
        const product = allProducts.find(p => p.id === sale.productSku);
        return acc + (Math.abs(sale.quantity) * (product?.sellingPrice || 0) / 100);
    }, 0);

    const itemsWithData = items.filter(i => i.status !== "PENDING");
    const itemsWithinTolerance = itemsWithData.filter(i => Math.abs(i.variance) <= 0.5);
    const effectiveness = itemsWithData.length > 0
        ? Math.round((itemsWithinTolerance.length / itemsWithData.length) * 100)
        : 100;

    return {
        totalSales: totalSalesRevenue,
        totalVarianceCost: itemsTotalVarianceCost,
        stockEffectiveness: effectiveness,
        lastAuditDate: new Date().toISOString(),
        items
    };
}

// --- ANALYTICS ENGINE (Phase H) ---

export interface AnalyticsSummary {
    salesTrend: { date: string; amount: number }[];
    topProducts: { name: string; quantity: number; revenue: number }[];
    categoryComposition: { name: string; value: number }[];
}

export async function getAnalyticsData(): Promise<AnalyticsSummary> {
    // 1. Fetch Transactions (Last 30 Days)
    const allTransactions = await db.select().from(transactions);

    // Filter Sales
    const sales = allTransactions.filter(t => t.type === "SALE");

    // A. Sales Trend (Daily Revenue)
    const trendMap = new Map<string, number>();
    const allProducts = await db.select().from(products);

    for (const sale of sales) {
        // Normalize date to YYYY-MM-DD (guard against invalid dates)
        const parsed = new Date(sale.date);
        const dateKey = !isNaN(parsed.getTime())
            ? parsed.toISOString().split('T')[0]
            : (sale.date?.split('T')[0] || 'unknown');
        const product = allProducts.find(p => p.id === sale.productSku);
        const revenue = (product?.sellingPrice || 0) * sale.quantity;

        const current = trendMap.get(dateKey) || 0;
        trendMap.set(dateKey, current + (revenue / 100)); // Store in Pesos
    }

    const salesTrend = Array.from(trendMap.entries())
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date));

    // B. Top Products (By Quantity)
    const productMap = new Map<string, number>();
    for (const sale of sales) {
        const current = productMap.get(sale.productSku || 'UNKNOWN') || 0;
        productMap.set(sale.productSku || 'UNKNOWN', current + sale.quantity);
    }

    const topProducts = Array.from(productMap.entries())
        .map(([sku, quantity]) => {
            const p = allProducts.find(x => x.id === sku);
            return {
                name: p?.name || sku,
                quantity,
                revenue: (p?.sellingPrice || 0) * quantity / 100
            };
        })
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

    // C. Cost Composition (Mocked for now, needs Category in Product Schema)
    // We will infer category from Name for MVP
    const categoryMap = new Map<string, number>();

    // Analyze usage to determine cost drivers
    // Reuse recipe logic or just use product costs directly? 
    // Let's use Stock Value for Composition

    // Fetch latest snapshot for stock value
    const allSnapshots = await db
        .select()
        .from(inventorySnapshots)
        .orderBy(desc(inventorySnapshots.date));

    const latestSnapshotMap = new Map<string, typeof allSnapshots[0]>();
    for (const s of allSnapshots) {
        if (!latestSnapshotMap.has(s.productSku)) latestSnapshotMap.set(s.productSku, s);
    }

    for (const [sku, snapshot] of latestSnapshotMap) {
        const p = allProducts.find(x => x.id === sku);
        if (!p || p.isSaleable) continue; // Only Ingredients

        const value = snapshot.actualCount * (p.costCents || 0) / 100;

        let category = "Varios";
        const name = p.name.toLowerCase();
        if (name.includes("carne") || name.includes("medallon")) category = "Carnes";
        else if (name.includes("pan")) category = "Panificados";
        else if (name.includes("queso") || name.includes("cheddar") || name.includes("leche")) category = "Lácteos";
        else if (name.includes("salsa") || name.includes("ketchup")) category = "Salsas";
        else if (name.includes("lechuga") || name.includes("tomate")) category = "Verduras";

        categoryMap.set(category, (categoryMap.get(category) || 0) + value);
    }

    const categoryComposition = Array.from(categoryMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    return {
        salesTrend,
        topProducts,
        categoryComposition
    };
}

// --- FINANCIAL METRICS (Cash Closure ETL) ---

export interface FinancialMetrics {
    monthlyRevenue: number;
    totalCash: number;
    totalMp: number;
    totalDelivery: number;
    cashPct: number;
    mpPct: number;
    deliveryPct: number;
    yesterdayVariance: number | null;
    varianceTrend: { date: string; variance: number }[];
    closureCount: number;
    currentMonth: string;
}

export async function getFinancialMetrics(): Promise<FinancialMetrics> {
    const { dailyCashClosures } = await import("@/db/schema");

    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    // Fetch all closures for current month
    const allClosures = await db.select().from(dailyCashClosures);
    const monthClosures = allClosures.filter(c => c.date?.startsWith(monthPrefix));

    if (monthClosures.length === 0) {
        return {
            monthlyRevenue: 0,
            totalCash: 0,
            totalMp: 0,
            totalDelivery: 0,
            cashPct: 0,
            mpPct: 0,
            deliveryPct: 0,
            yesterdayVariance: null,
            varianceTrend: [],
            closureCount: 0,
            currentMonth: monthNames[now.getMonth()],
        };
    }

    // Aggregate totals
    const monthlyRevenue = monthClosures.reduce((sum, c) => sum + (c.totalGlobal || 0), 0);
    const totalCash = monthClosures.reduce((sum, c) => sum + (c.totalCash || 0), 0);
    const totalMp = monthClosures.reduce((sum, c) => sum + (c.totalMp || 0), 0);
    const totalDelivery = monthClosures.reduce((sum, c) => sum + (c.totalDelivery || 0), 0);

    const grandTotal = totalCash + totalMp + totalDelivery;
    const cashPct = grandTotal > 0 ? Math.round((totalCash / grandTotal) * 100) : 0;
    const mpPct = grandTotal > 0 ? Math.round((totalMp / grandTotal) * 100) : 0;
    const deliveryPct = grandTotal > 0 ? Math.round((totalDelivery / grandTotal) * 100) : 0;

    // Yesterday's variance
    const sorted = [...monthClosures].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const yesterdayVariance = sorted.length > 0 ? (sorted[0].variance ?? null) : null;

    // Last 7 days variance trend
    const last7 = sorted.slice(0, 7).reverse();
    const varianceTrend = last7.map(c => ({
        date: c.date || "",
        variance: c.variance || 0,
    }));

    return {
        monthlyRevenue,
        totalCash,
        totalMp,
        totalDelivery,
        cashPct,
        mpPct,
        deliveryPct,
        yesterdayVariance,
        varianceTrend,
        closureCount: monthClosures.length,
        currentMonth: monthNames[now.getMonth()],
    };
}
