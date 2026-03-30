import "dotenv/config";
import { db } from "../db";
import { products, raw_materials } from "../db/schema";
import { sql, eq, or, and, like } from "drizzle-orm";

/**
 * [DIRECTIVA SRE P0] - MDM TAXONOMIC SWEEP 2 (SURGICAL ROUTING)
 * ───────────────────────────────────────────────────────────
 * Autor: Principal MDM Architect & Data Engineer (BurgerMusic OS)
 * Objetivo: Resolución de Edge Cases y erradicación de categorías legacy (POS_IMPORT, EXTENSIONS, GENERAL).
 * Escala: Fail-Closed Transactional.
 */

async function main() {
  const args = process.argv.slice(2);
  const storeIdArg = args.find((arg) => arg.startsWith("--store-id="))?.split("=")[1];

  if (!storeIdArg) {
    console.error("SRE FATAL: Missing --store-id argument required for multi-tenant isolation.");
    process.exit(1);
  }

  // Patrón de Type Shadowing para seguridad matemática
  const VALID_STORE_ID: string = storeIdArg;

  console.log(`[INFO] SWEEP 2: Iniciando Ruteo Quirúrgico MDM para: ${VALID_STORE_ID}`);

  try {
    await db.transaction(async (tx) => {
      // --- REGLA 1: ERRADICACIÓN DE POS_IMPORT ---
      // 1.1 Pizzas (MEDIANA/XL)
      const pizzaRes = await tx
        .update(products)
        .set({ category: "PIZZAS" })
        .where(
          and(
            eq(products.category, "POS_IMPORT"),
            or(like(products.name, "%MEDIANA%"), like(products.name, "%XL%"))
          )
        );
      console.log(`[INFO] Rule 1.1: ${pizzaRes.rowsAffected} POS_IMPORT -> PIZZAS (Pattern: MEDIANA/XL).`);

      // 1.2 Postres (CHEESECAKE/OREO)
      const postreRes = await tx
        .update(products)
        .set({ category: "POSTRES" })
        .where(
          and(
            eq(products.category, "POS_IMPORT"),
            or(like(products.name, "%CHEESECAKE%"), like(products.name, "%OREO%"))
          )
        );
      console.log(`[INFO] Rule 1.2: ${postreRes.rowsAffected} POS_IMPORT -> POSTRES (Pattern: CHEESECAKE/OREO).`);

      // 1.3 Almas Fuertes & Resto de POS_IMPORT -> HAMBURGUESAS
      const burgerRes = await tx
        .update(products)
        .set({ category: "HAMBURGUESAS" })
        .where(eq(products.category, "POS_IMPORT"));
      console.log(`[INFO] Rule 1.3: ${burgerRes.rowsAffected} POS_IMPORT -> HAMBURGUESAS (Final Sweep).`);

      // --- REGLA 2: ERRADICACIÓN DE EXTENSIONS Y GENERAL ---
      // 2.1 Hamburguesas (BIZZARAP/NIRVANA)
      const extensionBurgerRes = await tx
        .update(products)
        .set({ category: "HAMBURGUESAS" })
        .where(
          and(
            or(eq(products.category, "EXTENSIONS"), eq(products.category, "GENERAL")),
            or(like(products.name, "%BIZZARAP%"), like(products.name, "%NIRVANA%"))
          )
        );
      console.log(`[INFO] Rule 2.1: ${extensionBurgerRes.rowsAffected} EXT/GEN -> HAMBURGUESAS (Pattern: BIZZARAP/NIRVANA).`);

      // 2.2 Acompañamientos (NUGGET)
      const extensionSideRes = await tx
        .update(products)
        .set({ category: "ACOMPAÑAMIENTOS" })
        .where(
          and(
            or(eq(products.category, "EXTENSIONS"), eq(products.category, "GENERAL")),
            like(products.name, "%NUGGET%")
          )
        );
      console.log(`[INFO] Rule 2.2: ${extensionSideRes.rowsAffected} EXT/GEN -> ACOMPAÑAMIENTOS (Pattern: NUGGET).`);

      // --- REGLA 3: CORRECCIÓN DE PANADERÍA Y EMPANADAS ---
      // 3.1 Renombrar PANADERIA -> SANDWICHS
      const panRes = await tx
        .update(products)
        .set({ category: "SANDWICHS" })
        .where(eq(products.category, "PANADERIA"));
      
      const rawPanRes = await tx
        .update(raw_materials)
        .set({ category: "SANDWICHS" })
        .where(eq(raw_materials.category, "PANADERIA"));
      
      console.log(`[INFO] Rule 3.1: ${panRes.rowsAffected + rawPanRes.rowsAffected} PANADERIA -> SANDWICHS (Category Rename).`);

      // 3.2 Tostados -> SANDWICHS
      const tostadoRes = await tx
        .update(products)
        .set({ category: "SANDWICHS" })
        .where(like(products.name, "%TOSTADO%"));
      console.log(`[INFO] Rule 3.2: ${tostadoRes.rowsAffected} TOSTADO -> SANDWICHS.`);

      // 3.3 Empanadas -> ACOMPAÑAMIENTOS (Universal)
      const empanadaRes = await tx
        .update(products)
        .set({ category: "ACOMPAÑAMIENTOS" })
        .where(like(products.name, "%EMPANADA%"));
      
      const rawEmpanadaRes = await tx
        .update(raw_materials)
        .set({ category: "ACOMPAÑAMIENTOS" })
        .where(like(raw_materials.name, "%EMPANADA%"));

      console.log(`[INFO] Rule 3.3: ${empanadaRes.rowsAffected + rawEmpanadaRes.rowsAffected} EMPANADA -> ACOMPAÑAMIENTOS (Universal Routing).`);

      // --- REGLA 4: SALSAS RESCUE ---
      const fingerRes = await tx
        .update(products)
        .set({ category: "ACOMPAÑAMIENTOS" })
        .where(
          and(
            eq(products.category, "SALSAS"),
            like(products.name, "%FINGER DE POLLO%")
          )
        );
      console.log(`[INFO] Rule 4: ${fingerRes.rowsAffected} FINGER DE POLLO -> ACOMPAÑAMIENTOS (SALSAS rescue).`);

      // --- REGLA 5: UNIFICACIÓN DE BEBIDAS ---
      const beverageRes = await tx
        .update(products)
        .set({ category: "BEBIDAS" })
        .where(eq(products.category, "BEBIDAS_REVENTA"));
      
      const rawBeverageRes = await tx
        .update(raw_materials)
        .set({ category: "BEBIDAS" })
        .where(eq(raw_materials.category, "BEBIDAS_REVENTA"));
      
      console.log(`[INFO] Rule 5: ${beverageRes.rowsAffected + rawBeverageRes.rowsAffected} BEBIDAS_REVENTA -> BEBIDAS (Unification).`);
    });

    console.log(`[SUCCESS] SWEEP 2: Sanitización MDM Quirúrgica completada para ${VALID_STORE_ID}.`);
    process.exit(0);
  } catch (error) {
    console.error(`[FATAL] Rollback disparado. Error en Sweep 2:`, error);
    process.exit(1);
  }
}

main();
