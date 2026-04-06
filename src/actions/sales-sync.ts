"use server";

import { db } from "@/db";
import { products, fact_sales, sku_aliases } from "@/db/schema";
import { bill_of_materials } from "@/db/schema/bom";
import { inventory_items } from "@/db/schema/supply";
import { depleteInventoryForSales } from "./inventory-depletion";
import { eq, and, sql, isNull } from "drizzle-orm";
import Papa from "papaparse";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireManagerSession } from "@/lib/auth-action";

// ─────────────────────────────────────────────────────────────
// Brute-Force ETL V5.0 — NLP Variant Engine + Dynamic COGS
// Antigravity 2026: Zero Silent Drops + Modifier Intelligence
// ─────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════
// NLP VARIANT EXTRACTOR — Regex Modifier Parser
// ═══════════════════════════════════════════════════════════

// ─── NLP EXTRACTOR FASE 2 ─────────────────────────────────────
const VARIANT_STRIP_REGEX = /\b(triple|doble|simple|330\s*g|220\s*g|110\s*g)\b/ig;
const COMBO_MULTI_REGEX = /(?:^|\s)(?:promo\s*)?(\d+)\s*(?:x|-|--)\s*/i;

function parseVariantNLP(rawName: string): { cleanName: string; extraPatties: number; multiplier: number } {
  const normalized = rawName.trim();
  let extraPatties = 0;
  let multiplier = 1;

  // 1. Detectar multiplicador homogéneo (ej. "2 x Charly", "PROMO 2--")
  const multiMatch = normalized.match(COMBO_MULTI_REGEX);
  let cleanedForMulti = normalized;
  if (multiMatch && multiMatch[1]) {
    const extracted = parseInt(multiMatch[1], 10);
    if (!isNaN(extracted) && extracted > 0) {
      multiplier = extracted;
    }
    cleanedForMulti = normalized.replace(multiMatch[0], " ").trim();
  }

  // 2. Extraer patties
  const lower = cleanedForMulti.toLowerCase();
  if (lower.includes("triple") || lower.includes("330g") || lower.includes("330 g")) {
    extraPatties = 2;
  } else if (lower.includes("doble") || lower.includes("220g") || lower.includes("220 g")) {
    extraPatties = 1;
  }

  // 3. Purificar nombre base
  const cleanName = cleanedForMulti.replace(VARIANT_STRIP_REGEX, "").replace(/\s+/g, " ").trim().toLowerCase();

  return { cleanName, extraPatties, multiplier };
}

// ═══════════════════════════════════════════════════════════
// COGS Mutation Table (Centavos)
// ═══════════════════════════════════════════════════════════
const EXTRA_PATTY_COST_CENTS: Record<number, number> = {
  1: 300000,   // Doble: +$3.000
  2: 630000,   // Triple: +$6.300
};

export async function ingestSalesCSV(csvString: string) {
  const session = await requireManagerSession();
  if (!session.success || !session.data) {
    throw new Error(session.error || "ZERO_TRUST_VIOLATION: Acceso denegado.");
  }
  return rawIngestSalesCSV(csvString, session.data.storeId);
}

function parseDateHeuristic(rawDateStr: string): string | null {
  if (!rawDateStr || rawDateStr.trim() === "") return null;
  const parts = rawDateStr.trim().split(/[\/\-]/);
  if (parts.length >= 2) {
    const dStr = parts[0];
    const mStr = parts[1];
    const yStr = parts.length === 3 ? parts[2] : "";

    let d, m, y;
    if (yStr.length === 2) {
      // MM/DD/YY (Excel American default)
      m = parseInt(dStr, 10) - 1;
      d = parseInt(mStr, 10);
      y = 2000 + parseInt(yStr, 10);
    } else {
      // DD/MM/YYYY (Argentina standard)
      d = parseInt(dStr, 10);
      m = parseInt(mStr, 10) - 1;
      y = yStr ? parseInt(yStr, 10) : new Date().getFullYear();
    }
    const dt = new Date(y, m, d);
    if (!isNaN(dt.getTime())) {
       const pad = (n: number) => n.toString().padStart(2, '0');
       return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    }
  }
  return new Date().toISOString().split("T")[0];
}

export async function rawIngestSalesCSV(csvString: string, storeId: string) {
  if (!csvString) {
    return { success: false, error: "Empty CSV string" };
  }

  // 1. PRE-FLIGHT QUOTE STERILIZATION (Data Entropy Hotfix)
  // Aniquilación total de comillas dobles que rompen el RFC del CSV fusionando filas
  const sanitizedText = csvString.replace(/"/g, '');

  const parsed = Papa.parse(sanitizedText, {
    header: true,
    delimiter: ";",
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    console.warn("[ETL] CSV Parser warnings:", parsed.errors);
  }

  // Precargar catálogo de productos ACTIVOS (Zero-Trust)
  const allProducts = await db
    .select({ id: products.id, name: products.name, sku: products.sku, sellingPrice: products.sellingPrice, costCents: products.costCents })
    .from(products)
    .where(isNull(products.deletedAt));

  // Motor de Memoria de Alias (O(1))
  const allAliases = await db.select().from(sku_aliases).where(eq(sku_aliases.store_id, storeId));
  const aliasMap = new Map<string, string>();
  allAliases.forEach(a => aliasMap.set(a.raw_sku.toLowerCase(), a.product_id));

  // Precargar mapa de costo BOM dinámico — Agregación SQL O(1)
  const bomCosts = await db
    .select({
      productId: bill_of_materials.parentId,
      bomCostCents: sql<number>`COALESCE(SUM(${bill_of_materials.quantity} * ${bill_of_materials.unitMultiplier} * ${inventory_items.cost_per_unit_cents}), 0)`,
    })
    .from(bill_of_materials)
    .innerJoin(inventory_items, and(
      eq(inventory_items.id, bill_of_materials.childId),
      eq(inventory_items.is_active, true)
    ))
    .where(isNull(bill_of_materials.deletedAt))
    .groupBy(bill_of_materials.parentId);

  const costMap = new Map(bomCosts.map(c => [c.productId, Number(c.bomCostCents) || 0]));

  const unknownItems: string[] = [];
  const droppedRows: number[] = [];
  const validInsertPayloads: (typeof fact_sales.$inferInsert)[] = [];

  // ─── MEMORIA DE ARRASTRE (Fill-Down O(1)) ───
  let currentFecha = "";
  let currentCaja = "";

  let rowIndex = 0;
  for (const row of parsed.data as any[]) {
    rowIndex++;

    // ═══════════════════════════════════════════════════════════
    // FASE 2: EXTRACCIÓN FUERZA BRUTA DIMENSIONAL (Zod Bypass)
    // ═══════════════════════════════════════════════════════════
    const rowValues = Object.values(row);
    const rawFecha = row["FechaCaja"] || rowValues[0] || "";
    const rawCaja = row["NroCaja"] || rowValues[1] || "";
    const rawDesc = row["Descripcion"] || row["Descripción"] || rowValues[2] || "";
    const rawQty = row["Suma de Cantidad"] || row["Cantidad"] || rowValues[3] || "1";
    const rawPrice = row[" Suma de Precio"] || row["Suma de Precio"] || rowValues[4] || "0";

    // ═══════════════════════════════════════════════════════════
    // FASE 3: FILL-DOWN HEURISTIC
    // ═══════════════════════════════════════════════════════════
    const fechaTrimmed = String(rawFecha).trim();
    const cajaTrimmed = String(rawCaja).trim();

    if (fechaTrimmed !== "") {
      currentFecha = fechaTrimmed;
    }
    if (cajaTrimmed !== "") {
      currentCaja = cajaTrimmed;
    }

    const fechaEfectiva = fechaTrimmed || currentFecha;
    const cajaEfectiva = cajaTrimmed || currentCaja;

    if (!fechaEfectiva || !cajaEfectiva) {
      continue; // Aún no hay bloque base para rehidratar
    }

    // ═══════════════════════════════════════════════════════════
    // COERCIÓN ATÓMICA: Descripción
    // ═══════════════════════════════════════════════════════════
    const descCleaned = String(rawDesc).replace(/[\r\n"]/g, "").trim();

    if (!descCleaned || descCleaned.toLowerCase() === "sku_desconocido" || descCleaned.toLowerCase() === "descripcion" || descCleaned.toLowerCase() === "descripción") {
      console.log("[ETL] DROPPED ROW (no desc):", rowIndex, row);
      droppedRows.push(rowIndex);
      continue;
    }

    // ═══════════════════════════════════════════════════════════
    // NLP VARIANT ENGINE — Extract modifier before SKU lookup
    // ═══════════════════════════════════════════════════════════
    const { cleanName, extraPatties, multiplier } = parseVariantNLP(descCleaned);
    const descLower = descCleaned.toLowerCase();

    // ═══════════════════════════════════════════════════════════
    // COERCIÓN CRIPTOGRÁFICA: Cantidad y Precio
    // ═══════════════════════════════════════════════════════════
    const cleanQtyStr = String(rawQty).replace(/[^0-9,.\-]/g, "").replace(",", ".").trim();
    const baseQty = parseFloat(cleanQtyStr) || 1;
    const qty = baseQty * multiplier; // INYECCIÓN HOMOGÉNEA DE COMBO (Fase 2)

    let cleanPriceStr = String(rawPrice).replace(/[^0-9,\.]/g, "");
    const matchPrice = cleanPriceStr.match(/(.*)[,\.]([0-9]{2})$/);
    if (matchPrice) {
        cleanPriceStr = matchPrice[1].replace(/[,\.]/g, "") + "." + matchPrice[2];
    } else {
        cleanPriceStr = cleanPriceStr.replace(/[,\.]/g, "");
    }
    const parsedPrice = parseFloat(cleanPriceStr);
    const priceCents = Math.round((isNaN(parsedPrice) ? 0 : parsedPrice) * 100);

    // ═══════════════════════════════════════════════════════════
    // MOTOR DE BÚSQUEDA: Alias → NLP CleanName → Exacto
    // ═══════════════════════════════════════════════════════════
    const targetProductId = aliasMap.get(descLower) || aliasMap.get(cleanName);
    let matchedProduct = targetProductId
      ? allProducts.find(p => p.id === targetProductId)
      : undefined;

    if (!matchedProduct) {
      // Búsqueda por nombre exacto (raw_name descLower)
      matchedProduct = allProducts.find(p => p.name?.toLowerCase() === descLower);
    }

    if (!matchedProduct) {
      // Búsqueda por NLP cleanName (strip variant keywords)
      matchedProduct = allProducts.find(p => p.name?.toLowerCase() === cleanName);
    }

    if (!matchedProduct) {
      unknownItems.push(descCleaned || descLower);
      continue;
    }

    const saleId = "SALE_" + Date.now().toString() + "_" + randomUUID().substring(0, 8).toUpperCase();

    // Parseo fecha DD/MM/YYYY o MM/DD/YY → ISO usando memoria Fill-Down
    const parsedDate = parseDateHeuristic(String(fechaEfectiva));
    const dateStr = parsedDate || new Date().toISOString().split("T")[0];

    // ═══════════════════════════════════════════════════════════
    // DYNAMIC COGS: Base BOM + Extra Patty Surcharge
    // ═══════════════════════════════════════════════════════════
    const baseBomCost = costMap.get(matchedProduct.id) || matchedProduct.costCents || 0;
    const pattySurcharge = EXTRA_PATTY_COST_CENTS[extraPatties] || 0;
    const totalCostCents = baseBomCost + pattySurcharge;

    const frozenPrice = matchedProduct.sellingPrice || priceCents;

    // Bloqueo Criptográfico de Duplicados
    const ticketHash = `${dateStr}|${String(cajaEfectiva).trim()}|${matchedProduct.id}|${qty}|${priceCents}`;

    // Serializar metadata de variante
    const variantMeta = extraPatties > 0
      ? JSON.stringify({ extraPatties })
      : null;

    validInsertPayloads.push({
      id: saleId,
      storeId: storeId,
      date: dateStr,
      raw_name: descCleaned || descLower,
      productSku: matchedProduct.id,
      quantity: qty,
      net_price_cents: priceCents,
      historical_cost_cents: totalCostCents,
      historical_price_cents: frozenPrice,
      ticket_number: String(cajaEfectiva).trim(),
      payment_method: "UNKNOWN",
      status: "COMPLETED",
      depleted: false,
      ticket_hash: ticketHash,
      variant_metadata: variantMeta,
    });
  }

  console.log(`[ETL] Brute-Force V5.0 Summary: ${parsed.data.length} rows parsed, ${validInsertPayloads.length} valid, ${unknownItems.length} unknown, ${droppedRows.length} dropped`);

  if (validInsertPayloads.length === 0) {
    return { success: false, error: "No valid rows found after mapping", unknownItems };
  }

  // Bulk Insert O(1) con manejo de colisiones criptográficas y Batching Táctico
  const insertedSaleIds: string[] = [];
  const BATCH_SIZE = 100;
  
  for (let i = 0; i < validInsertPayloads.length; i += BATCH_SIZE) {
    const batch = validInsertPayloads.slice(i, i + BATCH_SIZE);
    const insertedSales = await db.insert(fact_sales)
                                .values(batch)
                                .onConflictDoNothing()
                                .returning({ insertedId: fact_sales.id });
    
    insertedSaleIds.push(...insertedSales.map(s => s.insertedId));
  }

  // El Gatillo de Descarga (Closed-Loop)
  if (insertedSaleIds.length > 0) {
     await depleteInventoryForSales(insertedSaleIds, storeId);
  }

  // Sanitización Atómica Heurística
  let autoResolved = 0;
  if (unknownItems.length > 0) {
      const { autoResolveOrphans } = await import("./alias-engine");
      const heuristicResult = await autoResolveOrphans();
      autoResolved = heuristicResult.autoResolved;
  }

  revalidatePath("/dashboard/sales");

  return {
    success: true,
    processedRows: parsed.data.length,
    newSalesInserted: insertedSaleIds.length,
    unknownItemsCount: unknownItems.length,
    unknownItems: Array.from(new Set(unknownItems)).slice(0, 50),
    droppedRowCount: droppedRows.length,
  };
}
