import "dotenv/config";
import { db } from "../db";
import {
  products,
  fact_sales,
  transactions,
  transaction_items,
  inventory_kardex,
  recipe_items,
} from "../db/schema";
import { raw_materials } from "../db/schema/bom";
import { eq, sql, isNull, and, or, like } from "drizzle-orm";

/**
 * [SRE] MDM CATALOG SANITIZATION & ZERO-DROP FUSION
 * ───────────────────────────────────────────────
 * DNA-level reconstruction of the Product and BOM catalog.
 * Standard: Antigravity 2026 (Principal MDM Architect)
 */

const CATEGORY_MAP = {
  SELLABLE_PRODUCTS: [
    { match: /DOBLE|SIMPLE|TRIPLE|VEGGIE|CHICKEN/i, category: "HAMBURGUESAS" },
    { match: /LATA|COCA|AGUA|LEVITE|SPRITE|CERVEZA|ANDES|HEINEKEN|STELLA|FERNET|CAMPARI|VODKA/i, category: "BEBIDAS" },
    { match: /PAPAS|AROS|NUGGETS/i, category: "SIDES" },
    { match: /FRANUI|TIRAMISU|CHOCOTORTA|CHEESCAKE/i, category: "POSTRES" },
    { match: /EMPANADA|TOSTADO|FAINA/i, category: "PANADERIA" }
  ],
  RAW_MATERIALS: [
    { match: /MEDALLON|PANCETA/i, category: "PROTEINAS" },
    { match: /PAN /i, category: "PANERIA" },
    { match: /CHEDDAR/i, category: "LACTEOS" },
    { match: /DIP|SALSA|BARBACOA/i, category: "SALSAS" },
    { match: /COCA|SPRITE|AGUA|LATA/i, category: "BEBIDAS_REVENTA" }
  ]
};

const SKU_MERGE_DICT = [
  { badSkuName: "BIZZARAP session #2", masterSkuName: "BIZARRAP Session #1" },
  { badSkuName: "SpriTe 1.5 lts", masterSkuName: "Sprite 1.5L" },
  { badSkuName: "kiss triple", masterSkuName: "KISS TRIPLE" },
  { badSkuName: "techno Chicken", masterSkuName: "Techno Chicken SIMPLE" },
  { badSkuName: "LATA Coca-Cola zero", masterSkuName: "Lata Coca-Cola Zero" }
];

const FAKE_RAW_MATERIALS_KEYWORDS = ["+", " X12", " X6", "PROMO", "COMBO", "unid.", "tostado"];

async function run() {
  console.log("🚀 Initializing MDM Sanitization...");

  await db.transaction(async (tx) => {
    // ════════════════════════════════════════════════════
    // RULE 2: TAXONOMY ENGINE (Normalización de Categorías)
    // ════════════════════════════════════════════════════
    console.log("📂 Running Taxonomy Engine...");

    const allProducts = await tx.select().from(products).where(isNull(products.deletedAt));
    for (const p of allProducts) {
      for (const rule of CATEGORY_MAP.SELLABLE_PRODUCTS) {
        if (rule.match.test(p.name)) {
          await tx.update(products).set({ category: rule.category }).where(eq(products.id, p.id));
          break;
        }
      }
    }

    const allRaw = await tx.select().from(raw_materials).where(isNull(raw_materials.deletedAt));
    for (const r of allRaw) {
      for (const rule of CATEGORY_MAP.RAW_MATERIALS) {
        if (rule.match.test(r.name)) {
          await tx.update(raw_materials).set({ category: rule.category }).where(eq(raw_materials.id, r.id));
          break;
        }
      }
    }
    console.log("✅ Categories normalized.");

    // ════════════════════════════════════════════════════
    // RULE 3: SKU FUSION (Merge & Soft Delete)
    // ════════════════════════════════════════════════════
    console.log("🔗 Executing SKU Fusion (Financial + Logistics)...");

    for (const merge of SKU_MERGE_DICT) {
      // Find IDs Case-Insensitive (using normalize lower in JS or LIKE in SQL)
      const [badProduct] = await tx.select().from(products)
        .where(sql`LOWER(${products.name}) = ${merge.badSkuName.toLowerCase()}`)
        .limit(1);
      
      const [masterProduct] = await tx.select().from(products)
        .where(sql`LOWER(${products.name}) = ${merge.masterSkuName.toLowerCase()}`)
        .limit(1);

      if (badProduct && masterProduct) {
        const badSku = badProduct.sku || badProduct.id;
        const masterSku = masterProduct.sku || masterProduct.id;

        console.log(`[MERGE] ${badSku} ➔ ${masterSku}`);

        // Update financial history
        await tx.update(fact_sales).set({ productSku: masterSku }).where(eq(fact_sales.productSku, badSku));
        await tx.update(transactions).set({ productSku: masterSku }).where(eq(transactions.productSku, badSku));
        await tx.update(transaction_items).set({ productSku: masterSku }).where(eq(transaction_items.productSku, badSku));
        
        // Update logistics/inventory history
        await tx.update(inventory_kardex).set({ productSku: masterSku }).where(eq(inventory_kardex.productSku, badSku));

        // Soft Delete the junk SKU
        await tx.update(products).set({ deletedAt: new Date() }).where(eq(products.id, badProduct.id));
      }
    }
    console.log("✅ SKU Fusion completed.");

    // ════════════════════════════════════════════════════
    // RULE 4: PURGA TERMODINÁMICA (Hard Delete)
    // ════════════════════════════════════════════════════
    console.log("🔥 Purging fake raw materials...");
    for (const keyword of FAKE_RAW_MATERIALS_KEYWORDS) {
      await tx.delete(raw_materials).where(like(raw_materials.name, `%${keyword}%`));
    }
    console.log("✅ Raw materials purged.");

    // ════════════════════════════════════════════════════
    // RULE 5: IDENTIFICACIÓN DE HUÉRFANOS BOM
    // ════════════════════════════════════════════════════
    console.log("🔍 Auditing BOM orphans (HAMBURGUESAS)...");
    
    // Cross-check burgers with recipes
    const burgersWithMissingRecipes = await tx.run(sql`
      SELECT p.name, p.id 
      FROM products p
      WHERE p.category = 'HAMBURGUESAS' 
        AND p.deleted_at IS NULL
        AND p.id NOT IN (SELECT DISTINCT product_sku FROM recipe_items WHERE deleted_at IS NULL)
    `);

    // Note: Drizzle raw run returns results in .rows
    const results = (burgersWithMissingRecipes.rows as any) || [];
    for (const row of results) {
       console.warn(`[ALERTA BOM] Receta Faltante o Costo Cero: ${row[0]}`);
    }

    const burgersWithZeroCost = await tx.select()
      .from(products)
      .where(and(eq(products.category, "HAMBURGUESAS"), eq(products.costCents, 0), isNull(products.deletedAt)));
    
    for (const b of burgersWithZeroCost) {
      // Avoid double printing if it was already caught by recipe check
      if (!results.some((r: any) => r[1] === b.id)) {
        console.warn(`[ALERTA BOM] Receta Faltante o Costo Cero: ${b.name}`);
      }
    }

    console.log("✅ Audit completed.");
  });

  console.log("🏁 MDM Sanitization complete. Database is now in 'Golden Record' state.");
}

run().catch((err) => {
  console.error("💀 MDM SANITIZATION FAILED:", err);
  process.exit(1);
});
