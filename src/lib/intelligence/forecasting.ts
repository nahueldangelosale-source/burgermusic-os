import { db } from "@/db";
import { products, recipes, transactions, inventorySnapshots } from "@/db/schema";
import { sql, eq, and, gte, sum, desc } from "drizzle-orm";

// TIPO DE DATO PARA SUGERENCIA DE COMPRA
export interface RestockSuggestion {
    supplierId: string | null;
    supplierName: string;
    items: {
        productId: string;
        productName: string;
        unit: string;
        currentStock: number;
        avgDailyConsumption: number; // ADC
        daysToCover: number;
        suggestedQuantity: number;
        unitCost: number;
        status: "OK" | "LOW" | "CRITICAL";
    }[];
}

/**
 * EL MOTOR DE PREDICCIÓN (The Oracle)
 * Calcula:
 * 1. Consumo promedio diario (ADC) de los últimos 7 días.
 * 2. Proyecta necesidad para X días.
 * 3. Resta el stock actual.
 */
export async function calculateRestockNeeds(daysToCover: number = 3): Promise<RestockSuggestion[]> {
    // 1. Obtener Ventas de los últimos 7 días
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateStr = sevenDaysAgo.toISOString().split('T')[0];

    // Agregación de ventas por producto (Platos vendidos)
    const salesData = await db
        .select({
            productSku: transactions.productSku,
            totalSold: sum(transactions.quantity),
        })
        .from(transactions)
        .where(and(eq(transactions.type, "SALE"), gte(transactions.date, dateStr)))
        .groupBy(transactions.productSku);

    // Mapa de Ventas: { "MALA_FAMA_DOBLE": 50, ... }
    const salesMap = new Map<string, number>();
    salesData.forEach(s => {
        if (s.productSku && s.totalSold) {
            salesMap.set(s.productSku, Number(s.totalSold));
        }
    });

    // 2. Obtener Recetas para explotar ingredientes
    const allRecipes = await db.query.recipes.findMany();
    const allProducts = await db.query.products.findMany({
        with: {
            supplier: true
        }
    });

    // 3. Obtener Stock Actual (Snapshot más reciente + Movimientos posteriores)
    // SIMPLIFICACIÓN MVP: Usamos el último snapshot conocido o 0 si no hay.
    // LÓGICA IDEAL: Stock = Último Snapshot + Compras - Ventas (usando recetas).
    // Para este MVP fase F, asumiremos que el "Stock Actual" es calculable o se puede estimar.
    // DADO QUE NO TENEMOS UN "LIVE STOCK" PERFECTO AÚN, VAMOS A USAR UN DATO SIMULADO O CALCULADO.
    // Vamos a calcular el consumo teórico de INSUMOS basado en las ventas.

    const ingredientConsumption = new Map<string, number>(); // Sku -> Total consumido en 7 días

    // Explode Recipes: Convertir Platos Vendidos a Insumos Gastados
    for (const [soldSku, quantitySold] of salesMap.entries()) {
        const productRecipes = allRecipes.filter(r => r.productSku === soldSku);

        if (productRecipes.length > 0) {
            // Es un plato compuesto (Hamburguesa)
            for (const r of productRecipes) {
                if (r.ingredientSku) {
                    const current = ingredientConsumption.get(r.ingredientSku) || 0;
                    ingredientConsumption.set(r.ingredientSku, current + (r.quantity * quantitySold));
                }
            }
        } else {
            // Es un producto directo (Gaseosa)
            const current = ingredientConsumption.get(soldSku) || 0;
            ingredientConsumption.set(soldSku, current + quantitySold);
        }
    }

    // 4. Generar Reporte por Proveedor
    const suggestionsBySupplier = new Map<string, RestockSuggestion>();

    for (const product of allProducts) {
        // Solo nos interesan insumos comprables (tienen supplier)
        if (!product.supplierId) continue;

        const consumption7Days = ingredientConsumption.get(product.id) || 0;
        const avgDailyConsumption = consumption7Days / 7;

        // TODO: En Fase Real, leer stock. Aquí asumimos stock bajo para forzar sugerencia en demo.
        // O mejor: Si no hay datos de stock, asumimos 0 para que sugiera comprar TODO lo necesario.
        const currentStock = 0;

        const needed = avgDailyConsumption * daysToCover;
        const suggestion = Math.max(0, needed - currentStock);

        if (suggestion <= 0 && avgDailyConsumption === 0) continue; // No pedir si no se usa y no se necesita

        const supplierName = product.supplier?.name || "Desconocido";

        if (!suggestionsBySupplier.has(product.supplierId)) {
            suggestionsBySupplier.set(product.supplierId, {
                supplierId: product.supplierId,
                supplierName,
                items: []
            });
        }

        suggestionsBySupplier.get(product.supplierId)!.items.push({
            productId: product.id,
            productName: product.name,
            unit: product.unit,
            currentStock,
            avgDailyConsumption,
            daysToCover,
            suggestedQuantity: Math.ceil(suggestion), // Redondear hacia arriba
            unitCost: product.costCents || 0,
            status: suggestion > 0 ? "LOW" : "OK"
        });
    }

    return Array.from(suggestionsBySupplier.values());
}
