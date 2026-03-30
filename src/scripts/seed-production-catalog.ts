import "dotenv/config";
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { z } from "zod";
import { db } from "../db";
import { products, recipe_items } from "../db/schema";
import { raw_materials } from "../db/schema/bom";
import { sql } from "drizzle-orm";

/**
 * PRODUCTION CATALOG HYDRATION SCRIPT (Antigravity 2026 Standard)
 * ─────────────────────────────────────────────────────────────
 * Deterministic ETL for menu prices and BOM templates.
 * Enforces Zero-Trust isolation and ACID atomicity.
 */

// 1. ZERO-TRUST CLI ARGUMENT VALIDATION
const storeIdArg = process.argv.find(a => a.startsWith('--store-id='));
const storeId = storeIdArg?.split('=')[1];

if (!storeId) {
  console.error("❌ CRITICAL ERROR: Missing --store-id argument.");
  console.error("Usage: npx tsx src/scripts/seed-production-catalog.ts --store-id=YOUR_STORE_ID");
  process.exit(1);
}

console.log(`🚀 Initializing Genesis Hydration for Store ID: [${storeId}]`);

// 2. ZOD SCHEMAS FOR DATA GUARDRAILS
const PriceRowSchema = z.object({
  Categoria: z.string(),
  Nombre: z.string(),
  Precio: z.string().transform(v => {
    const clean = v.replace(/[$. ]/g, "").replace(",", ".");
    return Math.round(parseFloat(clean) * 100);
  }),
  UltimaModificacion: z.string().optional(),
});

const BomRowSchema = z.object({
  Categoria: z.string(),
  Nombre: z.string(),
  Descripcion: z.string(),
});

// 3. SEMANTIC EXTRACTION ENGINE
function extractIngredients(description: string) {
  const cleanDesc = description
    .replace(/\(INCLUYE PAPAS\)\.?/gi, "")
    .replace(/INCLUYE PAPAS/gi, "")
    .replace(/\./g, "")
    .trim();

  const components = cleanDesc.split(/,|\+|y/i).map(c => c.trim()).filter(Boolean);

  return components.map(c => {
    let quantity = 1;
    let name = c;

    if (/doble|x2|2 unidades/i.test(c)) {
      quantity = 2;
      name = c.replace(/doble|x2|2 unidades/gi, "").trim();
    } else if (/x4|4 unidades/i.test(c)) {
      quantity = 4;
      name = c.replace(/x4|4 unidades/gi, "").trim();
    }

    return { name, quantity };
  });
}

// 4. UOM NORMALIZATION & CONVERSION LOGIC
function getUomConfig(name: string) {
  const norm = name.toLowerCase();
  
  if (norm.includes("papas")) {
    return { recipeUnit: "GRAMOS", purchaseUnit: "BOLSA", factor: 2500, category: "SIDES" };
  }
  if (norm.includes("cheddar")) {
    return { recipeUnit: "FETAS", purchaseUnit: "BARRA", factor: 200, category: "LACTEOS" };
  }
  if (norm.includes("medallon") || norm.includes("carne") || norm.includes("pollo")) {
    return { recipeUnit: "UNIDAD", purchaseUnit: "CAJA", factor: 50, category: "PROTEINAS" };
  }
  if (norm.includes("pan")) {
    return { recipeUnit: "UNIDAD", purchaseUnit: "PAQUETE", factor: 12, category: "PANERIA" };
  }
  
  return { recipeUnit: "UNIDAD", purchaseUnit: "UNIDAD", factor: 1, category: "GENERAL" };
}

// 5. STREAMING ETL RUNTIME
async function parseCsv<T>(filePath: string, schema: z.ZodType<T, any, any>): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const results: T[] = [];
    const fileStream = fs.createReadStream(filePath);
    
    Papa.parse(fileStream, {
      header: true,
      skipEmptyLines: true,
      step: (results_row) => {
        try {
          results.push(schema.parse(results_row.data));
        } catch (err) {
          console.error(`❌ Validation error in ${path.basename(filePath)}:`, err);
        }
      },
      complete: () => resolve(results),
      error: (error) => reject(error),
    });
  });
}

async function run() {
  const priceRows = await parseCsv(path.join(process.cwd(), "precios_menu_2026.csv"), PriceRowSchema);
  const bomRows = await parseCsv(path.join(process.cwd(), "bom_template.csv"), BomRowSchema);

  console.log(`📊 Validated ${priceRows.length} prices and ${bomRows.length} BOM templates.`);

  await db.transaction(async (tx) => {
    console.log("🛠️  Applying mutations to Ledger...");

    for (const p of priceRows) {
      const sku = `PROD-${p.Nombre.toUpperCase().replace(/\s+/g, '-')}`;
      
      let itemType: "MANUFACTURED" | "COMBO" | "SERVICE" = "MANUFACTURED";
      if (/PROMO|COMBO|PICADA/i.test(p.Nombre) || /PROMO|COMBO/i.test(p.Categoria)) {
        itemType = "COMBO";
      } else if (p.Categoria === "BEBIDAS") {
        itemType = "MANUFACTURED";
      }

      await tx.insert(products).values({
        id: sku,
        sku: sku,
        name: p.Nombre,
        category: p.Categoria,
        base_price_cents: p.Precio,
        sellingPrice: p.Precio,
        item_type: itemType,
        isSaleable: true,
      }).onConflictDoUpdate({
        target: products.id,
        set: {
          base_price_cents: p.Precio,
          sellingPrice: p.Precio,
          category: p.Categoria,
          item_type: itemType,
        }
      });
    }

    // 7. Process BOMs (Relational Fabric)
    for (const b of bomRows) {
      const productSku = `PROD-${b.Nombre.toUpperCase().replace(/\s+/g, '-')}`;
      
      // 🛡️ Parent Product Mirroring (Ensures FK compliance if missing from prices)
      await tx.insert(products).values({
        id: productSku,
        sku: productSku,
        name: b.Nombre.toUpperCase(),
        category: b.Categoria,
        item_type: "MANUFACTURED",
        isSaleable: true,
      }).onConflictDoNothing();

      const ingredients = extractIngredients(b.Descripcion);

      if (/INCLUYE PAPAS/i.test(b.Descripcion)) {
        ingredients.push({ name: "Papas Fritas Base", quantity: 1 });
      }

      console.log(`🔗 Linking BOM for [${b.Nombre}] -> ${ingredients.length} items`);

      for (const ing of ingredients) {
        const uom = getUomConfig(ing.name);
        const rawId = `RAW-${ing.name.toUpperCase().replace(/\s+/g, '-')}`;

        // 🛡️ Ingredient Mirroring
        await tx.insert(products).values({
          id: rawId,
          sku: rawId,
          name: ing.name.toUpperCase(),
          category: uom.category,
          item_type: "MANUFACTURED",
          isSaleable: false,
        }).onConflictDoUpdate({
          target: products.id,
          set: {
            name: ing.name.toUpperCase(),
          }
        });

        // Upsert Raw Material Metadata
        await tx.insert(raw_materials).values({
          id: rawId,
          supplierId: "UNKNOWN",
          name: ing.name.toUpperCase(),
          category: uom.category,
          baseUnit: uom.recipeUnit,
          purchaseUnit: uom.purchaseUnit,
          recipeUnit: uom.recipeUnit,
          conversionFactor: uom.factor,
          grossCostCents: 0,
          trueCostPerUnitCents: 0,
        }).onConflictDoUpdate({
          target: raw_materials.id,
          set: {
            category: uom.category,
            baseUnit: uom.recipeUnit,
            conversionFactor: uom.factor,
          }
        });

        // Upsert Recipe Item (BOM Atomic Link)
        try {
          await tx.insert(recipe_items).values({
            productSku: productSku,
            ingredientSku: rawId,
            quantity: ing.quantity,
          }).onConflictDoUpdate({
            target: [recipe_items.productSku, recipe_items.ingredientSku],
            set: {
              quantity: ing.quantity,
            }
          });
        } catch (fkErr) {
          console.error(`❌ FK VIOLATION on Recipe: Product [${productSku}] -> Ingredient [${rawId}]`);
          throw fkErr;
        }
      }
    }
  });

  console.log("✅ GENESIS HYDRATION COMPLETE. Production Plane is consistent.");
}

run().catch(err => {
  console.error("❌ FATAL HYDRATION FAILURE:", err);
  process.exit(1);
});
