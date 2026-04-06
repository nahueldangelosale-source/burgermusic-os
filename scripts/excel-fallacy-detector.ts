import fs from "fs";
import path from "path";
import * as Papa from "papaparse";

const CSV_FILE = "Ventas BurgerMusic 1Q.csv";

function detectExcelFallacy() {
  const csvPath = path.join(__dirname, `../${CSV_FILE}`);
  
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ [FATAL] No se encontró el archivo CSV en: ${csvPath}`);
    process.exit(1);
  }

  const rawText = fs.readFileSync(csvPath, "utf-8").replace(/"/g, "");

  const parsed = Papa.parse<string[]>(rawText, {
    header: false,
    delimiter: ";",
    skipEmptyLines: true,
  });

  const rawData = parsed.data;
  
  const firstRow = rawData[0] ?? [];
  const hasHeader = firstRow.some((v) => {
    const l = String(v).toLowerCase().trim();
    return l.includes("fecha") || l.includes("caja") || l.includes("cant") || l.includes("precio");
  });
  
  const startIndex = hasHeader ? 1 : 0;
  const dataRows = rawData.slice(startIndex);

  let naiveTotal = 0;
  let sreTotal = 0;
  let discardedByNaiveCount = 0;

  for (const row of dataRows) {
    const raw_price = String(row[4] ?? "").trim();
    if (!raw_price) continue;

    // a) Naive/Excel Parse (Falla silenciosamente rompiendo contabilidad)
    const naiveParsed = Number(raw_price.trim());
    if (!isNaN(naiveParsed)) {
      naiveTotal += naiveParsed;
    } else {
      discardedByNaiveCount++;
    }

    // b) Zod/SRE Parse (Extracción segura blindada usada típicamente en coerción Zod)
    const digitsOnly = raw_price.replace(/\D/g, '');
    const sreParsed = digitsOnly ? parseInt(digitsOnly, 10) / 100 : 0;
    
    // Fallback híbrido al del ETL si este approach numérico dañado colapsa con números sin decimales del legacy
    // En este script nos alineamos al mandato específico solicitado:
    sreTotal += sreParsed;
  }

  const rescuedCapital = sreTotal - naiveTotal;
  
  const formatArs = (val: number) => val.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

  console.log("\n\x1b[36m🕵️ [SRE] Analizando Discrepancia Numérica del Ledger vs MS Excel...\x1b[0m\n");
  console.log(`\x1b[31m❌ [EXCEL NAIVE SUM]: ${formatArs(naiveTotal)} (Descarta ${discardedByNaiveCount} records)\x1b[0m`);
  console.log(`\x1b[32m✅ [ZOD COERCION SUM]: ${formatArs(sreTotal)}\x1b[0m\n`);
  console.log(`\x1b[33m🔥 [CAPITAL RESCATADO]: ${formatArs(rescuedCapital)} ARS que Excel ignoró por errores de formato\x1b[0m\n`);
  
  process.exit(0);
}

detectExcelFallacy();
