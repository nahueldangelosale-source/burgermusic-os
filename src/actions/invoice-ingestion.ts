"use server";

import { db } from "@/db";
import { supplier_item_mappings } from "@/db/schema/supply";
import { eq, and } from "drizzle-orm";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * LÓGICA ZERO-TRUST: INGESTA DE FACTURAS (invoice-ingestion.ts)
 * 
 * Busca un ítem crudo (tal cual viene de la factura) en la ACL de mapeo 
 * `supplier_item_mappings`.
 * 
 * FAIL-CLOSED: Si no existe el mapeo, se corta la ejecución con un error
 * determinista para forzar la UI de Fricción Positiva (Homologación).
 * ─────────────────────────────────────────────────────────────────────────────
 */

export async function ingestInvoiceLineItem(supplierId: string, rawItemName: string) {
  // Búsqueda estricta (Zero-Trust)
  const [mapping] = await db
    .select({
      internalIngredientId: supplier_item_mappings.internalIngredientId,
      conversionFactor: supplier_item_mappings.conversionFactor,
    })
    .from(supplier_item_mappings)
    .where(
      and(
        eq(supplier_item_mappings.supplierId, supplierId),
        eq(supplier_item_mappings.supplierItemName, rawItemName)
      )
    )
    .limit(1);

  if (!mapping) {
    // Falla cerrada: Interlock transaccional. Requiere intervención C-Level / Manager.
    throw new Error("REQUIRES_HUMAN_MAPPING", { 
      cause: { supplierId, rawItemName } 
    });
  }

  return {
    internalIngredientId: mapping.internalIngredientId,
    conversionFactor: mapping.conversionFactor,
  };
}
