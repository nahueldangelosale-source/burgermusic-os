/**
 * Phase 21.6 - Mapeador Semántico de Cajas y Consumo
 * ──────────────────────────────────────────────────
 * Motor ultra veloz para coerción estricta hacia el Canonical Schema.
 */
import { z } from "zod";

const FINANCIAL_ALIASES = [
  { canonical: "date", aliases: ["fecha caja", "fecha", ""] },
  { canonical: "box_number", aliases: ["nro caja", "nro de caja", "caja"] },
  { canonical: "shift", aliases: ["turno"] },
  { canonical: "cashier_name", aliases: ["cajero"] },
  { canonical: "opening_balance_cents", aliases: ["importe apertura"] },
  {
    canonical: "closing_balance_cents",
    aliases: ["importe cierre", "importe sobre", "importeencajascierre"],
  },
  { canonical: "shrinkage_variance_cents", aliases: ["diferencias"] },
  { canonical: "opex_cents", aliases: ["gastos"] },
  { canonical: "cash_system_cents", aliases: ["cobro a clientes x efectivo", "efectivo sistema"] },
  { canonical: "cash_pya_cents", aliases: ["cobro a clientes x efectivo pya", "efectivo pya"] },
  { canonical: "mercadopago_cents", aliases: ["cobro a clientes x mercado pago", "mercado pago"] },
  {
    canonical: "online_pya_cents",
    aliases: ["cobros a clientes x pago online pya", "p. online pya"],
  },
  { canonical: "posnet_cents", aliases: ["posnet"] },
  { canonical: "delivery_payout_cents", aliases: ["pago delivery"] },
  { canonical: "delivery_count", aliases: ["cant. delivery"] },
  { canonical: "order_count", aliases: ["cant. pedidos"] },
  { canonical: "total_revenue_cents", aliases: ["facturacion total"] },
];

const ALIAS_LOOKUP: Record<string, string> = {};
for (const item of FINANCIAL_ALIASES) {
  for (const alias of item.aliases) {
    ALIAS_LOOKUP[alias] = item.canonical;
  }
}

function normalizeKey(key: string): string {
  if (!key) return "";
  return key
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Coerción de moneda estricta (eliminar $ y comas, parsear a Float, * 100, a Integer)
 */
function parseCurrencyCents(value: any): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Math.round(value * 100);
  const cleanStr = String(value).replace(/[$\s,]/g, "");
  const floatVal = Number.parseFloat(cleanStr);
  if (isNaN(floatVal)) return 0;
  return Math.round(floatVal * 100);
}

function parseNumber(value: any): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Math.round(value);
  const num = Number.parseInt(String(value).replace(/[^\d.-]/g, ""), 10);
  return isNaN(num) ? 0 : num;
}

function parseDateISO(value: any): string {
  if (!value) return new Date().toISOString();
  let dStr = String(value).trim();
  // Intento de coerción de D/M/Y
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(dStr)) {
    const [d, m, y] = dStr.split("/");
    dStr = `${y.length === 2 ? "20" + y : y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const dateObj = new Date(dStr);
  if (isNaN(dateObj.getTime())) return new Date().toISOString();
  return dateObj.toISOString();
}

export function sanitizeClosureRow(rawRow: Record<string, any>) {
  const canonicalRow: Record<string, any> = {
    consumption_payload: {},
  };

  for (const [rawKey, value] of Object.entries(rawRow)) {
    const rawKeyClean = normalizeKey(rawKey);
    const canonicalKey = ALIAS_LOOKUP[rawKeyClean];

    if (canonicalKey) {
      if (canonicalKey === "date") {
        canonicalRow[canonicalKey] = parseDateISO(value);
      } else if (canonicalKey.endsWith("_cents")) {
        canonicalRow[canonicalKey] = parseCurrencyCents(value);
      } else if (canonicalKey.endsWith("_count") || canonicalKey === "box_number") {
        canonicalRow[canonicalKey] = parseNumber(value);
      } else {
        canonicalRow[canonicalKey] = String(value || "").trim();
      }
    } else {
      // Paso B: Agrupación Residual de Consumo
      // Asumimos que todo lo no canónico es Item de Consumo.
      if (rawKeyClean !== "") {
        canonicalRow.consumption_payload[rawKey] = Number.parseInt(String(value), 10) || 0;
      }
    }
  }

  return canonicalRow;
}

export function mapCsvDataset(dataset: Record<string, any>[]): Record<string, any>[] {
  return dataset.map(sanitizeClosureRow);
}

// Fase 30.1 - Zero-Trust Parser y Filtrado Anti-Zombie
const RowSchema = z.object({
  nrocaja: z.preprocess((val) => Number(val), z.number().int().positive()),
  cantidad: z.preprocess((val) => (val ? Number(val) : 1), z.number()),
  precio_cents: z.preprocess((val) => {
    const p = Number.parseFloat(String(val || 0).replace(/[^\d.-]/g, ""));
    return isNaN(p) ? 0 : Math.round(p * 100);
  }, z.number().int()),
});

export type ParsedRow = {
  date: string;
  box: number;
  item: string;
  qty: number;
  price_cents: number;
};

export class PivotParser {
  private lastDate: string = new Date().toISOString().split("T")[0];
  private lastBox = 1;
  public auditErrors: any[] = [];

  public parse(rawRows: any[]): ParsedRow[] {
    const result: ParsedRow[] = [];

    for (const row of rawRows) {
      const desc = row["descripcion"] || row["descripción"] || "";
      const sumPrice = row["suma_de_precio"];

      // Ignorar sumatorias vacías
      if (!desc && !sumPrice) continue;

      // Filtro Anti-Zombie: Silencia Subtotales o Filas de Intersección Pivot
      if (/total|suma/i.test(desc)) continue;

      // Forward-Fill de Fechas
      if (row["fechacaja"]) {
        this.lastDate = parseDateISO(row["fechacaja"]).split("T")[0];
      }

      // Intentar Parse Estricto Zero-Trust con Zod
      const parsed = RowSchema.safeParse({
        nrocaja: row["nrocaja"] || this.lastBox,
        cantidad: row["suma_de_cantidad"],
        precio_cents: sumPrice,
      });

      if (!parsed.success) {
        this.auditErrors.push({ rawRow: row, errors: parsed.error });
        continue; // Filtro estricto: Descartar silenciosamente
      }

      // Actualizar variables de estado
      this.lastBox = parsed.data.nrocaja;

      result.push({
        date: this.lastDate,
        box: this.lastBox,
        item: String(desc).trim(),
        qty: parsed.data.cantidad,
        price_cents: parsed.data.precio_cents,
      });
    }

    return result;
  }
}
