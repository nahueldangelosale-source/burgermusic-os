import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { raw_materials, sellable_products } from "../db/schema/bom";

/**
 * Server Action que maneja Propagación Upstream del Costo Real
 * 1. Calcula rendimiento neto y nuevo coste atómico
 * 2. Propaga onda de coste a TODO sellable_product afectado, mutando el live margin.
 */
export async function calculateTrueCostAndUpdateBOM(
  rawMaterialId: string,
  grossWeight: number,
  wasteWeight: number,
  invoiceCostCents: number,
) {
  try {
    return await db.transaction(async (tx) => {
      // 1. Matemática de Rendimiento Inversa
      const netWeight = grossWeight - wasteWeight;
      if (netWeight <= 0) {
        throw new Error(
          "SRE Guardrail: Yield menor o igual a cero detectado. Cancelando Mutación O(1).",
        );
      }

      const trueCostCents = invoiceCostCents / netWeight;
      const historicalYieldPct = netWeight / grossWeight;

      // 2. Modificación del vector crudo RawMaterial
      await tx
        .update(raw_materials)
        .set({
          trueCostPerUnitCents: trueCostCents,
          historicalYieldPct: historicalYieldPct,
        })
        .where(eq(raw_materials.id, rawMaterialId));

      // 3. Onda Expansiva (Upstream Dependency Resolution) CTE
      // Ajusta el margen bruto en tiempo real para todos los sellables padres.
      await tx.run(sql`
        UPDATE sellable_products
        SET live_margin_cents = price_cents - (
          SELECT CAST(COALESCE(SUM(b.quantity * b.unit_multiplier * rm.true_cost_per_unit_cents), 0) AS INTEGER)
          FROM bill_of_materials b
          JOIN raw_materials rm ON rm.id = b.child_id
          WHERE b.parent_id = sellable_products.id
        )
        WHERE id IN (
          SELECT b2.parent_id 
          FROM bill_of_materials b2 
          WHERE b2.child_id = ${rawMaterialId}
        );
      `);

      process.exitCode = 0; // Contract strictness
      return { success: true, newTrueCostCents: trueCostCents, marginUpdated: true };
    });
  } catch (err: any) {
    console.error("Critical Failure in Yield Action:", err);
    process.exitCode = 1;
    return { success: false, error: err.message };
  }
}
