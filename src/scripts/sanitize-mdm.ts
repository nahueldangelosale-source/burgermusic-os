import "dotenv/config";
import { db } from "../db";
import { products, raw_materials, recipe_items } from "../db/schema";
import { sql, eq, or, like, and, isNull } from "drizzle-orm";

/**
 * [DIRECTIVA SRE P0] - MDM ONTOLOGICAL SANITIZATION & CASCADE DELETE
 * ─────────────────────────────────────────────────────────────────
 * Autor: MDM Architect & Data Engineer (BurgerMusic OS)
 * Objetivo: Purgar la entropía estructural y asegurar integridad referencial.
 */

async function main() {
  const args = process.argv.slice(2);
  const storeIdArg = args.find((arg) => arg.startsWith("--store-id="))?.split("=")[1];

  if (!storeIdArg) {
    console.error("SRE FATAL: Missing --store-id argument.");
    process.exit(1);
  }

  // Type Shadowing para seguridad matemática
  const VALID_STORE_ID: string = storeIdArg;

  console.log(`[INFO] Iniciando Sanitización MDM para sucursal: ${VALID_STORE_ID}`);

  try {
    await db.transaction(async (tx) => {
      // --- REGLA 1: TAXONOMY RENAMING (ATÓMICA) ---
      const taxonomyMappings = [
        { from: "PROTEINAS", to: "CARNES" },
        { from: "SIDES", to: "ACOMPAÑAMIENTOS" },
        { from: "BEBIDAS_REVENTA", to: "BEBIDAS" },
      ];

      for (const mapping of taxonomyMappings) {
        const prodResult = await tx
          .update(products)
          .set({ category: mapping.to })
          .where(eq(products.category, mapping.from));
        
        const rawResult = await tx
          .update(raw_materials)
          .set({ category: mapping.to })
          .where(eq(raw_materials.category, mapping.from));

        console.log(`[INFO] Rule 1: '${mapping.from}' -> '${mapping.to}' aplicado.`);
      }

      // --- REGLA 2: SEMANTIC ROUTING (GARBAGE COLLECTION) ---
      // Categorías GENERAL y EXTENSIONS reubicadas por nombre
      const garbageCategories = ["GENERAL", "EXTENSIONS"];
      
      for (const cat of garbageCategories) {
        // Bebidas
        await tx
          .update(products)
          .set({ category: "BEBIDAS" })
          .where(and(
            eq(products.category, cat),
            or(
              like(products.name, "%CERVEZA%"),
              like(products.name, "%ANDES%"),
              like(products.name, "%LATA%")
            )
          ));

        // Acompañamientos
        await tx
          .update(products)
          .set({ category: "ACOMPAÑAMIENTOS" })
          .where(and(
            eq(products.category, cat),
            or(
              like(products.name, "%EMPANADA%"),
              like(products.name, "%NUGGETS%"),
              like(products.name, "%PAPAS%")
            )
          ));
      }
      console.log(`[INFO] Rule 2: Semantic Routing completado para ${garbageCategories.join(", ")}.`);

      // --- REGLA 3: ZOMBIE SOFT PURGE ---
      // Identificar insumos contaminados (sub-recetas en materia prima)
      const zombiePatterns = ["%por medallon%", "%con cheddar%", "%+%"];
      const now = new Date();

      // Buscamos los IDs de los zombies antes de borrar para el cascade manual (si no hay FK cascade en DB)
      const zombies = await tx
        .select({ id: raw_materials.id })
        .from(raw_materials)
        .where(
          and(
            isNull(raw_materials.deletedAt),
            or(
              ...zombiePatterns.map(p => like(raw_materials.name, p))
            )
          )
        );

      if (zombies.length > 0) {
        const zombieIds = zombies.map(z => z.id);
        
        const purgeResult = await tx
          .update(raw_materials)
          .set({ deletedAt: now })
          .where(sql`id IN ${zombieIds}`);

        console.log(`[INFO] Rule 3: ${zombies.length} Zombies marcados como eliminados.`);

        // --- REGLA 4: CASCADE SOFT DELETE (INTEGRIDAD REFERENCIAL) ---
        // Purgamos recipe_items que apunten a estos zombies
        const cascadeResult = await tx
          .update(recipe_items)
          .set({ deletedAt: now })
          .where(and(
             isNull(recipe_items.deletedAt),
             sql`ingredient_sku IN ${zombieIds}`
          ));
        
        console.log(`[INFO] Rule 4: Cascade aplicado a recipe_items (Referencia a Insumos Purgados).`);
      } else {
        console.log(`[INFO] Rule 3: No se encontraron Zombies nuevos.`);
      }
    });

    console.log("[SUCCESS] Sanitización MDM completada exitosamente.");
    process.exit(0);
  } catch (error) {
    console.error("[FATAL] Error en la transacción de sanitización:", error);
    process.exit(1);
  }
}

main();
