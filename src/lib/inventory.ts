import { z } from "zod";

/**
 * Inventory Guardrails (Antigravity 2026 Standard)
 * ───────────────────────────────────────────────
 * Strict Zod schemas to ensure UOM integrity and 
 * prevent corruption of the physical-to-recipe conversion layer.
 */

export const SnapshotStatusSchema = z.enum(["DRAFT", "RECONCILED"]);

export const DraftSnapshotSchema = z.object({
  storeId: z.string().min(1, "Store ID is mandatory"),
  reportedBy: z.string().min(1, "Reporter name is mandatory"),
  items: z.array(z.object({
    rawMaterialId: z.string().min(1),
    count: z.number().nonnegative(),
  })).min(1, "At least one item required"),
});

export const POSPayloadSchema = z.object({
  store_id: z.string().min(1),
  ticket_id: z.string().min(1),
  timestamp: z.string().datetime(),
  items: z.array(z.object({
    name: z.string().min(1),
    qty: z.number().int().positive(),
    price_cents: z.number().int().nonnegative()
  })).min(1),
});

export const UOMGuardrailSchema = z.object({
  purchaseUnit: z.string().min(1, "Purchase unit is mandatory"),
  recipeUnit: z.string().min(1, "Recipe unit is mandatory"),
  conversionFactor: z.number().positive("Conversion factor must be strictly positive (Zero-Trust)"),
});

export const SnapshotItemSchema = z.object({
  rawMaterialId: z.string().uuid("Invalid Raw Material ID"),
  physicalCountPurchaseUnit: z.number().nonnegative("Physical count cannot be negative"),
});

export const InventorySnapshotSchema = z.object({
  storeId: z.string().min(1),
  status: SnapshotStatusSchema.default("DRAFT"),
  items: z.array(SnapshotItemSchema).min(1, "At least one item required for snapshot"),
});
