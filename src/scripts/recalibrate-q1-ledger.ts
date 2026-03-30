import "dotenv/config";
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { db } from "../db";
import {
  products,
  transactions,
  fact_sales,
  dailyCashClosures,
  inventory_kardex,
  sales_mapping_dlq,
} from "../db/schema";
import { TransactionExplosionEngine } from "../services/explosion-engine";
import { eq, sql } from "drizzle-orm";

/**
 * RETROACTIVE LEDGER REPLAY — Q1 TIME-TRAVEL
 * ────────────────────────────────────────────
 * Purges stale Q1 data with $0 costs and replays
 * every ticket through the corrected BOM engine.
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
    "Usage: npx tsx src/scripts/recalibrate-q1-ledger.ts --store-id=STORE001"
  );
  process.exit(1);
}

/**
 * ═══════════════════════════════════════════════════
 * 1.1. SRE ZERO-TRUST TYPE SHADOWING
 * ═══════════════════════════════════════════════════
 */
const VALID_STORE_ID: string = storeId;

console.log(`🔁 RETROACTIVE LEDGER REPLAY — Store: [${VALID_STORE_ID}]\n`);

// ═══════════════════════════════════════════════════
// 2. PRICE & DATE PARSING (Argentine Format)
// ═══════════════════════════════════════════════════
function parseArgCurrency(raw: string): number {
  if (!raw || raw.trim() === "") return 0;
  const cleaned = raw
    .replace(/\$/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Math.round(parseFloat(cleaned) * 100);
}

function parseArgDate(raw: string): string {
  const parts = raw.trim().split("/");
  if (parts.length !== 3) return raw;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

// ═══════════════════════════════════════════════════
// 3. SKU NORMALIZATION (Mirror of Q1 seeder)
// ═══════════════════════════════════════════════════
function normalizeToSku(rawName: string): string {
  let name = rawName.trim().toUpperCase();

  const synonymMap: Record<string, string> = {
    "CLASIC DOBLE 220G": "CLASSIC", "CLASIC SIMPLE 110G": "CLASSIC",
    "CLASIC TRIPLE 330G": "CLASSIC", "CLASSIC DOBLE 220G": "CLASSIC",
    "CLASSIC SIMPLE 110G": "CLASSIC",
    "ACDC DOBLE": "AC/DC", "ACDC SIMPLE": "AC/DC", "ACDC TRIPLE": "AC/DC",
    "MALA FAMA DOBLE 220G": "MALA FAMA", "MALA FAMA SIMPLE 110G": "MALA FAMA",
    "MALA FAMA TRIPLE 330G": "MALA FAMA",
    "HC DOBLE": "HC", "HC SIMPLE": "HC", "HC TRIPLE": "HC",
    "CHARLY DOBLE 220G": "CHARLY", "CHARLY SIMPLE 110G": "CHARLY",
    "CHARLY TRIPLE 330G": "CHARLY",
    "BEATLE DOBLE 220G": "THE BEATLES", "BEATLE SIMPLE 110G": "THE BEATLES",
    "BEATLE TRIPLE": "THE BEATLES",
    "RED HOT DOBLE": "RED HOT", "RED HOT SIMPLE 110G": "RED HOT",
    "RED HOT TRIPLE 330G": "RED HOT",
    "RESIDENTE DOBLE": "RESIDENTE", "RESIDENTE SIMPLE": "RESIDENTE",
    "ROLLING STONE DOBLE 220G": "ROLLING STONES",
    "ROLLING STONE SIMPLE 110G": "ROLLING STONES",
    "ROLLING STONE TRIPLE": "ROLLING STONES",
    "GORILLAZ DOBLE": "GORILLAZ", "GORILLAZ SIMPLE": "GORILLAZ",
    "GORILLAZ TRIPLE": "GORILLAZ",
    "DUKO DOBLE": "DUKO", "DUKO SIMPLE": "DUKO", "DUKO TRIPLE 330G": "DUKO",
    "KISS DOBLE": "KISS", "KISS SIMPLE": "KISS", "KISS TRIPLE": "KISS",
    "BOB MARLEY DOBLE": "BOB MARLEY", "BOB MARLEY SIMPLE": "BOB MARLEY",
    "FRIED ONION DOBLE 220G": "FRIED ONION", "FRIED ONION SIMPLE 110G": "FRIED ONION",
    "TECHNO CHICKEN DOBLE": "TECHNO CHICKEN", "TECHNO CHICKEN": "TECHNO CHICKEN",
    "PATRICIO REY DOBLE": "PATRICIO REY", "PATRICIO REY SIMPLE": "PATRICIO REY",
    "MADONNA VEGGIE": "MADONNA VEGGIE",
    "BIZARRAP SESSION #1": "BIZARRAP SESSION #1",
    "BIZZARAP SESSION #2": "BIZARRAP SESSION #2",
    "2 TOSTADOS AMERICANOS": "X2 TOSTADO AMERICANO",
    "2 TOSTADOS CLASSIC": "X2 TOSTADO CLASICO",
    "AMERICANO + LEVITE": "TOSTADO AMERICANO + LEVITE",
    "CLASICO + LEVITE": "TOSTADO CLASICO + LEVITE",
    "PAPAS QUEEN": "PAPAS QUEEN", "PAPAS CON CHEDDAR": "PAPAS CHEDDAR",
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
    "PROMO 1 -- 4 X CLASSIC SIMPLE": "CLASSIC",
    "PROMO 2-- 2 X CHARLY DOBLE": "CHARLY",
  };

  for (const [key, val] of Object.entries(synonymMap)) {
    if (name === key || name.startsWith(key)) {
      return `PROD-${val.replace(/\s+/g, "-")}`;
    }
  }
  return `PROD-${name.replace(/\s+/g, "-")}`;
}

// ═══════════════════════════════════════════════════
// 4. SKIP SET (Non-product lines)
// ═══════════════════════════════════════════════════
const SKIP_ITEMS = new Set([
  "ENVIO", "MESA", "DIP DE CHEDDAR", "DIP DE BARBACOA",
  "CAMBIO X DIP CHEDDAR", "PORCION EXTRA DE PAPAS MEDIANAS",
  "PORCION DE FAINA", "EXTRA CHEDDAR", "FERNET", "GIN TONIC",
  "GANCIA", "CHOCOTORTA", "TIRAMISU", "HIP HOP", "NIRVANA",
  "NIRVANA 2", "AROS DE CEBOLLA 6 UNID.", "NUGGET'S X6",
  "6 EMPANADAS", "12 EMPANADAS", "3 EMPANADAS", "LATA COCA-COLA ZERO",
]);

// ═══════════════════════════════════════════════════
// 5. STREAMING CSV PARSERS
// ═══════════════════════════════════════════════════
interface SaleLineItem {
  date: string;
  nroCaja: string;
  rawName: string;
  quantity: number;
  priceCents: number;
}

interface CashClosure {
  date: string;
  nroCaja: string;
  shift: string;
  importeCierre: number;
  diferencias: number;
  importeEnCaja: number;
}

async function streamSalesCSV(filePath: string): Promise<SaleLineItem[]> {
  return new Promise((resolve, reject) => {
    const items: SaleLineItem[] = [];
    let currentDate = "";
    let currentCaja = "";
    let isFirstRow = true;

    Papa.parse(fs.createReadStream(filePath), {
      delimiter: ";",
      header: false,
      skipEmptyLines: true,
      step: (result) => {
        const row = result.data as string[];
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

        items.push({
          date: currentDate,
          nroCaja: currentCaja,
          rawName: descripcion.trim(),
          quantity: qty,
          priceCents: parseArgCurrency(precio),
        });
      },
      complete: () => resolve(items),
      error: (error) => reject(error),
    });
  });
}

async function streamDinamicaCSV(filePath: string): Promise<CashClosure[]> {
  return new Promise((resolve, reject) => {
    const closures: CashClosure[] = [];
    let currentDate = "";
    let lineNum = 0;

    Papa.parse(fs.createReadStream(filePath), {
      delimiter: ";",
      header: false,
      skipEmptyLines: true,
      step: (result) => {
        lineNum++;
        if (lineNum < 7) return;

        const row = result.data as string[];
        const [fechaCaja, nroCaja, turno, , cierre, diferencias, enCaja] =
          row.map((c) => c?.trim() || "");

        if (fechaCaja === "Total general") return;
        if (fechaCaja) currentDate = parseArgDate(fechaCaja);
        if (!nroCaja) return;

        closures.push({
          date: currentDate,
          nroCaja,
          shift: turno || "Noche",
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
// 6. CHUNK UTILITY
// ═══════════════════════════════════════════════════
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ═══════════════════════════════════════════════════
// 7. MAIN ETL RUNTIME
// ═══════════════════════════════════════════════════
async function run() {
  const t0 = Date.now();

  // Phase 1: Stream CSVs
  console.log("[INFO] Streaming Ventas CSV...");
  const salesItems = await streamSalesCSV(
    path.join(process.cwd(), "Ventas BurgerMusic 1Q.csv")
  );
  console.log(`[INFO] ${salesItems.length} line items parsed.`);

  console.log("[INFO] Streaming Dinamica CSV...");
  const closures = await streamDinamicaCSV(
    path.join(process.cwd(), "Dinamica_Burgermusic.csv")
  );
  console.log(`[INFO] ${closures.length} cash closure records parsed.\n`);

  // ═════════════════════════════════════════════════
  // Phase 2: CLEAN SLATE (Purge stale data)
  // ═════════════════════════════════════════════════
  console.log("[INFO] Purgando Ledger Histórico...");

  // Disable FK checks for safe cascading purge
  await db.run(sql`PRAGMA foreign_keys = OFF`);

  await db.delete(inventory_kardex).where(eq(inventory_kardex.storeId, VALID_STORE_ID));
  console.log("[INFO] ✓ inventory_kardex purgado.");

  // Delete transaction_items (child of transactions)
  await db.run(sql`DELETE FROM transaction_items WHERE transaction_id IN (SELECT id FROM transactions WHERE store_id = ${VALID_STORE_ID})`);
  console.log("[INFO] ✓ transaction_items purgado.");

  await db.delete(transactions).where(eq(transactions.storeId, VALID_STORE_ID));
  console.log("[INFO] ✓ transactions purgado.");

  await db.delete(fact_sales).where(eq(fact_sales.storeId, VALID_STORE_ID));
  console.log("[INFO] ✓ fact_sales purgado.");

  await db.delete(dailyCashClosures).where(eq(dailyCashClosures.storeId, VALID_STORE_ID));
  console.log("[INFO] ✓ daily_cash_closures purgado.");

  await db.delete(sales_mapping_dlq);
  console.log("[INFO] ✓ sales_mapping_dlq purgado.");

  // Re-enable FK checks
  await db.run(sql`PRAGMA foreign_keys = ON`);

  console.log("[INFO] Ledger limpio. Iniciando re-ingesta con costos reales.\n");

  // ═════════════════════════════════════════════════
  // Phase 3: RE-INGEST with BOM Explosion
  // ═════════════════════════════════════════════════
  const salesByDate = new Map<string, SaleLineItem[]>();
  for (const item of salesItems) {
    if (!salesByDate.has(item.date)) salesByDate.set(item.date, []);
    salesByDate.get(item.date)!.push(item);
  }

  const dateKeys = Array.from(salesByDate.keys()).sort();
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

          // Defensive product mirror
          await tx.insert(products).values({
            id: sku, sku, name: item.rawName.toUpperCase(),
            category: "POS_IMPORT", item_type: "MANUFACTURED", isSaleable: true,
            base_price_cents: unitPriceCents, sellingPrice: unitPriceCents,
          }).onConflictDoNothing();

          // Insert SALE transaction
          const [txRecord] = await tx
            .insert(transactions)
            .values({
              date: item.date,
              type: "SALE",
              productSku: sku,
              quantity: -Math.abs(item.quantity),
              costCentsAtTime: unitPriceCents,
              referenceId: `CAJA-${item.nroCaja}`,
              notes: `REPLAY Q1: ${item.rawName}`,
              storeId: VALID_STORE_ID,
            })
            .returning({ id: transactions.id });

          if (!txRecord?.id) {
            throw new Error("SRE FATAL: Failed to obtain txId for SALE transaction. Atomicity compromised.");
          }

          // Insert fact_sales
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

          // BOM EXPLOSION (Now with real costs & UOM)
          try {
            await TransactionExplosionEngine.explode(
              txRecord.id,
              VALID_STORE_ID,
              [{ sku, quantity: item.quantity, unitPriceCents }],
              tx
            );
            totalBomExplosions++;
          } catch {
            totalDlqRedirected++;
          }

          totalProcessed++;
        }
      });

      const latency = Date.now() - chunkStart;
      console.log(
        `[INFO] Re-ingestando Lote ${ci + 1}/${chunks.length} - Fecha: ${date} - Kardex actualizado con costos reales. Latencia: ${latency}ms`
      );
    }

    // ═════════════════════════════════════════════════
    // Phase 4: Daily Cash Closure Reconciliation
    // ═════════════════════════════════════════════════
    const dayClosures = closures.filter((c) => c.date === date);

    for (const closure of dayClosures) {
      await db.insert(dailyCashClosures).values({
        date,
        day: new Date(date).toLocaleDateString("es-AR", { weekday: "long" }),
        zClose: closure.importeCierre,
        shift: closure.shift,
        totalCash: closure.importeEnCaja,
        totalGlobal: closure.importeCierre,
        variance: closure.diferencias,
        storeId: VALID_STORE_ID,
        sheetMonth: "Q1-2026-REPLAY",
      });
    }

    const dayLatency = Date.now() - dayStart;
    console.log(
      `✅ [${dayIdx + 1}/${dateKeys.length}] Day ${date} replayed | Items: ${dayItems.length} | Latency: ${dayLatency}ms`
    );
  }

  // ═════════════════════════════════════════════════
  // Phase 5: Final Report
  // ═════════════════════════════════════════════════
  const totalTime = Date.now() - t0;
  console.log(`\n════════════════════════════════════════`);
  console.log(`🏁 RETROACTIVE LEDGER REPLAY COMPLETE`);
  console.log(`   Total Items:         ${totalProcessed}`);
  console.log(`   BOM Explosions:      ${totalBomExplosions}`);
  console.log(`   DLQ Redirected:      ${totalDlqRedirected}`);
  console.log(`   Cash Closures:       ${closures.length}`);
  console.log(`   Total Time:          ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`════════════════════════════════════════\n`);
}

run().catch((err) => {
  console.error("❌ FATAL REPLAY FAILURE:", err);
  process.exit(1);
});
