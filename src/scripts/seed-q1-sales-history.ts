import "dotenv/config";
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { z } from "zod";
import { db } from "../db";
import {
  products,
  transactions,
  fact_sales,
  dailyCashClosures,
} from "../db/schema";
import { TransactionExplosionEngine } from "../services/explosion-engine";
import { sql } from "drizzle-orm";

/**
 * GENESIS Q1 2026 — SCIENTIFIC SALES HISTORY SEEDING
 * ───────────────────────────────────────────────────
 * Streaming ETL for 3 months of POS ticket data.
 * Integrates BOM Explosion Engine for inventory deduction.
 * Enforces ACID batching to prevent SQLITE_BUSY.
 *
 * Standard: Antigravity 2026 (Zero-Trust)
 */

// ═══════════════════════════════════════════════════
// 1. ZERO-TRUST CLI VALIDATION
// ═══════════════════════════════════════════════════
const storeIdArg = process.argv.find((a) => a.startsWith("--store-id="));
const storeId = storeIdArg?.split("=")[1];

if (!storeId) {
  console.error("❌ SRE FATAL: Missing --store-id argument.");
  console.error(
    "Usage: npx tsx src/scripts/seed-q1-sales-history.ts --store-id=STORE001"
  );
  process.exit(1);
}

/**
 * ═══════════════════════════════════════════════════
 * 1.1. SRE ZERO-TRUST TYPE SHADOWING
 * ═══════════════════════════════════════════════════
 */
const VALID_STORE_ID: string = storeId;

console.log(`🚀 Genesis Q1 Hydration for Store: [${VALID_STORE_ID}]`);

// ═══════════════════════════════════════════════════
// 2. PRICE PARSING (Argentine Format)
// ═══════════════════════════════════════════════════
function parseArgCurrency(raw: string): number {
  if (!raw || raw.trim() === "") return 0;
  // " $ 14.800,00 " -> 1480000
  const cleaned = raw
    .replace(/\$/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")  // Remove thousands separator
    .replace(",", ".");  // Decimal separator -> JS format
  return Math.round(parseFloat(cleaned) * 100);
}

function parseArgDate(raw: string): string {
  // "2/1/2026" -> "2026-01-02"
  const parts = raw.trim().split("/");
  if (parts.length !== 3) return raw;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

// ═══════════════════════════════════════════════════
// 3. SKU NORMALIZATION (Fuzzy Matching)
// ═══════════════════════════════════════════════════
function normalizeToSku(rawName: string): string {
  let name = rawName.trim().toUpperCase();

  // Collapse known synonyms to canonical SKUs
  const synonymMap: Record<string, string> = {
    "CLASIC DOBLE 220G": "CLASSIC",
    "CLASIC SIMPLE 110G": "CLASSIC",
    "CLASIC TRIPLE 330G": "CLASSIC",
    "CLASSIC DOBLE 220G": "CLASSIC",
    "CLASSIC SIMPLE 110G": "CLASSIC",
    "ACDC DOBLE": "AC/DC",
    "ACDC SIMPLE": "AC/DC",
    "ACDC TRIPLE": "AC/DC",
    "MALA FAMA DOBLE 220G": "MALA FAMA",
    "MALA FAMA SIMPLE 110G": "MALA FAMA",
    "MALA FAMA TRIPLE 330G": "MALA FAMA",
    "HC DOBLE": "HC (HERNÁN CATTÁNEO)",
    "HC SIMPLE": "HC (HERNÁN CATTÁNEO)",
    "HC TRIPLE": "HC (HERNÁN CATTÁNEO)",
    "CHARLY DOBLE 220G": "CHARLY",
    "CHARLY SIMPLE 110G": "CHARLY",
    "CHARLY TRIPLE 330G": "CHARLY",
    "BEATLE DOBLE 220G": "THE BEATLES",
    "BEATLE SIMPLE 110G": "THE BEATLES",
    "BEATLE TRIPLE": "THE BEATLES",
    "RED HOT DOBLE": "RED HOT",
    "RED HOT SIMPLE 110G": "RED HOT",
    "RED HOT TRIPLE 330G": "RED HOT",
    "RESIDENTE DOBLE": "RESIDENTE",
    "RESIDENTE SIMPLE": "RESIDENTE",
    "ROLLING STONE DOBLE 220G": "ROLLING STONES",
    "ROLLING STONE SIMPLE 110G": "ROLLING STONES",
    "ROLLING STONE TRIPLE": "ROLLING STONES",
    "GORILLAZ DOBLE": "GORILLAZ",
    "GORILLAZ SIMPLE": "GORILLAZ",
    "GORILLAZ TRIPLE": "GORILLAZ",
    "DUKO DOBLE": "DUKO",
    "DUKO SIMPLE": "DUKO",
    "DUKO TRIPLE 330G": "DUKO",
    "KISS DOBLE": "KISS",
    "KISS SIMPLE": "KISS",
    "KISS TRIPLE": "KISS",
    "BOB MARLEY DOBLE": "BOB MARLEY",
    "BOB MARLEY SIMPLE": "BOB MARLEY",
    "BOB MARLEY TRIPLE": "BOB MARLEY",
    "FRIED ONION DOBLE 220G": "FRIED ONION",
    "FRIED ONION SIMPLE 110G": "FRIED ONION",
    "TECHNO CHICKEN DOBLE": "TECHNO CHICKEN",
    "TECHNO CHICKEN": "TECHNO CHICKEN",
    "PATRICIO REY DOBLE": "PATRICIO REY",
    "PATRICIO REY SIMPLE": "PATRICIO REY",
    "MADONNA VEGGIE": "MADONNA VEGGIE",
    "BIZARRAP SESSION #1": "BIZARRAP SESSION #1",
    "BIZZARAP SESSION #2": "BIZARRAP SESSION #2",
    "2 TOSTADOS AMERICANOS": "X2 TOSTADO AMERICANO",
    "2 TOSTADOS CLASSIC": "X2 TOSTADO CLASICO",
    "AMERICANO + LEVITE": "TOSTADO AMERICANO + LEVITE",
    "CLASICO + LEVITE": "TOSTADO CLASICO + LEVITE",
    "PAPAS QUEEN": "PAPAS QUEEN",
    "PAPAS CON CHEDDAR": "PAPAS CHEDDAR",
    "PAPAS MERCURY": "PAPAS MERCURY",
    "COCA COLA 1.5 LTS": "COCA COLA 1.5 LTS",
    "COCA COLA ZERO 1.5 LTS": "COCA COLA ZERO 1.5 LTS",
    "SPRITE 1.5L": "SPRITE 1.5 LTS",
    "COCA 500 ML": "LATA COCA-COLA 354CC",
    "SPRITE 500 ML": "LATA SPRITE 354CC",
    "FANTA 500 ML": "LATA SPRITE 354CC",
    "AGUA 500CC": "VILLAVICENCIO 500CC",
    "LEVITE 500ML": "LEVITE DE NARANJA 500ML",
    "LATON HEINEKEN": "CERVEZA HEINEKEN LATA 473CC",
    "HEINEKEN 464ML": "CERVEZA HEINEKEN LATA 473CC",
    "STELLA ARTOIS 464ML": "STELLA ARTOIS LATA",
    "ANDES RUBIA": "ANDES RUBIA LATA 473CC",
    "CERVEZA ANDES IPA": "ANDES IPA LATA 473CC",
    "CERVEZA ANDES ROJA": "ANDES ROJA LATA 473CC",
    "LATA SCHWEPPES POMELO ZERO": "LATA SCHWEPPES POMELO ZERO",
    "LEVITE DE POMELO 1,5 L": "LEVITE DE POMELO 1.5LT",
    "LEVITE DE MANZANA 1.5 LTS": "LEVITE DE MANZANA 1.5 LTS",
    "NUGGETS X12 + PAPAS + BBQ": "NUGGETS DE POLLO + PAPAS",
    "AROS DE CEBOLLA X 12 + PAPAS + BBQ": "AROS DE CEBOLLA + PAPAS",
    "KIDS ROCK  (RICOSAURIO X 4+ PAPAS )": "KIDS ROCK",
    "FRANUI CHOCOLATE CON LECHE + CHOCOLATE BLANCO": "FRANUI",
    "FRANUI CHOCOLATE SEMIAMARGO + CHOCOLATE BLANCO": "FRANUI",
    "EMPANADA DE CARNE": "CARNE",
    "EMPANADA DE POLLO": "POLLO",
    "EMPANADA DE JAMON Y QUESO": "JAMON Y QUESO",
    "EMPANADA DE CEBOLLA Y QUESO": "CEBOLLA Y QUESO",
    "JOHN LENNON MEDIANA": "JOHN LENNON",
    "JOHN LENNON XL": "JOHN LENNON",
    "MICHAEL JACKSON MEDIANA": "MICHAEL JACKSON",
    "MICHAEL JACKSON XL": "MICHAEL JACKSON",
    "PINK FLOYD MEDIANA": "PINK FLOYD",
    "PINK FLOYD XL": "PINK FLOYD",
    "CREEDENCE MEDIANA": "CREEDENCE",
    "CREEDENCE XL": "CREEDENCE",
    "MICK JAGGER MEDIANA": "MICK JAGGER MEDIANA",
    "ELVIS PRESLEY MEDIANA": "ELVIS PRESLEY",
    "ELVIS PRESLEY XL": "ELVIS PRESLEY",
    "FREDDIE MERCURY": "FREDDIE MERCURY",
    "PROMO 1 -- 4 X CLASSIC SIMPLE": "CLASSIC",
    "PROMO 2-- 2 X CHARLY DOBLE": "CHARLY",
  };

  // Check for exact match first (trim spaces from known keys)
  for (const [key, val] of Object.entries(synonymMap)) {
    if (name === key || name.startsWith(key)) {
      return `PROD-${val.replace(/\s+/g, "-")}`;
    }
  }

  // Fallback: generate SKU from raw name
  return `PROD-${name.replace(/\s+/g, "-")}`;
}

// ═══════════════════════════════════════════════════
// 4. ITEMS TO SKIP (Non-product lines)
// ═══════════════════════════════════════════════════
const SKIP_ITEMS = new Set([
  "ENVIO",
  "MESA",
  "DIP DE CHEDDAR",
  "DIP DE BARBACOA",
  "CAMBIO X DIP CHEDDAR",
  "PORCION EXTRA DE PAPAS MEDIANAS",
  "PORCION DE FAINA",
  "EXTRA CHEDDAR",
  "FERNET",
  "GIN TONIC",
  "GANCIA",
  "CHOCOTORTA",
  "TIRAMISU",
  "HIP HOP",
  "NIRVANA",
  "NIRVANA 2",
  "AROS DE CEBOLLA 6 UNID.",
  "NUGGET'S X6",
  "6 EMPANADAS",
  "12 EMPANADAS",
  "3 EMPANADAS",
  "LATA COCA-COLA ZERO",
]);

// ═══════════════════════════════════════════════════
// 5. STREAMING CSV PARSER (Carry-Forward Pattern)
// ═══════════════════════════════════════════════════
interface SaleLineItem {
  date: string;       // ISO format YYYY-MM-DD
  nroCaja: string;
  rawName: string;
  quantity: number;
  priceCents: number;
}

async function streamSalesCSV(filePath: string): Promise<SaleLineItem[]> {
  return new Promise((resolve, reject) => {
    const items: SaleLineItem[] = [];
    let currentDate = "";
    let currentCaja = "";
    let isFirstRow = true;

    const fileStream = fs.createReadStream(filePath);
    Papa.parse(fileStream, {
      delimiter: ";",
      header: false,
      skipEmptyLines: true,
      step: (result) => {
        const row = result.data as string[];

        // Skip header row
        if (isFirstRow) { isFirstRow = false; return; }

        const [fechaCaja, nroCaja, descripcion, cantidad, precio] = row.map(
          (c) => c?.trim() || ""
        );

        if (fechaCaja) currentDate = parseArgDate(fechaCaja);
        if (nroCaja) currentCaja = nroCaja;
        if (!descripcion) return;

        const upperName = descripcion.trim().toUpperCase();
        if (SKIP_ITEMS.has(upperName)) return;
        if (!cantidad && !precio) return;

        const qty = cantidad ? parseInt(cantidad, 10) : 1;
        if (qty <= 0 || isNaN(qty)) return;

        const priceCents = parseArgCurrency(precio);

        items.push({
          date: currentDate,
          nroCaja: currentCaja,
          rawName: descripcion.trim(),
          quantity: qty,
          priceCents,
        });
      },
      complete: () => resolve(items),
      error: (error) => reject(error),
    });
  });
}

// ═══════════════════════════════════════════════════
// 6. DINAMICA CSV PARSER (Cash Closures)
// ═══════════════════════════════════════════════════
interface CashClosure {
  date: string;
  nroCaja: string;
  shift: string;
  importeApertura: number;
  importeCierre: number;
  diferencias: number;
  importeEnCaja: number;
}

async function streamDinamicaCSV(filePath: string): Promise<CashClosure[]> {
  return new Promise((resolve, reject) => {
    const closures: CashClosure[] = [];
    let currentDate = "";
    let lineNum = 0;

    const fileStream = fs.createReadStream(filePath);
    Papa.parse(fileStream, {
      delimiter: ";",
      header: false,
      skipEmptyLines: true,
      step: (result) => {
        lineNum++;
        if (lineNum < 7) return; // Skip multi-headers

        const row = result.data as string[];
        const [fechaCaja, nroCaja, turno, apertura, cierre, diferencias, enCaja] =
          row.map((c) => c?.trim() || "");

        if (fechaCaja === "Total general") return;
        if (fechaCaja) currentDate = parseArgDate(fechaCaja);
        if (!nroCaja) return;

        closures.push({
          date: currentDate,
          nroCaja,
          shift: turno || "Noche",
          importeApertura: parseInt(apertura || "0", 10),
          importeCierre: parseInt(cierre || "0", 10),
          diferencias: parseInt(diferencias || "0", 10),
          importeEnCaja: parseInt(enCaja || "0", 10),
        });
      },
      complete: () => resolve(closures),
      error: (error) => reject(error),
    });
  });
}

// ═══════════════════════════════════════════════════
// 7. CHUNKING UTILITY (SQLITE_BUSY Prevention)
// ═══════════════════════════════════════════════════
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ═══════════════════════════════════════════════════
// 8. MAIN ETL RUNTIME
// ═══════════════════════════════════════════════════
async function run() {
  const t0 = Date.now();

  // Phase 1: Stream Sales Data
  console.log("📥 Streaming sales CSV...");
  const salesItems = await streamSalesCSV(
    path.join(process.cwd(), "Ventas BurgerMusic 1Q.csv")
  );
  console.log(`📊 Parsed ${salesItems.length} line items.`);

  // Phase 2: Stream Cash Closures
  console.log("📥 Streaming cash closures CSV...");
  const closures = await streamDinamicaCSV(
    path.join(process.cwd(), "Dinamica_Burgermusic.csv")
  );
  console.log(`📊 Parsed ${closures.length} cash closure records.`);

  // Phase 3: Group sales by date for daily batching
  const salesByDate = new Map<string, SaleLineItem[]>();
  for (const item of salesItems) {
    if (!salesByDate.has(item.date)) salesByDate.set(item.date, []);
    salesByDate.get(item.date)!.push(item);
  }

  const dateKeys = Array.from(salesByDate.keys()).sort();
  console.log(`📅 ${dateKeys.length} operational days to process.`);

  // Phase 4: Process each day in batched transactions
  let totalProcessed = 0;
  let totalBomExplosions = 0;
  let totalDlqRedirected = 0;
  const BATCH_SIZE = 50;

  for (let dayIdx = 0; dayIdx < dateKeys.length; dayIdx++) {
    const date = dateKeys[dayIdx];
    const dayItems = salesByDate.get(date)!;
    const chunks = chunkArray(dayItems, BATCH_SIZE);
    const dayStart = Date.now();

    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci];
      const chunkStart = Date.now();

      await db.transaction(async (tx) => {
        for (const item of chunk) {
          const sku = normalizeToSku(item.rawName);
          const unitPriceCents = item.quantity > 0
            ? Math.round(item.priceCents / item.quantity)
            : item.priceCents;

          // 8a. DEFENSIVE PRODUCT MIRRORING (FK Integrity)
          await tx.insert(products).values({
            id: sku,
            sku: sku,
            name: item.rawName.toUpperCase(),
            category: "POS_IMPORT",
            item_type: "MANUFACTURED",
            isSaleable: true,
            base_price_cents: unitPriceCents,
            sellingPrice: unitPriceCents,
          }).onConflictDoNothing();

          // 8b. Insert parent SALE transaction
          const [txRecord] = await tx
            .insert(transactions)
            .values({
              date: item.date,
              type: "SALE",
              productSku: sku,
              quantity: -Math.abs(item.quantity),
              costCentsAtTime: unitPriceCents,
              referenceId: `CAJA-${item.nroCaja}`,
              notes: `ETL Genesis Q1: ${item.rawName}`,
              storeId: VALID_STORE_ID,
            })
            .returning({ id: transactions.id });

          if (!txRecord?.id) {
            throw new Error("SRE FATAL: Failed to obtain txId for Genesis SALE. Atomicity compromised.");
          }

          // 8c. Insert fact_sales ledger row
          await tx.insert(fact_sales).values({
            id: crypto.randomUUID(),
            storeId: VALID_STORE_ID,
            date: item.date,
            shift: "FULL",
            raw_name: item.rawName,
            productSku: sku,
            quantity: item.quantity,
            net_price_cents: item.priceCents,
          });

          // 8d. BOM EXPLOSION (Fire recipe engine - Fail-Safe)
          try {
            await TransactionExplosionEngine.explode(
              txRecord.id,
              VALID_STORE_ID,
              [
                {
                  sku,
                  quantity: item.quantity,
                  unitPriceCents,
                },
              ],
              tx
            );
            totalBomExplosions++;
          } catch (err: any) {
            // MissingRecipeException -> DLQ redirect (handled by engine)
            totalDlqRedirected++;
          }

          totalProcessed++;
        }
      });

      const latency = Date.now() - chunkStart;
      console.log(
        `[INFO] Lote ${ci + 1}/${chunks.length} procesado - Fecha: ${date} - Latencia: ${latency}ms`
      );
    }

    // Phase 5: Daily Reconciliation (Cross with Dinamica)
    const dayClosures = closures.filter((c) => c.date === date);
    const daySalesTotal = dayItems.reduce((sum, i) => sum + i.priceCents, 0);

    for (const closure of dayClosures) {
      const closureTotalCents = closure.importeCierre * 100;
      const theoreticalVariance = closureTotalCents - daySalesTotal;

      await db.insert(dailyCashClosures).values({
        date,
        day: new Date(date).toLocaleDateString("es-AR", { weekday: "long" }),
        zClose: closure.importeCierre,
        shift: closure.shift,
        totalCash: closure.importeEnCaja,
        totalGlobal: closure.importeCierre,
        variance: closure.diferencias,
        storeId: VALID_STORE_ID,
        sheetMonth: `Q1-2026`,
      });
    }

    const dayLatency = Date.now() - dayStart;
    console.log(
      `✅ [${dayIdx + 1}/${dateKeys.length}] Day ${date} complete | Items: ${dayItems.length} | Latency: ${dayLatency}ms`
    );
  }

  const totalTime = Date.now() - t0;
  console.log(`\n════════════════════════════════════════`);
  console.log(`🏁 GENESIS Q1 HYDRATION COMPLETE`);
  console.log(`   Total Items:         ${totalProcessed}`);
  console.log(`   BOM Explosions:      ${totalBomExplosions}`);
  console.log(`   DLQ Redirected:      ${totalDlqRedirected}`);
  console.log(`   Cash Closures:       ${closures.length}`);
  console.log(`   Total Time:          ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`════════════════════════════════════════\n`);
}

run().catch((err) => {
  console.error("❌ FATAL HYDRATION FAILURE:", err);
  process.exit(1);
});
