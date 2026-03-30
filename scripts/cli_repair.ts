import * as dotenv from "dotenv";
dotenv.config();

import { db } from "../src/db";
import { sql } from "drizzle-orm";
import * as fs from "node:fs";
import * as path from "node:path";

function normalizeToSku(name: string): string {
  return "PDR_" + name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
}

async function run() {
  console.log("[CLI-REPAIR] Starting...");
  console.log("[CLI-REPAIR] DB URL:", process.env.TURSO_DATABASE_URL?.substring(0, 30));

  // 1. Read CSV
  const csvPath = path.join(process.cwd(), "precios_menu_2026.csv");
  const raw = fs.readFileSync(csvPath, "utf-8");
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  const dataLines = lines.slice(1);
  console.log(`[CLI-REPAIR] CSV lines: ${dataLines.length}`);

  // 2. Parse
  const entries: { id: string; sku: string; name: string; category: string; priceCents: number }[] = [];
  const seenIds = new Set<string>();
  
  for (const line of dataLines) {
    const parts = line.split(",");
    if (parts.length < 3) continue;
    const category = parts[0].trim();
    const name = parts[1].trim();
    const priceCents = parseInt(parts[2].trim(), 10) * 100;
    if (!name || isNaN(priceCents)) continue;
    
    let sku = normalizeToSku(name);
    if (seenIds.has(sku)) {
      const catSuffix = normalizeToSku(category).replace("PDR_", "");
      sku = `${sku}_${catSuffix}`;
    }
    seenIds.add(sku);
    entries.push({ id: sku, sku, name, category, priceCents });
  }
  console.log(`[CLI-REPAIR] Parsed: ${entries.length} products`);

  // 3. Purge
  await db.run(sql`PRAGMA foreign_keys = OFF`);
  await db.run(sql`DELETE FROM products`);
  await db.run(sql`PRAGMA foreign_keys = ON`);
  console.log("[CLI-REPAIR] Products purged");

  // 4. Insert via raw SQL
  let inserted = 0;
  for (const e of entries) {
    try {
      await db.run(sql`
        INSERT INTO products (id, sku, name, category, selling_price, is_saleable, unit, base_price_cents, cost_cents)
        VALUES (${e.id}, ${e.sku}, ${e.name}, ${e.category}, ${e.priceCents}, 1, 'UNIDAD', ${e.priceCents}, 0)
      `);
      inserted++;
    } catch (err: any) {
      console.error(`  FAILED ${e.id}: ${err.message}`);
    }
  }
  console.log(`[CLI-REPAIR] Inserted: ${inserted}/${entries.length}`);

  // 5. Verify
  const count = await db.run(sql`SELECT count(*) as c FROM products WHERE is_saleable = 1`);
  console.log(`[CLI-REPAIR] Verification: ${JSON.stringify(count.rows[0])}`);
  
  const sample = await db.run(sql`SELECT id, name, category, selling_price FROM products LIMIT 5`);
  console.log("[CLI-REPAIR] Sample:", JSON.stringify(sample.rows, null, 2));

  process.exit(0);
}

run();
