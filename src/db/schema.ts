// Drizzle ORM Schema Definitions
import { sqliteTable, text, integer, blob, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// --- USUARIOS (Base) ---
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role', { enum: ["MANAGER", "KITCHEN", "RECEIVER"] }).notNull(),
  pin_hash: text('pin_hash').notNull(), // Plaintext PIN for MVP, Hash in Prod
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// --- PROVEEDORES (Base) ---
export const suppliers = sqliteTable("suppliers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  contact_info: text("contact_info"),
  frequency: text("frequency"), // Ej: 'Weekly', 'Daily'
  active: integer("active", { mode: "boolean" }).default(true),
});

// --- PRODUCTOS (Depende de Proveedores) ---
export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  unit: text('unit').notNull(),

  // Ingeniería Inversa & Costos
  isSaleable: integer('is_saleable', { mode: 'boolean' }).default(false),
  costCents: integer('cost_cents').default(0),
  sellingPrice: integer('selling_price').default(0), // PVP in Cents
  targetMargin: integer('target_margin').default(30), // Target Margin %
  supplierId: text('supplier_id').references(() => suppliers.id), // Link to supplier
  safetyStock: real('safety_stock').default(0), // Stock mínimo de alerta

  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),

  synonyms: text('synonyms', { mode: 'json' }).$type<string[]>().default([]),
});

// --- RECETAS (Depende de Productos) ---
export const recipes = sqliteTable('recipes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productSku: text('product_sku').references(() => products.id), // El plato (MALA_FAMA_DOBLE)
  ingredientSku: text('ingredient_sku').references(() => products.id), // El insumo (INS_CARNE)
  quantity: real('quantity').notNull(), // Cantidad requerida (ej: 0.1 kg o 2.0 unidades)

  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// --- HISTORIAL DE PRECIOS (Depende de Productos y Usuarios) ---
export const priceHistory = sqliteTable('price_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productSku: text('product_sku').references(() => products.id).notNull(),
  oldCost: integer('old_cost').notNull(),
  newCost: integer('new_cost').notNull(),
  changedBy: text('changed_by').references(() => users.id),
  changeReason: text('change_reason'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// --- LEDGER DE TRANSACCIONES (Patrón Kardex) ---
export const TRANSACTION_TYPES = [
  "RECEIPT",      // +qty. Entrada por factura de proveedor
  "SALE",         // -qty. Salida por venta (explosionada por BOM)
  "ADJUSTMENT",   // ±qty. Corrección manual (merma, robo, error)
  "WASTE",        // -qty. Desperdicio (producto vencido, quemado)
  "COUNT",        // ±qty. Ajuste por conteo físico (snapshot → delta)
] as const;

export type TransactionType = typeof TRANSACTION_TYPES[number];

export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(),
  type: text('type', { enum: TRANSACTION_TYPES }).notNull(),
  productSku: text('product_sku').references(() => products.id).notNull(),
  quantity: real('quantity').notNull(), // +positivo = entrada, -negativo = salida
  costCentsAtTime: integer('cost_cents_at_time').default(0), // Costo unitario congelado
  referenceId: text('reference_id'),    // ID de factura, venta POS, etc.
  notes: text('notes'),                 // "Merma por vencimiento", etc.
  createdBy: text('created_by'),        // userId que registró
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// --- SNAPSHOTS INVENTARIO ---
export const inventorySnapshots = sqliteTable('inventory_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').default(sql`(CURRENT_TIMESTAMP)`),
  productSku: text('product_sku').notNull(),
  actualCount: real('actual_count').notNull(), // Changed to real
  rawInput: text('raw_input').notNull(),
  reportedBy: text('reported_by').default("WebApp User"),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// --- COMPRAS/RECEPCIONES ---
export const receptions = sqliteTable("receptions", {
  id: text("id").primaryKey(),
  supplier: text("supplier").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  totalAmount: integer("total_amount").notNull(),

  fileUrl: text("file_url"),
  mimeType: text("mime_type"),

  status: text("status", { enum: ["PENDING", "CONFIRMED", "REJECTED"] }).default("PENDING"),
  rawData: text("raw_data").notNull(), // JSON extraído

  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  createdBy: text("created_by"), // ID del Receiver
});

export const purchases = sqliteTable("purchases", {
  id: text("id").primaryKey(),
  supplier_id: text("supplier_id").references(() => suppliers.id),
  receiver_user_id: text("receiver_user_id").references(() => users.id),
  total_amount: real("total_amount").notNull(),
  invoice_image_url: text("invoice_image_url"),
  status: text("status", { enum: ["PENDING", "COMPLETED", "FLAGGED"] }).default("COMPLETED"),
  created_at: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

export const purchase_items = sqliteTable("purchase_items", {
  id: text("id").primaryKey(),
  purchase_id: text("purchase_id").references(() => purchases.id),
  product_id: text("product_id").references(() => products.id),
  quantity: real("quantity").notNull(),
  unit_cost: real("unit_cost").notNull(),
  variance_flag: integer("variance_flag", { mode: "boolean" }).default(false),
});

// --- ORÁCULO ---
export const po_status_enum = ["DRAFT", "SENT", "RECEIVED", "CANCELLED"] as const;

export const purchase_orders = sqliteTable("purchase_orders", {
  id: text("id").primaryKey(),
  supplier_id: text("supplier_id"),
  status: text("status", { enum: po_status_enum }).default("DRAFT"),
  total_estimated: integer("total_estimated"),
  created_at: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  delivery_date: text("delivery_date"),
});

export const po_items = sqliteTable("po_items", {
  id: text("id").primaryKey(),
  po_id: text("po_id").references(() => purchase_orders.id),
  product_id: text("product_id").references(() => products.id),
  quantity_suggested: real("quantity_suggested"),
  quantity_ordered: real("quantity_ordered"),
  unit_cost_snapshot: integer("unit_cost_snapshot"),
});

// --- ESTADO DE SINCRONIZACIÓN (ETL) ---
export const syncState = sqliteTable('sync_state', {
  id: text('id').primaryKey(),              // Ej: "google_sheets_sales"
  lastSyncedDate: text('last_synced_date'), // Última fecha procesada
  lastSyncedRow: integer('last_synced_row').default(0), // Última fila procesada
  lastRunAt: text('last_run_at'),           // Timestamp del último sync
});
