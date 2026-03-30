// src/db/seed-recipes.ts
import "dotenv/config";
import { db } from "./index";
import { type product_unit_enum, products, recipe_items } from "./schema";

type ProductUnit = (typeof product_unit_enum)[number];
import { eq } from "drizzle-orm";

async function main() {
  console.log("👨🍳 Iniciando carga de Recetas Maestras...");

  // 1. CREAR INSUMOS (Raw Materials)
  // Estos son los items que cuenta el personal en WhatsApp
  const insumos = [
    {
      id: "INS_CARNE_110",
      name: "Medallón Carne 110g",
      unit: "UNIDAD" as ProductUnit,
      costCents: 80000,
    }, // Ej: $800
    { id: "INS_PAN_PAPA", name: "Pan de Papa", unit: "UNIDAD" as ProductUnit, costCents: 30000 },
    { id: "INS_CHEDDAR", name: "Feta Cheddar", unit: "UNIDAD" as ProductUnit, costCents: 15000 },
    { id: "INS_BACON", name: "Feta Bacon", unit: "UNIDAD" as ProductUnit, costCents: 20000 },
    {
      id: "INS_PAPA_KG",
      name: "Papas Bastón (Bolsa)",
      unit: "GRAMOS" as ProductUnit,
      costCents: 120000,
    },
    { id: "INS_ACEITE", name: "Aceite Freidora", unit: "LITROS" as ProductUnit, costCents: 500000 },
  ];

  console.log("📦 Insertando Insumos...");
  for (const insumo of insumos) {
    await db
      .insert(products)
      .values({
        ...insumo,
        isSaleable: false, // No se vende en el POS
        safetyStock: 10,
      })
      .onConflictDoUpdate({ target: products.id, set: { name: insumo.name } });
  }

  // 2. DEFINIR LAS RECETAS (El Puente)
  // Mapeamos el SKU del CSV (Venta) -> Insumos (Inventario)

  const recetas = [
    // --- MALA FAMA DOBLE 220g ---
    // SKU generado por el CSV Parser: MALA_FAMA_DOBLE_220G (User provided SKU in logic, might differ from actual CSV output but we follow the script)
    // Note: User's CSV parser logic: 'Mala Fama Doble ( Mala Fama )' -> 'Mala Fama Doble' -> 'MALA_FAMA_DOBLE'
    // The user provided 'MALA_FAMA_DOBLE_220G' in this seed script.
    // If the CSV produces 'MALA_FAMA_DOBLE', this seed script needs to match it.
    // The user's CSV parser regex: cleanName.toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
    // If name is "Mala Fama Doble", result is "MALA_FAMA_DOBLE".
    // If name is "Mala Fama Doble 220g", result is "MALA_FAMA_DOBLE_220G".
    // I will keep the user's seed script exactly as is, if it mismatches, we can debug.
    {
      productSku: "MALA_FAMA_DOBLE_220G",
      ingredients: [
        { ingredientSku: "INS_CARNE_110", quantity: 2 }, // Doble carne
        { ingredientSku: "INS_PAN_PAPA", quantity: 1 },
        { ingredientSku: "INS_CHEDDAR", quantity: 2 }, // Asumimos 2 fetas
        { ingredientSku: "INS_BACON", quantity: 2 }, // Asumimos bacon
      ],
    },

    // --- DUKO DOBLE ---
    {
      productSku: "DUKO_DOBLE",
      ingredients: [
        { ingredientSku: "INS_CARNE_110", quantity: 2 },
        { ingredientSku: "INS_PAN_PAPA", quantity: 1 },
        { ingredientSku: "INS_CHEDDAR", quantity: 4 }, // Duko suele ser extra queso?
      ],
    },

    // --- CHARLY SIMPLE 110g ---
    {
      productSku: "CHARLY_SIMPLE_110G",
      ingredients: [
        { ingredientSku: "INS_CARNE_110", quantity: 1 },
        { ingredientSku: "INS_PAN_PAPA", quantity: 1 },
        { ingredientSku: "INS_CHEDDAR", quantity: 1 },
      ],
    },

    // --- PAPAS CON CHEDDAR ---
    {
      productSku: "PAPAS_CON_CHEDDAR",
      ingredients: [
        { ingredientSku: "INS_PAPA_KG", quantity: 0.3 }, // 300g de papa
        { ingredientSku: "INS_CHEDDAR", quantity: 2 }, // 2 fetas fundidas (ejemplo)
        { ingredientSku: "INS_ACEITE", quantity: 0.05 }, // Absorción de aceite
      ],
    },
  ];

  console.log("🔗 Conectando Recetas...");
  for (const receta of recetas) {
    // Verificar si el producto de venta existe
    // IMPORTANT: db.query.products might not be available if not properly exported in db/index.ts
    // We'll use db.select().from(products).where(...)
    const productExists = await db
      .select()
      .from(products)
      .where(eq(products.id, receta.productSku))
      .limit(1);

    if (productExists.length === 0) {
      console.warn(
        `⚠️ Saltando receta para '${receta.productSku}': No existe en productos (¿Cargaste el CSV primero?).`,
      );

      // OPTIONAL: Auto-create the product to ensure recipe seeding works for testing?
      // User said "Si el producto NO existe... lo creamos" in the IMPORT logic.
      // Here, if I want this seed to generally work, I should probably create them too?
      // But the instruction says "Saltando receta". I will follow the user's code.
      continue;
    }

    // Insertar ingredientes
    for (const ingrediente of receta.ingredients) {
      await db
        .insert(recipe_items)
        .values({
          productSku: receta.productSku,
          ingredientSku: ingrediente.ingredientSku,
          quantity: ingrediente.quantity,
        })
        .onConflictDoNothing();
    }
    console.log(`✅ Receta configurada: ${receta.productSku}`);
  }

  console.log("🏁 Carga de recetas finalizada.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
