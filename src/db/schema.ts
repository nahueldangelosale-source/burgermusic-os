import { sql } from "drizzle-orm";
// Drizzle ORM Schema Definitions
import { blob, integer, real, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { raw_materials } from "./schema/bom";

// --- USUARIOS (Base) ---
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role", { enum: ["OWNER_GLOBAL", "MANAGER", "KITCHEN", "RECEIVER"] }).notNull(),
  pin_hash: text("pin_hash").notNull(),
  storeId: text("store_id").notNull(), // Local assignment
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// --- PROVEEDORES (Base) ---
export const suppliers = sqliteTable("suppliers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  cuit: text("cuit").notNull().unique(),
  cbu: text("cbu").notNull().default(""),
  contact_info: text("contact_info"),
  category: text("category", { enum: ["Insumos", "Servicios", "Mantenimiento", "Otros"] }).default(
    "Insumos",
  ),
  paymentTerms: text("payment_terms").default("Contado"), // Ej: 'Contado', '30 Días', 'Transferencia'
  paymentMethod: text("payment_method", {
    enum: ["TRANSFERENCIA", "EFECTIVO", "CHEQUE", "CRIPTO"],
  }).default("TRANSFERENCIA"),
  leadTime: integer("lead_time").default(24), // En horas por defecto
  frequency: text("frequency"), // Ej: 'Weekly', 'Daily'
  phone: text("phone"),
  address: text("address"),
  paymentMethods: text("payment_methods", { mode: "json" })
    .$type<string[]>()
    .default(["TRANSFERENCIA"]),
  invoiceType: text("invoice_type", { enum: ["FACTURA", "REMITO", "AMBAS"] }).default("FACTURA"),
  active: integer("active", { mode: "boolean" }).default(true),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
});

// --- PRODUCTOS (Depende de Proveedores) ---
export const product_unit_enum = ["UNIDAD", "GRAMOS", "LITROS"] as const;
export const itemTypeEnum = ["MANUFACTURED", "COMBO", "SERVICE"] as const;

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  sku: text("sku"),
  name: text("name").notNull(),
  unit: text("unit", { enum: product_unit_enum }).notNull().default("UNIDAD"),
  item_type: text("item_type", { enum: itemTypeEnum }).notNull().default("MANUFACTURED"),

  category: text("category").default("GENERAL"),
  base_price_cents: integer("base_price_cents").default(0),
  description: text("description"),

  // Ingeniería Inversa & Costos
  isSaleable: integer("is_saleable", { mode: "boolean" }).default(false),
  costCents: integer("cost_cents").default(0),
  sellingPrice: integer("selling_price").default(0), // PVP in Cents
  targetMargin: integer("target_margin").default(30), // Target Margin %
  supplierId: text("supplier_id").references(() => suppliers.id), // Link to supplier
  safetyStock: real("safety_stock").default(0), // Stock mínimo de alerta
  weight_grams: integer("weight_grams").default(0), // Trazabilidad de Reduflación

  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),

  synonyms: text("synonyms", { mode: "json" }).$type<string[]>().default([]),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
});

// --- RECETAS (Depende de Productos) ---
export const recipe_items = sqliteTable("recipe_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productSku: text("product_sku").references(() => products.id),
  ingredientSku: text("ingredient_sku").references(() => products.id),
  quantity: real("quantity").notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
}, (table) => ({
  unq: unique("recipe_item_unq").on(table.productSku, table.ingredientSku),
}));

// Fase 30.2 - BOM Master Data y Tipaje Fuerte Canónico
export const mdm_ingredients = sqliteTable("mdm_ingredients", {
  id: text("id").primaryKey(),
  canonical_name: text("canonical_name").notNull().unique(),
  yield_percentage: real("yield_percentage").notNull().default(1.0),
});

export const bom_recipes = sqliteTable("bom_recipes", {
  id: text("id").primaryKey(),
  product_sku: text("product_sku").references(() => products.id),
  ingredient_id: text("ingredient_id").references(() => mdm_ingredients.id),
  theoretical_qty: real("theoretical_qty").notNull(),
});

// --- HISTORIAL DE PRECIOS (Depende de Productos y Usuarios) ---
export const priceHistory = sqliteTable("price_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productSku: text("product_sku")
    .references(() => products.id)
    .notNull(),
  oldCost: integer("old_cost").notNull(),
  newCost: integer("new_cost").notNull(),
  changedBy: text("changed_by").references(() => users.id),
  changeReason: text("change_reason"),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// --- LEDGER DE TRANSACCIONES (Patrón Kardex) ---
export const TRANSACTION_TYPES = [
  "RECEIPT", // +qty. Entrada por factura de proveedor
  "SALE", // -qty. Salida por venta (explosionada por BOM)
  "ADJUSTMENT", // ±qty. Corrección manual (merma, robo, error)
  "WASTE", // -qty. Desperdicio (producto vencido, quemado)
  "COUNT", // ±qty. Ajuste por conteo físico (snapshot → delta)
] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  type: text("type", { enum: TRANSACTION_TYPES }).notNull(),
  productSku: text("product_sku")
    .references(() => products.id)
    .notNull(),
  quantity: real("quantity").notNull(), // +positivo = entrada, -negativo = salida
  costCentsAtTime: integer("cost_cents_at_time").default(0), // Costo unitario congelado
  referenceId: text("reference_id"), // ID de factura, venta POS, etc.
  notes: text("notes"), // "Merma por vencimiento", etc.
  storeId: text("store_id").notNull(), // Local assignment
  createdBy: text("created_by"), // userId que registró
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

export const transaction_items = sqliteTable("transaction_items", {
  id: text("id").primaryKey(),
  transactionId: integer("transaction_id").references(() => transactions.id),
  productSku: text("product_sku").references(() => products.id),
  quantity: real("quantity").notNull(),
  frozenUnitPriceCents: integer("frozen_unit_price_cents").notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// --- SNAPSHOTS INVENTARIO ---
export const snapshot_status_enum = ["DRAFT", "RECONCILED"] as const;

export const inventorySnapshots = sqliteTable("inventory_snapshots", {
  id: text("id").primaryKey(), // Switching to UUID for consistency
  date: text("date").default(sql`(CURRENT_TIMESTAMP)`),
  storeId: text("store_id").notNull(),
  reportedBy: text("reported_by").default("WebApp User"), // countedBy
  status: text("status", { enum: snapshot_status_enum }).notNull().default("RECONCILED"),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

export const snapshot_items = sqliteTable("snapshot_items", {
  id: text("id").primaryKey(),
  snapshotId: text("snapshot_id").references(() => inventorySnapshots.id),
  rawMaterialId: text("raw_material_id").references(() => raw_materials.id),
  physicalCountPurchaseUnit: real("physical_count_purchase_unit").notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
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
  storeId: text("store_id").notNull(), // Isolation

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
  storeId: text("store_id").notNull(), // Isolation
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

// --- RECEIVER AGENT (OCR & COMPROBANTES INTERNOS) ---
export const receipts = sqliteTable("receipts", {
  id: text("id").primaryKey(), // UUID o 'CRI-' + timestamp
  supplierName: text("supplier_name").notNull(),
  invoiceNumber: text("invoice_number"),
  totalAmount: real("total_amount").notNull(),
  hasTaxCredit: integer("has_tax_credit", { mode: "boolean" }).default(true),
  entryMode: text("entry_mode", { enum: ["AI_SCAN", "MANUAL", "NO_INVOICE"] }).notNull(),
  status: text("status", { enum: ["PENDING", "APPROVED", "DISPUTED"] }).default("APPROVED"),
  storeId: text("store_id").notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

export const receipt_items = sqliteTable("receipt_items", {
  id: text("id").primaryKey(),
  receiptId: text("receipt_id").references(() => receipts.id),
  productName: text("product_name").notNull(),
  quantity: real("quantity").notNull(),
  unit: text("unit").notNull(),
  unitPrice: real("unit_price").notNull(),
});

export const petty_cash_transactions = sqliteTable("petty_cash_transactions", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  amount: real("amount").notNull(), // negativo para egresos (compras no_invoice)
  reason: text("reason").notNull(),
  supplierId: text("supplier_id").references(() => suppliers.id), // Agregado para gastos manuales con proveedor
  costCenter: text("cost_center", {
    enum: ["Cocina", "Salón", "Logística", "Administración", "Mantenimiento"],
  }).default("Cocina"),
  expenseDate: text("expense_date"), // Fecha del gasto manual (YYYY-MM-DD)
  referenceId: text("reference_id").references(() => receipts.id), // Opcional, si viene de OCR
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// --- ORÁCULO ---
export const po_status_enum = ["DRAFT", "SENT", "RECEIVED", "CANCELLED"] as const;

export const purchase_orders = sqliteTable("purchase_orders", {
  id: text("id").primaryKey(),
  supplier_id: text("supplier_id"),
  status: text("status", { enum: po_status_enum }).default("DRAFT"),
  total_estimated: integer("total_estimated"),
  created_at: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  order_date: text("order_date"),
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

// --- ESTADO DE SINCRONIZACIÓN (ETL — por pestaña) ---
export const syncState = sqliteTable("sync_state", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  syncKey: text("sync_key").notNull().unique(), // Ej: "sheet_MARZO", "sheet_FEBRERO"
  lastSyncedRow: integer("last_synced_row").default(0),
  updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// --- CIERRES DE CAJA DIARIOS (Flujo Financiero) ---
export const dailyCashClosures = sqliteTable("daily_cash_closures", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(), // Fecha del cierre (YYYY-MM-DD)
  day: text("day"), // Día de la semana ("Lunes", "Martes")
  zClose: real("z_close"), // Caja Z
  shift: text("shift"), // Turno
  salesCounter: real("sales_counter"), // Ventas Mostrador
  salesMpQr: real("sales_mp_qr"), // Ventas MP QR
  salesDelivery: real("sales_delivery"), // Ventas Pedidos Ya
  totalMp: real("total_mp"), // Total MercadoPago
  totalCash: real("total_cash"), // Total Efectivo
  totalDelivery: real("total_delivery"), // Total Delivery
  totalGlobal: real("total_global"), // Total Global
  laborCost: real("labor_cost"), // Costo de Personal Diario
  variance: real("variance"), // Sobran/faltan
  storeId: text("store_id").notNull(), // ID de sucursal
  sheetMonth: text("sheet_month"), // Pestaña origen (ej. "MARZO")
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// --- API KEYS (Tenant Isolation para Webhooks) ---
export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull().unique(), // Cada sucursal tiene un único token activo en MVP
  keyHash: text("key_hash").notNull(), // Hash de la key (Plaintext para MVP/testing interno rápido, o hash bcrypt)
  active: integer("active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// --- METRICAS LABORALES ---
export const labor_costs = sqliteTable("labor_costs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  storeId: text("store_id").notNull(),
  date: text("date").notNull(), // Fecha del turno (YYYY-MM-DD)
  shift: text("shift"), // Mañana, Tarde, Noche
  totalHours: real("total_hours").notNull(),
  costAmount: real("cost_amount").notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// --- METRICAS DE PROVEEDORES (OTIF & Lead Time) ---
export const supplier_metrics = sqliteTable("supplier_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  supplierId: text("supplier_id").references(() => suppliers.id),
  poId: text("po_id").references(() => purchase_orders.id),
  date: text("date").notNull(), // Fecha de entrega
  leadTimeHours: real("lead_time_hours").notNull(),
  isFull: integer("is_full", { mode: "boolean" }).default(true),
  isOnTime: integer("is_on_time", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// --- DATA OPS (IMPORTACIONES) ---
export const data_runs = sqliteTable("data_runs", {
  id: text("id").primaryKey(), // UUID
  fileName: text("file_name").notNull(),
  status: text("status").notNull(), // 'SUCCESS', 'PARTIAL', 'FAILED'
  rowsProcessed: integer("rows_processed").default(0),
  rowsFailed: integer("rows_failed").default(0),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// --- RELATIONS ---
import { relations } from "drizzle-orm";

export const productsRelations = relations(products, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [products.supplierId],
    references: [suppliers.id],
  }),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  products: many(products),
}));

// --- FINTECH & TESORERÍA (Mercado Pago, Posnet, etc.) ---
export const payment_gateways_ledger = sqliteTable("payment_gateways_ledger", {
  id: text("id").primaryKey(), // UUID
  gateway: text("gateway", { enum: ["MERCADO_PAGO", "POSNET", "UBER_EATS", "PEDIDOS_YA"] })
    .notNull()
    .default("MERCADO_PAGO"),
  transactionReference: text("transaction_reference").notNull(), // ID de la Tx en MP
  date: text("date").notNull(), // Fecha operación

  grossAmount: real("gross_amount").notNull(), // Monto Bruto (Venta)
  feeAmount: real("fee_amount").notNull().default(0), // Comisión pasarela
  taxAmount: real("tax_amount").notNull().default(0), // Retenciones (IIBB, IVA, Ganancias)
  netAmount: real("net_amount").notNull(), // Monto Neto final

  releaseDate: text("release_date").notNull(), // Cuándo se liquida el dinero
  status: text("status", { enum: ["PENDING", "CLEARED", "REJECTED"] }).default("CLEARED"),

  storeId: text("store_id").notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// --- AI DECISION LEDGER (Agentic Security) ---
export const ai_audit_logs = sqliteTable("ai_audit_logs", {
  id: text("id").primaryKey(), // UUID
  agentName: text("agent_name").notNull(), // ej: 'GEMINI_INVOICE_OCR', 'COST_PROPAGATOR'
  action: text("action").notNull(), // ej: 'CREATE_PURCHASE', 'UPDATE_PRICES'

  // Guardrail info
  payloadRef: text("payload_ref"), // Referencia a un s3, log o json si es grande
  zodSchemaUsed: text("zod_schema_used").notNull(),

  // Decisión del PEP
  status: text("status", {
    enum: ["APPROVED", "REJECTED_BY_GUARDRAIL", "REJECTED_BY_RBAC"],
  }).notNull(),
  rejectionReason: text("rejection_reason"),

  userId: text("user_id"), // El humano responsable que disparó la tarea
  storeId: text("store_id").notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// --- SYSTEM ALERTS (Fricción Positiva & Sentinel Logs) ---
export const system_alerts = sqliteTable("system_alerts", {
  id: text("id").primaryKey(), // Idempotente: SENTINEL-STOREID-YYYYMMDD
  storeId: text("store_id").notNull(),
  type: text("type", { enum: ["MARGIN_ANOMALY", "SHRINKAGE_ALARM", "SECURITY_BREACH"] }).notNull(),
  severity: text("severity", { enum: ["CRITICAL", "WARNING", "INFO"] }).notNull(),
  details: text("details", { mode: "json" }).$type<{
    category?: string;
    actualValue: number;
    threshold: number;
    reasoning: string;
    suggestion?: string;
  }>().notNull(),
  isLocked: integer("is_locked", { mode: "boolean" }).default(false), // Bloquea Cierre de Caja
  isResolved: integer("is_resolved", { mode: "boolean" }).default(false),
  resolvedBy: text("resolved_by").references(() => users.id),
  justification: text("justification"),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// --- WAREHOUSE DATA AIRLOCK (Transactional Outbox) ---
export const outbox_events = sqliteTable("outbox_events", {
  id: text("id").primaryKey(), // UUID
  aggregateType: text("aggregate_type").notNull(), // ej: 'TRANSACTION', 'EXPENSE', 'MERCADO_PAGO'
  aggregateId: text("aggregate_id").notNull(), // ID of the mutated record
  payload: text("payload").notNull(), // JSONB stringified
  status: text("status", { enum: ["PENDING", "PROCESSING", "PROCESSED", "FAILED"] })
    .notNull()
    .default("PENDING"),

  storeId: text("store_id").notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  processedAt: text("processed_at"),
});

// --- ACCOUNTS PAYABLE (Filtro 3 Vías C-Level) ---
export const accounts_payable = sqliteTable(
  "accounts_payable",
  {
    id: text("id").primaryKey(),
    supplier_id: text("supplier_id").notNull(),
    po_amount: integer("po_amount").notNull().default(0),
    receipt_amount: integer("receipt_amount").notNull().default(0),
    invoice_amount: integer("invoice_amount").notNull().default(0),
    credit_note_amount: integer("credit_note_amount").notNull().default(0),
    status: text("status", { enum: ["PERFECT_MATCH", "DISPUTE", "PAID", "PENDING"] }).default("PENDING"),
    storeId: text("store_id").notNull(),
    due_date: text("due_date").notNull(),
    createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  }
);

export const supplier_payments = sqliteTable("supplier_payments", {
  id: text("id").primaryKey(),
  supplierId: text("supplier_id").references(() => suppliers.id).notNull(),
  amount: integer("amount").notNull(), // en centavos
  date: text("date").notNull(), // Fecha de pago YYYY-MM-DD
  method: text("method").notNull(), // TRANSFERENCIA, EFECTIVO, etc
  referenceId: text("reference_id"), // Comprobante
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

export const payment_allocations = sqliteTable("payment_allocations", {
  id: text("id").primaryKey(),
  paymentId: text("payment_id").references(() => supplier_payments.id).notNull(),
  invoiceId: text("invoice_id").references(() => accounts_payable.id).notNull(),
  amountApplied: integer("amount_applied").notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// --- OPEX LEDGER (Costos Fijos & Devengamiento Diario Matemático) ---
export const opex_ledger = sqliteTable("opex_ledger", {
  id: text("id").primaryKey(),
  store_id: text("store_id").notNull(),
  type: text("type", { enum: ["FIXED", "VARIABLE", "EXTRAORDINARY", "TAX"] }).notNull(),
  description: text("description").notNull(),
  total_amount: integer("total_amount").notNull(),
  daily_accrual_amount: integer("daily_accrual_amount").notNull().default(0),
  calculation_type: text("calculation_type", { enum: ["FIXED", "PERCENTAGE"] }),
  percentage_rate: real("percentage_rate"),
  start_date: text("start_date").notNull(),
  end_date: text("end_date"), // Opcional para extraordinarios y variables de 1 día
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// --- RRHH & EMPLEADOS ---
export const employees = sqliteTable("employees", {
  id: text("id").primaryKey(),
  store_id: text("store_id").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  hourly_rate: integer("hourly_rate").notNull(), // en centavos
  active: integer("active", { mode: "boolean" }).default(true).notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// --- COMPLIANCE & CHECKLISTS ---
export const checklists = sqliteTable("checklists", {
  id: text("id").primaryKey(),
  store_id: text("store_id").notNull(),
  shift_date: text("shift_date").notNull(),
  task_name: text("task_name").notNull(),
  is_completed: integer("is_completed", { mode: "boolean" }).default(false).notNull(),
  completed_by: text("completed_by").references(() => employees.id),
  timestamp: text("timestamp").default(sql`(CURRENT_TIMESTAMP)`),
});

// --- DOCUMENTOS LEGALES (Vencimientos & Alertas) ---
export const legal_documents = sqliteTable("legal_documents", {
  id: text("id").primaryKey(),
  store_id: text("store_id").notNull(),
  document_type: text("document_type").notNull(),
  expiration_date: text("expiration_date").notNull(),
  alert_triggered: integer("alert_triggered", { mode: "boolean" }).default(false).notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// --- GATEWAY SETTLEMENTS (Liquidaciones Pendientes Mercado Pago / Dinero en Tránsito) ---
export const gateway_settlements = sqliteTable("gateway_settlements", {
  id: text("id").primaryKey(),
  provider: text("provider").default("MercadoPago"),
  amount: integer("amount").notNull(),
  settlement_date: text("settlement_date").notNull(), // YYYY-MM-DD format
  status: text("status", { enum: ["PENDING", "SETTLED"] }).default("PENDING"),
  storeId: text("store_id").notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// --- INVENTORY KARDEX STATE (Operational Ledger Math) ---
export const inventory_kardex = sqliteTable("inventory_kardex", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  productSku: text("product_sku").notNull(),
  quantity: real("quantity").notNull().default(0),
  referenceId: text("reference_id"), // Added for SRE auditability
  updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// --- LIBRO MAYOR DE COTIZACIONES (MOTOR DE ARBITRAJE) ---
export const ingredient_quotes = sqliteTable(
  "ingredient_quotes",
  {
    id: text("id").primaryKey(),
    supplier_id: text("supplier_id")
      .references(() => suppliers.id)
      .notNull(),
    ingredient_sku: text("ingredient_sku")
      .references(() => products.id)
      .notNull(),
    price_cents: integer("price_cents").notNull(),
    updated_at: integer("updated_at").default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    unq: unique("supplier_ingredient_idx").on(table.supplier_id, table.ingredient_sku),
  }),
);

// Temporary patch file for schema additions to execute dynamically via DDL.
// The Drizzle push will be simulated locally.

// --- CAJAS DIARIAS (Tesorería) ---
export const cash_register_transactions = sqliteTable(
  "cash_register_transactions",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id").notNull(),
    date: text("date").notNull(), // FechaCaja
    registerNum: text("register_num").notNull(), // NroCaja
    shift: text("shift").notNull(), // Turno 'MAÑANA' | 'NOCHE'
    openingAmount: real("opening_amount").notNull(),
    closingAmount: real("closing_amount").notNull(),
    discrepancy: real("discrepancy").notNull(),
    cashInRegister: real("cash_in_register").notNull(),

    // Unpivoted items
    paymentMethod: text("payment_method").notNull(),
    amount: real("amount").notNull(),

    createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    unq: unique("cash_reg_tx_unq").on(
      table.date,
      table.registerNum,
      table.shift,
      table.paymentMethod,
    ),
  }),
);

// --- GASTOS RECURRENTES (OPEX Accrual) ---
export const recurring_expenses = sqliteTable("recurring_expenses", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  description: text("description").notNull(),
  monthlyAmount: real("monthly_amount").notNull(),
  dayOfMonth: integer("day_of_month").notNull(),
  category: text("category").notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// --- VENTAS DIRECTAS (ETL) ---
export const fact_sales = sqliteTable("fact_sales", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  date: text("date").notNull(),
  shift: text("shift").notNull(),
  raw_name: text("raw_name").notNull(),
  productSku: text("product_sku").notNull(),
  quantity: real("quantity").notNull(),
  net_price_cents: integer("net_price_cents").notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// --- SUGERENCIAS DE COMPRA (ADC CRON FORECAST) ---
export const purchase_suggestions = sqliteTable("purchase_suggestions", {
  id: text("id").primaryKey(),
  sku: text("sku").notNull(),
  suggested_qty: real("suggested_qty").notNull(),
  status: text("status", { enum: ["Riesgo de Quiebre (ADC)", "SENT", "REJECTED"] }).default(
    "Riesgo de Quiebre (ADC)",
  ),
  created_at: text("created_at").default(sql`(CURRENT_DATE)`),
});

// --- DEAD-LETTER QUEUE (Ingesta No Mapeada) ---
export const sales_mapping_dlq = sqliteTable("sales_mapping_dlq", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  raw_name: text("raw_name").notNull(),
  quantity: real("quantity").notNull(),
  price: integer("price").notNull(), // en centavos
  resolved: integer("resolved", { mode: "boolean" }).default(false).notNull(),
  timestamp: text("timestamp").default(sql`(CURRENT_TIMESTAMP)`),
});

// --- LEDGER DE PROVEEDORES (Cuentas Corrientes) ---
export const fact_supplier_ledger = sqliteTable("fact_supplier_ledger", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  supplier_id: text("supplier_id").references(() => suppliers.id).notNull(),
  type: text("type", { enum: ["INVOICE", "PAYMENT", "CREDIT_NOTE", "DEBIT_NOTE"] }).notNull(),
  invoice_number: text("invoice_number"),
  description: text("description"),
  amount_cents: integer("amount_cents").notNull(), // +positivo = deuda, -negativo = pago
  balance_cents: integer("balance_cents").notNull().default(0), // Saldo running
  reference_id: text("reference_id"), // PO, recepción, etc.
  date: text("date").notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// --- REGISTRO FISCAL ATÓMICO (IVA, IIBB, GANANCIAS) ---
export const fact_taxes = sqliteTable("fact_taxes", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  source_type: text("source_type", { enum: ["INVOICE", "SALE", "GATEWAY", "OPEX"] }).notNull(),
  source_id: text("source_id").notNull(), // ID del documento origen
  tax_type: text("tax_type", { enum: ["IVA_21", "IVA_10_5", "IVA_27", "IIBB", "GANANCIAS", "SUSS", "OTHER"] }).notNull(),
  base_amount_cents: integer("base_amount_cents").notNull(),
  tax_amount_cents: integer("tax_amount_cents").notNull(),
  date: text("date").notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

export * from "./schema/bom";
