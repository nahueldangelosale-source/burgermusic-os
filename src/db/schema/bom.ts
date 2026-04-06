import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const raw_materials = sqliteTable("raw_materials", {
  id: text("id").primaryKey(),
  supplierId: text("supplier_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull().default("INGREDIENTES"), // Bebidas, Insumos, etc
  baseUnit: text("base_unit").notNull(), // Ej: 'GR', 'ML', 'UNIT'
  grossCostCents: integer("gross_cost_cents").notNull(),
  historicalYieldPct: real("historical_yield_pct").notNull().default(1.0),
  trueCostPerUnitCents: real("true_cost_per_unit_cents").notNull(), // Costo real tras merma
  purchaseUnit: text("purchase_unit").notNull().default("UNIDAD"), // Ej: 'BOLSA', 'CAJA'
  recipeUnit: text("recipe_unit").notNull().default("UNIDAD"), // Ej: 'GRAMOS'
  conversionFactor: real("conversion_factor").notNull().default(1.0), // 1 BOLSA = 2500 GRAMOS
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
});

export const sellable_products = sqliteTable("sellable_products", {
  id: text("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  category: text("category").notNull().default("GENERAL"),
  priceCents: integer("price_cents").notNull(),
  liveMarginCents: integer("live_margin_cents").notNull().default(0), // Actualizado asíncronamente
});

export const bill_of_materials = sqliteTable("bill_of_materials", {
  id: text("id").primaryKey(),
  parentId: text("parent_id").notNull(), // sellable_product.id o raw_material.id (sub-receta)
  childId: text("child_id"),             // Nullable: NULL = enlace roto pendiente de resolución manual
  raw_child_name: text("raw_child_name"), // Nombre crudo del CSV cuando childId es NULL (Human-in-the-loop)
  quantity: real("quantity").notNull(),
  unitMultiplier: real("unit_multiplier").notNull().default(1.0),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
});
