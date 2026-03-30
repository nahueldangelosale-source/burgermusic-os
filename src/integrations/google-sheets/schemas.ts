import { z } from "zod";

/**
 * Utility to clean currency strings before Zod validation/coercion.
 * "$12.500,50" -> "12500.50"
 */
export function cleanCurrencyString(val: unknown): string {
  if (typeof val !== "string") return String(val || "0");
  return val.replace(/\$/g, "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
}

/**
 * Strict Schema for a single row of the Daily Cash Closure Sheet.
 * This represents the "Contract" between the Spreadsheet and our Database.
 */
export const DailyClosureRowSchema = z.object({
  date: z.string().min(1, "Fecha requerida"),
  day: z.string().optional().nullable(),
  zClose: z.preprocess(cleanCurrencyString, z.coerce.number().default(0)),
  shift: z.string().optional().nullable(),
  totalMp: z.preprocess(cleanCurrencyString, z.coerce.number().default(0)),
  salesDelivery: z.preprocess(cleanCurrencyString, z.coerce.number().default(0)),
  totalDelivery: z.preprocess(cleanCurrencyString, z.coerce.number().default(0)),
  totalGlobal: z.preprocess(cleanCurrencyString, z.coerce.number().default(0)),
  variance: z.preprocess(cleanCurrencyString, z.coerce.number().default(0)),
  laborCost: z.preprocess(cleanCurrencyString, z.coerce.number().optional().default(0)),
});

export type DailyClosureRow = z.infer<typeof DailyClosureRowSchema>;

export const VALID_MONTHS = [
  "ENERO",
  "FEBRERO",
  "MARZO",
  "ABRIL",
  "MAYO",
  "JUNIO",
  "JULIO",
  "AGOSTO",
  "SEPTIEMBRE",
  "OCTUBRE",
  "NOVIEMBRE",
  "DICIEMBRE",
];

/**
 * Mapping of Spreadsheet Header Names to Schema Keys.
 * This allows the ETL to find the right data regardless of column order.
 */
export const HEADER_MAP: Record<string, keyof DailyClosureRow> = {
  FECHA: "date",
  CAJERO: "day", // Currently used as 'day' or 'cajero' in the sheet
  DÍA: "day",
  Z: "zClose",
  TURNO: "shift",
  "TOTAL MP": "totalMp",
  "MERCADO PAGO": "totalMp",
  "DELIVERY EFEC": "salesDelivery",
  "PEDIDOS YA EFEC": "salesDelivery",
  "TOTAL DELIVERY": "totalDelivery", // Count or amount depending on sheet version
  "FACTURACION TOTAL": "totalGlobal",
  "TOTAL GLOBAL": "totalGlobal",
  FALTANTES: "variance",
  "SOBRAN/FALTAN": "variance",
  "COSTO LABORAL": "laborCost",
  PERSONAL: "laborCost",
};
