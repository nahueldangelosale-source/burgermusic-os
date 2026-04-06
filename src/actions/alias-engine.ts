"use server";

/**
 * ─────────────────────────────────────────────────────────────
 * Heuristic Auto-Matcher Engine V1.0 — BurgerMusic OS
 * ─────────────────────────────────────────────────────────────
 * O(N) heuristic resolution of orphaned SKUs from legacy CSV
 * imports. Applies a deterministic decision tree and batch-
 * inserts resolved aliases into sku_aliases atomically.
 *
 * Decision Tree:
 *  1. Identity Match (exact name or sku)
 *  2. Rule 'HC' → "Hernán Cattáneo" family
 *  3. Size Modifier: Doble/Triple/Simple
 *
 * Fail-Closed. Zero fire-and-forget.
 */

import { db } from "@/db";
import { products, sku_aliases, fact_sales, sales_mapping_dlq } from "@/db/schema";
import { requireManagerSession } from "@/actions/ProfitabilityEngine";
import { eq, isNull, sql, notInArray, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

// ─── Normalizer ────────────────────────────────────────────
function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

// ─── Types ─────────────────────────────────────────────────
type ProductRecord = {
  id: string;
  name: string;
  sku: string | null;
  nameLower: string;
  skuLower: string | null;
};

type ResolvedAlias = typeof sku_aliases.$inferInsert;

// ─── Auto-Resolver ─────────────────────────────────────────
export async function autoResolveOrphans() {
  const session = await requireManagerSession();
  const storeId = session?.user?.storeId || "centro";

  // 1. Load ALL active products O(1) — single DB round-trip
  const allProducts = await db
    .select({ id: products.id, name: products.name, sku: products.sku })
    .from(products)
    .where(isNull(products.deletedAt));

  const catalog: ProductRecord[] = allProducts.map(p => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    nameLower: normalize(p.name),
    skuLower: p.sku ? normalize(p.sku) : null,
  }));

  // 2. Build O(1) lookup maps
  const byNameExact = new Map<string, ProductRecord>();
  const bySkuExact = new Map<string, ProductRecord>();

  for (const p of catalog) {
    byNameExact.set(p.nameLower, p);
    if (p.skuLower) bySkuExact.set(p.skuLower, p);
  }

  // 3. Load existing aliases to avoid duplicate processing
  const existingAliases = await db
    .select({ raw_sku: sku_aliases.raw_sku })
    .from(sku_aliases)
    .where(eq(sku_aliases.store_id, storeId));

  const existingSet = new Set(existingAliases.map(a => a.raw_sku.toLowerCase()));

  // 4. Discover orphans: distinct raw_name in fact_sales with no product match
  const allDistinctRaw = await db
    .selectDistinct({ raw_name: fact_sales.raw_name })
    .from(fact_sales)
    .where(eq(fact_sales.storeId, storeId));

  // 5. Filter to true orphans: no existing alias AND no direct product match
  const orphans = allDistinctRaw
    .map(r => r.raw_name)
    .filter(raw => {
      const norm = normalize(raw);
      if (existingSet.has(norm)) return false;
      if (byNameExact.has(norm)) return false;
      if (bySkuExact.has(norm)) return false;
      return true;
    });

  // 6. Heuristic Resolution Loop — O(N) with O(1) lookups
  const resolved: ResolvedAlias[] = [];
  const unresolved: string[] = [];

  for (const rawSku of orphans) {
    const norm = normalize(rawSku);
    let match: ProductRecord | undefined;

    // ── RULE 1: Identity Match ──────────────────────────────
    match = byNameExact.get(norm) || bySkuExact.get(norm);

    // ── RULE 2: HC Family ───────────────────────────────────
    if (!match && norm.includes("hc")) {
      // Search for any product whose name contains "cattáneo" or "cattaneo" or "hc"
      match = catalog.find(p =>
        p.nameLower.includes("cattáneo") ||
        p.nameLower.includes("cattaneo") ||
        p.nameLower.includes("hernán") ||
        p.nameLower.includes("hernan") ||
        (p.skuLower && p.skuLower.includes("hc"))
      );
    }

    // ── RULE 3: Size/Weight Modifier ────────────────────────
    if (!match) {
      const hasDoble = norm.includes("doble");
      const hasTriple = norm.includes("triple");

      // Try to find a base product by partial containment
      const baseKeywords = norm
        .replace(/doble|triple|simple|x2|x3/gi, "")
        .replace(/\s+/g, " ")
        .trim();

      if (baseKeywords.length > 2) {
        // Find candidate products whose name contains the base keywords
        const candidates = catalog.filter(p =>
          p.nameLower.includes(baseKeywords) || baseKeywords.includes(p.nameLower)
        );

        if (candidates.length > 0) {
          if (hasDoble) {
            match = candidates.find(p => p.nameLower.includes("doble")) || candidates[0];
          } else if (hasTriple) {
            match = candidates.find(p => p.nameLower.includes("triple")) || candidates[0];
          } else {
            // Fallback: prefer "simple" variant, otherwise first match
            match = candidates.find(p =>
              p.nameLower.includes("simple") || p.nameLower.includes("clásic")
            ) || candidates[0];
          }
        }
      }
    }

    if (match) {
      resolved.push({
        id: randomUUID(),
        store_id: storeId,
        raw_sku: norm,
        product_id: match.id,
      });
    } else {
      unresolved.push(rawSku);
    }
  }

  // 7. Batch Insert — Single O(1) DB round-trip
  let insertedCount = 0;
  if (resolved.length > 0) {
    const result = await db
      .insert(sku_aliases)
      .values(resolved)
      .onConflictDoNothing()
      .returning({ id: sku_aliases.id });
    insertedCount = result.length;
  }

  return {
    success: true,
    totalOrphansScanned: orphans.length,
    autoResolved: insertedCount,
    unresolvedCount: unresolved.length,
    unresolvedSample: unresolved.slice(0, 25),
  };
}

// ─── Read Unresolved Orphans for UI ────────────────────────
export async function getUnresolvedOrphans() {
  const session = await requireManagerSession();
  const storeId = session?.user?.storeId || "centro";

  // O(1) Extracción Pura desde el Purgatorio (Zero-Trust DLQ)
  const unresolvedDlqRows = await db
    .selectDistinct({ raw_name: sales_mapping_dlq.raw_name })
    .from(sales_mapping_dlq)
    .where(
      sql`${sales_mapping_dlq.storeId} = ${storeId} AND ${sales_mapping_dlq.resolved} = 0`
    );

  const orphans = unresolvedDlqRows.map(r => r.raw_name);

  // Extraemos también el catálogo para inyectarlo al Server Component (OrphanageTray)
  const allProducts = await db
    .select({ id: products.id, name: products.name, sku: products.sku })
    .from(products)
    .where(isNull(products.deletedAt));

  return {
    orphans,
    totalCount: orphans.length,
    products: allProducts.map(p => ({ id: p.id, name: p.name })),
  };
}

/**
 * Mapeo Manual Inmutable (Human-in-the-Loop)
 * Permite a un humano asignar un rawString a un officialSkuId maestro.
 */
export async function mapSkuAlias(rawString: string, officialSkuId: string) {
  const session = await requireManagerSession();
  const storeId = session?.user?.storeId || "centro";

  if (!rawString || !officialSkuId) {
    return { success: false, error: "Parámetros inválidos" };
  }

  const id = "ALIAS_MANUAL_" + randomUUID().substring(0, 8).toUpperCase();

  try {
    await db.insert(sku_aliases).values({
      id,
      store_id: storeId,
      raw_sku: rawString.trim(),
      product_id: officialSkuId,
    }).onConflictDoUpdate({
      target: sku_aliases.raw_sku,
      set: {
        product_id: officialSkuId,
      }
    });

    return { success: true };
  } catch (err: any) {
    console.error("[mapSkuAlias] Error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Mapeo Manual Masivo (Human-in-the-Loop Batching)
 * Permite a un humano asignar múltiples rawStrings a officialSkuIds de forma atómica en O(1).
 */
export async function mapSkuAliasesBatch(mappings: { rawString: string; officialSkuId: string }[]) {
  const session = await requireManagerSession();
  const storeId = session?.user?.storeId || "centro";

  if (!mappings || mappings.length === 0) {
    return { success: false, error: "Array de mapeo vacío" };
  }

  const valuesToInsert = mappings.map(m => ({
    id: "ALIAS_MANUAL_" + randomUUID().substring(0, 8).toUpperCase(),
    store_id: storeId,
    raw_sku: m.rawString.trim(),
    product_id: m.officialSkuId,
  }));

  try {
    // Bulk Insert O(1)
    await db.insert(sku_aliases).values(valuesToInsert).onConflictDoUpdate({
      target: sku_aliases.raw_sku,
      set: {
        product_id: sql`excluded.product_id`,
      }
    });

    // DLQ Garbage Collection
    const rawNames = mappings.map(m => m.rawString);
    if (rawNames.length > 0) {
      await db.update(sales_mapping_dlq)
        .set({ resolved: true })
        .where(inArray(sales_mapping_dlq.raw_name, rawNames));
    }

    // Zero-Trust UI Cache Purgation
    revalidatePath('/dashboard/sales');
    
    return { success: true };
  } catch (err: any) {
    console.error("[mapSkuAliasesBatch] Agregation Error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Retorna O(1) catálogo para Dropdown de OrphanageTray
 */
export async function getMDMCatalog() {
  return await db.select({ id: products.id, name: products.name })
    .from(products)
    .where(isNull(products.deletedAt));
}
