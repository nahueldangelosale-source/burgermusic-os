"use server";

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  AUTONOMOUS PROCUREMENT AGENT — Closed-Loop Supply Chain                   ║
 * ║  BurgerMusic OS · Antigravity 2026 · Phase 3 Refactor                     ║
 * ║                                                                            ║
 * ║  REGLA DE HIERRO (CTO-IMMUTABLE):                                          ║
 * ║  Este agente NO puede transaccionar dinero, enviar emails                  ║
 * ║  ni crear POs vinculantes. Solo SUGIERE via agenda_items.                  ║
 * ║  La autoridad financiera es exclusivamente HUMANA.                         ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Correcciones v4.1 (Architectural Drift Resolution):
 *   - Fix TS18046: `poDraft` era `unknown` → tipado explícito via cast seguro
 *   - LEFT JOIN con `supplier_ingredients` + `suppliers` para datos deterministas
 *   - Prompt enriquecido con proveedor real y LPP (Last Purchase Price) real
 *   - temperature: 0.15 (mandato CTO — mínima creatividad, máxima precisión)
 *   - Zod schema aplicado a la respuesta de Gemini
 */

import { z } from "zod";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "@/db";
import {
  inventory_kardex,
  mdm_ingredients,
  suppliers,
  agenda_items,
} from "@/db/schema";
import { supplier_ingredients } from "@/db/schema/supply";
import { eq, and, isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// § CONSTANTES OPERACIONALES
// ─────────────────────────────────────────────────────────────────────────────

const AUTONOMY_THRESHOLD_HOURS = 48;  // Nivel de alarma: <48h de stock
const BURN_LOOKBACK_DAYS = 7;         // Ventana para calcular burn rate
const MAX_AGENDA_ITEMS_PER_RUN = 10;  // Guardrail: limita el spam en agenda

// ─────────────────────────────────────────────────────────────────────────────
// § ZOD SCHEMA — Output esperado de Gemini (temperature 0.15)
//   El schema se pasa como contrato innegociable al modelo.
//   El modelo solo puede producir lo que el schema permite.
// ─────────────────────────────────────────────────────────────────────────────

const PODraftSchema = z.object({
  ingredientName: z
    .string()
    .describe("Nombre canónico del insumo crítico. EXACTAMENTE como se proveyó en el contexto."),
  suggestedQuantityKg: z
    .number()
    .positive()
    .describe("Cantidad sugerida de compra en Kg para cubrir 14 días de operación."),
  estimatedTotalCentsArs: z
    .number()
    .int()
    .describe(
      "Costo total estimado en centavos ARS (integer). Calculado como suggestedQuantityKg × lastPurchasePriceCents del contexto.",
    ),
  supplierName: z
    .string()
    .describe(
      "Nombre EXACTO del proveedor provisto en el contexto. Si no hay proveedor registrado, usar 'Sin proveedor registrado'.",
    ),
  supplierCuit: z
    .string()
    .describe("CUIT del proveedor del contexto, o 'N/A' si no hay proveedor."),
  urgencyRationale: z
    .string()
    .max(120)
    .describe("Justificación de urgencia en máximo 20 palabras. Operativo y concreto."),
});

// Tipo inferido para eliminar TS18046 en el uso de poDraft
type PODraft = z.infer<typeof PODraftSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// § TIPOS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

type IngredientAutonomy = {
  ingredientId: string;
  name: string;
  currentStockKg: number;
  burnRateKgPerDay: number;
  autonomyHours: number;
  isCritical: boolean;
};

type SupplierContext = {
  supplierName: string;
  supplierCuit: string;
  supplierId: string;
  lastPurchasePriceCents: number;
  leadTimeHours: number;
  purchaseUnit: string;
  minOrderQty: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// § MOTOR DE AUTONOMÍA — calculateStockAutonomy()
//   Calcula horas de stock restante por burn rate de los últimos 7 días.
//   Complejidad: O(n) donde n = número de RAW_MATERIAL en MDM.
// ─────────────────────────────────────────────────────────────────────────────

async function calculateStockAutonomy(): Promise<IngredientAutonomy[]> {
  const rawMaterials = await db
    .select({
      id: mdm_ingredients.id,
      name: mdm_ingredients.canonical_name,
    })
    .from(mdm_ingredients)
    .where(eq(mdm_ingredients.ingredientType, "RAW_MATERIAL"));

  if (rawMaterials.length === 0) return [];

  const autonomyReport: IngredientAutonomy[] = [];

  for (const mat of rawMaterials) {
    // Stock actual = SUMA de todos los movimientos del Kardex para este SKU
    // Positivos = entradas (facturas), Negativos = salidas (ventas/merma)
    const [stockResult] = await db
      .select({
        totalQty: sql<number>`COALESCE(SUM(${inventory_kardex.quantity}), 0)`,
      })
      .from(inventory_kardex)
      .where(eq(inventory_kardex.productSku, mat.id));

    const currentStockKg = stockResult?.totalQty ?? 0;

    // Burn Rate = ABS(SUM de movimientos negativos en los últimos N días) / N
    // Los movimientos negativos son salidas por venta o merma.
    const [burnResult] = await db
      .select({
        totalBurned: sql<number>`COALESCE(ABS(SUM(
          CASE WHEN ${inventory_kardex.quantity} < 0
               AND ${inventory_kardex.updatedAt} >= datetime('now', '-${sql.raw(String(BURN_LOOKBACK_DAYS))} days')
          THEN ${inventory_kardex.quantity}
          ELSE 0 END
        )), 0)`,
      })
      .from(inventory_kardex)
      .where(eq(inventory_kardex.productSku, mat.id));

    const totalBurnedKg = burnResult?.totalBurned ?? 0;
    const burnRateKgPerDay = totalBurnedKg / BURN_LOOKBACK_DAYS;

    // Autonomía = Stock actual / Burn Rate diario × 24 horas
    // Si burn rate = 0 → autonomía infinita (sin consumo reciente)
    const autonomyHours =
      burnRateKgPerDay > 0
        ? (currentStockKg / burnRateKgPerDay) * 24
        : Infinity;

    autonomyReport.push({
      ingredientId: mat.id,
      name: mat.name,
      currentStockKg: Math.round(currentStockKg * 100) / 100,
      burnRateKgPerDay: Math.round(burnRateKgPerDay * 100) / 100,
      autonomyHours: Math.round(autonomyHours * 10) / 10,
      isCritical: autonomyHours < AUTONOMY_THRESHOLD_HOURS,
    });
  }

  return autonomyReport;
}

// ─────────────────────────────────────────────────────────────────────────────
// § LEFT JOIN ENGINE — resolveSupplierContext()
//   Para un ingrediente crítico, busca al proveedor preferido via
//   supplier_ingredients JOIN suppliers.
//   Retorna datos deterministas para el prompt de Gemini.
//   Si no hay proveedor registrado, retorna contexto vacío (sin alucinación).
// ─────────────────────────────────────────────────────────────────────────────

async function resolveSupplierContext(
  ingredientId: string,
): Promise<SupplierContext | null> {
  // LEFT JOIN: supplier_ingredients → suppliers
  // Prioridad: proveedor marcado como is_preferred = true
  // Fallback: cualquier proveedor registrado para este insumo
  const [preferred] = await db
    .select({
      supplierName: suppliers.name,
      supplierCuit: suppliers.cuit,
      supplierId: suppliers.id,
      lastPurchasePriceCents: supplier_ingredients.last_purchase_price_cents,
      leadTimeHours: supplier_ingredients.lead_time_hours,
      purchaseUnit: supplier_ingredients.purchase_unit,
      minOrderQty: supplier_ingredients.min_order_qty,
      isPreferred: supplier_ingredients.is_preferred,
    })
    .from(supplier_ingredients)
    .leftJoin(suppliers, eq(supplier_ingredients.supplier_id, suppliers.id))
    .where(
      and(
        eq(supplier_ingredients.ingredient_id, ingredientId),
        eq(supplier_ingredients.is_preferred, true),
        isNull(suppliers.deletedAt),
      ),
    )
    .limit(1);

  if (preferred?.supplierName) {
    return {
      supplierName: preferred.supplierName,
      supplierCuit: preferred.supplierCuit ?? "N/A",
      supplierId: preferred.supplierId ?? "",
      lastPurchasePriceCents: preferred.lastPurchasePriceCents ?? 0,
      leadTimeHours: preferred.leadTimeHours ?? 24,
      purchaseUnit: preferred.purchaseUnit ?? "KG",
      minOrderQty: preferred.minOrderQty ?? 1,
    };
  }

  // Fallback: cualquier proveedor activo para este insumo (sin filtro preferred)
  const [fallback] = await db
    .select({
      supplierName: suppliers.name,
      supplierCuit: suppliers.cuit,
      supplierId: suppliers.id,
      lastPurchasePriceCents: supplier_ingredients.last_purchase_price_cents,
      leadTimeHours: supplier_ingredients.lead_time_hours,
      purchaseUnit: supplier_ingredients.purchase_unit,
      minOrderQty: supplier_ingredients.min_order_qty,
    })
    .from(supplier_ingredients)
    .leftJoin(suppliers, eq(supplier_ingredients.supplier_id, suppliers.id))
    .where(
      and(
        eq(supplier_ingredients.ingredient_id, ingredientId),
        isNull(suppliers.deletedAt),
      ),
    )
    .limit(1);

  if (fallback?.supplierName) {
    return {
      supplierName: fallback.supplierName,
      supplierCuit: fallback.supplierCuit ?? "N/A",
      supplierId: fallback.supplierId ?? "",
      lastPurchasePriceCents: fallback.lastPurchasePriceCents ?? 0,
      leadTimeHours: fallback.leadTimeHours ?? 24,
      purchaseUnit: fallback.purchaseUnit ?? "KG",
      minOrderQty: fallback.minOrderQty ?? 1,
    };
  }

  return null; // Sin proveedor registrado — el agente lo indica explícitamente
}

// ─────────────────────────────────────────────────────────────────────────────
// § FORMATEADOR DE MONEDA (ARS cents → string legible)
// ─────────────────────────────────────────────────────────────────────────────

function formatARS(cents: number): string {
  const ars = cents / 100;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(ars);
}

// ─────────────────────────────────────────────────────────────────────────────
// § SERVER ACTION PÚBLICO — evaluateStockAutonomy()
// ─────────────────────────────────────────────────────────────────────────────

export async function evaluateStockAutonomy() {
  try {
    // PASO 1: Calcular autonomía de todos los RAW_MATERIAL
    const report = await calculateStockAutonomy();
    const criticalItems = report.filter((r) => r.isCritical);

    if (criticalItems.length === 0) {
      return {
        success: true,
        message:
          "✅ [ZERO-ENTROPY] Todos los insumos RAW_MATERIAL tienen >48h de autonomía.",
        report,
        actionsGenerated: 0,
      };
    }

    let actionsGenerated = 0;

    // Guardrail: limita el número de agenda items por ejecución
    const itemsToProcess = criticalItems.slice(0, MAX_AGENDA_ITEMS_PER_RUN);

    for (const item of itemsToProcess) {
      try {
        // PASO 2: LEFT JOIN → proveedor preferido + LPP determinista
        const supplierCtx = await resolveSupplierContext(item.ingredientId);

        // Cálculo determinista de la compra sugerida (14 días de cobertura)
        const suggestedQtyKg = Math.ceil(item.burnRateKgPerDay * 14);
        const estimatedTotalCents = supplierCtx
          ? suggestedQtyKg * supplierCtx.lastPurchasePriceCents
          : 0;

        // PASO 3: Prompt enriquecido con datos reales (sin alucinación de precios)
        const supplierBlock = supplierCtx
          ? `
- Proveedor preferido: "${supplierCtx.supplierName}" (CUIT: ${supplierCtx.supplierCuit})
- Último precio de compra: ${formatARS(supplierCtx.lastPurchasePriceCents)} por ${supplierCtx.purchaseUnit}
- Lead time: ${supplierCtx.leadTimeHours}h
- MOQ: ${supplierCtx.minOrderQty} ${supplierCtx.purchaseUnit}
- Costo estimado total: ${formatARS(estimatedTotalCents)} (${suggestedQtyKg} ${supplierCtx.purchaseUnit} × ${formatARS(supplierCtx.lastPurchasePriceCents)})`
          : `
- SIN PROVEEDOR REGISTRADO para este insumo en el MDM.
- No estimes un precio de mercado. Usa estimatedTotalCentsArs = 0.
- supplierName = "Sin proveedor registrado", supplierCuit = "N/A"`;

        // PASO 4: generateObject → Gemini 2.5 Flash (temperature 0.15)
        //   Fix TS18046: cast explícito al tipo inferido del schema Zod.
        //   `generateObject` devuelve Promise<{ object: SCHEMA_TYPE }> pero
        //   TypeScript no siempre resuelve el genérico cuando hay Zod v4.
        const generationResult = await generateObject({
          model: google("gemini-2.5-flash"),
          schema: PODraftSchema,
          temperature: 0.15, // Mandato CTO: mínima creatividad
          prompt: `
Eres el Agente de Compras de BurgerMusic OS. Tu única tarea es completar el JSON
del schema según los datos EXACTOS provistos. NO inventes precios ni proveedores.

DATOS REALES DEL SISTEMA (usa estos valores textualmente):
- Insumo: "${item.name}" (tipo: RAW_MATERIAL)
- Stock actual: ${item.currentStockKg} Kg
- Burn rate: ${item.burnRateKgPerDay} Kg/día
- Autonomía restante: ${item.autonomyHours} horas ⚠️ CRÍTICO (<48h)
- Compra sugerida para 14 días: ${suggestedQtyKg} Kg
${supplierBlock}

INSTRUCCIONES ESTRICTAS:
1. ingredientName = "${item.name}" (exacto, sin modificar)
2. suggestedQuantityKg = ${suggestedQtyKg} (ya calculado, no cambies)
3. estimatedTotalCentsArs = ${estimatedTotalCents} (ya calculado, no cambies)
4. Completa urgencyRationale en máximo 20 palabras.
5. Si no hay proveedor, usa los valores indicados arriba para supplierName y supplierCuit.
`,
        });

        // Cast type-safe: el schema Zod garantiza la forma del objeto
        const poDraft = generationResult.object as PODraft;

        // PASO 5: Inyectar en Agenda Táctica del C-Level
        const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];

        await db.insert(agenda_items).values({
          id: randomUUID(),
          title: [
            `🔴 PO Urgente: ${poDraft.ingredientName}`,
            `— ${poDraft.suggestedQuantityKg} Kg`,
            `@ ${poDraft.supplierName}`,
            poDraft.estimatedTotalCentsArs > 0
              ? `(${formatARS(poDraft.estimatedTotalCentsArs)})`
              : "(precio sin cotizar)",
            `· ${poDraft.urgencyRationale}`,
          ].join(" "),
          type: "TASK",
          dueDate,
          isCompleted: false,
        });

        actionsGenerated++;
      } catch (aiErr: unknown) {
        // AI failure es no-fatal: inyectamos tarea simplificada sin AI
        const errMsg = aiErr instanceof Error ? aiErr.message : "AI Error";
        console.warn(
          `[PROCUREMENT_AGENT] AI fallback para "${item.name}":`,
          errMsg,
        );

        // Fallback determinista — sin Gemini, con datos propios del sistema
        const suggestedKg = Math.ceil(item.burnRateKgPerDay * 14);
        const supplierFallback = await resolveSupplierContext(
          item.ingredientId,
        ).catch(() => null);

        const fallbackTitle = supplierFallback
          ? `🔴 ALERTA Stock: ${item.name} — ${item.currentStockKg}Kg (${item.autonomyHours}h). Comprar ${suggestedKg}Kg a ${supplierFallback.supplierName} (${formatARS(supplierFallback.lastPurchasePriceCents)}/Kg)`
          : `🔴 ALERTA Stock: ${item.name} — ${item.currentStockKg}Kg (${item.autonomyHours}h). Comprar ${suggestedKg}Kg. Sin proveedor MDM registrado.`;

        await db.insert(agenda_items).values({
          id: randomUUID(),
          title: fallbackTitle,
          type: "TASK",
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          isCompleted: false,
        });

        actionsGenerated++;
      }
    }

    revalidatePath("/dashboard/command-center");
    revalidatePath("/dashboard/supply");

    return {
      success: true,
      message: `⚡ Agente de Compras: ${actionsGenerated} PO(s) inyectadas en la Agenda Táctica del C-Level.`,
      report,
      actionsGenerated,
      criticalCount: criticalItems.length,
    };
  } catch (error: unknown) {
    const msg =
      error instanceof Error
        ? error.message
        : "Fallo en el Agente de Compras (Fail-Closed).";
    console.error("[PROCUREMENT_AGENT_FATAL]", msg);
    return { success: false, error: msg };
  }
}
