"use server";

import { db } from "@/db";
import { products } from "@/db/schema";
import { sellable_products } from "@/db/schema/bom";
import { authenticatedAction } from "@/lib/auth-action";
import { withTenant } from "@/lib/tenant-db";
import { sql, isNull } from "drizzle-orm";

/**
 * Catalog Mapping Engine — O(1) HashMap Resolution
 * 
 * Construye un diccionario de resolución instantánea para cruzar
 * el raw_name de ventas/Excel con el product_sku del Motor BOM.
 */

// --- NORMALIZACIÓN CANÓNICA ---
const normalize = (s: string): string =>
  String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase()
    .trim();

// --- TIPO DEL CATÁLOGO ---
export type CatalogEntry = {
  sku: string;
  name: string;
  category: string;
};

// --- CONSTRUCTOR O(1) HASHMAP ---
export const buildCatalogHashMap = authenticatedAction(async (_: void, { user }) => {
  const tenant = withTenant({ user });

  // Extraer productos vendibles + insumos
  const allProducts = await tenant
    .select({
      id: products.id,
      name: products.name,
      category: products.category,
      sku: products.sku,
    })
    .from(products)
    .where(isNull(products.deletedAt));

  let sellables: { id: string; sku: string; category: string }[] = [];
  try {
    sellables = (await tenant
      .select({
        id: sellable_products.id,
        sku: sellable_products.sku,
        category: sellable_products.category,
      })
      .from(sellable_products)) as any[];
  } catch {
    // sellable_products puede no existir aún
  }

  // Construcción del HashMap bidireccional
  const hashMap: Record<string, CatalogEntry> = {};
  let totalEntries = 0;

  for (const p of allProducts) {
    const entry: CatalogEntry = {
      sku: p.id,
      name: p.name,
      category: p.category || "GENERAL",
    };

    // Indexar por nombre normalizado
    hashMap[normalize(p.name)] = entry;
    totalEntries++;

    // Indexar por SKU limpio
    if (p.sku) {
      hashMap[normalize(p.sku)] = entry;
      totalEntries++;
    }

    // Indexar por ID sin prefijo
    const cleanId = normalize(p.id.replace(/^(PRD_|PROD-|PRD_AUTO_)/i, ""));
    hashMap[cleanId] = entry;
    totalEntries++;
  }

  for (const s of sellables) {
    const entry: CatalogEntry = {
      sku: s.id,
      name: s.sku,
      category: s.category || "GENERAL",
    };
    hashMap[normalize(s.sku)] = entry;
    totalEntries++;
  }

  return { totalEntries, hashMap };
});

// --- RESOLUCIÓN O(1) ---
export const resolveSkuFromRawName = authenticatedAction(
  async (
    payload: { rawName: string; category?: string },
    { user }
  ) => {
    const result = await buildCatalogHashMap();
    if (!result.success || !result.data) {
      throw new Error("Error al construir el catálogo.");
    }

    const { hashMap } = result.data;
    const key = normalize(payload.rawName);

    // Búsqueda directa O(1)
    const match = hashMap[key];
    if (match) {
      return {
        resolved: true,
        sku: match.sku,
        name: match.name,
        category: payload.category || match.category,
      };
    }

    // Búsqueda parcial por token más largo (fallback O(n) pero solo si O(1) falla)
    const tokens = key.split(/\s+/).filter(t => t.length > 2);
    for (const token of tokens) {
      for (const [mapKey, mapEntry] of Object.entries(hashMap)) {
        if (mapKey.includes(token)) {
          return {
            resolved: true,
            sku: mapEntry.sku,
            name: mapEntry.name,
            category: payload.category || mapEntry.category,
            fuzzy: true,
          };
        }
      }
    }

    return { resolved: false, rawName: payload.rawName };
  }
);

// --- ASIGNACIÓN DE CATEGORÍA AL SKU ---
export const assignCategoryToSku = authenticatedAction(
  async (
    payload: { sku: string; category: string },
    { user }
  ) => {
    const tenant = withTenant({ user });

    await tenant
      .update(products)
      .set({ category: payload.category })
      .where(sql`${products.id} = ${payload.sku}`);

    return { success: true, sku: payload.sku, category: payload.category };
  }
);
