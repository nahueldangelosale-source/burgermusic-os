/**
 * ══════════════════════════════════════════════════════════════════════════════
 * BurgerMusic OS — Force CSV Ingest V6.0 (SRE P0 Rewrite)
 * Arquitectura: Zero-Trust · ACID Chunk Transactions · MDM O(1) Hash-Map
 * Estándar Antigravity 2026
 *
 * Columnas CSV (delimitador: ';', sin header mode):
 *   row[0] → Fecha
 *   row[1] → Caja (NroCaja)
 *   row[2] → Descripcion
 *   row[3] → Cantidad  (Suma de Cantidad)
 *   row[4] → Precio    (Suma de Precio)
 *
 * Reglas de Integridad:
 *   - Fail-Closed: cualquier error detiene el lote y hace Rollback ACID.
 *   - Fill-Down: Fecha/Caja se propagan hacia abajo si la celda está vacía.
 *   - NLP: parseVariantNLP extrae extraPatties y multiplier ANTES del lookup.
 *   - MDM: productos precargados en Map<string, ProductRow> — O(1) exacto.
 *   - DLQ: ítems sin match → array unknownItems (sin inserción, sin silencio).
 *   - Kardex: deducción en inventory_kardex dentro de la misma tx que fact_sales.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import fs from "fs";
import path from "path";
import * as Papa from "papaparse";
import * as dotenv from "dotenv";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, isNull, and, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

// ── Bootstrap ────────────────────────────────────────────────────────────────
dotenv.config({ path: path.join(__dirname, "../.env") });

// ── DB: Conexión directa (CLI, no Next.js runtime) ───────────────────────────
const TURSO_URL   = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || TURSO_URL.trim() === "") {
  console.error("❌ [ENV] TURSO_DATABASE_URL no configurado. Abortando.");
  process.exit(1);
}

const libsqlClient = createClient({
  url:       TURSO_URL,
  authToken: TURSO_TOKEN ?? undefined,
});

// Importamos el schema completo para tipado Drizzle sin importar el módulo Next
import * as schema from "../src/db/schema";
import { bill_of_materials } from "../src/db/schema/bom";
import { inventory_items }   from "../src/db/schema/supply";

const db = drizzle(libsqlClient, { schema: { ...schema } });

// ── Constantes de Negocio ─────────────────────────────────────────────────────
const STORE_ID    = "centro";
const BATCH_SIZE  = 100;              // Anti-"too many SQL variables"
const CSV_FILE    = "Ventas BurgerMusic 1Q.csv";

/** Costo adicional por patty extra (centavos ARS) */
const EXTRA_PATTY_COST_CENTS: Record<number, number> = {
  1: 300_000,  // Doble  → +$3.000
  2: 630_000,  // Triple → +$6.300
};

/**
 * Nombre normalizado del insumo "Medallón de Carne 110g" en inventory_items.
 * Se busca en la tabla por LIKE para mayor resiliencia.
 */
const MEAT_PATTY_NAME_FRAGMENT = "medallón de carne";

// ── NLP Variant Engine ────────────────────────────────────────────────────────
const VARIANT_STRIP_REGEX = /\b(triple|doble|simple|330\s*g|220\s*g|110\s*g)\b/ig;
const COMBO_MULTI_REGEX   = /(?:^|\s)(?:promo\s*)?(\d+)\s*(?:x|-{1,2})\s*/i;

interface NlpResult {
  cleanName:    string;
  extraPatties: number;   // 0=simple, 1=doble, 2=triple
  multiplier:   number;   // factor homogéneo (ej. "2 x Charly" → 2)
}

function parseVariantNLP(rawName: string): NlpResult {
  const normalized = rawName.trim();
  let extraPatties = 0;
  let multiplier   = 1;

  // 1. Detectar multiplicador de combo homogéneo ("2 x Charly", "PROMO 2--")
  const multiMatch    = normalized.match(COMBO_MULTI_REGEX);
  let cleanedForMulti = normalized;
  if (multiMatch && multiMatch[1]) {
    const extracted = parseInt(multiMatch[1], 10);
    if (!isNaN(extracted) && extracted > 0) {
      multiplier = extracted;
    }
    cleanedForMulti = normalized.replace(multiMatch[0], " ").trim();
  }

  // 2. Detectar patties extras por modificador de tamaño
  const lower = cleanedForMulti.toLowerCase();
  if (lower.includes("triple") || lower.includes("330g") || lower.includes("330 g")) {
    extraPatties = 2;
  } else if (lower.includes("doble") || lower.includes("220g") || lower.includes("220 g")) {
    extraPatties = 1;
  }

  // 3. Purificar nombre base eliminando tokens de variante
  const cleanName = cleanedForMulti
    .replace(VARIANT_STRIP_REGEX, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return { cleanName, extraPatties, multiplier };
}

// ── Coerciones de Tipo ────────────────────────────────────────────────────────

/**
 * Regla 2 — Coerción Criptográfica: Cantidad
 * row[3]: strip non-digits → parseInt → fallback 1
 */
function coerceQty(raw: string): number {
  const parsed = parseInt(raw.replace(/\D/g, ""), 10);
  return isNaN(parsed) || parsed <= 0 ? 1 : parsed;
}

/**
 * Regla 2 — Coerción Criptográfica: Precio en centavos
 * row[4]: quita '$' y puntos de miles, convierte coma a punto, ×100
 * Ej: " $ 14.800,00 " → 1480000
 */
function coercePriceCents(raw: string): number {
  const cleaned  = String(raw || "0")
    .replace(/\$|\./g, "")   // elimina '$' y puntos de miles
    .replace(",", ".")        // convierte decimal AR a punto
    .trim();
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : Math.round(val * 100);
}

/**
 * Parseo de fecha DD/MM/YYYY o MM/DD/YY → ISO YYYY-MM-DD
 * Heurística: si el año tiene 2 dígitos → formato americano M/D/YY
 */
function parseDateHeuristic(raw: string): string {
  if (!raw || raw.trim() === "") return new Date().toISOString().split("T")[0];
  const parts = raw.trim().split(/[\/\-]/);
  if (parts.length >= 2) {
    const [p0, p1, p2 = ""] = parts;
    let d: number, m: number, y: number;
    if (p2.length === 2) {
      // MM/DD/YY (Excel americano por defecto)
      m = parseInt(p0, 10) - 1;
      d = parseInt(p1, 10);
      y = 2000 + parseInt(p2, 10);
    } else {
      // DD/MM/YYYY (Argentina standard)
      d = parseInt(p0, 10);
      m = parseInt(p1, 10) - 1;
      y = p2 ? parseInt(p2, 10) : new Date().getFullYear();
    }
    const dt = new Date(y, m, d);
    if (!isNaN(dt.getTime())) {
      const pad = (n: number) => n.toString().padStart(2, "0");
      return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    }
  }
  return new Date().toISOString().split("T")[0];
}

// ── Tipos ─────────────────────────────────────────────────────────────────────
type ProductRow = {
  id:            string;
  name:          string;
  nameLower:     string;
  costCents:     number;
  sellingPrice:  number;
};

type ValidPayload = typeof schema.fact_sales.$inferInsert;

interface KardexDepletion {
  inventoryItemId: string;  // ID del ítem en inventory_items (Medallón de Carne 110g)
  delta:           number;  // unidades a restar (negativo)
  referenceId:     string;  // sale_id para auditoría
}

// ── Main ETL ──────────────────────────────────────────────────────────────────
async function forceIngest(): Promise<void> {
  const csvPath = path.join(__dirname, `../${CSV_FILE}`);

  // ── 1. Carga de Archivo ──────────────────────────────────────────────────
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ [FATAL] CSV no encontrado: ${csvPath}`);
    process.exit(1);
  }

  const rawText = fs.readFileSync(csvPath, "utf-8");
  console.log(`✅ [I/O] Archivo cargado: ${(rawText.length / 1024).toFixed(2)} KB`);

  // ── 2. Sterilización Anti-Corrupción ────────────────────────────────────
  const sanitizedText = rawText.replace(/"/g, "");

  // ── 3. Parse Geométrico Inmutable (header: false) ───────────────────────
  const parsed   = Papa.parse<string[]>(sanitizedText, {
    header:         false,
    delimiter:      ";",
    skipEmptyLines: true,
  });

  const rawData = parsed.data;

  if (parsed.errors.length > 0) {
    console.warn(`⚠️ [CSV] ${parsed.errors.length} advertencias de parser:`, parsed.errors.slice(0, 5));
  }

  // Detectar y saltear header si el CSV lo tiene
  const firstRow     = rawData[0] ?? [];
  const hasHeader    = firstRow.some((v) => {
    const l = String(v).toLowerCase().trim();
    return l.includes("fecha") || l.includes("caja") || l.includes("cant") || l.includes("precio");
  });
  const startIndex   = hasHeader ? 1 : 0;
  const dataRows     = rawData.slice(startIndex);
  console.log(`📊 [CSV] ${dataRows.length} filas de datos (header ${hasHeader ? "detectado y saltado" : "no detectado"})`);

  // ── 4. Precarga MDM en Memoria — O(1) Hash-Map ──────────────────────────
  console.log("🧠 [MDM] Cargando catálogo de productos activos...");

  const allProducts = await db
    .select({
      id:           schema.products.id,
      name:         schema.products.name,
      costCents:    schema.products.costCents,
      sellingPrice: schema.products.sellingPrice,
    })
    .from(schema.products)
    .where(isNull(schema.products.deletedAt));

  // Hash-Map: name.toLowerCase() → ProductRow
  const productMap = new Map<string, ProductRow>();
  for (const p of allProducts) {
    const row: ProductRow = {
      id:           p.id,
      name:         p.name,
      nameLower:    p.name.toLowerCase().trim(),
      costCents:    p.costCents ?? 0,
      sellingPrice: p.sellingPrice ?? 0,
    };
    productMap.set(row.nameLower, row);
  }

  // Precarga de aliases SKU
  const allAliases = await db.select().from(schema.sku_aliases);

  const aliasMap = new Map<string, string>();
  allAliases.forEach(alias => {
    // Coerción defensiva contra null/undefined
    if (alias.raw_sku && alias.product_id) {
       aliasMap.set(alias.raw_sku.trim().toLowerCase(), alias.product_id);
    }
  });

  // Precarga de costos BOM dinámicos (SQL aggregation O(1))
  const bomCosts = await db
    .select({
      productId:    bill_of_materials.parentId,
      bomCostCents: sql<number>`COALESCE(SUM(${bill_of_materials.quantity} * ${bill_of_materials.unitMultiplier} * ${inventory_items.cost_per_unit_cents}), 0)`,
    })
    .from(bill_of_materials)
    .innerJoin(inventory_items, and(
      eq(inventory_items.id, bill_of_materials.childId!),
      eq(inventory_items.is_active, true),
    ))
    .where(isNull(bill_of_materials.deletedAt))
    .groupBy(bill_of_materials.parentId);

  const costMap = new Map<string, number>(
    bomCosts.map((c) => [c.productId, Number(c.bomCostCents) || 0])
  );

  console.log(`✅ [MDM] ${productMap.size} productos · ${allAliases.length} aliases · ${costMap.size} costos BOM cargados`);

  // Buscar el ID del ítem "Medallón de Carne 110g" en inventory_items para el Kardex
  const pattyItems = await db
    .select({ id: inventory_items.id, name: inventory_items.name })
    .from(inventory_items)
    .where(and(
      eq(inventory_items.store_id, STORE_ID),
      eq(inventory_items.is_active, true),
    ));

  const meatPattyItem = pattyItems.find(
    (i) => i.name.toLowerCase().includes(MEAT_PATTY_NAME_FRAGMENT)
  );

  if (!meatPattyItem) {
    console.warn(`⚠️ [KARDEX] No se encontró "${MEAT_PATTY_NAME_FRAGMENT}" en inventory_items. La deducción de Kardex de patties extra se omitirá.`);
  } else {
    console.log(`✅ [KARDEX] Patty item encontrado: ${meatPattyItem.name} [${meatPattyItem.id}]`);
  }

  // ── 5. Loop de Transformación — O(N) ────────────────────────────────────
  const validPayloads:    ValidPayload[]     = [];
  const kardexDepletions: KardexDepletion[]  = [];
  const unknownItems:     string[]           = [];
  let droppedRowCount = 0;

  /** Memoria de Arrastre (Fill-Down) — fuera del bucle, estado persistente */
  let currentFecha = "";
  let currentCaja  = "";

  for (let i = 0; i < dataRows.length; i++) {
    const row       = dataRows[i];
    const rowNum    = startIndex + i + 1; // 1-indexed para logs

    // ── 5.1 Fill-Down: Fecha y Caja ───────────────────────────────────────
    const cellFecha = String(row[0] ?? "").trim();
    const cellCaja  = String(row[1] ?? "").trim();

    if (cellFecha !== "") currentFecha = cellFecha;
    if (cellCaja  !== "") currentCaja  = cellCaja;

    const fechaEfectiva = currentFecha;
    const cajaEfectiva  = currentCaja;

    if (!fechaEfectiva || !cajaEfectiva) {
      // No tenemos bloque base todavía; descartamos silenciosamente hasta tener contexto
      droppedRowCount++;
      continue;
    }

    // ── 5.2 Descripción ───────────────────────────────────────────────────
    const rawDesc   = String(row[2] ?? "").replace(/[\r\n"]/g, "").trim();
    const descLower = rawDesc.trim().toLowerCase();

    if (
      !rawDesc ||
      descLower === "descripcion" ||
      descLower === "descripción" ||
      descLower === "sku_desconocido"
    ) {
      droppedRowCount++;
      continue;
    }

    // ── 5.3 NLP: Extracción de Modificadores (ANTES del lookup MDM) ───────
    const { cleanName, extraPatties, multiplier } = parseVariantNLP(rawDesc);

    // ── 5.4 Coerción Criptográfica: Cantidad ─────────────────────────────
    //   row[3] = Suma de Cantidad
    const parsedQty  = coerceQty(String(row[3] ?? ""));
    const finalQty   = parsedQty * multiplier;   // Inyección homogénea de combo

    // ── 5.5 Coerción Criptográfica: Precio en centavos ───────────────────
    //   row[4] = Suma de Precio
    const netPriceCents = coercePriceCents(String(row[4] ?? ""));

    // ── 5.6 MDM Lookup: Alias → NLP cleanName → Exacto (O(1)) ───────────
    let matchedProduct: ProductRow | undefined;

    // Normalización Zero-Trust: todas las llaves de búsqueda se normalizan
    const normalizedDesc  = descLower.trim();
    const normalizedClean = cleanName.trim().toLowerCase();

    // Prioridad 1: alias exacto del rawDesc
    const aliasedId = aliasMap.get(normalizedDesc) ?? aliasMap.get(normalizedClean);
    if (aliasedId) {
      matchedProduct = productMap.get(
        allProducts.find((p) => p.id === aliasedId)?.name.trim().toLowerCase() ?? ""
      );
    }

    // Prioridad 2: nombre exacto del rawDesc en el hash-map
    if (!matchedProduct) {
      matchedProduct = productMap.get(normalizedDesc);
    }

    // Prioridad 3: nombre NLP-limpiado en el hash-map
    if (!matchedProduct) {
      matchedProduct = productMap.get(normalizedClean);
    }

    // Fail-Closed: ítems sin match → DLQ surface
    if (!matchedProduct) {
      unknownItems.push(rawDesc);
      continue;
    }

    // ── 5.7 COGS Dinámico + Surcharge de Patties ─────────────────────────
    const baseBomCost     = costMap.get(matchedProduct.id) ?? matchedProduct.costCents ?? 0;
    const pattySurcharge  = EXTRA_PATTY_COST_CENTS[extraPatties] ?? 0;
    const totalCostCents  = baseBomCost + pattySurcharge;
    const frozenPrice     = matchedProduct.sellingPrice || netPriceCents;

    // ── 5.8 ID Idempotente (Ticket Hash) ─────────────────────────────────
    const dateStr    = parseDateHeuristic(fechaEfectiva);
    const saleId     = `SALE_${Date.now()}_${randomUUID().substring(0, 8).toUpperCase()}`;
    const ticketHash = `${dateStr}|${cajaEfectiva}|${matchedProduct.id}|${finalQty}|${netPriceCents}`;
    const variantMeta = extraPatties > 0
      ? JSON.stringify({ extraPatties })
      : null;

    validPayloads.push({
      id:                    saleId,
      storeId:               STORE_ID,
      date:                  dateStr,
      raw_name:              rawDesc,
      productSku:            matchedProduct.id,
      quantity:              finalQty,
      net_price_cents:       netPriceCents,
      historical_cost_cents: totalCostCents,
      historical_price_cents:frozenPrice,
      ticket_number:         cajaEfectiva,
      payment_method:        "UNKNOWN",
      status:                "COMPLETED",
      depleted:              false,
      ticket_hash:           ticketHash,
      variant_metadata:      variantMeta,
    });

    // ── 5.9 Preparar deducción Kardex si hay patties extra ───────────────
    if (extraPatties > 0 && meatPattyItem) {
      kardexDepletions.push({
        inventoryItemId: meatPattyItem.id,
        delta:           -1 * (extraPatties * finalQty),  // negativo = salida
        referenceId:     saleId,
      });
    }
  }

  console.log(`\n📋 [ETL] Transformación completa:`);
  console.log(`   - Filas procesadas:        ${dataRows.length}`);
  console.log(`   - Payloads válidos:        ${validPayloads.length}`);
  console.log(`   - Ítems sin match (DLQ):  ${unknownItems.length}`);
  console.log(`   - Filas descartadas:       ${droppedRowCount}`);

  if (validPayloads.length === 0) {
    console.error("❌ [ABORT] Ningún payload válido. Verificar CSV y catálogo MDM.");
    if (unknownItems.length > 0) {
      console.log("\n🛑 MUESTRA DLQ (sin match en catálogo):");
      [...new Set(unknownItems)].slice(0, 20).forEach((u) => console.log(`   - ${u}`));
    }
    process.exit(1);
  }

  // ── 6. ACID Chunking: Insert en Lotes de BATCH_SIZE ─────────────────────
  console.log(`\n🔥 [DB] Iniciando ingesta ACID en lotes de ${BATCH_SIZE}...`);

  let totalInserted  = 0;
  let totalKardex    = 0;
  const totalBatches = Math.ceil(validPayloads.length / BATCH_SIZE);

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const start   = batchIdx * BATCH_SIZE;
    const end     = Math.min(start + BATCH_SIZE, validPayloads.length);
    const batch   = validPayloads.slice(start, end);
    const batchNum = batchIdx + 1;

    // Depletions de Kardex correspondientes a este lote
    const batchSaleIds   = new Set(batch.map((p) => p.id));
    const batchDepletions = kardexDepletions.filter((k) => batchSaleIds.has(k.referenceId));

    try {
      // ── TRANSACCIÓN ACID ────────────────────────────────────────────────
      await db.transaction(async (tx) => {
        // INSERT fact_sales (ignora duplicados por ticket_hash)
        const inserted = await tx
          .insert(schema.fact_sales)
          .values(batch)
          .onConflictDoNothing()
          .returning({ insertedId: schema.fact_sales.id });

        totalInserted += inserted.length;

        // DEDUCCIÓN Kardex para patties extra del lote
        for (const dep of batchDepletions) {
          // Upsert: si existe el registro de kardex → acumula; si no → crea
          await tx
            .insert(schema.inventory_kardex)
            .values({
              id:          `KDX_${randomUUID().substring(0, 12).toUpperCase()}`,
              storeId:     STORE_ID,
              productSku:  dep.inventoryItemId,
              quantity:    dep.delta,              // negativo = consumo
              referenceId: dep.referenceId,
            })
            .onConflictDoNothing();

          // También actualiza current_stock en inventory_items
          await tx
            .update(inventory_items)
            .set({
              current_stock: sql`${inventory_items.current_stock} + ${dep.delta}`,
            })
            .where(eq(inventory_items.id, dep.inventoryItemId));

          totalKardex++;
        }
      });

      console.log(`   ✅ Lote ${batchNum}/${totalBatches} → ${batch.length} filas procesadas (${batchDepletions.length} movimientos Kardex)`);

    } catch (batchErr: unknown) {
      // Fail-Closed: error en el lote → log + continuar (la tx ya hizo rollback)
      const msg = batchErr instanceof Error ? batchErr.message : String(batchErr);
      console.error(`   ❌ Lote ${batchNum}/${totalBatches} ROLLBACK: ${msg}`);
    }
  }

  // ── 7. Reporte Final ──────────────────────────────────────────────────────
  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║  BurgerMusic ETL — REPORTE FINAL V6.0               ║`);
  console.log(`╠══════════════════════════════════════════════════════╣`);
  console.log(`║  Filas en CSV:            ${String(dataRows.length).padStart(8)}                  ║`);
  console.log(`║  Insertadas (fact_sales): ${String(totalInserted).padStart(8)}                  ║`);
  console.log(`║  Movimientos Kardex:      ${String(totalKardex).padStart(8)}                  ║`);
  console.log(`║  Ítems DLQ (sin match):   ${String(unknownItems.length).padStart(8)}                  ║`);
  console.log(`║  Filas descartadas:       ${String(droppedRowCount).padStart(8)}                  ║`);
  console.log(`╚══════════════════════════════════════════════════════╝`);

  if (unknownItems.length > 0) {
    const unique = [...new Set(unknownItems)];
    console.log(`\n🛑 TOP ${Math.min(unique.length, 20)} HUÉRFANOS — Requieren mapeo en UI (OrphanageTray):`);
    unique.slice(0, 20).forEach((u) => console.log(`   ⚠  ${u}`));
    if (unique.length > 20) {
      console.log(`   ... y ${unique.length - 20} más`);
    }

    console.log(`\n🔥 [DB] Persistiendo ${unique.length} huérfanos en DLQ (sales_mapping_dlq)...`);
    
    const dlqPayloads = unique.map(rawName => ({
      id: `DLQ_${randomUUID().substring(0, 12).toUpperCase()}`,
      storeId: STORE_ID,
      raw_name: rawName,
      quantity: 1, // Fallback estéril para huérfano agrupado
      price: 0,    // Fallback estéril para huérfano agrupado
      resolved: false,
    }));

    const dlqBatches = Math.ceil(dlqPayloads.length / BATCH_SIZE);
    
    for (let i = 0; i < dlqBatches; i++) {
        const batch = dlqPayloads.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        try {
            await db.insert(schema.sales_mapping_dlq).values(batch).onConflictDoNothing();
        } catch (err: any) {
            console.error(`   ❌ Lote DLQ ${i + 1}/${dlqBatches} falló: ${err.message}`);
        }
    }
    console.log(`   ✅ DLQ Persistido exitosamente. Resuelve desde el C-Level Dashboard.`);
  }

  await libsqlClient.close();
  process.exit(0);
}

// ── Entry Point ───────────────────────────────────────────────────────────────
forceIngest().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\n💥 [PANIC] Crash fatal de ingestión: ${msg}`);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
