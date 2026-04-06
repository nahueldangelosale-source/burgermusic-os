import { db } from "../src/db";
import { sales_mapping_dlq } from "../src/db/schema";

async function nukeDlq() {
  console.log("\x1b[36m\n🕵️ [SRE] Iniciando Purga Termodinámica del Purgatorio DLQ...\x1b[0m\n");

  try {
    await db.delete(sales_mapping_dlq);
    console.log("\x1b[32m✅ [ZERO-ENTROPY]: Purgatorio DLQ desintegrado físicamente.\x1b[0m\n");
    process.exit(0);
  } catch (error) {
    console.error("\x1b[31m❌ [FATAL ERROR] Falla en la purga del DLQ:\x1b[0m", error);
    process.exit(1);
  }
}

nukeDlq();
