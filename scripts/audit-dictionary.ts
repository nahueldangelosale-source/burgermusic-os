import { db } from "../src/db";
import { sku_aliases } from "../src/db/schema";
import { sql } from "drizzle-orm";

async function auditDictionary() {
  console.log("\x1b[36m\n🕵️ [SRE] Iniciando Diagnóstico de Memoria MDM...\x1b[0m\n");

  try {
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(sku_aliases);
      
    const count = countResult[0]?.count || 0;

    if (count === 0) {
      console.log(`\x1b[31m❌ [AMNESIA MDM]: La tabla sku_aliases está VACÍA. Requiere intervención en UI.\x1b[0m\n`);
    } else {
      console.log(`\x1b[32m✅ [MEMORIA ACTIVA]: ${count} alias encontrados en Turso DB.\x1b[0m\n`);
      
      const top5 = await db.select().from(sku_aliases).limit(5);
      console.log("   Muestra representativa (Top 5):");
      top5.forEach((alias, i) => {
        console.log(`   ${i + 1}. [${alias.raw_sku}] → ${alias.product_id}`);
      });
      console.log();
    }
    
    process.exit(0);

  } catch (error) {
    console.error("\x1b[31m❌ [FATAL ERROR] Falla en la validación del Diccionario MDM:\x1b[0m", error);
    process.exit(1);
  }
}

auditDictionary();
