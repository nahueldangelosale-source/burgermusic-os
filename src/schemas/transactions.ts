import { z } from "zod";
import { randomUUID } from "node:crypto";

export const IngestionTransactionSchema = z.preprocess((val: any) => {
  if (!val || typeof val !== "object") return val;
  const normalized: any = { ...val };
  
  // Base Line Fallbacks (Strict Fallbacks for Date and Str)
  normalized.quantity = 1;
  normalized.net_price_cents = 0;
  
  // Date must be perfectly 10 chars.
  let baseDate = String(val.FechaCaja || "").trim();
  if (baseDate.length < 10) baseDate = new Date().toISOString().split("T")[0];
  normalized.date = baseDate.substring(0, 10);
  
  normalized.raw_name = String(val.Descripcion || "GENERIC_VAULT_ITEM").trim();

  for (const key of Object.keys(val)) {
    const cleanKey = String(key).trim().toUpperCase();
    if (cleanKey.includes("FECHA")) {
      let d = val[key];
      if (typeof d === "number") {
        const step = d > 59 ? 25569 : 25568;
        d = new Date((d - step) * 86400 * 1000).toISOString().split("T")[0];
      } else if (typeof d === "string" && d.includes("/")) {
        const parts = d.split("/");
        if (parts.length === 3) {
          const p1 = parts[0].trim();
          const p2 = parts[1].trim();
          let p3 = parts[2].trim();
          
          // Soporte para años cortos (ej. '26' -> '2026')
          if (p3.length === 2 && parseInt(p3) >= 0) {
             p3 = `20${p3}`;
          }

          if (p3.length === 4) { // DD/MM/YYYY
            d = `${p3}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`;
          } else if (p1.length === 4) { // YYYY/MM/DD
            d = `${p1}-${p2.padStart(2, '0')}-${p3.padStart(2, '0')}`;
          }
        }
      }
      // Sanitizar fecha, asegurando 10 chars mínimos
      const parsedDate = String(d || "").split(" ")[0].trim();
      if (parsedDate.length >= 10) normalized.date = parsedDate.substring(0, 10);
    }
    else if (cleanKey.includes("CAJA") && (cleanKey.includes("ID") || cleanKey.includes("NRO"))) normalized.store_id = String(val[key]);
    else if (cleanKey.includes("ARTICULO") || cleanKey.includes("DESCRIP")) normalized.raw_name = String(val[key]).trim();
    else if (cleanKey.includes("CANTIDAD") || cleanKey.includes("CANT") || cleanKey.includes("QTY")) {
      const parsedVal = typeof val[key] === "number" ? val[key] : Number(String(val[key] || "1").replace(/[^0-9.-]+/g, ""));
      normalized.quantity = Math.max(1, parseInt(String(parsedVal || 1), 10));
    }
    else if (cleanKey.includes("PRECIO") || cleanKey.includes("VALOR") || cleanKey.includes("IMPORTE") || cleanKey.includes("MONTO")) {
       const p = typeof val[key] === "number" ? val[key] : Number(String(val[key] || "0").replace(/[^0-9.-]+/g, ""));
       normalized.net_price_cents = Math.round((p || 0) * 100);
    }
  }

  // Absolute Math Sanity Checks
  normalized.quantity = isNaN(normalized.quantity) ? 1 : normalized.quantity;
  normalized.net_price_cents = isNaN(normalized.net_price_cents) ? 0 : normalized.net_price_cents;
  
  return normalized;
}, z.object({
  id: z.string().uuid().optional(),
  date: z.string().min(10), // Now safe because preprocess enforces it
  shift: z.string().default("UNKNOWN").catch("UNKNOWN"),
  raw_name: z.string().catch("VAULT_ITEM"),
  product_sku: z.string().optional(),
  productSku: z.string().optional(),
  // Replace Zod coercion with pure number, since preprocess handled coercion
  quantity: z.number().catch(1), 
  net_price_cents: z.number().catch(0),
  store_id: z.string(),
  storeId: z.string(),
}).transform((val) => {
  return {
    id: val.id || randomUUID(),
    date: val.date,
    shift: val.shift,
    raw_name: val.raw_name,
    productSku: val.productSku || val.product_sku || "MISC_UNKNOWN",
    quantity: val.quantity,
    net_price_cents: val.net_price_cents,
    storeId: val.storeId || val.store_id,
  };
}));

function normalizeExcelDateFast(val: string): string {
  let d = val;
  if (d.includes(".")) d = d.replace(/\./g, "/");

  if (d.includes("/")) {
    const parts = d.split("/");
    if (parts.length === 3) {
      const p1 = parts[0].trim();
      const p2 = parts[1].trim();
      let p3 = parts[2].trim();
      if (p3.length === 2 && parseInt(p3) >= 0) p3 = `20${p3}`;
      
      if (p3.length === 4) {
        d = `${p3}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`;
      } else if (p1.length === 4) {
        d = `${p1}-${p2.padStart(2, '0')}-${p3.padStart(2, '0')}`;
      }
    }
  }
  const parsed = d.split(" ")[0].trim();
  return parsed.length >= 8 ? parsed.substring(0, 10) : val;
}

export const ExcelRowSchema = z.object({
  cantidad: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return NaN;
    return val;
  }, z.coerce.number()),
  precio: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return NaN;
    if (typeof val === 'string') {
      let clean = val.replace(/\$/g, '').replace(/\s/g, '');
      if (clean === "") return NaN;
      
      const lastComma = clean.lastIndexOf(',');
      const lastDot = clean.lastIndexOf('.');
      
      if (lastComma !== -1 && lastDot !== -1) {
          if (lastComma > lastDot) {
              // LatAm: 14.800,50
              clean = clean.replace(/\./g, '').replace(',', '.');
          } else {
              // US: 14,800.50
              clean = clean.replace(/,/g, '');
          }
      } else if (lastComma !== -1) {
          // Solo coma. Si tiene 3 dígitos exactos post-coma, es separador de miles. Sino, decimal.
          if (clean.length - lastComma - 1 === 3) {
              clean = clean.replace(/,/g, ''); // Ej: 14,800 -> 14800
          } else {
              clean = clean.replace(',', '.'); // Ej: 14,50 -> 14.50
          }
      } else if (lastDot !== -1) {
          // Solo punto. Si tiene 3 dígitos exactos post-punto, es separador de miles LatAm. Sino, decimal US nativo.
          if (clean.length - lastDot - 1 === 3) {
              clean = clean.replace(/\./g, ''); // Ej: 14.800 -> 14800
          }
      }
      return Number(clean);
    }
    return val;
  }, z.coerce.number()),
  nroCaja: z.coerce.string(),
  fecha: z.preprocess((val: any) => {
    if (typeof val === "number") {
      // Zero-Trust: Conversión atómica de fecha serial de Excel a ISO YYYY-MM-DD
      const step = val > 59 ? 25569 : 25568;
      return new Date((val - step) * 86400 * 1000).toISOString().split("T")[0];
    }
    if (typeof val === "string") {
      return normalizeExcelDateFast(val);
    }
    return val;
  }, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido. Requiere YYYY-MM-DD.")),
  descripcion: z.coerce.string().trim().transform(v => v === "" ? "MISC_UNKNOWN" : v).catch("MISC_UNKNOWN")
});

export function parseAndTransformTransaction(rawData: unknown) {
  return IngestionTransactionSchema.parse(rawData);
}

export function parseAndTransformTransactionsBulk(rawData: unknown[]) {
  return z.array(IngestionTransactionSchema).parse(rawData);
}
