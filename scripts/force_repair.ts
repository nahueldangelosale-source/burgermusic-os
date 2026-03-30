import { repairProductCatalog } from "../src/actions/repair-catalog";
import * as dotenv from "dotenv";

dotenv.config();

async function run() {
  console.log("Iniciando reparación forzada del catálogo...");
  const result = await repairProductCatalog();
  console.log("Resultado:", JSON.stringify(result, null, 2));
  process.exit(0);
}

run();
