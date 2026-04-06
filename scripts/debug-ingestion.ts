import * as Papa from "papaparse";
import * as dotenv from 'dotenv';
import path from 'path';
import { db } from '../src/db';
import { sql } from 'drizzle-orm';
import { fact_sales } from '../src/db/schema';
import { ingestSalesCSV } from '../src/actions/sales-sync';

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

const rawDataStr = `;;AROS DE CEBOLLA X 12 + PAPAS + BBQ;1;" $ 8,600.00 "
;;"Beatle Doble 220g ";1;" $ 15,600.00 "
;;"Bob Marley Doble ";1;" $ 15,100.00 "
;;cambio x dip cheddar;1;" $ 1,800.00 "
3/10/26;393696;Agua 500cc;1;" $ 2,100.00 "
;;"Alma Fuerte ";1;" $ 13,500.00 "`;

async function testIngest() {
  console.log("=== STEP 1: PARSING CSV (Like IngestionAirlocks) ===");
  const results = Papa.parse(rawDataStr, { header: false, skipEmptyLines: true });
  const rawData = results.data as string[][];
  
  const mapping = { fecha: 0, nroCaja: 1, descripcion: 2, cantidad: 3, precio: 4 };
  const standardHeaders = ["FechaCaja", "NroCaja", "Descripcion", "Suma de Cantidad", " Suma de Precio"];
  const mappedRows = [];
  
  const isHeaderRow = rawData[0] && rawData[0].some(val => {
    const lower = String(val).toLowerCase();
    return lower.includes("fec") || lower.includes("caja") || lower.includes("cant") || lower.includes("prec");
  });
  
  const startIndex = isHeaderRow ? 1 : 0;
  
  for (let i = startIndex; i < rawData.length; i++) {
    const row = rawData[i];
    mappedRows.push([
      row[mapping.fecha] || "",
      row[mapping.nroCaja] || "",
      row[mapping.descripcion] || "",
      row[mapping.cantidad] || "1",
      row[mapping.precio] || "0",
    ]);
  }
  
  const rebuiltCsv = Papa.unparse({ fields: standardHeaders, data: mappedRows }, { delimiter: ";" });
  console.log("=== STEP 2: REBUILT CSV ===");
  console.log(rebuiltCsv);
  
  console.log("=== STEP 3: SALES SYNC ===");
  const res = await ingestSalesCSV(rebuiltCsv);
  console.dir(res, { depth: null });
  
  process.exit(0);
}

testIngest().catch(console.error);
