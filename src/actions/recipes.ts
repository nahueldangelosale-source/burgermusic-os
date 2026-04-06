"use server";

import { db } from "@/db";
import { bill_of_materials } from "@/db/schema/bom";
import { eq, and, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { requireManagerSession } from "@/lib/auth-action";
import { RecipeIngredientSchema } from "@/schemas/recipes";
import { withTenant } from "@/lib/tenant-db";

/**
 * getRecipeForProduct
 * ─────────────────────────────────────────────────────────────────────────────
 * Zero-Trust version: Filtrado por Tenant y validación de sesión.
 */
export async function getRecipeForProduct(productId: string) {
  const session = await requireManagerSession();
  if (!session.success || !session.data) {
    throw new Error(session.error || "ZERO_TRUST_VIOLATION: Acceso denegado a Recetas.");
  }
  const { storeId, role } = session.data;
  const tenant = withTenant({ user: { storeId, role } });

  try {
    const rawData = await tenant
      .select()
      .from(bill_of_materials)
      .where(and(eq(bill_of_materials.parentId, productId), isNull(bill_of_materials.deletedAt)))
      .all();
    return { success: true, data: rawData };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * addIngredientToRecipe
 */
export async function addIngredientToRecipe(payload: z.infer<typeof RecipeIngredientSchema>) {
  const session = await requireManagerSession();
  if (!session.success || !session.data) {
    throw new Error(session.error || "ZERO_TRUST_VIOLATION: Acceso denegado.");
  }
  const { storeId, role } = session.data;
  const tenant = withTenant({ user: { storeId, role } });

  const { productId, ingredientId, qty, unitMultiplier } = (payload as any);
  
  await tenant.insert(bill_of_materials).values([{
    id: "BOM-" + randomUUID().substring(0, 8).toUpperCase(),
    parentId: productId,
    childId: ingredientId,
    quantity: qty,
    unitMultiplier: unitMultiplier || 1.0,
  }]);

  revalidatePath("/dashboard/supply");
  return { success: true };
}

/**
 * removeIngredientFromRecipe
 * V3.1 Regla 2: Soft Delete — PROHIBIDO db.delete() en BOM
 */
export async function removeIngredientFromRecipe(recipeId: string) {
  const session = await requireManagerSession();
  if (!session.success || !session.data) {
    throw new Error(session.error || "ZERO_TRUST_VIOLATION: Acceso denegado.");
  }
  const { storeId, role } = session.data;
  const tenant = withTenant({ user: { storeId, role } });

  await tenant.update(bill_of_materials)
    .set({ deletedAt: new Date() })
    .where(eq(bill_of_materials.id, recipeId));

  revalidatePath("/dashboard/supply");
  return { success: true };
}

const UpdateBOMSchema = z.object({
  bomId: z.string().min(1, "BOM ID requerido"),
  newInventoryItemId: z.string().min(1, "Inventory Item ID requerido"),
});

/**
 * updateBOMItem
 * V3.1: Motor de Vinculación Manual (Human-in-the-Loop Resolution)
 */
export async function updateBOMItem(bomId: string, newInventoryItemId: string) {
  const session = await requireManagerSession();
  if (!session.success || !session.data) {
    throw new Error(session.error || "ZERO_TRUST_VIOLATION: Acceso denegado.");
  }
  const { storeId, role } = session.data;
  const tenant = withTenant({ user: { storeId, role } });

  const validated = UpdateBOMSchema.parse({ bomId, newInventoryItemId });
  
  await tenant.update(bill_of_materials)
    .set({ childId: validated.newInventoryItemId, raw_child_name: null })
    .where(eq(bill_of_materials.id, validated.bomId));

  revalidatePath("/dashboard/supply");
  return { success: true };
}

/**
 * updateRecipeIngredient
 */
export async function updateRecipeIngredient(
  recipeId: string, 
  newQty: number, 
  unitMultiplier: number,
  rawMaterialId: string, 
  newCostCents: number,
  newBaseUnit?: string
) {
  const session = await requireManagerSession();
  if (!session.success || !session.data) {
    throw new Error(session.error || "ZERO_TRUST_VIOLATION: Acceso denegado.");
  }
  const { storeId, role } = session.data;
  const tenant = withTenant({ user: { storeId, role } });

  try {
     const { raw_materials } = await import("@/db/schema/bom");
     
     const materialUpdate: Record<string, unknown> = { 
       grossCostCents: newCostCents, 
       trueCostPerUnitCents: newCostCents, 
     };
     if (newBaseUnit) {
        materialUpdate.baseUnit = newBaseUnit;
     }

     // ACID Shield: Both mutations MUST succeed or both rollback
     await tenant.transaction(async (tx: any) => {
       await tx.update(raw_materials)
         .set(materialUpdate)
         .where(eq(raw_materials.id, rawMaterialId));

       await tx.update(bill_of_materials)
         .set({ quantity: newQty, unitMultiplier })
         .where(eq(bill_of_materials.id, recipeId));
     });
        
     revalidatePath("/dashboard/supply");
     return { success: true };
  } catch (error: unknown) {
     const msg = error instanceof Error ? error.message : "Unknown error";
     return { success: false, error: msg };
  }
}

/**
 * ingestUnstructuredBOM
 * V3.1: Auto-Upsert CASTRADO — PROHIBIDO db.insert(inventory_items).
 */
export async function ingestUnstructuredBOM(csvData: Array<{ Nombre: string, Descripcion: string }>) {
  const session = await requireManagerSession();
  if (!session.success || !session.data) {
    throw new Error(session.error || "ZERO_TRUST_VIOLATION: Acceso denegado.");
  }
  const { storeId, role } = session.data;
  const tenant = withTenant({ user: { storeId, role } });

  const { products } = await import("@/db/schema");
  const { inventory_items } = await import("@/db/schema/supply");

  // V3.1: Solo productos y ingredientes ACTIVOS
  const allProducts = await tenant.select({ id: products.id, name: products.name, category: products.category }).from(products).where(isNull(products.deletedAt));
  const allIngredients = await tenant.select({ id: inventory_items.id, name: inventory_items.name }).from(inventory_items).where(eq(inventory_items.is_active, true));

  // V3.1: Solo BOMs activos para dedup
  const existingBoms = await tenant.select({ parentId: bill_of_materials.parentId, childId: bill_of_materials.childId }).from(bill_of_materials).where(isNull(bill_of_materials.deletedAt));
  const bomSet = new Set(existingBoms.map((b: any) => `${b.parentId}-${b.childId || 'NULL'}`));

  const newBoms: (typeof bill_of_materials.$inferInsert)[] = [];
  let unresolvedCount = 0;

  for (const row of csvData) {
    if (!row.Nombre || !row.Descripcion) continue;
    
    const parentNameLower = String(row.Nombre).trim().toLowerCase();
    const parentProd = allProducts.find((p: any) => p.name?.toLowerCase() === parentNameLower);
    if (!parentProd) continue;

    // Motor Heurístico para Hamburguesas (Antes del split)
    if (parentProd.category?.toUpperCase() === "HAMBURGUESAS" || parentNameLower.includes("doble") || parentNameLower.includes("triple") || parentNameLower.includes("simple") || parentNameLower.includes("burger")) {
       const panMatch = allIngredients.find((i: any) => i.name === "PAN TBP");
       if (panMatch && !bomSet.has(`${parentProd.id}-${panMatch.id}`)) {
          bomSet.add(`${parentProd.id}-${panMatch.id}`);
          newBoms.push({ id: "BOM-AUTO-" + randomUUID().substring(0, 8).toUpperCase(), parentId: parentProd.id, childId: panMatch.id, quantity: 1, unitMultiplier: 1.0 });
       }
       
       const medMatch = allIngredients.find((i: any) => i.name === "MEDALLON DE CARNE 110G");
       if (medMatch && !bomSet.has(`${parentProd.id}-${medMatch.id}`)) {
          let meatQty = 1;
          if (parentNameLower.includes("doble")) meatQty = 2;
          else if (parentNameLower.includes("triple")) meatQty = 3;
          bomSet.add(`${parentProd.id}-${medMatch.id}`);
          newBoms.push({ id: "BOM-AUTO-" + randomUUID().substring(0, 8).toUpperCase(), parentId: parentProd.id, childId: medMatch.id, quantity: meatQty, unitMultiplier: 1.0 });
       }

       if (String(row.Descripcion).toUpperCase().includes("INCLUYE PAPAS")) {
          const papasMatch = allIngredients.find((i: any) => i.name === "PAPAS SIMPLOT CRUNCH");
          if (papasMatch && !bomSet.has(`${parentProd.id}-${papasMatch.id}`)) {
             bomSet.add(`${parentProd.id}-${papasMatch.id}`);
             newBoms.push({ id: "BOM-AUTO-" + randomUUID().substring(0, 8).toUpperCase(), parentId: parentProd.id, childId: papasMatch.id, quantity: 0.15, unitMultiplier: 1.0 });
          }
       }
    }

    // Airlock Heurístico (Limpieza NLP)
    let desc = String(row.Descripcion).toUpperCase();
    desc = desc.replace(/[.]/g, "").replace(/INCLUYE PAPAS/gi, "").replace(/CON GUARNICIÓN/gi, "").replace(/CON GUARNICION/gi, "").trim();
    const parts = desc.split(',').map(s => s.trim()).filter(Boolean);

    for (const part of parts) {
      if (part.length < 3) continue;
      const partLower = part.toLowerCase();

      // O(1) NLP Bridge
      let searchName = partLower;
      if (searchName.includes("papas") || searchName.includes("fritas")) searchName = "papas simplot crunch";
      if (searchName.includes("carne") || searchName.includes("medallon")) searchName = "medallon de carne 110g";
      if (searchName.includes("pan ") && !searchName.includes("tbp")) searchName = "pan tbp";
      if (searchName.includes("cheddar") && searchName.includes("feta")) searchName = "cheddar fetas";
      if (searchName.includes("nugget")) searchName = "nuggets";
      
      let matchIng = allIngredients.find((i: any) => i.name.toLowerCase().includes(searchName)) || allIngredients.find((i: any) => searchName.includes(i.name.toLowerCase()));
      
      if (matchIng) {
        // MATCH EXITOSO — Vincular directamente
        const key = `${parentProd.id}-${matchIng.id}`;
        if (!bomSet.has(key)) {
          bomSet.add(key);
          newBoms.push({
            id: "BOM-AUTO-" + randomUUID().substring(0, 8).toUpperCase(),
            parentId: parentProd.id,
            childId: matchIng.id,
            quantity: 1, 
            unitMultiplier: 1.0,
          });
        }
      } else {
        // V3.1: SIN MATCH — Insertar BOM con childId=NULL + raw_child_name
        const rawName = part.trim().toUpperCase();
        const dedupKey = `${parentProd.id}-RAW:${rawName}`;
        if (!bomSet.has(dedupKey)) {
          bomSet.add(dedupKey);
          newBoms.push({
            id: "BOM-UNRESOLVED-" + randomUUID().substring(0, 8).toUpperCase(),
            parentId: parentProd.id,
            childId: null,
            raw_child_name: rawName,
            quantity: 1,
            unitMultiplier: 1.0,
          });
          unresolvedCount++;
        }
      }
    }
  }

  // Volcado Atómico
  if (newBoms.length > 0) {
     const CHUNK = 500;
     for (let i = 0; i < newBoms.length; i += CHUNK) {
       await tenant.insert(bill_of_materials).values(newBoms.slice(i, i + CHUNK)).onConflictDoNothing();
     }
  }

  revalidatePath("/dashboard/supply");
  return { success: true, count: newBoms.length, unresolvedCount };
}
