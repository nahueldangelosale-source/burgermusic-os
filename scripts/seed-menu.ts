import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db/index";
import menuData from "../src/db/menu-data.json";
import { products, recipe_items } from "../src/db/schema";

function cleanPrice(priceStr: string): number {
  // "$11.100" -> 11100
  // Remove '$', remove '.', parse int
  return Number.parseInt(priceStr.replace(/[^0-9]/g, "")) || 0;
}

function generateSku(name: string): string {
  // "CLASSIC" -> "CLASSIC"
  // "Coca Cola 1.5 lts" -> "COCA_COLA_1_5_LTS"
  return name
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^A-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

// Simple keyword matcher for ingredients
const INGREDIENT_DICTIONARY: Record<string, string> = {
  CHEDDAR: "INS_CHEDDAR",
  CARNE: "INS_CARNE_110", // Asumimos carne standard
  PANCETA: "INS_PANCETA",
  HUEVO: "INS_HUEVO",
  CEBOLLA: "INS_CEBOLLA",
  "CEBOLLA CRISPY": "INS_CEBOLLA_CRISPY",
  "CEBOLLA CARAMELIZADA": "INS_CEBOLLA_CARAMELIZADA",
  LECHUGA: "INS_LECHUGA",
  TOMATE: "INS_TOMATE",
  PEPINO: "INS_PEPINO",
  SALSA: "INS_SALSA_BASE", // Generic
  "PAN DE QUESO": "INS_PAN_QUESO",
  PAN: "INS_PAN_PAPA", // Default bun
  PROVOLETA: "INS_PROVOLETA",
  POLLO: "INS_POLLO_CRISPY",
  BONDIOLA: "INS_BONDIOLA",
  "AROS DE CEBOLLA": "INS_AROS_CEBOLLA",
  PAPAS: "INS_PAPA_KG", // For "INCLUYE PAPAS"
};

async function main() {
  console.log("🍔 Ingesting Official Menu from JSON...");

  // 1. Ensure Ingredients Exist
  // We create them with dummy costs for now, user can update in Lab
  const uniqueIngredients = new Set(Object.values(INGREDIENT_DICTIONARY));
  for (const sku of uniqueIngredients) {
    await db
      .insert(products)
      .values({
        id: sku,
        name: sku.replace("INS_", "").replace(/_/g, " "),
        unit: "unid",
        isSaleable: false,
        costCents: 10000, // Dummy cost $100
      } as any)
      .onConflictDoNothing();
  }

  // 2. Process Categories
  for (const category of menuData) {
    console.log(`📂 Processing Category: ${category.category}`);

    for (const item of category.products) {
      const sku = generateSku(item.name);
      const priceCents = cleanPrice(item.price) * 100; // Store in cents if needed, schema has costCents not price.
      // Schema 'costCents' is COST, not PRICE.
      // We don't have a 'price' column in schema yet!
      // We will ignore storing price for now, or store it in cost? NO.
      // We just store the product existence.

      console.log(`   🔸 Upserting: ${item.name} (${sku})`);

      await db
        .insert(products)
        .values({
          id: sku,
          name: item.name,
          unit: "unid",
          isSaleable: true,
          costCents: 0, // We don't know the cost, only the sale price.
        } as any)
        .onConflictDoUpdate({
          target: products.id,
          set: { name: item.name }, // Update name if changed
        });

      // 3. Infer Recipes
      const desc = item.description.toUpperCase();
      const ingredientsToAdd: { id: string; qty: number }[] = [];

      // Always add Bun for burgers (heuristic)
      if (
        category.category.includes("Hamburguesas") &&
        !desc.includes("PAN DE QUESO") &&
        !desc.includes("CROISSANT")
      ) {
        ingredientsToAdd.push({ id: "INS_PAN_PAPA", qty: 1 });
      }

      // Keyword matching
      for (const [keyword, ingSku] of Object.entries(INGREDIENT_DICTIONARY)) {
        if (desc.includes(keyword)) {
          // Avoid double counting specific vs generic (e.g. Cebolla vs Cebolla Crispy)
          // Simple logic: if we already added a specific "Cebolla Crispy", don't add generic "Cebolla"?
          // For MVP, just add everything found.

          // Simple Quantity detection? "DOBLE CHEDDAR" -> 2
          let qty = 1;
          if (desc.includes(`DOBLE ${keyword}`)) qty = 2;
          if (desc.includes(`TRIPLE ${keyword}`)) qty = 3;

          // Special case: "INCLUYE PAPAS"
          if (keyword === "PAPAS" && desc.includes("INCLUYE PAPAS")) {
            qty = 0.3; // 300g portion?
            // "Papas Baston" -> INS_PAPA_KG
          }

          ingredientsToAdd.push({ id: ingSku, qty });
        }
      }

      // Clear old recipe lines for this product to prevent duplicates/stale data
      await db.delete(recipe_items).where(eq(recipe_items.productSku, sku));

      // Insert new ingredients
      if (ingredientsToAdd.length > 0) {
        // De-duplicate by ID (sum quantities)
        const merged = new Map<string, number>();
        for (const i of ingredientsToAdd) {
          merged.set(i.id, (merged.get(i.id) || 0) + i.qty);
        }

        for (const [ingId, qty] of merged.entries()) {
          await db.insert(recipe_items).values({
            productSku: sku,
            ingredientSku: ingId,
            quantity: qty,
          } as any);
        }
      }
    }
  }

  console.log("✅ Menu Ingestion Complete.");
  process.exit(0);
}

main().catch(console.error);
