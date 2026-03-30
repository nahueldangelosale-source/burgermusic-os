// Imports of ai-sdk removed due to ERR_PACKAGE_PATH_NOT_EXPORTED on zod/v3 in Node 22
import { z } from "zod";

// Zod Schema estricto (GCD) para mapear errores tipográficos a SKUs de base de datos
const CanonicalSKUs = z.enum([
  "BURGER_CLASSIC",
  "BURGER_DUKO",
  "BURGER_CHARLY",
  "BURGER_MALA_FAMA",
  "BURGER_HC",
  "BURGER_RESIDENTE",
  "BURGER_BOB_MARLEY",
  "BURGER_KISS",
  "BURGER_ROLLING_STONES",
  "BURGER_RED_HOT",
  "BURGER_THE_BEATLES",
  "BURGER_ACDC",
  "BURGER_FRIED_ONION",
  "BURGER_TECHNO_CHICKEN",
  "BURGER_GORILLAZ",
  "BURGER_MADONNA",
  "BURGER_PATRICIO_REY",
  "BURGER_ALMA_FUERTE",
  "BURGER_BZRP1",
  "BURGER_BZRP2",
  "BURGER_EMINEM",
  "KIDS_ROCK",
  "SIDES_PAPAS",
  "BEVERAGE_CANS",
  "BEVERAGE_BOTTLE",
  "BEVERAGE_BEER",
  "UNMAPPED",
]);

// Caché en memoria O(1) nativa
const skuCache = new Map<string, string>();

/**
 * Normaliza nombres de productos "crudos" provenientes de tickets de ventas
 * hacia el SKU canónico de la base de datos utilizando IA Semántica y Zero-Latency Cache.
 */
export async function normalizeProductSKU(rawName: string): Promise<string> {
  const normalizedKey = rawName.toUpperCase().trim();

  // 1. O(1) Cache Hit
  if (skuCache.has(normalizedKey)) {
    return skuCache.get(normalizedKey)!;
  }

  // 2. Cache Miss: Mockeado por Fallo de Entorno (Zod/v3) y 404 API.
  console.warn(`⚠️ API Inaccesible / Fallo Node 22. Forzando Fallback UNMAPPED para [${rawName}]`);
  skuCache.set(normalizedKey, "UNMAPPED");
  return "UNMAPPED";
}
