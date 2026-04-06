"use server";

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║    MULTIPLICADOR SEMÁNTICO BOM — BurgerMusic OS v4.1                       ║
 * ║    Scalar Recipe Cloner | Zero-Trust | Fail-Closed | Type-Safe             ║
 * ║    Regla de Multiplicación Diferenciada por Categoría de Ingrediente        ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Arquitectura:
 *   1. Zod Shield → valida variantType y baseMenuItemId
 *   2. Lee receta base desde bom_recipes (ingredientes canónicos MDM)
 *   3. Aplica escalar diferenciado:
 *      - Carnes (INTERMEDIATE) + Queso cheddar → ×2 o ×3
 *      - Pan (Buns) + Packaging → SIEMPRE ×1 (innegociable)
 *      - Resto (salsas, vegetales) → escalar completo
 *   4. Crea nuevo product en MDM con sufijo variante
 *   5. Inserta bom_recipes de la variante clonada
 *   6. revalidatePath() para hidratación de UI
 */

import { db } from "@/db";
import {
  products,
  bom_recipes,
  mdm_ingredients,
  ai_audit_logs,
} from "@/db/schema";
import { requireManagerSession } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// § CONSTANTES DE NEGOCIO — Inmutables por mandato del CTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Multiplicadores por tipo de variante.
 * DOBLE → ×2, TRIPLE → ×3
 */
const VARIANT_SCALAR: Record<VariantType, number> = {
  DOUBLE: 2,
  TRIPLE: 3,
} as const;

/**
 * SKU patterns que identifican Pan/Buns — SIEMPRE multiplicador ×1.
 * Se evalúa contra canonical_name en lowercase.
 * Regla: si el nombre contiene alguna de estas strings → NO se escala.
 */
const BUN_KEYWORDS = ["pan", "bun", "brioche", "tostado", "pan artesanal"] as const;

/**
 * SKU patterns que identifican Packaging — SIEMPRE multiplicador ×1.
 */
const PACKAGING_KEYWORDS = [
  "packaging",
  "caja",
  "bolsa",
  "servilleta",
  "cubierto",
  "vaso",
  "container",
  "wrap",
  "film",
] as const;

/**
 * Tipos de ingrediente que se escalan (carnes intermedias y materias primas).
 * Los PURCHASED_READY no-cárnicos sin keyword de pan/packaging también escalan.
 */
const SCALABLE_INGREDIENT_TYPES: ReadonlySet<string> = new Set([
  "INTERMEDIATE",   // Medallones, hamburguesas procesadas
  "RAW_MATERIAL",   // Carne molida cruda
]);

// ─────────────────────────────────────────────────────────────────────────────
// § ZOD SHIELD
// ─────────────────────────────────────────────────────────────────────────────

const VARIANT_TYPES = ["DOUBLE", "TRIPLE"] as const;
type VariantType = (typeof VARIANT_TYPES)[number];

const GenerateVariantSchema = z.object({
  baseMenuItemId: z
    .string()
    .min(1, "baseMenuItemId es requerido"),
  variantType: z.enum([...VARIANT_TYPES] as [VariantType, ...VariantType[]], {
    message: "variantType debe ser 'DOUBLE' o 'TRIPLE'",
  }),
  /**
   * Nombre personalizado de la variante.
   * Si no se provee, se genera automáticamente: "{base} DOBLE" / "{base} TRIPLE"
   */
  variantName: z.string().optional(),
});

type GenerateVariantPayload = z.infer<typeof GenerateVariantSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// § TIPOS DE RESPUESTA
// ─────────────────────────────────────────────────────────────────────────────

export type VariantRecipeResult =
  | {
      success: true;
      variantProductId: string;
      variantProductName: string;
      variantType: VariantType;
      scalar: number;
      ingredientsCloned: number;
      ingredientsSingleMult: number; // Buns + Packaging mantenidos en ×1
    }
  | {
      success: false;
      error: string;
      code:
        | "UNAUTHORIZED"
        | "ZOD_SHIELD_REJECTION"
        | "BASE_PRODUCT_NOT_FOUND"
        | "BASE_RECIPE_EMPTY"
        | "CLONING_FAILURE";
    };

// ─────────────────────────────────────────────────────────────────────────────
// § HELPERS SEMÁNTICOS — Clasificadores de Ingredientes
// ─────────────────────────────────────────────────────────────────────────────

function isBunIngredient(canonicalName: string): boolean {
  const lower = canonicalName.toLowerCase();
  return BUN_KEYWORDS.some((kw) => lower.includes(kw));
}

function isPackagingIngredient(canonicalName: string, category: string | null): boolean {
  const lower = canonicalName.toLowerCase();
  const categoryLower = (category ?? "").toLowerCase();
  return (
    PACKAGING_KEYWORDS.some((kw) => lower.includes(kw)) ||
    categoryLower === "packaging"
  );
}

/**
 * Determina si un ingrediente debe escalarse con el multiplicador de variante.
 *
 * Reglas de negocio (mandato CTO — innegociable):
 *   - ingredientType === 'INTERMEDIATE' | 'RAW_MATERIAL' → SIEMPRE escala
 *   - Nombre contiene "pan", "bun", "brioche" → NUNCA escala (×1)
 *   - Categoría "PACKAGING" o nombre contiene keyword packaging → NUNCA escala (×1)
 *   - PURCHASED_READY sin keywords de pan/packaging → escala (salsas, quesos no-cheddar)
 *   - Cheddar especificamente → se escala (por semántica de "hamburguesa premium")
 *
 * Retorna el multiplicador efectivo (1 o variantScalar).
 */
function resolveMultiplier(
  ingredientType: string,
  canonicalName: string,
  category: string | null,
  variantScalar: number,
): number {
  // Pan → SIEMPRE ×1 (innegociable)
  if (isBunIngredient(canonicalName)) return 1;

  // Packaging → SIEMPRE ×1 (innegociable)
  if (isPackagingIngredient(canonicalName, category)) return 1;

  // Carnes e Intermedios → escalar completo
  if (SCALABLE_INGREDIENT_TYPES.has(ingredientType)) return variantScalar;

  // Resto (PURCHASED_READY: queso cheddar, salsas, vegetales) → escalar completo
  // El cheddar es parte de la identidad de la hamburguesa y se multiplica.
  return variantScalar;
}

// ─────────────────────────────────────────────────────────────────────────────
// § SERVER ACTION PRINCIPAL — generateVariantRecipe()
// ─────────────────────────────────────────────────────────────────────────────

export async function generateVariantRecipe(
  baseMenuItemId: string,
  variantType: VariantType,
  variantName?: string,
): Promise<VariantRecipeResult> {
  // ── GATE 1: Zero-Trust Session ─────────────────────────────────────────────
  let session: { userId: string; storeId: string; userName: string };
  try {
    session = await requireManagerSession();
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "UNAUTHORIZED_ACCESS",
      code: "UNAUTHORIZED",
    };
  }
  const { storeId, userId, userName } = session;

  // ── GATE 2: Zod Shield ─────────────────────────────────────────────────────
  const payload: GenerateVariantPayload = { baseMenuItemId, variantType, variantName };
  const parseResult = GenerateVariantSchema.safeParse(payload);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues
      .map((e) => `[${e.path.join(".")}]: ${e.message}`)
      .join(" | ");
    return {
      success: false,
      error: `Zod Shield Rejection: ${errorMsg}`,
      code: "ZOD_SHIELD_REJECTION",
    };
  }
  const validated = parseResult.data;
  const scalar = VARIANT_SCALAR[validated.variantType];
  const variantSuffix = validated.variantType === "DOUBLE" ? "DOBLE" : "TRIPLE";

  try {
    let variantProductId: string;
    let variantProductName: string;
    let ingredientsCloned = 0;
    let ingredientsSingleMult = 0;

    await db.transaction(async (tx) => {
      // ──────────────────────────────────────────────────────────────────────
      // PASO 1: Leer el Producto Base (Menu Item)
      //   Fail-Closed: si no existe, revertir y retornar error semántico.
      // ──────────────────────────────────────────────────────────────────────
      const [baseProduct] = await tx
        .select({
          id: products.id,
          name: products.name,
          sku: products.sku,
          category: products.category,
          base_price_cents: products.base_price_cents,
          costCents: products.costCents,
          sellingPrice: products.sellingPrice,
          targetMargin: products.targetMargin,
          supplierId: products.supplierId,
          item_type: products.item_type,
          unit: products.unit,
        })
        .from(products)
        .where(
          and(
            eq(products.id, validated.baseMenuItemId),
            isNull(products.deletedAt),
          ),
        );

      if (!baseProduct) {
        throw new Error(
          `BASE_PRODUCT_NOT_FOUND: El producto base '${validated.baseMenuItemId}' no existe o fue eliminado (soft-delete).`,
        );
      }

      // ──────────────────────────────────────────────────────────────────────
      // PASO 2: Leer Receta Base desde bom_recipes (con JOIN a mdm_ingredients)
      //   Se obtiene canonical_name e ingredientType para la clasificación.
      // ──────────────────────────────────────────────────────────────────────
      const baseRecipeRows = await tx
        .select({
          bomId: bom_recipes.id,
          ingredient_id: bom_recipes.ingredient_id,
          theoretical_qty: bom_recipes.theoretical_qty,
          canonical_name: mdm_ingredients.canonical_name,
          ingredientType: mdm_ingredients.ingredientType,
          product_sku: bom_recipes.product_sku,
        })
        .from(bom_recipes)
        .innerJoin(
          mdm_ingredients,
          eq(bom_recipes.ingredient_id, mdm_ingredients.id),
        )
        .where(eq(bom_recipes.product_sku, validated.baseMenuItemId));

      if (baseRecipeRows.length === 0) {
        throw new Error(
          `BASE_RECIPE_EMPTY: El producto base '${validated.baseMenuItemId}' (${baseProduct.name}) no tiene receta BOM registrada. No se puede clonar.`,
        );
      }

      // ──────────────────────────────────────────────────────────────────────
      // PASO 3: Crear el nuevo Producto Variante en MDM
      //   - Nuevo ID autogenerado
      //   - Nombre: "{BaseName} {DOBLE|TRIPLE}" o variantName si se proveyó
      //   - Precio base estimado: precio × scalar (estimación inicial, revisable)
      // ──────────────────────────────────────────────────────────────────────
      variantProductId = `PROD-${randomUUID()}`;
      variantProductName =
        validated.variantName ??
        `${baseProduct.name} ${variantSuffix}`;

      // Precio variante: estimación proporcional al escalar.
      // El margen se mantiene igual al del producto base (revisable por C-Level).
      const estimatedVariantPriceCents = Math.round(
        (baseProduct.sellingPrice ?? 0) * scalar,
      );
      const estimatedVariantCostCents = Math.round(
        (baseProduct.costCents ?? 0) * scalar,
      );

      await tx.insert(products).values({
        id: variantProductId,
        name: variantProductName,
        sku: baseProduct.sku ? `${baseProduct.sku}-${variantSuffix}` : null,
        unit: baseProduct.unit,
        item_type: baseProduct.item_type,
        category: baseProduct.category,
        base_price_cents: estimatedVariantPriceCents,
        costCents: estimatedVariantCostCents,
        sellingPrice: estimatedVariantPriceCents,
        targetMargin: baseProduct.targetMargin,
        supplierId: baseProduct.supplierId ?? null,
        isSaleable: true,
        synonyms: [],
      });

      // ──────────────────────────────────────────────────────────────────────
      // PASO 4: Clonar Receta con Escalar Semántico Diferenciado
      //
      //   Para cada línea BOM del producto base:
      //   - Si es Pan o Packaging → mantener quantity original (×1)
      //   - Si es Carne (INTERMEDIATE/RAW_MATERIAL) o Cheddar → ×scalar
      //   - Resto de ingredientes → ×scalar
      //
      //   quantity SIEMPRE en la misma unidad que la receta base.
      //   No hay conversión de UoM en este motor.
      // ──────────────────────────────────────────────────────────────────────
      const newBomRows: Array<typeof bom_recipes.$inferInsert> = [];

      for (const row of baseRecipeRows) {
        const effectiveMultiplier = resolveMultiplier(
          row.ingredientType,
          row.canonical_name,
          null, // category no disponible en mdm_ingredients directamente
          scalar,
        );

        const scaledQty = row.theoretical_qty * effectiveMultiplier;

        // Contadores para el reporte al cliente
        if (effectiveMultiplier === 1) {
          ingredientsSingleMult++;
        } else {
          ingredientsCloned++;
        }

        newBomRows.push({
          id: `BOM-${randomUUID()}`,
          product_sku: variantProductId,
          ingredient_id: row.ingredient_id,
          theoretical_qty: scaledQty,
        });
      }

      // Inserción bulk de todas las líneas BOM de la variante
      await tx.insert(bom_recipes).values(newBomRows);

      // ──────────────────────────────────────────────────────────────────────
      // PASO 5: AI Audit Log — Fricción Positiva
      // ──────────────────────────────────────────────────────────────────────
      await tx.insert(ai_audit_logs).values({
        id: `AUDT-${randomUUID()}`,
        agentName: "BOM_SCALAR_MULTIPLIER_v4",
        action: "GENERATE_VARIANT_RECIPE",
        zodSchemaUsed: "GenerateVariantSchema",
        status: "APPROVED",
        storeId,
        userId,
        payloadRef: JSON.stringify({
          baseMenuItemId: validated.baseMenuItemId,
          baseName: baseProduct.name,
          variantType: validated.variantType,
          scalar,
          variantProductId,
          variantProductName,
          ingredientsCloned,
          ingredientsSingleMult,
          operatedBy: userName,
        }),
      });
    });

    // ── REVALIDACIÓN DE PATHS ──────────────────────────────────────────────
    revalidatePath("/dashboard/supply");
    revalidatePath("/dashboard/menu");
    revalidatePath("/dashboard/recipes");

    return {
      success: true,
      variantProductId: variantProductId!,
      variantProductName: variantProductName!,
      variantType: validated.variantType,
      scalar,
      ingredientsCloned,
      ingredientsSingleMult,
    };
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Unknown BOM Cloning Error";

    console.error("[BOM_SCALAR_FATAL]:", {
      error: msg,
      baseMenuItemId,
      variantType,
      storeId,
      timestamp: new Date().toISOString(),
    });

    const code = msg.includes("BASE_PRODUCT_NOT_FOUND")
      ? "BASE_PRODUCT_NOT_FOUND"
      : msg.includes("BASE_RECIPE_EMPTY")
        ? "BASE_RECIPE_EMPTY"
        : "CLONING_FAILURE";

    return { success: false, error: msg, code };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § ACCIÓN AUXILIAR — updateRecipeBOM() (existente, preservada)
// Re-exported para backward compatibility con bom-mutations.ts y UI existente.
// ─────────────────────────────────────────────────────────────────────────────

export async function updateRecipeBOM(
  recipeId: string,
  ingredientId: string,
  newTheoreticalQty: number,
): Promise<{ success: boolean; error?: string }> {
  let session: { userId: string; storeId: string };
  try {
    session = await requireManagerSession();
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "UNAUTHORIZED_ACCESS",
    };
  }
  const { storeId, userId } = session;

  // Zod Shield inline para la mutación individual
  const schema = z.object({
    recipeId: z.string().min(1),
    ingredientId: z.string().min(1),
    newTheoreticalQty: z.number().positive("quantity debe ser > 0"),
  });
  const result = schema.safeParse({ recipeId, ingredientId, newTheoreticalQty });
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((e) => e.message).join(" | "),
    };
  }

  try {
    await db.transaction(async (tx) => {
      const [currentRecipe] = await tx
        .select()
        .from(bom_recipes)
        .where(eq(bom_recipes.id, recipeId));

      if (!currentRecipe) {
        throw new Error(
          `Recipe Hash '${recipeId}' no detectada en la Matrix BOM.`,
        );
      }

      const oldQty = currentRecipe.theoretical_qty;

      await tx
        .update(bom_recipes)
        .set({ theoretical_qty: newTheoreticalQty })
        .where(eq(bom_recipes.id, recipeId));

      await tx.insert(ai_audit_logs).values({
        id: `AUDT-${randomUUID()}`,
        agentName: "BOM_MUTATION_CLIENT_v4",
        action: "UPDATE_RECIPE_BOM",
        zodSchemaUsed: "InlineBOMUpdateSchema",
        status: "APPROVED",
        storeId,
        userId,
        payloadRef: JSON.stringify({
          recipeId,
          ingredientId,
          oldQty,
          newQty: newTheoreticalQty,
          delta: newTheoreticalQty - oldQty,
        }),
      });
    });

    revalidatePath("/dashboard/supply");
    revalidatePath("/dashboard/recipes");

    return { success: true };
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Unknown BOM Update Error";
    console.error("[BOM_UPDATE_FATAL]:", msg);
    return { success: false, error: msg };
  }
}
