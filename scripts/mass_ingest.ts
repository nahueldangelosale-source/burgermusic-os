// @ts-nocheck
import fs from "fs";
import { parse } from "csv-parse/sync";
import { db } from "../src/db";
import { products } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function massIngest() {
  console.log("🚀 Iniciando Ingesta Masiva Executive Grade...");

  // 1. Leer Archivos
  const preciosPath = "d:/Musica Descargada/BurgerMusic/precios_menu_2026.csv";
  const bomPath = "d:/Musica Descargada/BurgerMusic/bom_template.csv";

  const preciosRaw = fs.readFileSync(preciosPath, "utf-8");
  const bomRaw = fs.readFileSync(bomPath, "utf-8");

  const preciosData = parse(preciosRaw, { columns: true, skip_empty_lines: true });
  const bomData = parse(bomRaw, { columns: true, skip_empty_lines: true });

  console.log(`📊 Leídos: ${preciosData.length} precios, ${bomData.length} composiciones.`);

  // 2. Indexar Descripciones del BOM
  const bomLookup = new Map();
  for (const row of bomData) {
    bomLookup.set(row.Nombre.trim().toUpperCase(), row.Descripcion);
  }

  // 3. Procesar e Inyectar
  let count = 0;
  for (const row of preciosData) {
    const name = row.Nombre.trim();
    const cat = row.Categoria.trim();
    const price = parseInt(row.Precio) || 0;
    
    // Formato solicitado: PDR_ + Nombre
    const rawId = name.toUpperCase().replace(/[^A-Z0-9]/g, "_").slice(0, 30);
    const sku = "PDR_" + rawId;
    const id = "PDR_" + rawId; // Sincronizamos ID y SKU para evitar fragmentación

    const description = bomLookup.get(name.toUpperCase()) || "Sin descripción (Carga Masiva)";

    try {
      const exists = await db.select().from(products).where(eq(products.id, id));
      
      const payload = {
        id,
        sku,
        name: name,
        category: cat,
        isSaleable: true,
        base_price_cents: price * 100,
        sellingPrice: price * 100,
        description: description,
        unit: "UNIDAD"
      };

      if (exists.length > 0) {
        await db.update(products).set(payload).where(eq(products.id, id));
      } else {
        await db.insert(products).values(payload);
      }
      count++;
    } catch (err) {
      console.error(`❌ Error con ${name}:`, err);
    }
  }

  console.log(`✅ Finalizado. ${count} productos inyectados/actualizados.`);
  process.exit(0);
}

massIngest().catch(e => {
  console.error("💥 Falla crítica:", e);
  process.exit(1);
});
