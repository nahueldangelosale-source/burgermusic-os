import * as Papa from "papaparse";

const rawDataStr = `;;AROS DE CEBOLLA X 12 + PAPAS + BBQ;1;" $ 8,600.00 "
;;"Beatle Doble 220g ";1;" $ 15,600.00 "
;;"Bob Marley Doble ";1;" $ 15,100.00 "
;;cambio x dip cheddar;1;" $ 1,800.00 "
3/10/26;393696;Agua 500cc;1;" $ 2,100.00 "
;;"Alma Fuerte ";1;" $ 13,500.00 "`;

function parseDateHeuristic(rawDateStr: string): string | null {
  if (!rawDateStr || rawDateStr.trim() === "") return null;
  const parts = rawDateStr.trim().split(/[\/\-]/);
  if (parts.length >= 2) {
    const dStr = parts[0];
    const mStr = parts[1];
    const yStr = parts.length === 3 ? parts[2] : "";

    let d, m, y;
    if (yStr.length === 2) {
      // MM/DD/YY
      m = parseInt(dStr, 10) - 1;
      d = parseInt(mStr, 10);
      y = 2000 + parseInt(yStr, 10);
    } else {
      // DD/MM/YYYY
      d = parseInt(dStr, 10);
      m = parseInt(mStr, 10) - 1;
      y = yStr ? parseInt(yStr, 10) : new Date().getFullYear();
    }
    const dt = new Date(y, m, d);
    if (!isNaN(dt.getTime())) {
       // Manual ISO string to prevent timezone bias slipping into UTC previous day
       const pad = (n: number) => n.toString().padStart(2, '0');
       return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    }
  }
  return new Date().toISOString().split("T")[0];
}

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
const rebuiltParsed = Papa.parse(rebuiltCsv, { header: true, skipEmptyLines: true });
let currentFecha = "";

for (const row of rebuiltParsed.data as any[]) {
  const rawFecha = row["FechaCaja"] || "";
  if (rawFecha.trim()) currentFecha = rawFecha.trim();
  
  const fechaEfectiva = currentFecha;
  const rawDesc = row["Descripcion"] || "";
  const rawPriceStr = row[" Suma de Precio"] || row["Precio"] || "0";
  
  // Robust price parser matching sales-sync.ts upgrade
  let cleanStr = rawPriceStr.replace(/[^0-9,\.]/g, "");
  const matchPrice = cleanStr.match(/(.*)[,\.]([0-9]{2})$/);
  if (matchPrice) {
      cleanStr = matchPrice[1].replace(/[,\.]/g, "") + "." + matchPrice[2];
  } else {
      cleanStr = cleanStr.replace(/[,\.]/g, "");
  }
  const parsedPrice = parseFloat(cleanStr);
  const priceToInsert = Math.round((isNaN(parsedPrice) ? 0 : parsedPrice) * 100);
  
  const parsedDate = parseDateHeuristic(fechaEfectiva);
  
  console.log(`Row: Desc="${rawDesc}" | rawPrice="${rawPriceStr}" -> parsedPrice=${parsedPrice} (${priceToInsert} cents) | rawFecha=${rawFecha} -> EffectiveDate=${fechaEfectiva} -> ParsedDate=${parsedDate}`);
}
