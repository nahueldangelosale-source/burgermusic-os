import { db } from "../src/db";
import { products, recipe_items } from "../src/db/schema";
import { raw_materials } from "../src/db/schema/bom";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 Seeding E2E test data...");

  const testProductId = "PRD-HAMBURGUESA-TEST";
  const testRawId = "RAW-CARNE-TEST";

  // 1. Ensure Product exists
  const existingProduct = await db.select().from(products).where(eq(products.id, testProductId)).get();
  if (!existingProduct) {
    await db.insert(products).values({
      id: testProductId,
      sku: testProductId, // Use same ID as SKU for simplicity in E2E
      name: "Hamburguesa SRE Test",
      unit: "UNIDAD",
      item_type: "MANUFACTURED",
      isSaleable: true,
      sellingPrice: 150000, // $1500.00
    });
    console.log("✅ Created Product:", testProductId);
  }

  // 2. Ensure Raw Material exists
  const existingRaw = await db.select().from(raw_materials).where(eq(raw_materials.id, testRawId)).get();
  if (!existingRaw) {
    await db.insert(raw_materials).values({
      id: testRawId,
      name: "Carne Molida Test",
      supplierId: "SUP-001",
      category: "PROTEINAS",
      baseUnit: "GRAMOS",
      grossCostCents: 1000,
      trueCostPerUnitCents: 1000,
      purchaseUnit: "BOLSA",
      recipeUnit: "GRAMOS",
      conversionFactor: 2500, // 1 BOLSA = 2500 GRAMOS
    });
    console.log("✅ Created Raw Material:", testRawId);
  }

  // 3. Ensure recipe_items exists (BOM resolution table)
  const existingRecipe = await db.select().from(recipe_items).where(eq(recipe_items.productSku, testProductId)).get();
  if (!existingRecipe) {
    await db.insert(recipe_items).values({
      productSku: testProductId,
      ingredientSku: testRawId,
      quantity: 100, // 100g per burger
    });
    console.log("✅ Created recipe_items entry");
  }

  console.log("🏁 E2E Seeding Complete.");
}

seed().catch(err => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
