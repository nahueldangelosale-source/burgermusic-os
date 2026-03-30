"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.purchase_suggestions = exports.fact_sales = exports.recurring_expenses = exports.cash_register_transactions = exports.ingredient_quotes = exports.inventory_kardex = exports.opex_ledger = exports.accounts_payable = exports.outbox_events = exports.ai_audit_logs = exports.payment_gateways_ledger = exports.suppliersRelations = exports.productsRelations = exports.data_runs = exports.supplier_metrics = exports.labor_costs = exports.apiKeys = exports.dailyCashClosures = exports.syncState = exports.po_items = exports.purchase_orders = exports.po_status_enum = exports.petty_cash_transactions = exports.receipt_items = exports.receipts = exports.purchase_items = exports.purchases = exports.receptions = exports.inventorySnapshots = exports.transactions = exports.TRANSACTION_TYPES = exports.priceHistory = exports.bom_recipes = exports.mdm_ingredients = exports.recipes = exports.products = exports.product_unit_enum = exports.suppliers = exports.users = void 0;
var drizzle_orm_1 = require("drizzle-orm");
// Drizzle ORM Schema Definitions
var sqlite_core_1 = require("drizzle-orm/sqlite-core");
// --- USUARIOS (Base) ---
exports.users = (0, sqlite_core_1.sqliteTable)("users", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    name: (0, sqlite_core_1.text)("name").notNull(),
    role: (0, sqlite_core_1.text)("role", { enum: ["OWNER_GLOBAL", "MANAGER", "KITCHEN", "RECEIVER"] }).notNull(),
    pin_hash: (0, sqlite_core_1.text)("pin_hash").notNull(), // Plaintext PIN for MVP, Hash in Prod
    storeId: (0, sqlite_core_1.text)("store_id").default("centro"), // Local assignment
    createdAt: (0, sqlite_core_1.text)("created_at").default((0, drizzle_orm_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["(CURRENT_TIMESTAMP)"], ["(CURRENT_TIMESTAMP)"])))),
});
// --- PROVEEDORES (Base) ---
exports.suppliers = (0, sqlite_core_1.sqliteTable)("suppliers", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    name: (0, sqlite_core_1.text)("name").notNull(),
    cuit: (0, sqlite_core_1.text)("cuit").notNull().unique(),
    cbu: (0, sqlite_core_1.text)("cbu").notNull().default(""),
    contact_info: (0, sqlite_core_1.text)("contact_info"),
    category: (0, sqlite_core_1.text)("category", { enum: ["Insumos", "Servicios", "Mantenimiento", "Otros"] }).default("Insumos"),
    paymentTerms: (0, sqlite_core_1.text)("payment_terms").default("Contado"), // Ej: 'Contado', '30 Días', 'Transferencia'
    paymentMethod: (0, sqlite_core_1.text)("payment_method", {
        enum: ["TRANSFERENCIA", "EFECTIVO", "CHEQUE", "CRIPTO"],
    }).default("TRANSFERENCIA"),
    leadTime: (0, sqlite_core_1.integer)("lead_time").default(24), // En horas por defecto
    frequency: (0, sqlite_core_1.text)("frequency"), // Ej: 'Weekly', 'Daily'
    phone: (0, sqlite_core_1.text)("phone"),
    address: (0, sqlite_core_1.text)("address"),
    paymentMethods: (0, sqlite_core_1.text)("payment_methods", { mode: "json" })
        .$type()
        .default(["TRANSFERENCIA"]),
    invoiceType: (0, sqlite_core_1.text)("invoice_type", { enum: ["FACTURA", "REMITO", "AMBAS"] }).default("FACTURA"),
    active: (0, sqlite_core_1.integer)("active", { mode: "boolean" }).default(true),
});
// --- PRODUCTOS (Depende de Proveedores) ---
exports.product_unit_enum = ["UNIDAD", "GRAMOS", "LITROS"];
exports.products = (0, sqlite_core_1.sqliteTable)("products", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    name: (0, sqlite_core_1.text)("name").notNull(),
    unit: (0, sqlite_core_1.text)("unit", { enum: exports.product_unit_enum }).notNull().default("UNIDAD"),
    category: (0, sqlite_core_1.text)("category", { enum: ["BURGER", "SIDE", "BEVERAGE", "SALAD", "DESSERT"] }).default("BURGER"),
    base_price_cents: (0, sqlite_core_1.integer)("base_price_cents").default(0),
    includes_fries: (0, sqlite_core_1.integer)("includes_fries", { mode: "boolean" }).default(false),
    description: (0, sqlite_core_1.text)("description"),
    // Ingeniería Inversa & Costos
    isSaleable: (0, sqlite_core_1.integer)("is_saleable", { mode: "boolean" }).default(false),
    costCents: (0, sqlite_core_1.integer)("cost_cents").default(0),
    sellingPrice: (0, sqlite_core_1.integer)("selling_price").default(0), // PVP in Cents
    targetMargin: (0, sqlite_core_1.integer)("target_margin").default(30), // Target Margin %
    supplierId: (0, sqlite_core_1.text)("supplier_id").references(function () { return exports.suppliers.id; }), // Link to supplier
    safetyStock: (0, sqlite_core_1.real)("safety_stock").default(0), // Stock mínimo de alerta
    weight_grams: (0, sqlite_core_1.integer)("weight_grams").default(0), // Trazabilidad de Reduflación
    createdAt: (0, sqlite_core_1.text)("created_at").default((0, drizzle_orm_1.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["(CURRENT_TIMESTAMP)"], ["(CURRENT_TIMESTAMP)"])))),
    synonyms: (0, sqlite_core_1.text)("synonyms", { mode: "json" }).$type().default([]),
});
// --- RECETAS (Depende de Productos) ---
exports.recipes = (0, sqlite_core_1.sqliteTable)("recipes", {
    id: (0, sqlite_core_1.integer)("id").primaryKey({ autoIncrement: true }),
    productSku: (0, sqlite_core_1.text)("product_sku").references(function () { return exports.products.id; }), // El plato (MALA_FAMA_DOBLE)
    ingredientSku: (0, sqlite_core_1.text)("ingredient_sku").references(function () { return exports.products.id; }), // El insumo (INS_CARNE)
    quantity: (0, sqlite_core_1.real)("quantity").notNull(), // Cantidad requerida (ej: 0.1 kg o 2.0 unidades)
    createdAt: (0, sqlite_core_1.text)("created_at").default((0, drizzle_orm_1.sql)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["(CURRENT_TIMESTAMP)"], ["(CURRENT_TIMESTAMP)"])))),
});
// Fase 30.2 - BOM Master Data y Tipaje Fuerte Canónico
exports.mdm_ingredients = (0, sqlite_core_1.sqliteTable)("mdm_ingredients", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    canonical_name: (0, sqlite_core_1.text)("canonical_name").notNull().unique(),
    yield_percentage: (0, sqlite_core_1.real)("yield_percentage").notNull().default(1.0),
});
exports.bom_recipes = (0, sqlite_core_1.sqliteTable)("bom_recipes", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    product_sku: (0, sqlite_core_1.text)("product_sku").references(function () { return exports.products.id; }),
    ingredient_id: (0, sqlite_core_1.text)("ingredient_id").references(function () { return exports.mdm_ingredients.id; }),
    theoretical_qty: (0, sqlite_core_1.real)("theoretical_qty").notNull(),
});
// --- HISTORIAL DE PRECIOS (Depende de Productos y Usuarios) ---
exports.priceHistory = (0, sqlite_core_1.sqliteTable)("price_history", {
    id: (0, sqlite_core_1.integer)("id").primaryKey({ autoIncrement: true }),
    productSku: (0, sqlite_core_1.text)("product_sku")
        .references(function () { return exports.products.id; })
        .notNull(),
    oldCost: (0, sqlite_core_1.integer)("old_cost").notNull(),
    newCost: (0, sqlite_core_1.integer)("new_cost").notNull(),
    changedBy: (0, sqlite_core_1.text)("changed_by").references(function () { return exports.users.id; }),
    changeReason: (0, sqlite_core_1.text)("change_reason"),
    createdAt: (0, sqlite_core_1.text)("created_at").default((0, drizzle_orm_1.sql)(templateObject_4 || (templateObject_4 = __makeTemplateObject(["(CURRENT_TIMESTAMP)"], ["(CURRENT_TIMESTAMP)"])))),
});
// --- LEDGER DE TRANSACCIONES (Patrón Kardex) ---
exports.TRANSACTION_TYPES = [
    "RECEIPT", // +qty. Entrada por factura de proveedor
    "SALE", // -qty. Salida por venta (explosionada por BOM)
    "ADJUSTMENT", // ±qty. Corrección manual (merma, robo, error)
    "WASTE", // -qty. Desperdicio (producto vencido, quemado)
    "COUNT", // ±qty. Ajuste por conteo físico (snapshot → delta)
];
exports.transactions = (0, sqlite_core_1.sqliteTable)("transactions", {
    id: (0, sqlite_core_1.integer)("id").primaryKey({ autoIncrement: true }),
    date: (0, sqlite_core_1.text)("date").notNull(),
    type: (0, sqlite_core_1.text)("type", { enum: exports.TRANSACTION_TYPES }).notNull(),
    productSku: (0, sqlite_core_1.text)("product_sku")
        .references(function () { return exports.products.id; })
        .notNull(),
    quantity: (0, sqlite_core_1.real)("quantity").notNull(), // +positivo = entrada, -negativo = salida
    costCentsAtTime: (0, sqlite_core_1.integer)("cost_cents_at_time").default(0), // Costo unitario congelado
    referenceId: (0, sqlite_core_1.text)("reference_id"), // ID de factura, venta POS, etc.
    notes: (0, sqlite_core_1.text)("notes"), // "Merma por vencimiento", etc.
    storeId: (0, sqlite_core_1.text)("store_id").default("centro"), // Local assignment
    createdBy: (0, sqlite_core_1.text)("created_by"), // userId que registró
    createdAt: (0, sqlite_core_1.text)("created_at").default((0, drizzle_orm_1.sql)(templateObject_5 || (templateObject_5 = __makeTemplateObject(["(CURRENT_TIMESTAMP)"], ["(CURRENT_TIMESTAMP)"])))),
});
// --- SNAPSHOTS INVENTARIO ---
exports.inventorySnapshots = (0, sqlite_core_1.sqliteTable)("inventory_snapshots", {
    id: (0, sqlite_core_1.integer)("id").primaryKey({ autoIncrement: true }),
    date: (0, sqlite_core_1.text)("date").default((0, drizzle_orm_1.sql)(templateObject_6 || (templateObject_6 = __makeTemplateObject(["(CURRENT_TIMESTAMP)"], ["(CURRENT_TIMESTAMP)"])))),
    productSku: (0, sqlite_core_1.text)("product_sku").notNull(),
    actualCount: (0, sqlite_core_1.real)("actual_count").notNull(), // Changed to real
    rawInput: (0, sqlite_core_1.text)("raw_input").notNull(),
    storeId: (0, sqlite_core_1.text)("store_id").default("centro"), // Isolation
    reportedBy: (0, sqlite_core_1.text)("reported_by").default("WebApp User"),
    createdAt: (0, sqlite_core_1.text)("created_at").default((0, drizzle_orm_1.sql)(templateObject_7 || (templateObject_7 = __makeTemplateObject(["(CURRENT_TIMESTAMP)"], ["(CURRENT_TIMESTAMP)"])))),
});
// --- COMPRAS/RECEPCIONES ---
exports.receptions = (0, sqlite_core_1.sqliteTable)("receptions", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    supplier: (0, sqlite_core_1.text)("supplier").notNull(),
    invoiceNumber: (0, sqlite_core_1.text)("invoice_number").notNull(),
    totalAmount: (0, sqlite_core_1.integer)("total_amount").notNull(),
    fileUrl: (0, sqlite_core_1.text)("file_url"),
    mimeType: (0, sqlite_core_1.text)("mime_type"),
    status: (0, sqlite_core_1.text)("status", { enum: ["PENDING", "CONFIRMED", "REJECTED"] }).default("PENDING"),
    rawData: (0, sqlite_core_1.text)("raw_data").notNull(), // JSON extraído
    storeId: (0, sqlite_core_1.text)("store_id").default("centro"), // Isolation
    createdAt: (0, sqlite_core_1.text)("created_at").default((0, drizzle_orm_1.sql)(templateObject_8 || (templateObject_8 = __makeTemplateObject(["(CURRENT_TIMESTAMP)"], ["(CURRENT_TIMESTAMP)"])))),
    createdBy: (0, sqlite_core_1.text)("created_by"), // ID del Receiver
});
exports.purchases = (0, sqlite_core_1.sqliteTable)("purchases", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    supplier_id: (0, sqlite_core_1.text)("supplier_id").references(function () { return exports.suppliers.id; }),
    receiver_user_id: (0, sqlite_core_1.text)("receiver_user_id").references(function () { return exports.users.id; }),
    total_amount: (0, sqlite_core_1.real)("total_amount").notNull(),
    invoice_image_url: (0, sqlite_core_1.text)("invoice_image_url"),
    status: (0, sqlite_core_1.text)("status", { enum: ["PENDING", "COMPLETED", "FLAGGED"] }).default("COMPLETED"),
    storeId: (0, sqlite_core_1.text)("store_id").default("centro"), // Isolation
    created_at: (0, sqlite_core_1.text)("created_at").default((0, drizzle_orm_1.sql)(templateObject_9 || (templateObject_9 = __makeTemplateObject(["(CURRENT_TIMESTAMP)"], ["(CURRENT_TIMESTAMP)"])))),
});
exports.purchase_items = (0, sqlite_core_1.sqliteTable)("purchase_items", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    purchase_id: (0, sqlite_core_1.text)("purchase_id").references(function () { return exports.purchases.id; }),
    product_id: (0, sqlite_core_1.text)("product_id").references(function () { return exports.products.id; }),
    quantity: (0, sqlite_core_1.real)("quantity").notNull(),
    unit_cost: (0, sqlite_core_1.real)("unit_cost").notNull(),
    variance_flag: (0, sqlite_core_1.integer)("variance_flag", { mode: "boolean" }).default(false),
});
// --- RECEIVER AGENT (OCR & COMPROBANTES INTERNOS) ---
exports.receipts = (0, sqlite_core_1.sqliteTable)("receipts", {
    id: (0, sqlite_core_1.text)("id").primaryKey(), // UUID o 'CRI-' + timestamp
    supplierName: (0, sqlite_core_1.text)("supplier_name").notNull(),
    invoiceNumber: (0, sqlite_core_1.text)("invoice_number"),
    totalAmount: (0, sqlite_core_1.real)("total_amount").notNull(),
    hasTaxCredit: (0, sqlite_core_1.integer)("has_tax_credit", { mode: "boolean" }).default(true),
    entryMode: (0, sqlite_core_1.text)("entry_mode", { enum: ["AI_SCAN", "MANUAL", "NO_INVOICE"] }).notNull(),
    status: (0, sqlite_core_1.text)("status", { enum: ["PENDING", "APPROVED", "DISPUTED"] }).default("APPROVED"),
    storeId: (0, sqlite_core_1.text)("store_id").default("centro"),
    createdAt: (0, sqlite_core_1.text)("created_at").default((0, drizzle_orm_1.sql)(templateObject_10 || (templateObject_10 = __makeTemplateObject(["(CURRENT_TIMESTAMP)"], ["(CURRENT_TIMESTAMP)"])))),
});
exports.receipt_items = (0, sqlite_core_1.sqliteTable)("receipt_items", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    receiptId: (0, sqlite_core_1.text)("receipt_id").references(function () { return exports.receipts.id; }),
    productName: (0, sqlite_core_1.text)("product_name").notNull(),
    quantity: (0, sqlite_core_1.real)("quantity").notNull(),
    unit: (0, sqlite_core_1.text)("unit").notNull(),
    unitPrice: (0, sqlite_core_1.real)("unit_price").notNull(),
});
exports.petty_cash_transactions = (0, sqlite_core_1.sqliteTable)("petty_cash_transactions", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    storeId: (0, sqlite_core_1.text)("store_id").default("centro"),
    amount: (0, sqlite_core_1.real)("amount").notNull(), // negativo para egresos (compras no_invoice)
    reason: (0, sqlite_core_1.text)("reason").notNull(),
    supplierId: (0, sqlite_core_1.text)("supplier_id").references(function () { return exports.suppliers.id; }), // Agregado para gastos manuales con proveedor
    costCenter: (0, sqlite_core_1.text)("cost_center", {
        enum: ["Cocina", "Salón", "Logística", "Administración", "Mantenimiento"],
    }).default("Cocina"),
    expenseDate: (0, sqlite_core_1.text)("expense_date"), // Fecha del gasto manual (YYYY-MM-DD)
    referenceId: (0, sqlite_core_1.text)("reference_id").references(function () { return exports.receipts.id; }), // Opcional, si viene de OCR
    createdAt: (0, sqlite_core_1.text)("created_at").default((0, drizzle_orm_1.sql)(templateObject_11 || (templateObject_11 = __makeTemplateObject(["(CURRENT_TIMESTAMP)"], ["(CURRENT_TIMESTAMP)"])))),
});
// --- ORÁCULO ---
exports.po_status_enum = ["DRAFT", "SENT", "RECEIVED", "CANCELLED"];
exports.purchase_orders = (0, sqlite_core_1.sqliteTable)("purchase_orders", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    supplier_id: (0, sqlite_core_1.text)("supplier_id"),
    status: (0, sqlite_core_1.text)("status", { enum: exports.po_status_enum }).default("DRAFT"),
    total_estimated: (0, sqlite_core_1.integer)("total_estimated"),
    created_at: (0, sqlite_core_1.text)("created_at").default((0, drizzle_orm_1.sql)(templateObject_12 || (templateObject_12 = __makeTemplateObject(["(CURRENT_TIMESTAMP)"], ["(CURRENT_TIMESTAMP)"])))),
    delivery_date: (0, sqlite_core_1.text)("delivery_date"),
});
exports.po_items = (0, sqlite_core_1.sqliteTable)("po_items", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    po_id: (0, sqlite_core_1.text)("po_id").references(function () { return exports.purchase_orders.id; }),
    product_id: (0, sqlite_core_1.text)("product_id").references(function () { return exports.products.id; }),
    quantity_suggested: (0, sqlite_core_1.real)("quantity_suggested"),
    quantity_ordered: (0, sqlite_core_1.real)("quantity_ordered"),
    unit_cost_snapshot: (0, sqlite_core_1.integer)("unit_cost_snapshot"),
});
// --- ESTADO DE SINCRONIZACIÓN (ETL — por pestaña) ---
exports.syncState = (0, sqlite_core_1.sqliteTable)("sync_state", {
    id: (0, sqlite_core_1.integer)("id").primaryKey({ autoIncrement: true }),
    syncKey: (0, sqlite_core_1.text)("sync_key").notNull().unique(), // Ej: "sheet_MARZO", "sheet_FEBRERO"
    lastSyncedRow: (0, sqlite_core_1.integer)("last_synced_row").default(0),
    updatedAt: (0, sqlite_core_1.text)("updated_at").default((0, drizzle_orm_1.sql)(templateObject_13 || (templateObject_13 = __makeTemplateObject(["(CURRENT_TIMESTAMP)"], ["(CURRENT_TIMESTAMP)"])))),
});
// --- CIERRES DE CAJA DIARIOS (Flujo Financiero) ---
exports.dailyCashClosures = (0, sqlite_core_1.sqliteTable)("daily_cash_closures", {
    id: (0, sqlite_core_1.integer)("id").primaryKey({ autoIncrement: true }),
    date: (0, sqlite_core_1.text)("date").notNull(), // Fecha del cierre (YYYY-MM-DD)
    day: (0, sqlite_core_1.text)("day"), // Día de la semana ("Lunes", "Martes")
    zClose: (0, sqlite_core_1.real)("z_close"), // Caja Z
    shift: (0, sqlite_core_1.text)("shift"), // Turno
    salesCounter: (0, sqlite_core_1.real)("sales_counter"), // Ventas Mostrador
    salesMpQr: (0, sqlite_core_1.real)("sales_mp_qr"), // Ventas MP QR
    salesDelivery: (0, sqlite_core_1.real)("sales_delivery"), // Ventas Pedidos Ya
    totalMp: (0, sqlite_core_1.real)("total_mp"), // Total MercadoPago
    totalCash: (0, sqlite_core_1.real)("total_cash"), // Total Efectivo
    totalDelivery: (0, sqlite_core_1.real)("total_delivery"), // Total Delivery
    totalGlobal: (0, sqlite_core_1.real)("total_global"), // Total Global
    laborCost: (0, sqlite_core_1.real)("labor_cost"), // Costo de Personal Diario
    variance: (0, sqlite_core_1.real)("variance"), // Sobran/faltan
    storeId: (0, sqlite_core_1.text)("store_id").default("centro"), // ID de sucursal
    sheetMonth: (0, sqlite_core_1.text)("sheet_month"), // Pestaña origen (ej. "MARZO")
    createdAt: (0, sqlite_core_1.text)("created_at").default((0, drizzle_orm_1.sql)(templateObject_14 || (templateObject_14 = __makeTemplateObject(["(CURRENT_TIMESTAMP)"], ["(CURRENT_TIMESTAMP)"])))),
});
// --- API KEYS (Tenant Isolation para Webhooks) ---
exports.apiKeys = (0, sqlite_core_1.sqliteTable)("api_keys", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    storeId: (0, sqlite_core_1.text)("store_id").notNull().unique(), // Cada sucursal tiene un único token activo en MVP
    keyHash: (0, sqlite_core_1.text)("key_hash").notNull(), // Hash de la key (Plaintext para MVP/testing interno rápido, o hash bcrypt)
    active: (0, sqlite_core_1.integer)("active", { mode: "boolean" }).default(true),
    createdAt: (0, sqlite_core_1.text)("created_at").default((0, drizzle_orm_1.sql)(templateObject_15 || (templateObject_15 = __makeTemplateObject(["(CURRENT_TIMESTAMP)"], ["(CURRENT_TIMESTAMP)"])))),
});
// --- METRICAS LABORALES ---
exports.labor_costs = (0, sqlite_core_1.sqliteTable)("labor_costs", {
    id: (0, sqlite_core_1.integer)("id").primaryKey({ autoIncrement: true }),
    storeId: (0, sqlite_core_1.text)("store_id").default("centro"),
    date: (0, sqlite_core_1.text)("date").notNull(), // Fecha del turno (YYYY-MM-DD)
    shift: (0, sqlite_core_1.text)("shift"), // Mañana, Tarde, Noche
    totalHours: (0, sqlite_core_1.real)("total_hours").notNull(),
    costAmount: (0, sqlite_core_1.real)("cost_amount").notNull(),
    createdAt: (0, sqlite_core_1.text)("created_at").default((0, drizzle_orm_1.sql)(templateObject_16 || (templateObject_16 = __makeTemplateObject(["(CURRENT_TIMESTAMP)"], ["(CURRENT_TIMESTAMP)"])))),
});
// --- METRICAS DE PROVEEDORES (OTIF & Lead Time) ---
exports.supplier_metrics = (0, sqlite_core_1.sqliteTable)("supplier_metrics", {
    id: (0, sqlite_core_1.integer)("id").primaryKey({ autoIncrement: true }),
    supplierId: (0, sqlite_core_1.text)("supplier_id").references(function () { return exports.suppliers.id; }),
    poId: (0, sqlite_core_1.text)("po_id").references(function () { return exports.purchase_orders.id; }),
    date: (0, sqlite_core_1.text)("date").notNull(), // Fecha de entrega
    leadTimeHours: (0, sqlite_core_1.real)("lead_time_hours").notNull(),
    isFull: (0, sqlite_core_1.integer)("is_full", { mode: "boolean" }).default(true),
    isOnTime: (0, sqlite_core_1.integer)("is_on_time", { mode: "boolean" }).default(true),
    createdAt: (0, sqlite_core_1.text)("created_at").default((0, drizzle_orm_1.sql)(templateObject_17 || (templateObject_17 = __makeTemplateObject(["(CURRENT_TIMESTAMP)"], ["(CURRENT_TIMESTAMP)"])))),
});
// --- DATA OPS (IMPORTACIONES) ---
exports.data_runs = (0, sqlite_core_1.sqliteTable)("data_runs", {
    id: (0, sqlite_core_1.text)("id").primaryKey(), // UUID
    fileName: (0, sqlite_core_1.text)("file_name").notNull(),
    status: (0, sqlite_core_1.text)("status").notNull(), // 'SUCCESS', 'PARTIAL', 'FAILED'
    rowsProcessed: (0, sqlite_core_1.integer)("rows_processed").default(0),
    rowsFailed: (0, sqlite_core_1.integer)("rows_failed").default(0),
    createdAt: (0, sqlite_core_1.text)("created_at").default((0, drizzle_orm_1.sql)(templateObject_18 || (templateObject_18 = __makeTemplateObject(["(CURRENT_TIMESTAMP)"], ["(CURRENT_TIMESTAMP)"])))),
});
// --- RELATIONS ---
var drizzle_orm_2 = require("drizzle-orm");
exports.productsRelations = (0, drizzle_orm_2.relations)(exports.products, function (_a) {
    var one = _a.one;
    return ({
        supplier: one(exports.suppliers, {
            fields: [exports.products.supplierId],
            references: [exports.suppliers.id],
        }),
    });
});
exports.suppliersRelations = (0, drizzle_orm_2.relations)(exports.suppliers, function (_a) {
    var many = _a.many;
    return ({
        products: many(exports.products),
    });
});
// --- FINTECH & TESORERÍA (Mercado Pago, Posnet, etc.) ---
exports.payment_gateways_ledger = (0, sqlite_core_1.sqliteTable)("payment_gateways_ledger", {
    id: (0, sqlite_core_1.text)("id").primaryKey(), // UUID
    gateway: (0, sqlite_core_1.text)("gateway", { enum: ["MERCADO_PAGO", "POSNET", "UBER_EATS", "PEDIDOS_YA"] })
        .notNull()
        .default("MERCADO_PAGO"),
    transactionReference: (0, sqlite_core_1.text)("transaction_reference").notNull(), // ID de la Tx en MP
    date: (0, sqlite_core_1.text)("date").notNull(), // Fecha operación
    grossAmount: (0, sqlite_core_1.real)("gross_amount").notNull(), // Monto Bruto (Venta)
    feeAmount: (0, sqlite_core_1.real)("fee_amount").notNull().default(0), // Comisión pasarela
    taxAmount: (0, sqlite_core_1.real)("tax_amount").notNull().default(0), // Retenciones (IIBB, IVA, Ganancias)
    netAmount: (0, sqlite_core_1.real)("net_amount").notNull(), // Monto Neto final
    releaseDate: (0, sqlite_core_1.text)("release_date").notNull(), // Cuándo se liquida el dinero
    status: (0, sqlite_core_1.text)("status", { enum: ["PENDING", "CLEARED", "REJECTED"] }).default("CLEARED"),
    storeId: (0, sqlite_core_1.text)("store_id").default("centro"),
    createdAt: (0, sqlite_core_1.text)("created_at").default((0, drizzle_orm_1.sql)(templateObject_19 || (templateObject_19 = __makeTemplateObject(["(CURRENT_TIMESTAMP)"], ["(CURRENT_TIMESTAMP)"])))),
});
// --- AI DECISION LEDGER (Agentic Security) ---
exports.ai_audit_logs = (0, sqlite_core_1.sqliteTable)("ai_audit_logs", {
    id: (0, sqlite_core_1.text)("id").primaryKey(), // UUID
    agentName: (0, sqlite_core_1.text)("agent_name").notNull(), // ej: 'GEMINI_INVOICE_OCR', 'COST_PROPAGATOR'
    action: (0, sqlite_core_1.text)("action").notNull(), // ej: 'CREATE_PURCHASE', 'UPDATE_PRICES'
    // Guardrail info
    payloadRef: (0, sqlite_core_1.text)("payload_ref"), // Referencia a un s3, log o json si es grande
    zodSchemaUsed: (0, sqlite_core_1.text)("zod_schema_used").notNull(),
    // Decisión del PEP
    status: (0, sqlite_core_1.text)("status", {
        enum: ["APPROVED", "REJECTED_BY_GUARDRAIL", "REJECTED_BY_RBAC"],
    }).notNull(),
    rejectionReason: (0, sqlite_core_1.text)("rejection_reason"),
    userId: (0, sqlite_core_1.text)("user_id"), // El humano responsable que disparó la tarea
    storeId: (0, sqlite_core_1.text)("store_id").default("centro"),
    createdAt: (0, sqlite_core_1.text)("created_at").default((0, drizzle_orm_1.sql)(templateObject_20 || (templateObject_20 = __makeTemplateObject(["(CURRENT_TIMESTAMP)"], ["(CURRENT_TIMESTAMP)"])))),
});
// --- WAREHOUSE DATA AIRLOCK (Transactional Outbox) ---
exports.outbox_events = (0, sqlite_core_1.sqliteTable)("outbox_events", {
    id: (0, sqlite_core_1.text)("id").primaryKey(), // UUID
    aggregateType: (0, sqlite_core_1.text)("aggregate_type").notNull(), // ej: 'TRANSACTION', 'EXPENSE', 'MERCADO_PAGO'
    aggregateId: (0, sqlite_core_1.text)("aggregate_id").notNull(), // ID of the mutated record
    payload: (0, sqlite_core_1.text)("payload").notNull(), // JSONB stringified
    status: (0, sqlite_core_1.text)("status", { enum: ["PENDING", "PROCESSING", "PROCESSED", "FAILED"] })
        .notNull()
        .default("PENDING"),
    storeId: (0, sqlite_core_1.text)("store_id").default("centro"),
    createdAt: (0, sqlite_core_1.text)("created_at").default((0, drizzle_orm_1.sql)(templateObject_21 || (templateObject_21 = __makeTemplateObject(["(CURRENT_TIMESTAMP)"], ["(CURRENT_TIMESTAMP)"])))),
    processedAt: (0, sqlite_core_1.text)("processed_at"),
});
// --- ACCOUNTS PAYABLE (B2B Liquidación) ---
exports.accounts_payable = (0, sqlite_core_1.sqliteTable)("accounts_payable", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    cuit: (0, sqlite_core_1.text)("cuit").notNull(),
    invoice_number: (0, sqlite_core_1.text)("invoice_number").notNull(),
    amount: (0, sqlite_core_1.real)("amount").notNull(),
    paymentMethod: (0, sqlite_core_1.text)("payment_method", {
        enum: ["TRANSFERENCIA", "EFECTIVO", "CHEQUE", "CRIPTO"],
    }),
    status: (0, sqlite_core_1.text)("status", { enum: ["PENDING", "PAID", "REJECTED"] }).default("PENDING"),
    storeId: (0, sqlite_core_1.text)("store_id").default("centro"),
    createdAt: (0, sqlite_core_1.text)("created_at").default((0, drizzle_orm_1.sql)(templateObject_22 || (templateObject_22 = __makeTemplateObject(["(CURRENT_TIMESTAMP)"], ["(CURRENT_TIMESTAMP)"])))),
}, function (table) { return ({
    unq: (0, sqlite_core_1.unique)("ap_invoice_cuit_idx").on(table.invoice_number, table.cuit),
}); });
// --- OPEX LEDGER (Costos Fijos) ---
exports.opex_ledger = (0, sqlite_core_1.sqliteTable)("opex_ledger", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    description: (0, sqlite_core_1.text)("description").notNull(),
    amount: (0, sqlite_core_1.real)("amount").notNull(),
    date: (0, sqlite_core_1.text)("date").notNull(),
    storeId: (0, sqlite_core_1.text)("store_id").default("centro"),
    createdAt: (0, sqlite_core_1.text)("created_at").default((0, drizzle_orm_1.sql)(templateObject_23 || (templateObject_23 = __makeTemplateObject(["(CURRENT_TIMESTAMP)"], ["(CURRENT_TIMESTAMP)"])))),
});
// --- INVENTORY KARDEX STATE (Operational Ledger Math) ---
exports.inventory_kardex = (0, sqlite_core_1.sqliteTable)("inventory_kardex", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    storeId: (0, sqlite_core_1.text)("store_id").notNull(),
    productSku: (0, sqlite_core_1.text)("product_sku").notNull(),
    quantity: (0, sqlite_core_1.real)("quantity").notNull().default(0),
    updatedAt: (0, sqlite_core_1.text)("updated_at").default((0, drizzle_orm_1.sql)(templateObject_24 || (templateObject_24 = __makeTemplateObject(["(CURRENT_TIMESTAMP)"], ["(CURRENT_TIMESTAMP)"])))),
});
// --- LIBRO MAYOR DE COTIZACIONES (MOTOR DE ARBITRAJE) ---
exports.ingredient_quotes = (0, sqlite_core_1.sqliteTable)("ingredient_quotes", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    supplier_id: (0, sqlite_core_1.text)("supplier_id")
        .references(function () { return exports.suppliers.id; })
        .notNull(),
    ingredient_sku: (0, sqlite_core_1.text)("ingredient_sku")
        .references(function () { return exports.products.id; })
        .notNull(),
    price_cents: (0, sqlite_core_1.integer)("price_cents").notNull(),
    updated_at: (0, sqlite_core_1.integer)("updated_at").default((0, drizzle_orm_1.sql)(templateObject_25 || (templateObject_25 = __makeTemplateObject(["(strftime('%s', 'now'))"], ["(strftime('%s', 'now'))"])))),
}, function (table) { return ({
    unq: (0, sqlite_core_1.unique)("supplier_ingredient_idx").on(table.supplier_id, table.ingredient_sku),
}); });
// Temporary patch file for schema additions to execute dynamically via DDL.
// The Drizzle push will be simulated locally.
// --- CAJAS DIARIAS (Tesorería) ---
exports.cash_register_transactions = (0, sqlite_core_1.sqliteTable)("cash_register_transactions", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    storeId: (0, sqlite_core_1.text)("store_id").default("centro"),
    date: (0, sqlite_core_1.text)("date").notNull(), // FechaCaja
    registerNum: (0, sqlite_core_1.text)("register_num").notNull(), // NroCaja
    shift: (0, sqlite_core_1.text)("shift").notNull(), // Turno 'MAÑANA' | 'NOCHE'
    openingAmount: (0, sqlite_core_1.real)("opening_amount").notNull(),
    closingAmount: (0, sqlite_core_1.real)("closing_amount").notNull(),
    discrepancy: (0, sqlite_core_1.real)("discrepancy").notNull(),
    cashInRegister: (0, sqlite_core_1.real)("cash_in_register").notNull(),
    // Unpivoted items
    paymentMethod: (0, sqlite_core_1.text)("payment_method").notNull(),
    amount: (0, sqlite_core_1.real)("amount").notNull(),
    createdAt: (0, sqlite_core_1.text)("created_at").default((0, drizzle_orm_1.sql)(templateObject_26 || (templateObject_26 = __makeTemplateObject(["(CURRENT_TIMESTAMP)"], ["(CURRENT_TIMESTAMP)"])))),
}, function (table) { return ({
    unq: (0, sqlite_core_1.unique)("cash_reg_tx_unq").on(table.date, table.registerNum, table.shift, table.paymentMethod),
}); });
// --- GASTOS RECURRENTES (OPEX Accrual) ---
exports.recurring_expenses = (0, sqlite_core_1.sqliteTable)("recurring_expenses", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    storeId: (0, sqlite_core_1.text)("store_id").default("centro"),
    description: (0, sqlite_core_1.text)("description").notNull(),
    monthlyAmount: (0, sqlite_core_1.real)("monthly_amount").notNull(),
    dayOfMonth: (0, sqlite_core_1.integer)("day_of_month").notNull(),
    category: (0, sqlite_core_1.text)("category").notNull(),
    createdAt: (0, sqlite_core_1.text)("created_at").default((0, drizzle_orm_1.sql)(templateObject_27 || (templateObject_27 = __makeTemplateObject(["(CURRENT_TIMESTAMP)"], ["(CURRENT_TIMESTAMP)"])))),
});
// --- VENTAS DIRECTAS (ETL) ---
exports.fact_sales = (0, sqlite_core_1.sqliteTable)("fact_sales", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    date: (0, sqlite_core_1.text)("date").notNull(),
    shift: (0, sqlite_core_1.text)("shift").notNull(),
    raw_name: (0, sqlite_core_1.text)("raw_name").notNull(),
    productSku: (0, sqlite_core_1.text)("product_sku").notNull(),
    quantity: (0, sqlite_core_1.real)("quantity").notNull(),
    net_price_cents: (0, sqlite_core_1.integer)("net_price_cents").notNull(),
    createdAt: (0, sqlite_core_1.text)("created_at").default((0, drizzle_orm_1.sql)(templateObject_28 || (templateObject_28 = __makeTemplateObject(["(CURRENT_TIMESTAMP)"], ["(CURRENT_TIMESTAMP)"])))),
});
// --- SUGERENCIAS DE COMPRA (ADC CRON FORECAST) ---
exports.purchase_suggestions = (0, sqlite_core_1.sqliteTable)("purchase_suggestions", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    sku: (0, sqlite_core_1.text)("sku").notNull(),
    suggested_qty: (0, sqlite_core_1.real)("suggested_qty").notNull(),
    status: (0, sqlite_core_1.text)("status", { enum: ["Riesgo de Quiebre (ADC)", "SENT", "REJECTED"] }).default("Riesgo de Quiebre (ADC)"),
    created_at: (0, sqlite_core_1.text)("created_at").default((0, drizzle_orm_1.sql)(templateObject_29 || (templateObject_29 = __makeTemplateObject(["(CURRENT_DATE)"], ["(CURRENT_DATE)"])))),
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13, templateObject_14, templateObject_15, templateObject_16, templateObject_17, templateObject_18, templateObject_19, templateObject_20, templateObject_21, templateObject_22, templateObject_23, templateObject_24, templateObject_25, templateObject_26, templateObject_27, templateObject_28, templateObject_29;
