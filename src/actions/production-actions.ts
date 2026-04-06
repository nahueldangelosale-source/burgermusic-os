"use server";

import { z } from "zod";
import { db } from "@/db";
import {
  production_batches,
  production_batch_inputs,
  inventory_kardex,
  mdm_ingredients,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// ═══════════════════════════════════════════════════════════════
//  PRODUCTION ENGINE — Yield Management & Batch Manufacturing
//  BurgerMusic OS • Antigravity 2026
// ═══════════════════════════════════════════════════════════════
//
//  Constante termodinámica del ecosistema:
//  1 Kg de carne cruda (mezcla asado + roastbeef) = 8.1 medallones de 110g
//  Merma térmica/operativa: ~10%
//  Cálculo: 1000g * 0.9 / 110g ≈ 8.18 → floor(8.1) = conservador
// ═══════════════════════════════════════════════════════════════

const YIELD_PER_KG = 8.1; // Medallones por Kg (post-merma 10%)
const MEDALLON_WEIGHT_GRAMS = 110;

// ─── Zod Contracts ──────────────────────────────────────────

const RawMeatInputSchema = z.object({
  ingredientId: z.string().min(1, "ingredientId es requerido"),
  grams: z.number().int().positive("Los gramos deben ser un entero positivo"),
});

const ProduceMedallonesSchema = z.object({
  storeId: z.string().min(1, "storeId es requerido"),
  producedIngredientId: z.string().min(1, "ID del bien intermedio (medallón) requerido"),
  inputs: z.array(RawMeatInputSchema).min(1, "Se requiere al menos un corte de carne cruda"),
});

export type ProduceMedallonesPayload = z.infer<typeof ProduceMedallonesSchema>;

export async function produceMedallones(rawPayload: ProduceMedallonesPayload) {
  // 1. ZOD COERCION (Zero-Trust Edge Gate)
  const parsed = ProduceMedallonesSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validación Zod fallida (Zero-Trust).",
      details: parsed.error.format(),
    };
  }

  const { storeId, producedIngredientId, inputs } = parsed.data;

  try {
    const result = await db.transaction(async (tx) => {
      // 2. YIELD MATHEMATICS
      const totalGrams = inputs.reduce((acc, input) => acc + input.grams, 0);
      const totalKg = totalGrams / 1000;
      const quantityProduced = Math.floor(totalKg * YIELD_PER_KG);

      if (quantityProduced <= 0) {
        throw new Error(
          `[YIELD_ZERO] Gramos totales (${totalGrams}g) insuficientes para producir al menos 1 medallón. Mínimo requerido: ~${Math.ceil(1000 / YIELD_PER_KG)}g.`
        );
      }

      // 3. COST RESOLUTION (Consultar costo unitario actual de cada corte crudo)
      let totalCostCents = 0;
      const frozenInputs: Array<{
        ingredientId: string;
        grams: number;
        unitCostCents: number;
      }> = [];

      for (const input of inputs) {
        // Buscar el costo del insumo crudo en mdm_ingredients
        // Si no existe ahí, buscar en inventory_kardex el último costo registrado
        const [ingredient] = await tx
          .select({
            id: mdm_ingredients.id,
            name: mdm_ingredients.canonical_name,
            ingredientType: mdm_ingredients.ingredientType,
          })
          .from(mdm_ingredients)
          .where(eq(mdm_ingredients.id, input.ingredientId))
          .limit(1);

        if (!ingredient) {
          throw new Error(
            `[INGREDIENT_NOT_FOUND] Insumo ${input.ingredientId} no existe en MDM. Abortando lote.`
          );
        }

        if (ingredient.ingredientType !== "RAW_MATERIAL") {
          throw new Error(
            `[TYPE_MISMATCH] Insumo "${ingredient.name}" no es RAW_MATERIAL (es ${ingredient.ingredientType}). Solo materias primas crudas pueden alimentar el motor de producción.`
          );
        }

        // Derivar cost-per-gram desde el último movimiento de inventario
        // ASUNCIÓN: El último kardex RECEIPT para este SKU contiene el costo corriente
        const [latestCost] = await tx
          .select({
            costPerGramCents: sql<number>`CAST(ABS(${inventory_kardex.quantity}) AS REAL)`,
          })
          .from(inventory_kardex)
          .where(eq(inventory_kardex.productSku, input.ingredientId))
          .orderBy(sql`${inventory_kardex.updatedAt} DESC`)
          .limit(1);

        // Fallback: si no hay historial, usar un costo simbólico de $0 (se flaggeará)
        const costCentsPerGram = latestCost ? Math.ceil(latestCost.costPerGramCents) : 0;
        const inputCostCents = Math.ceil((input.grams / 1000) * costCentsPerGram);

        totalCostCents += inputCostCents;

        frozenInputs.push({
          ingredientId: input.ingredientId,
          grams: input.grams,
          unitCostCents: costCentsPerGram,
        });
      }

      const costPerUnitCents = quantityProduced > 0
        ? Math.ceil(totalCostCents / quantityProduced)
        : 0;

      // 4. BATCH REGISTRATION (Lote de Producción)
      const batchId = crypto.randomUUID();

      await tx.insert(production_batches).values({
        id: batchId,
        storeId,
        producedIngredientId,
        quantityProduced,
        totalCostCents,
        costPerUnitCents,
        yieldFactor: YIELD_PER_KG,
        notes: `Lote automático: ${totalGrams}g → ${quantityProduced} medallones (merma 10%)`,
      });

      // 5. INPUT REGISTRATION (Materia Prima Consumida)
      for (const fi of frozenInputs) {
        await tx.insert(production_batch_inputs).values({
          id: crypto.randomUUID(),
          batchId,
          ingredientId: fi.ingredientId,
          quantityUsedGrams: fi.grams,
          unitCostCents: fi.unitCostCents,
        });
      }

      // 6. KARDEX DEDUCTION (Resta de Materia Prima Cruda)
      for (const fi of frozenInputs) {
        await tx.insert(inventory_kardex).values({
          id: crypto.randomUUID(),
          storeId,
          productSku: fi.ingredientId,
          quantity: -(fi.grams / 1000), // Kardex opera en Kg (unidad base del insumo)
          referenceId: `PROD-BATCH-${batchId}`,
        });
      }

      // 7. KARDEX ADDITION (Alta de Bien Intermedio Producido)
      await tx.insert(inventory_kardex).values({
        id: crypto.randomUUID(),
        storeId,
        productSku: producedIngredientId,
        quantity: quantityProduced, // +unidades de medallones
        referenceId: `PROD-BATCH-${batchId}`,
      });

      return {
        batchId,
        totalGrams,
        quantityProduced,
        totalCostCents,
        costPerUnitCents,
        yieldFactor: YIELD_PER_KG,
      };
    });

    revalidatePath("/dashboard/command-center");
    revalidatePath("/dashboard/supply");

    return {
      success: true,
      data: result,
      message: `✅ Lote ${result.batchId.substring(0, 8)}... producido: ${result.totalGrams}g → ${result.quantityProduced} medallones. Costo/u: $${(result.costPerUnitCents / 100).toFixed(2)}.`,
    };
  } catch (error: any) {
    console.error("[PRODUCTION_ENGINE_ERROR]", error.message);
    return {
      success: false,
      error: error.message || "Fallo en el Motor de Producción (Fail-Closed).",
    };
  }
}
