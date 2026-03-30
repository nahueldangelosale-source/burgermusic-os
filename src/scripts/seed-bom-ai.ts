import * as fs from "fs";
import * as path from "path";
import { loadEnvConfig } from "@next/env";
import Papa from "papaparse";
loadEnvConfig(process.cwd());

async function main() {
  console.log("🚀 Iniciando Motor ETL Local para Master Data Management...");

  const filePath = path.join(process.cwd(), "bom_template.csv");
  if (!fs.existsSync(filePath)) {
    console.error("❌ Archivo bom_template.csv no encontrado.");
    process.exit(1);
  }
  const csvContent = fs.readFileSync(filePath, "utf-8");

  const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
  const rows = parsed.data as any[];

  console.log(`🧠 Parseo local CSV completo. Filas encontradas: ${rows.length}`);

  // Dynamic Schema/DB Resolution (Bypassing TSX Hoisting)
  const { db } = await import("../db");
  const { products, mdm_ingredients, bom_recipes } = await import("../db/schema");

  console.log("💾 Iniciando Transacción Idempotente (O(1)) en Turso DB...");

  try {
    await db.transaction(async (tx) => {
      for (const item of rows) {
        const cateRaw = item.Categoria || "MENÚ";
        const catStr = cateRaw.toLowerCase().includes("hamburguesa")
          ? "BURGER"
          : cateRaw.toLowerCase().includes("acompañar")
            ? "SIDE"
            : cateRaw.toLowerCase().includes("bebida")
              ? "BEVERAGE"
              : cateRaw.toLowerCase().includes("ensalada")
                ? "SALAD"
                : "DESSERT";

        const productId = `PRD_${(item.Nombre || "")
          .toUpperCase()
          .replace(/\s+/g, "_")
          .replace(/[^A-Z0-9_]/g, "")}`;
        if (!productId || productId === "PRD_") continue;

        // 1. Inserción de Producto (onConflictDoNothing)
        await tx
          .insert(products)
          .values({
            id: productId,
            name: item.Nombre,
            category: catStr as "BURGER" | "SIDE" | "BEVERAGE" | "SALAD" | "DESSERT",
            sellingPrice: 1000000,
            costCents: 0,
          })
          .onConflictDoNothing();

        console.log(`- Procesando Producto: ${item.Nombre}`);

        const desc = (item.Descripcion || "").toUpperCase();

        // Mapeo Heurístico Básico para reemplazar la latencia de IA
        const ingredientsMap: Record<string, number> = {};

        if (desc.includes("CHEDDAR"))
          ingredientsMap["INS_CHEDDAR"] =
            (desc.match(/DOBLE CHEDDAR/g) || desc.match(/CHEDDAR/g) || []).length > 1 ? 2 : 1;
        if (desc.includes("CARNE"))
          ingredientsMap["INS_MEDALLON_CARNE"] = desc.includes("DOBLE") ? 2 : 1;
        if (desc.includes("PANCETA")) ingredientsMap["INS_PANCETA"] = 1;
        if (desc.includes("HUEVO")) ingredientsMap["INS_HUEVO"] = 1;
        if (desc.includes("CEBOLLA")) ingredientsMap["INS_CEBOLLA"] = 1;
        if (desc.includes("POLLO")) ingredientsMap["INS_POLLO_CRISPY"] = 1;
        if (desc.includes("INCLUYE PAPAS")) ingredientsMap["INS_PAPA_BASTON_PORCION"] = 1;
        if (desc.includes("TOMATE")) ingredientsMap["INS_TOMATE"] = 1;
        if (desc.includes("LECHUGA")) ingredientsMap["INS_LECHUGA"] = 1;

        for (const [canonicalId, qty] of Object.entries(ingredientsMap)) {
          // 2. Inserción MDM
          await tx
            .insert(mdm_ingredients)
            .values({
              id: canonicalId,
              canonical_name: canonicalId.replace("INS_", "").replace(/_/g, " "),
            })
            .onConflictDoNothing();

          // 3. Relación BOM
          await tx
            .insert(bom_recipes)
            .values({
              id: `BOM_${productId}_${canonicalId}`,
              product_sku: productId,
              ingredient_id: canonicalId,
              theoretical_qty: qty,
            })
            .onConflictDoNothing();

          console.log(`    -> [BOM] ${qty}x ${canonicalId.replace("INS_", "")}`);
        }
      }
    });

    console.log("✅ Seed Atómico Completado Correctamente. (Exit Code: 0)");
    process.exit(0);
  } catch (e: any) {
    console.error("❌ Error Crítico en Transacción:", e.message);
    process.exit(1);
  }
}

main();
