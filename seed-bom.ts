import "dotenv/config";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "./src/db";
import { products, recipe_items } from "./src/db/schema";

async function run() {
  console.log("Seeding BOM Graph for BurgerMusic...");

  // Deleted the hanging `db.delete()` calls. Instead, we insert prefixed names.
  // await db.delete(recipes);
  // await db.delete(products);

  // 1. RAW MATERIALS
  const rawMaterials = [
    {
      id: uuidv4(),
      name: "[BOM] Harina 0000",
      costCents: 120000,
      isSaleable: false,
      unit: "GRAMOS" as const,
    },
    {
      id: uuidv4(),
      name: "[BOM] Queso Muzzarella",
      costCents: 850000,
      isSaleable: false,
      unit: "GRAMOS" as const,
    },
    {
      id: uuidv4(),
      name: "[BOM] Salsa de Tomate",
      costCents: 220000,
      isSaleable: false,
      unit: "LITROS" as const,
    },
    {
      id: uuidv4(),
      name: "[BOM] Medallón Carne 110g",
      costCents: 110000,
      isSaleable: false,
      unit: "UNIDAD" as const,
    },
    {
      id: uuidv4(),
      name: "[BOM] Pan de Hamburguesa",
      costCents: 35000,
      isSaleable: false,
      unit: "UNIDAD" as const,
    },
    {
      id: uuidv4(),
      name: "[BOM] Queso Cheddar",
      costCents: 20000,
      isSaleable: false,
      unit: "UNIDAD" as const,
    },
    {
      id: uuidv4(),
      name: "[BOM] Panceta Ahumada",
      costCents: 1500000,
      isSaleable: false,
      unit: "GRAMOS" as const,
    },
  ];

  await db.insert(products).values(rawMaterials);

  const harinaId = rawMaterials.find((m) => m.name === "[BOM] Harina 0000")!.id;
  const muzzaId = rawMaterials.find((m) => m.name === "[BOM] Queso Muzzarella")!.id;
  const salsaId = rawMaterials.find((m) => m.name === "[BOM] Salsa de Tomate")!.id;

  const medallonId = rawMaterials.find((m) => m.name === "[BOM] Medallón Carne 110g")!.id;
  const panId = rawMaterials.find((m) => m.name === "[BOM] Pan de Hamburguesa")!.id;
  const cheddarId = rawMaterials.find((m) => m.name === "[BOM] Queso Cheddar")!.id;
  const pancetaId = rawMaterials.find((m) => m.name === "[BOM] Panceta Ahumada")!.id;

  console.log("Ingredientes insertados.");

  // 2. SEMI-FINISHED PRODUCTS (Masa)
  const masaId = uuidv4();
  await db.insert(products).values({
    id: masaId,
    name: "[BOM] Bollo Masa 350g",
    costCents: 50000, // Theoretical calculation below overriding base
    isSaleable: false,
    unit: "UNIDAD" as const,
  });

  // Recipe for Bollo
  await db
    .insert(recipe_items)
    .values([{ productSku: masaId, ingredientSku: harinaId, quantity: 0.35 }]);

  // 3. FINAL PRODUCTS
  const finalProducts = [
    {
      id: uuidv4(),
      name: "[BOM] Pizza Muzzarella L",
      costCents: 1200000,
      sellingPrice: 950000,
      isSaleable: true,
      unit: "UNIDAD" as const,
    },
    {
      id: uuidv4(),
      name: "[BOM] Burger Doble Bacon",
      costCents: 350000,
      sellingPrice: 650000,
      isSaleable: true,
      unit: "UNIDAD" as const,
    },
  ];

  // Re-calculating actual margins by replacing costCents with sum of BOM
  // Bollo: 1200 * 0.35 = $420
  // Muzza: 8500 * 0.30 = $2550
  // Salsa: 2200 * 0.15 = $330
  // Pizza Total Cost = $3,300. Selling Price = $9,500. Margin = 65%
  finalProducts[0].costCents = 330000;

  // Medallon: 1100 * 2 = $2200
  // Pan: 350 * 1 = $350
  // Cheddar: 200 * 2 = $400
  // Panceta: 15000 * 0.05 = $750
  // Burger Total Cost = $3,700. Selling Price = $6,500. Margin = 43%
  finalProducts[1].costCents = 370000;

  await db.insert(products).values(finalProducts);

  const pizzaId = finalProducts[0].id;
  const burgerId = finalProducts[1].id;

  // 4. BOM (Recipe Items)
  await db.insert(recipe_items).values([
    // Pizza BOM
    { productSku: pizzaId, ingredientSku: masaId, quantity: 1 },
    { productSku: pizzaId, ingredientSku: muzzaId, quantity: 0.3 }, // 300g
    { productSku: pizzaId, ingredientSku: salsaId, quantity: 0.15 }, // 150ml

    // Burger BOM
    { productSku: burgerId, ingredientSku: panId, quantity: 1 }, // 1 unit
    { productSku: burgerId, ingredientSku: medallonId, quantity: 2 }, // 2x110g
    { productSku: burgerId, ingredientSku: cheddarId, quantity: 2 }, // 2 fetas
    { productSku: burgerId, ingredientSku: pancetaId, quantity: 0.05 }, // 50g
  ]);

  console.log("Recetas (BOM) insertadas correctamente.");
  console.log("Grafo listo para probar propagación de Costos.");
}

run().catch(console.error);
