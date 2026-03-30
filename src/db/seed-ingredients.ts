import { sql } from "drizzle-orm";
import { db } from "./index";
import { products as ingredients, products, recipe_items } from "./schema";

const INGREDIENTS_SEED = [
  { id: "INS_CARNE", name: "Medallón de Carne 110g", isSaleable: false, unit: "UNIDAD" as const },
  { id: "INS_PAN", name: "Pan de Papa", isSaleable: false, unit: "UNIDAD" as const },
  { id: "INS_CHEDDAR", name: "Feta de Queso Cheddar", isSaleable: false, unit: "UNIDAD" as const },
  { id: "INS_BACON", name: "Panceta Crispy", isSaleable: false, unit: "GRAMOS" as const },
  {
    id: "INS_PAPAS_PORCION",
    name: "Porción de Papas Fritas Estándar",
    isSaleable: false,
    unit: "UNIDAD" as const,
  },
];

export async function runIngredientSeed() {
  console.log("Iniciando Seed de Ingredientes y Motor BOM...");

  // 1. Obtener los IDs reales de los platillos inyectados previamente
  const finalProducts = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(sql`category = 'BURGER' OR category = 'SIDE'`);

  if (finalProducts.length === 0) {
    console.warn("No hay productos catalogados. Ejecuta el seed del catálogo primero.");
    return;
  }

  // 2. Construcción Heurística del Grafo BOM
  const RECIPES_SEED: { productSku: string; ingredientSku: string; quantity: number }[] = [];

  for (const product of finalProducts) {
    const nameLower = product.name.toLowerCase();

    // Heurísticas de Clasificación
    if (nameLower.includes("doble")) {
      RECIPES_SEED.push({ productSku: product.id, ingredientSku: "INS_CARNE", quantity: 2 });
      RECIPES_SEED.push({ productSku: product.id, ingredientSku: "INS_CHEDDAR", quantity: 4 });
      RECIPES_SEED.push({ productSku: product.id, ingredientSku: "INS_BACON", quantity: 1 });
      RECIPES_SEED.push({ productSku: product.id, ingredientSku: "INS_PAN", quantity: 1 });
    } else if (nameLower.includes("simple") || nameLower.includes("burger")) {
      RECIPES_SEED.push({ productSku: product.id, ingredientSku: "INS_CARNE", quantity: 1 });
      RECIPES_SEED.push({ productSku: product.id, ingredientSku: "INS_CHEDDAR", quantity: 2 });
      RECIPES_SEED.push({ productSku: product.id, ingredientSku: "INS_BACON", quantity: 1 });
      RECIPES_SEED.push({ productSku: product.id, ingredientSku: "INS_PAN", quantity: 1 });
    }
  }

  // 3. Inyección Atómica Zero-Trust
  try {
    await db.transaction(async (tx) => {
      // Registrar ingredientes crudos
      await tx.insert(ingredients).values(INGREDIENTS_SEED).onConflictDoNothing();

      // Aseguramos inmutabilidad temporal borrando el estado previo del sub-grafo si re-ejecutamos
      await tx.delete(recipe_items);

      // Inyectar aristas BOM
      if (RECIPES_SEED.length > 0) {
        await tx.insert(recipe_items).values(RECIPES_SEED);
      }
    });
    console.log(
      `BOM Seed Finalizado: ${INGREDIENTS_SEED.length} Ingredientes, ${RECIPES_SEED.length} Relaciones.`,
    );
  } catch (error) {
    console.error("Fallo Atómico durante Seed BOM:", error);
    process.exit(1);
  }
}

// Support direct execution via Node
if (require.main === module) {
  runIngredientSeed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
