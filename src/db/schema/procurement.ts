import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { products, suppliers } from "../schema";

export const ProcurementStatusEnum = [
  "PENDING_APPROVAL",
  "PO_EMITTED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "MATCHED",
  "BLOCKED",
  "PAYABLE",
] as const;

export const purchase_requisitions = sqliteTable("proc_purchase_requisitions", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  requestedBy: text("requested_by").notNull(),
  status: text("status", { enum: ProcurementStatusEnum }).default("PENDING_APPROVAL"),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

export const pr_items = sqliteTable("proc_pr_items", {
  id: text("id").primaryKey(),
  prId: text("pr_id").references(() => purchase_requisitions.id),
  ingredientSku: text("ingredient_sku").references(() => products.id),
  qty: real("qty").notNull(),
});

export const purchase_orders = sqliteTable("proc_purchase_orders", {
  id: text("id").primaryKey(),
  prId: text("pr_id").references(() => purchase_requisitions.id),
  supplierId: text("supplier_id").references(() => suppliers.id),
  status: text("status", { enum: ProcurementStatusEnum }).default("PO_EMITTED"),
  totalExpected: real("total_expected"),
  storeId: text("store_id").notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

export const po_items = sqliteTable("proc_po_items", {
  id: text("id").primaryKey(),
  poId: text("po_id").references(() => purchase_orders.id),
  ingredientSku: text("ingredient_sku").references(() => products.id),
  qty: real("qty").notNull(),
  frozenPriceCents: integer("frozen_price_cents").notNull(),
});

export const goods_receipts = sqliteTable("proc_goods_receipts", {
  id: text("id").primaryKey(),
  poId: text("po_id").references(() => purchase_orders.id),
  ingredientSku: text("ingredient_sku").references(() => products.id),
  qtyReceived: real("qty_received").notNull(),
  storeId: text("store_id").notNull(),
  receivedAt: text("received_at").default(sql`(CURRENT_TIMESTAMP)`),
});

export const invoice_receipts = sqliteTable("proc_invoice_receipts", {
  id: text("id").primaryKey(),
  poId: text("po_id").references(() => purchase_orders.id),
  ingredientSku: text("ingredient_sku").references(() => products.id),
  invoicedQty: real("invoiced_qty").notNull(),
  invoicedPriceCents: integer("invoiced_price_cents").notNull(),
  invoiceId: text("invoice_id").notNull(),
  storeId: text("store_id").notNull(),
});
