import "dotenv/config";
import { processBomCsv } from "../actions/mdm-ingestion";
import * as fs from "fs";
import * as path from "path";

async function run() {
  try {
    const csvPath = path.join(process.cwd(), "bom_template.csv");
    const content = fs.readFileSync(csvPath, "utf-8");
    console.log("Iniciando inyección estructural O(1) desde: " + csvPath);
    const res = await processBomCsv(content);
    console.log("Estado de red BOM:", res);
    process.exit(0);
  } catch (error) {
    console.error("Error catastrófico en script:", error);
    process.exit(1);
  }
}

run();
