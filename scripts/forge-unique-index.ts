/**
 * ══════════════════════════════════════════════════════════════════════════════
 * BurgerMusic OS — Surgical DDL Injection: UNIQUE Index on sku_aliases.raw_sku
 * ══════════════════════════════════════════════════════════════════════════════
 * Bypasses Drizzle Kit's broken `push` (Schema Drift on supplier_claims_po_idx)
 * by injecting raw DDL directly into Turso/SQLite.
 *
 * Estándar Antigravity 2026 · Fail-Closed · Zero-Trust
 * ══════════════════════════════════════════════════════════════════════════════
 */

import path from "path";
import * as dotenv from "dotenv";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";

// ── Bootstrap ────────────────────────────────────────────────────────────────
dotenv.config({ path: path.join(__dirname, "../.env") });

const TURSO_URL   = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || TURSO_URL.trim() === "") {
  console.error("❌ [ENV] TURSO_DATABASE_URL no configurado. Abortando.");
  process.exit(1);
}

const libsqlClient = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN ?? undefined,
});

const db = drizzle(libsqlClient);

// ── Main ─────────────────────────────────────────────────────────────────────
async function forgeUniqueIndex(): Promise<void> {
  console.log("🔧 [DDL] Iniciando inyección quirúrgica de índice UNIQUE...");
  console.log(`   Target: sku_aliases.raw_sku`);
  console.log(`   DB:     ${TURSO_URL?.substring(0, 40)}...`);

  await db.run(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_sku_aliases_raw_sku ON sku_aliases (raw_sku);`
  );

  console.log("✅ Índice Único forjado en Turso DB. Idempotencia asegurada.");
  console.log("   ON CONFLICT ahora resolverá sin SQLITE_ERROR.");

  await libsqlClient.close();
  process.exit(0);
}

// ── Entry Point ──────────────────────────────────────────────────────────────
forgeUniqueIndex().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\n💥 [PANIC] Fallo en forja de índice: ${msg}`);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
