import { sql } from "drizzle-orm";
import { sqliteTable, text, real, integer, index, unique } from "drizzle-orm/sqlite-core";

export const item_category_enum = ["VEGETALES", "CARNES", "PANIFICADOS", "QUESOS_FIAMBRES", "CONGELADOS", "PACKAGING", "BEBIDAS", "OTROS"] as const;
export const measurement_unit_enum = ["KG", "GRAMO", "UNIDAD", "LITRO"] as const;
export const movement_type_enum = ["IN", "OUT", "ADJUST"] as const;

export const inventory_items = sqliteTable("inventory_items", {
  id: text("id").primaryKey(),
  store_id: text("store_id").notNull(),
  name: text("name").notNull(),
  category: text("category", { enum: item_category_enum }).notNull(),
  measurement_unit: text("measurement_unit", { enum: measurement_unit_enum }).notNull(),
  current_stock: real("current_stock").default(0),
  min_stock_alert: real("min_stock_alert").default(0),
  maximum_capacity: real("maximum_capacity").default(100),
  cost_per_unit_cents: integer("cost_per_unit_cents").default(0).notNull(),

  // V3.1 Compliance: Soft Delete & Audit Trail
  is_active: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  deleted_at: text("deleted_at"),

  // LPP Audit Trail
  audited_at: text("audited_at"),
  audited_by: text("audited_by"),

  created_at: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  updated_at: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// Regla 2: El Ledger de Movimientos (Event Sourcing)
export const stock_movements = sqliteTable("stock_movements", {
  id: text("id").primaryKey(),
  store_id: text("store_id").notNull(),
  item_id: text("item_id").notNull().references(() => inventory_items.id, { onDelete: 'cascade' }),
  movement_type: text("movement_type", { enum: movement_type_enum }).notNull(),
  quantity: real("quantity").notNull(),
  reference_id: text("reference_id"),
  
  created_at: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

export const purchase_order_status_enum = ['DRAFT', 'APPROVED', 'SENT', 'FULFILLED'] as const;

export const purchase_orders = sqliteTable("purchase_orders", {
  id: text("id").primaryKey(),
  store_id: text("store_id").notNull().default("STR_DEFAULT"), // Fallback if required by architecture
  supplierId: text("supplierId"),
  status: text("status", { enum: purchase_order_status_enum }).notNull().default('DRAFT'),
  totalAmountCents: integer("totalAmountCents").notNull().default(0),
  createdAt: text("createdAt").default(sql`(CURRENT_TIMESTAMP)`),
});

export const purchase_order_items = sqliteTable("purchase_order_items", {
  id: text("id").primaryKey(),
  poId: text("poId").notNull().references(() => purchase_orders.id, { onDelete: 'cascade' }),
  ingredientId: text("ingredientId").notNull(),
  quantityGrams: integer("quantityGrams").notNull(),
  unitPriceCents: integer("unitPriceCents").notNull().default(0),
});

// --- RECEPCIÓN Y MATCH FISICO (Airlock) ---
export const goods_receipt_status_enum = ['MATCHED', 'DISPUTED'] as const;

export const goods_receipts = sqliteTable("goods_receipts", {
  id: text("id").primaryKey(),
  po_id: text("po_id").notNull().references(() => purchase_orders.id),
  store_id: text("store_id").notNull(),
  supplier_id: text("supplier_id"),
  receipt_date: text("receipt_date").notNull(),
  status: text("status", { enum: goods_receipt_status_enum }).notNull().default('MATCHED'),
  document_url: text("document_url"),
  audited_by: text("audited_by"),
  created_at: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

export const goods_receipt_items = sqliteTable("goods_receipt_items", {
  id: text("id").primaryKey(),
  receipt_id: text("receipt_id").notNull().references(() => goods_receipts.id, { onDelete: 'cascade' }),
  inventory_item_id: text("inventory_item_id").notNull().references(() => inventory_items.id),
  expected_quantity: real("expected_quantity").notNull(),
  actual_received_quantity: real("actual_received_quantity").notNull(),
  variance_quantity: real("variance_quantity").notNull().default(0),
});

// --- AUTONOMOUS CLAIM ORCHESTRATOR ---
export const supplier_claim_status_enum = ['DISPUTED', 'CLAIM_SENT', 'RESOLVED'] as const;

export const supplier_claims = sqliteTable("supplier_claims", {
  id: text("id").primaryKey(),
  receipt_id: text("receipt_id").notNull().references(() => goods_receipts.id),
  po_id: text("po_id").notNull().references(() => purchase_orders.id),
  status: text("status", { enum: supplier_claim_status_enum }).notNull().default('DISPUTED'),
  missing_details: text("missing_details").notNull(),
  ai_claim_draft: text("ai_claim_draft").notNull(),
  created_at: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  resolved_at: text("resolved_at"),
}, (table) => ({
  poIdx: index("supplier_claims_po_idx").on(table.po_id),
}));

// ─────────────────────────────────────────────────────────────────────────────
// SUPPLIER SKUs — Raw Catalogue from the Physical World
//
// Cada proveedor envía insumos bajo sus propios nombres caóticos.
// Esta tabla captura los SKUs crudos tal como aparecen en remitos/facturas.
// Se vincula a supplier_item_mappings (ACL) para su traducción a MDM.
// ─────────────────────────────────────────────────────────────────────────────
export const supplier_skus = sqliteTable("supplier_skus", {
  id: text("id").primaryKey(),
  supplierId: text("supplier_id").notNull(),
  skuName: text("sku_name").notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
}, (table) => ({
  /** Un proveedor no debería tener SKUs duplicados */
  unq: unique("supplier_sku_unq").on(table.supplierId, table.skuName),
  /** Índice para búsqueda rápida por proveedor */
  supplierIdx: index("ss_supplier_idx").on(table.supplierId),
}));

// ─────────────────────────────────────────────────────────────────────────────
// SUPPLIER INGREDIENTS — MDM Bridge (Proveedor ↔ Insumo)
//
// Fuente canónica de verdad para el Agente de Compras:
//   - Qué proveedor abastece qué insumo
//   - Precio de última compra (WAC LPP) en cents
//   - Proveedor preferido para generación automática de PO
//   - Lead time operativo por relación proveedor-insumo
//
// El Agente de Compras hace LEFT JOIN aquí para enriquecer
// los borradores de OC con datos deterministas (sin alucinación).
// ─────────────────────────────────────────────────────────────────────────────
export const supplier_ingredients = sqliteTable(
  "supplier_ingredients",
  {
    id: text("id").primaryKey(),

    /** FK lógica a suppliers.id */
    supplier_id: text("supplier_id").notNull(),

    /**
     * FK lógica a mdm_ingredients.id.
     * Se usa mdm_ingredients (no inventory_items) porque es el MDM
     * canónico de insumos que alimenta el Kardex y el Agente de Compras.
     */
    ingredient_id: text("ingredient_id").notNull(),

    /**
     * Precio de la última compra en centavos (integer — mandato CTO).
     * Se actualiza automáticamente en cada ingesta de factura WAC.
     * Ej: $1.250/kg → 125000 cents.
     */
    last_purchase_price_cents: integer("last_purchase_price_cents")
      .notNull()
      .default(0),

    /**
     * Proveedor preferido para este insumo.
     * Solo 1 proveedor puede ser preferred por ingredient_id.
     * El Agente de Compras lo prioriza al generar borradores de PO.
     */
    is_preferred: integer("is_preferred", { mode: "boolean" })
      .notNull()
      .default(false),

    /** Lead time operativo en horas para esta relación específica */
    lead_time_hours: integer("lead_time_hours").notNull().default(24),

    /** Unidad de compra (KG, UNIDAD, LITRO) — para el prompt del agente */
    purchase_unit: text("purchase_unit").notNull().default("KG"),

    /** Cantidad mínima de pedido (MOQ) */
    min_order_qty: real("min_order_qty").notNull().default(1),

    updated_at: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
    created_at: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    /** Un proveedor tiene un único precio por insumo */
    unq: unique("supplier_ingredient_unq").on(
      table.supplier_id,
      table.ingredient_id,
    ),
    /** Índice para búsquedas rápidas por insumo → proveedor preferido */
    ingredientIdx: index("si_ingredient_idx").on(table.ingredient_id),
    /** Índice para búsquedas por proveedor → catálogo completo */
    supplierIdx: index("si_supplier_idx").on(table.supplier_id),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// ANTICORRUPTION LAYER (ACL) — Supplier UOM Translation Mapping
//
// Relación N:1
// Muchos strings sucios provenientes de facturas (supplierItemName) 
// mapean a un único ingrediente estandarizado en MDM (internalIngredientId).
// Aplica el conversionFactor para resolver la discrepancia de UOM a gramos o unidades atómicas en O(1).
// ─────────────────────────────────────────────────────────────────────────────
export const supplier_item_mappings = sqliteTable(
  "supplier_item_mappings",
  {
    id: text("id").primaryKey(),

    /** FK a suppliers.id */
    supplierId: text("supplier_id").notNull(),

    /** Nombre sucio tal como viene en la factura del proveedor */
    supplierItemName: text("supplier_item_name").notNull(),

    /**
     * FK a mdm_ingredients.id
     */
    internalIngredientId: text("internal_ingredient_id").notNull(),

    /**
     * Factor de conversión (multiplier) para llevar la unidad de compra a la unidad base (ej: GRAMOS).
     * Siempre es Integer. Ej: "Caja de 15kg" -> factor 15000.
     * En el Invoice Engine: cantidad * conversionFactor = cantidadBase
     */
    conversionFactor: integer("conversion_factor").notNull(),

    updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
    createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    /** Un proveedor no debería tener mapeos duplicados para el mismo string exacto */
    unq: unique("sup_item_map_unq").on(
      table.supplierId,
      table.supplierItemName,
    ),
    /** Búsqueda rápida por nombre (usado intensivamente durante la ingesta) */
    nameIdx: index("sim_name_idx").on(table.supplierId, table.supplierItemName),
  }),
);
