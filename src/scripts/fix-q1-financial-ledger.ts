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
  recipe_items,
} from "../db/schema";
import { TransactionExplosionEngine } from "../services/explosion-engine";
import { eq, sql, inArray } from "drizzle-orm";

/**
 * [SRE] FINANCIAL LEDGER ZERO-DROP — Q1 REMEDIATION
 * ────────────────────────────────────────────────
 * Achieves 100% financial consistency ($238,561,700.00).
 * Standard: Antigravity 2026 (Principal Data Engineer)
 */

// 1. CLI ARGUMENTS
const storeIdArg = process.argv.find((a) => a.startsWith("--store-id="));
const storeId = storeIdArg?.split("=")[1];

if (!storeId) {
  console.error("❌ SRE FATAL: Missing --store-id argument.");
  process.exit(1);
}

console.log(`🛡️  SRE Remediation started for Store: [${storeId}]`);

// 2. AUXILIARY FUNCTIONS
function parseArgCurrency(raw: string): number {
  if (!raw || raw.trim() === "") return 0;
  const cleaned = raw.replace(/\$/g, "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  return Math.round(parseFloat(cleaned) * 100);
}

function parseArgDate(raw: string): string {
  const parts = raw.trim().split("/");
  if (parts.length !== 3) return raw;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function normalizeToSku(rawName: string): string {
  const name = rawName.trim().toUpperCase();
  return `PROD-${name.replace(/\s+/g, "-")}`;
}

// 3. MAIN RUNTIME
async function run() {
  const startTime = Date.now();

  // A. PRE-FETCH DATA
  console.log("📥 Loading recipes data...");
  const recipesMap = new Set(
    (await db.select({ sku: recipe_items.productSku })
      .from(recipe_items)
      .where(sql`${recipe_items.deletedAt} IS NULL`))
      .map(r => r.sku)
      .filter((s): s is string => s !== null)
  );

  console.log("📥 Loading CSV files...");
  const salesFile = path.join(process.cwd(), "Ventas BurgerMusic 1Q.csv");
  const dinamicaFile = path.join(process.cwd(), "Dinamica_Burgermusic.csv");

  const salesItems = await new Promise<any[]>((res, rej) => {
    const items: any[] = [];
    let currentDate = "";
    let isFirst = true;
    Papa.parse(fs.createReadStream(salesFile), {
      delimiter: ";",
      step: (row) => {
        if (isFirst) { isFirst = false; return; }
        const [fecha, caja, desc, cant, prec] = row.data as string[];
        if (fecha) currentDate = parseArgDate(fecha);
        if (!desc) return;
        items.push({
          date: currentDate,
          caja: caja || "UNKNOWN",
          name: desc.trim(),
          qty: cant ? parseInt(cant, 10) : 1,
          priceCents: parseArgCurrency(prec),
        });
      },
      complete: () => res(items),
      error: rej,
    });
  });

  const closures = await new Promise<any[]>((res, rej) => {
    const items: any[] = [];
    let currentDate = "";
    let lineNum = 0;
    Papa.parse(fs.createReadStream(dinamicaFile), {
      delimiter: ";",
      step: (row) => {
        lineNum++;
        if (lineNum < 7) return;
        const [fecha, caja, turno, , cierre, dif, enCaja] = row.data as string[];
        if (fecha === "Total general") return;
        if (fecha) currentDate = parseArgDate(fecha);
        if (!caja) return;
        items.push({
          date: currentDate,
          caja,
          shift: turno || "Noche",
          zClose: parseInt(cierre || "0", 10),
          variance: parseInt(dif || "0", 10),
          cash: parseInt(enCaja || "0", 10),
        });
      },
      complete: () => res(items),
      error: rej,
    });
  });

  // B. ATOMIC TRANSACTION
  console.log("⚛️ Initiating global transaction...");
  await db.transaction(async (tx) => {
    // RULE 1: Controlled destruction
    await tx.run(sql`PRAGMA foreign_keys = OFF`);
    
    // Purge logic
    const sId = storeId as string;
    await tx.delete(inventory_kardex).where(eq(inventory_kardex.storeId, sId));
    await tx.run(sql`DELETE FROM transaction_items WHERE transaction_id IN (SELECT id FROM transactions WHERE store_id = ${sId})`);
    await tx.delete(transactions).where(eq(transactions.storeId, sId));
    await tx.delete(fact_sales).where(eq(fact_sales.storeId, sId));
    await tx.delete(dailyCashClosures).where(eq(dailyCashClosures.storeId, sId));
    await tx.delete(sales_mapping_dlq).where(eq(sales_mapping_dlq.storeId, sId));
    
    await tx.run(sql`PRAGMA foreign_keys = ON`);
    console.log("✅ Local purge completed.");

    // RULE 2 & 3: Ingestion
    const BATCH_SIZE = 100;
    for (let i = 0; i < salesItems.length; i += BATCH_SIZE) {
      const chunk = salesItems.slice(i, i + BATCH_SIZE);
      for (const item of chunk) {
        const sku = normalizeToSku(item.name);

        // Defensive mirroring
        await tx.insert(products).values({
          id: sku, sku, name: item.name.toUpperCase(),
          item_type: "MANUFACTURED", isSaleable: true,
          base_price_cents: item.priceCents, sellingPrice: item.priceCents,
        }).onConflictDoNothing();

        // Financial entry
        const [txRecord] = await tx.insert(transactions).values({
          date: item.date, type: "SALE", productSku: sku,
          quantity: -Math.abs(item.qty), costCentsAtTime: item.priceCents,
          referenceId: `CAJA-${item.caja}`, storeId: sId,
        }).returning({ id: transactions.id });

        await tx.insert(fact_sales).values({
          id: crypto.randomUUID(), storeId: sId, date: item.date,
          shift: "FULL", raw_name: item.name, productSku: sku,
          quantity: item.qty, net_price_cents: item.priceCents,
        });

        // BOM Logic
        try {
          if (recipesMap.has(sku)) {
            await TransactionExplosionEngine.explode(txRecord.id, sId, [
              { sku, quantity: item.qty, unitPriceCents: item.priceCents }
            ], tx);
          } else {
            // Quarantine entry
            await tx.insert(sales_mapping_dlq).values({
              id: crypto.randomUUID(),
              storeId: sId,
              raw_name: item.name,
              quantity: item.qty,
              price: item.priceCents,
              resolved: false,
            });
          }
        } catch (bomError) {
           // Rule 3: Graceful degradation - If explosion fails, we already have the financial record.
           // The TransactionExplosionEngine already inserts into DLQ on failure, 
           // but we ensure the tx continues.
           console.warn(`[WARN] BOM Explosion failed for ${sku}, item kept in ledger.`);
        }
      }
      console.log(`[INFO] Processed items: ${Math.min(i + BATCH_SIZE, salesItems.length)}/${salesItems.length}`);
    }

    // Daily Closures
    for (const closure of closures) {
      await tx.insert(dailyCashClosures).values({
        date: closure.date, zClose: closure.zClose, shift: closure.shift,
        totalCash: closure.cash, totalGlobal: closure.zClose,
        variance: closure.variance, storeId: sId, sheetMonth: "Q1-SRE-FIX",
      });
    }

    // RULE 4: Final Validation
    const [result] = await tx.select({ 
      sum: sql<number>`SUM(net_price_cents)` 
    }).from(fact_sales).where(eq(fact_sales.storeId, sId));

    const totalCalculated = Number(result?.sum || 0);
    const target = 23856170000;

    if (totalCalculated !== target) {
      console.error(`❌ SRE FATAL: Ledger discrepancy. Expected: ${target}, Got: ${totalCalculated}`);
      throw new Error("SRE FATAL: Descuadre. Rollback iniciado.");
    }

    console.log(`[INFO] Integridad Criptográfica Alcanzada: $238,561,700.00 exactos.`);
  });

  const duration = (Date.now() - startTime) / 1000;
  console.log(`⏱️  Total duration: ${duration.toFixed(2)}s`);
}

run().catch(err => {
  console.error("💀 SRE FATAL FAILURE:", err);
  process.exit(1);
});
