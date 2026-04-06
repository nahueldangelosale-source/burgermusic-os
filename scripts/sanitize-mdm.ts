import { db } from "@/db";
import { sql } from "drizzle-orm";

async function run() {
  console.log("🕵️ Iniciando Sanitización de Duplicados MDM...");

  // Eliminamos físicamente los registros fantasma dejando el de menor rowid
  await db.run(sql`
    DELETE FROM products 
    WHERE rowid NOT IN (
      SELECT min(rowid) 
      FROM products 
      GROUP BY id
    )
  `);

  console.log("✅ MDM Sanitizado: Duplicados erradicados.");
  process.exit(0);
}

run().catch(err => {
  console.error("Error sanitizando MDM:", err);
  process.exit(1);
});
