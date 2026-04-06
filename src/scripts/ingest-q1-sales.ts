/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║    SRE ENGINE: Time-Machine Ingestion & BOM Explosion (Backflushing)      ║
 * ║    BurgerMusic OS v4.2 — Retrospective 1Q Ingestion                       ║
 * ║                                                                           ║
 * ║    Ejecutar:  npx tsx --tsconfig tsconfig.json src/scripts/ingest-q1-sales.ts ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import "dotenv/config";
import fs from "fs";
import { resolve } from "path";
import Papa from "papaparse";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { products, inventory_kardex } from "@/db/schema";
import { bill_of_materials } from "@/db/schema/bom";

// ═══════════════════════════════════════════════════════════════════════
// § 1. BOOTSTRAP TURSO
// ═══════════════════════════════════════════════════════════════════════

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL) {
  console.error("🔴 FATAL: TURSO_DATABASE_URL no definida en .env");
  process.exit(1);
}

const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
const db = drizzle(client);

// ═══════════════════════════════════════════════════════════════════════
// § 2. TIPOS DE DATOS CSV
// ═══════════════════════════════════════════════════════════════════════

interface CsvRow {
  FechaCaja: string;
  Descripcion: string;
  "Suma de Cantidad": string;
}

// ═══════════════════════════════════════════════════════════════════════
// § 2.5 DICCIONARIO DE COERCIÓN SEMÁNTICA O(1) — POS → MDM Bridge
// ═══════════════════════════════════════════════════════════════════════

const POS_SEMANTIC_MAP: Record<string, string> = {
  // POS Variant                   → Product Catalog Canonical
  "Papas Fritas":                  "Papas con Cheddar",
  "Papas":                         "Papas con Cheddar",
  "Papas Fritas c/ Cheddar":       "Papas con Cheddar",
  "Papas c/Cheddar":               "Papas con Cheddar",
  "ACDC":                          "ACDC Doble",
  "Clasic Doble":                  "Clasic Doble 220g",
  "Clasica Doble":                 "Clasic Doble 220g",
  "Clásica Doble":                 "Clasic Doble 220g",
  "Mala Fama":                     "Mala Fama Doble 220g",
  "Mala Fama Doble":               "Mala Fama Doble 220g",
  "Charly":                        "Charly Simple 110g",
  "Charly Simple":                 "Charly Simple 110g",
};

function coercePosName(raw: string): string {
  const trimmed = raw.trim();
  for (const [key, value] of Object.entries(POS_SEMANTIC_MAP)) {
    if (key.toLowerCase() === trimmed.toLowerCase()) {
      return value;
    }
  }
  return trimmed;
}

// ═══════════════════════════════════════════════════════════════════════
// § 3. EJECUCIÓN (TIME-MACHINE BACKFLUSHING)
// ═══════════════════════════════════════════════════════════════════════

async function runTimeMachineIngestion() {
  const startTime = performance.now();
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  [SRE-ETL] Q1 TIME-MACHINE & BOM EXPLOSION INITIATED   ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const filePath = resolve(process.cwd(), "Ventas BurgerMusic 1Q.csv");
  if (!fs.existsSync(filePath)) {
    console.error(`🔴 Archivo no encontrado: ${filePath}`);
    process.exit(1);
  }

  // 1. Cargar estado de la DB (Productos y Recetas) O(1)
  const allProducts = await db.select().from(products).where(isNull(products.deletedAt)).all();
  const allBom = await db.select().from(bill_of_materials).where(isNull(bill_of_materials.deletedAt)).all();
  
  if (allProducts.length === 0) {
    console.error("🔴 Catálogo de productos vacío. Abortando SRE.");
    process.exit(1);
  }

  const csvContent = fs.readFileSync(filePath, "utf-8");
  const parsed = Papa.parse<CsvRow>(csvContent, {
    header: true,
    delimiter: ";",
    skipEmptyLines: true,
  });

  const transactions: any[] = [];
  let skippedRows = 0;
  let explodedMovements = 0;

  console.log(`[SRE-ETL] Iniciando procesamiento de ${parsed.data.length} registros (Zero-Trust)...`);

  for (const row of parsed.data) {
    const desc = row.Descripcion?.trim() || "";
    const qtySold = parseFloat(row["Suma de Cantidad"]?.replace(",", ".") || "0");
    const dateRaw = row.FechaCaja?.trim() || "";
    
    if (!desc || qtySold <= 0 || !dateRaw) {
      skippedRows++;
      continue;
    }

    // A. Semantic Coercion + Fuzzy Match: Producto
    const coercedDesc = coercePosName(desc);
    if (coercedDesc !== desc) {
      console.log(`  🔄 [COERCION] POS "${desc}" → "${coercedDesc}"`);
    }
    const matchedProduct = allProducts.find(p => p.name.toLowerCase() === coercedDesc.toLowerCase());
    if (!matchedProduct) {
      console.warn(`[SRE-WARNING] Producto no encontrado en Sales ETL: "${coercedDesc}" (raw: "${desc}"). Omitido.`);
      skippedRows++;
      continue;
    }

    // B. Obtener Receta (BOM)
    const recipe = allBom.filter(b => b.parentId === matchedProduct.id);
    if (recipe.length === 0) {
      console.warn(`[SRE-WARNING] Producto sin receta (BOM): "${matchedProduct.name}". Explosion imposible. Omitido.`);
      skippedRows++;
      continue;
    }

    // C. Reconstruir Fecha (Time-Machine)
    let historicalDate = new Date().toISOString();
    // Intento de parseo de 'DD/MM/YYYY' o 'YYYY-MM-DD'
    if (dateRaw.includes("/")) {
      const parts = dateRaw.split(/[ /]/);
      if (parts.length >= 3) {
        // DD/MM/YYYY
        historicalDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00Z`).toISOString();
      }
    } else {
      historicalDate = new Date(dateRaw).toISOString();
    }
    
    // Fallback if invalid date
    if (isNaN(Date.parse(historicalDate))) {
      historicalDate = new Date().toISOString();
    }

    // D. Explosion BOM & Encolamiento Transaccional
    for (const item of recipe) {
      if (!item.childId) continue;
      
      const explodedQty = item.quantity * qtySold;
      
      transactions.push({
        id: `KX-${randomUUID().substring(0,16)}`,
        storeId: "STR_DEFAULT", // O hardcode del store principal (asumido por el scope del script)
        productSku: item.childId,
        movementType: "SALE",        // Representa consumo atómico por venta
        quantity: -explodedQty,      // Deducción exacta de gramos/unidades
        referenceId: `ETL-Q1-${matchedProduct.id}`,
        updatedAt: historicalDate,   // TIME-MACHINE OVERRIDE
      });
      
      explodedMovements++;
    }
  }

  // 4. Inserción Batch (Agrupada de a 500 para proteger Memoria SQLite)
  console.log(`\n[SRE-ETL] Explosion completada. Impactando Kardex (${explodedMovements} movimientos)...`);
  
  const CHUNK_SIZE = 500;
  let batchCount = 0;
  
  for (let i = 0; i < transactions.length; i += CHUNK_SIZE) {
    const chunk = transactions.slice(i, i + CHUNK_SIZE);
    // @ts-ignore
    await db.insert(inventory_kardex).values(chunk);
    batchCount++;
  }

  const elapsed = Math.round(performance.now() - startTime);

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  [SRE-ETL] REPORTE DE INGESTA RETROSPECTIVA            ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  🛒 Ventas Cursadas (BOM Exploded): ${transactions.length / (allBom.length || 1)} (aprox)`);
  console.log(`  💥 Movimientos ACID Inyectados:    ${explodedMovements}`);
  console.log(`  ⚠️  Filas Skippeadas SRE:          ${skippedRows}`);
  console.log(`  ⏱️  Latencia Total:                ${elapsed}ms | Batches: ${batchCount}`);
  console.log(`\n✅ Exit Code 0. Motor de Burn Rate alimentado con Q1.\n`);
}

runTimeMachineIngestion()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n🔴 [SRE-ETL] FALLO CATASTRÓFICO DURANTE INGESTA:");
    console.error(err.message || err);
    process.exit(1);
  });
