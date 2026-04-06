"use server";

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as fs from "node:fs";
import * as path from "node:path";
import { requireManagerSession } from "@/lib/auth-action";

function normalizeToSku(name: string): string {
  return "PDR_" + name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
}

/**
 * repairProductCatalog
 * ─────────────────────────────────────────────────────────────────────────────
 * Operación Crítica: Reconstrucción total de la maestra de productos.
 * RBAC: Solo accesible para OWNER_GLOBAL (C-Level).
 */
export async function repairProductCatalog() {
  const session = await requireManagerSession();
  if (!session.success || !session.data) {
    throw new Error(session.error || "ZERO_TRUST_VIOLATION: Acceso denegado.");
  }

  // Escudo RBAC: Solo el Propietario Global puede purgar el catálogo
  if (session.data.role !== "OWNER_GLOBAL") {
    throw new Error("UNAUTHORIZED_ACCESS: Solo C-Level puede ejecutar reparaciones de catálogo.");
  }

  console.log("[REPAIR] Starting catalog repair by user:", session.data.id);

  // 1. Read the canonical CSV
  const csvPath = path.join(process.cwd(), "precios_menu_2026.csv");
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}`);
  }

  const raw = fs.readFileSync(csvPath, "utf-8");
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  
  // Skip header row
  const dataLines = lines.slice(1);
  
  if (dataLines.length === 0) {
    throw new Error("CSV has no data rows");
  }

  // 2. Parse CSV into product entries
  const entries: { id: string; sku: string; name: string; category: string; priceCents: number }[] = [];
  const seenIds = new Set<string>();

  for (const line of dataLines) {
    const parts = line.split(",");
    if (parts.length < 3) continue;

    const category = parts[0].trim();
    const name = parts[1].trim();
    const priceStr = parts[2].trim();
    const priceCents = parseInt(priceStr, 10) * 100;

    if (!name || isNaN(priceCents)) continue;

    const sku = normalizeToSku(name);
    
    let finalId = sku;
    if (seenIds.has(sku)) {
      const catSuffix = normalizeToSku(category).replace("PDR_", "");
      finalId = `${sku}_${catSuffix}`;
    }
    seenIds.add(finalId);

    entries.push({ id: finalId, sku: finalId, name, category, priceCents });
  }

  console.log(`[REPAIR] Parsed ${entries.length} products from CSV`);

  // 3. Purge existing products (disable FK checks)
  await db.run(sql`PRAGMA foreign_keys = OFF`);
  await db.run(sql`DELETE FROM products`);
  await db.run(sql`PRAGMA foreign_keys = ON`);
  console.log("[REPAIR] Table products purged");

  // 4. Insert each product using raw SQL
  let inserted = 0;
  for (const e of entries) {
    try {
      await db.run(sql`
        INSERT INTO products (id, sku, name, category, selling_price, is_saleable, unit, base_price_cents, cost_cents)
        VALUES (${e.id}, ${e.sku}, ${e.name}, ${e.category}, ${e.priceCents}, 1, 'UNIDAD', ${e.priceCents}, 0)
      `);
      inserted++;
    } catch (insertErr: any) {
      console.error(`[REPAIR] Failed to insert ${e.id}:`, insertErr.message);
    }
  }

  console.log(`[REPAIR] Inserted ${inserted}/${entries.length} products`);

  // 5. Verify
  const countResult = await db.run(sql`SELECT count(*) as c FROM products WHERE is_saleable = 1`);
  const finalCount = (countResult.rows[0] as any)?.c || 0;
  console.log(`[REPAIR] Verification: ${finalCount} saleable products in DB`);

  try {
    revalidatePath("/dashboard/supply");
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/command-center");
  } catch (_) {}

  return { 
    inserted, 
    verified: finalCount,
    message: `Catálogo reconstruido: ${inserted} productos inyectados y ${finalCount} verificados.` 
  };
}
