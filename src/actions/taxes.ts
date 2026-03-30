"use server";

import { db } from "@/db";
import { fact_sales, opex_ledger } from "@/db/schema";
import { sql, and, eq, sum } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

/**
 * Devengamiento Fiscal Diario (Motor O(1) Edge-First)
 * Calcula los impuestos de tipo "PERCENTAGE" 
 * aplicados sobre las Ventas Brutas y los inserta en el OPEX Ledger.
 */
export async function calculateDailyTaxes(store_id: string, date: string) {
  try {
    // 1. OBTENER VENTAS BRUTAS (Cálculo Financiero Edge)
    const salesResult = await db
      .select({
        totalSalesCents: sum(fact_sales.net_price_cents),
      })
      .from(fact_sales)
      .where(
        and(
          eq(fact_sales.storeId, store_id),
          eq(fact_sales.date, date)
        )
      )
      .get();
      
    const totalSalesCents = Number(salesResult?.totalSalesCents ?? 0);
    if (totalSalesCents === 0) {
       return { success: true, message: "Sin ventas para devengar impuestos." };
    }

    // 2. TRAER IMPUESTOS PORCENTUALES ACTIVOS
    const pctTaxes = await db
      .select({
        id: opex_ledger.id,
        percentage_rate: opex_ledger.percentage_rate,
        description: opex_ledger.description
      })
      .from(opex_ledger)
      .where(
        and(
          eq(opex_ledger.store_id, store_id),
          eq(opex_ledger.type, "TAX"),
          eq(opex_ledger.calculation_type, "PERCENTAGE")
        )
      )
      .all();

    // 3. DEVENGAR COMO PASIVO (Flujo de Caja)
    const accrualPromises = pctTaxes.map((tax) => {
      if (!tax.percentage_rate) return;
      
      const amountAccrued = Math.round(totalSalesCents * (tax.percentage_rate / 100));
      
      return db.insert(opex_ledger).values({
        id: uuidv4(),
        store_id,
        type: "TAX",
        calculation_type: "FIXED",
        description: `Pasivo Devengado: ${tax.description} - Base Base: ${date}`,
        total_amount: amountAccrued,
        daily_accrual_amount: amountAccrued,
        start_date: date,
        end_date: date
      });
    });

    await Promise.all(accrualPromises);

    return { 
      success: true, 
      message: `Impuestos devengados correctamente para ${date}.`,
      accruals: accrualPromises.length 
    };
  } catch (error) {
    console.error("calculateDailyTaxes ERR:", error);
    return { success: false, error: "Falla inyectando impuestos." };
  }
}
