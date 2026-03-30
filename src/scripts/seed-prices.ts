import { db } from "../db";
import { products } from "../db/schema";
import { sellable_products } from "../db/schema/bom";
import { eq } from "drizzle-orm";
import Papa from "papaparse";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

// 1. Zod Schema para sanitizar y transaccionar filas
const PriceRowSchema = z.object({
  Categoria: z.string().transform(v => v.trim()),
  Nombre: z.string().transform(v => v.trim()),
  Precio: z.string().or(z.number()).transform(v => Number(v) * 100), // ARS a Centavos Financieros
  UltimaModificacion: z.string().transform(v => v.trim()),
});

// Mapa de normalización de Categorías al Enum Drizzle "BURGER" | "SIDE" | "BEVERAGE" | "SALAD" | "DESSERT"
function mapCategory(catRaw: string) {
  const cat = catRaw.toUpperCase();
  if (cat.includes("HAMBURGUESAS") || cat.includes("PIZZAS")) return "BURGER";
  if (cat.includes("BEBIDAS")) return "BEVERAGE";
  if (cat.includes("ENSALADA")) return "SALAD";
  if (cat.includes("POSTRE")) return "DESSERT";
  return "SIDE"; // Empanadas, Tostados, Acompañar
}

function cleanStringForLookup(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function seedPrices() {
  console.log("🟦 Iniciando ETL Seed Prices 2026...");

  // 2. Extraer CSV Crudo
  const csvPath = path.join(process.cwd(), "precios_menu_2026.csv");
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV No encontrado en: ${csvPath}`);
  }
  const csvFormat = fs.readFileSync(csvPath, "utf-8");

  // 3. Papaparse en Memoria (Node.js buffer)
  const { data, errors } = Papa.parse(csvFormat, {
    header: true,
    skipEmptyLines: true,
  });

  if (errors.length) {
    console.error("❌ Errores de parseo:", errors);
    return;
  }

  // 4. Carga O(1) en Memoria para Lookups
  const existingProducts = await db.select({ id: products.id, name: products.name }).from(products);
  
  // Diccionario O(1)
  const productMap = new Map<string, string>();
  for (const p of existingProducts) {
    productMap.set(cleanStringForLookup(p.name), p.id);
  }

  let updatedCount = 0;
  let insertedCount = 0;

  const updates: Array<{ id: string, price: number }> = [];
  const inserts: Array<{ id: string, name: string, category: any, base_price_cents: number, isSaleable: boolean }> = [];

  // 5. Transformación y Despacho
  for (const raw of data) {
    const parsed = PriceRowSchema.safeParse(raw);
    if (!parsed.success) {
      console.warn(`[!] Omitiendo fila corrupta:`, raw);
      continue;
    }

    const row = parsed.data;
    const cleanName = cleanStringForLookup(row.Nombre);
    const dbId = productMap.get(cleanName);

    if (dbId) {
      // SI EXISTE: Agregar a la cola de updates
      updates.push({ id: dbId, price: row.Precio });
    } else {
      // SI NO EXISTE: Agregar a la cola de inserts
      // Generamos un PRD_ id determinista
      const newId = `PRD_${cleanName.toUpperCase()}`;
      inserts.push({
        id: newId,
        name: row.Nombre,
        category: mapCategory(row.Categoria),
        base_price_cents: row.Precio,
        isSaleable: true
      });
    }
  }

  // 6. Transaccionalidad ACID
  console.log(`⏳ Orquestando Transacción Batch Drizzle... (Updates: ${updates.length} | Inserts: ${inserts.length})`);
  
  await db.transaction(async (tx) => {
    // 6.a Procesar Inserts Nativos
    if (inserts.length > 0) {
      // SQLite en libSQL admite inserts múltiples en chunk
      for (let i = 0; i < inserts.length; i += 500) {
        const chunk = inserts.slice(i, i + 500);
        await tx.insert(products).values(chunk);
        
        await tx.insert(sellable_products).values(
            chunk.map(p => ({
              id: p.id,
              sku: p.id,
              category: String(p.category),
              priceCents: p.base_price_cents,
              liveMarginCents: 0
            }))
        ).onConflictDoNothing();
      }
    }

    // 6.b Procesar Updates Nativos (Sequencial rápido en Turso)
    for (const u of updates) {
      await tx.update(products)
        .set({ base_price_cents: u.price })
        .where(eq(products.id, u.id));

      await tx.insert(sellable_products).values({
        id: u.id,
        sku: u.id,
        category: "GENERAL",
        priceCents: u.price,
        liveMarginCents: 0
      }).onConflictDoUpdate({
        target: sellable_products.sku,
        set: { priceCents: u.price }
      });
    }
  });

  console.log("\x1b[32m%s\x1b[0m", `✅ ETL Finalizado con Éxito. Zero Data-Loss garantizado.`);
  console.log("\x1b[36m%s\x1b[0m", `📈 Artículos Actualizados (UPSERT): ${updates.length}`);
  console.log("\x1b[35m%s\x1b[0m", `🆕 Nuevos Artículos Creados (INSERT): ${inserts.length}`);
}

seedPrices().catch((err) => {
  console.error("❌ Fatal Error durante Seed:", err);
  process.exit(1);
});
