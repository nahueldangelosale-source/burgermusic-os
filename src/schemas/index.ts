/**
 * Centralized Zod Schema Registry — BurgerMusic OS v3.1
 * ─────────────────────────────────────────────────────
 * Single source of truth for all Zod validation schemas and their
 * inferred types. Eliminates type fragmentation across action files.
 *
 * Re-exports from domain-specific schema files for backward compatibility.
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────
// PURCHASES — LPP Engine Schemas (Cents Only)
// ─────────────────────────────────────────────────────

export const PurchaseItemSchema = z.object({
  inventory_item_id: z.string().min(1, "inventory_item_id is required"),
  quantity: z.number().positive("quantity must be > 0"),
  total_line_cents: z.number().int("total_line_cents must be integer (cents)").positive("total_line_cents must be > 0"),
});

export const PurchaseIngestSchema = z.object({
  supplier_id: z.string().optional(),
  supplier_name: z.string().min(1, "supplier_name is required"),
  invoice_number: z.string().optional(),
  items: z.array(PurchaseItemSchema).min(1, "At least one purchase item is required"),
});

export type PurchaseIngestPayload = z.infer<typeof PurchaseIngestSchema>;
export type PurchaseItemPayload = z.infer<typeof PurchaseItemSchema>;

// ─────────────────────────────────────────────────────
// Re-exports from domain schema files
// ─────────────────────────────────────────────────────

export { RecipeIngredientSchema, RecipeUpdateSchema } from "./recipes";
export { ProductUpdateSchema, ProductBatchSchema } from "./products";
export { SupplierSchema } from "./suppliers";
export {
  InvoiceItemSchema,
  InvoiceSchema,
  ManualInvoiceSchema,
  PurchaseOrderItemSchema,
  PurchaseOrderSchema,
} from "./treasury";
export type { InvoiceInput, ManualInvoiceInput, PurchaseOrderInput } from "./treasury";
export {
  IngestionTransactionSchema,
  ExcelRowSchema,
  parseAndTransformTransaction,
  parseAndTransformTransactionsBulk,
} from "./transactions";
