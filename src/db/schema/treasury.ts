import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ENUMs
export const expense_type_enum = ["FIXED", "VARIABLE", "EXTRAORDINARY", "PAYROLL", "TAXES"] as const;
export const ap_status_enum = ["PENDING", "PARTIAL", "PAID", "OVERDUE"] as const;

// Regla 1: Ontología de Egresos
export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey(),
  store_id: text("store_id").notNull(), // Aislamiento Zero-Trust
  expense_type: text("expense_type", { enum: expense_type_enum }).notNull(),
  
  // Trazabilidad Impositiva Financiera O(1)
  net_amount_cents: integer("net_amount_cents").notNull(),
  tax_amount_cents: integer("tax_amount_cents").notNull(),
  withholdings_cents: integer("withholdings_cents").notNull(),
  gross_amount_cents: integer("gross_amount_cents").notNull(),
  
  reference_id: text("reference_id"), // Hook Polimórfico
  
  created_at: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  deleted_at: integer("deleted_at", { mode: "timestamp" }), // Soft Delete Aislado
});

// Regla 2: Motor de Cuentas por Pagar (Accounts Payable)
export const supplier_current_accounts = sqliteTable("supplier_current_accounts", {
  id: text("id").primaryKey(),
  store_id: text("store_id").notNull(),
  supplier_id: text("supplier_id").notNull(),
  
  // Contabilidad Partida Doble
  debt_cents: integer("debt_cents").notNull().default(0), 
  credit_cents: integer("credit_cents").notNull().default(0), 
  
  due_date: integer("due_date", { mode: "timestamp" }).notNull(),
  status: text("status", { enum: ap_status_enum }).notNull().default("PENDING"),
  
  created_at: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  deleted_at: integer("deleted_at", { mode: "timestamp" }), // Soft Delete Aislado
});

export const expense_line_items = sqliteTable("expense_line_items", {
  id: text("id").primaryKey(),
  store_id: text("store_id").notNull(),
  expense_id: text("expense_id").notNull().references(() => expenses.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  quantity: integer("quantity", { mode: "number" }).notNull(),
  unit_price_cents: integer("unit_price_cents").notNull(),
  total_cents: integer("total_cents").notNull(),
  
  created_at: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  deleted_at: integer("deleted_at", { mode: "timestamp" }),
});

// ─────────────────────────────────────────────────────────────
// TOPOLOGÍA DE LIQUIDEZ V3.2 — Separación Estricta de Cajas
// ─────────────────────────────────────────────────────────────

export const account_type_enum = ["BANK", "SAFE", "DIGITAL_WALLET"] as const;

// Caja Chica — Para gastos menores sin factura formal
export const petty_cash_fund = sqliteTable("petty_cash_fund", {
  id: text("id").primaryKey(),
  store_id: text("store_id").notNull(),
  fund_name: text("fund_name").notNull().default("Caja Chica"),
  current_balance_cents: integer("current_balance_cents").notNull().default(0),
  last_replenished_at: text("last_replenished_at"),
  audited_by: text("audited_by"),
  audited_at: text("audited_at"),
  created_at: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// Cuentas Bancarias & Caja Fuerte — Para AP pesadas
export const treasury_accounts = sqliteTable("treasury_accounts", {
  id: text("id").primaryKey(),
  store_id: text("store_id").notNull(),
  account_name: text("account_name").notNull(),
  account_type: text("account_type", { enum: account_type_enum }).notNull().default("BANK"),
  balance_cents: integer("balance_cents").notNull().default(0),
  audited_by: text("audited_by"),
  audited_at: text("audited_at"),
  created_at: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// Cierres de Caja (Vortex Ingestion)
export const cash_register_closures = sqliteTable("cash_register_closures", {
  id: text("id").primaryKey(),
  store_id: text("store_id").notNull(),
  shift: text("shift").notNull(),
  closed_at: text("closed_at").notNull(),
  payment_method: text("payment_method", { enum: ["EFECTIVO", "EFECTIVO_PYA", "MERCADO_PAGO", "ONLINE_PYA", "DELIVERY_PROPIO", "POSNET", "PAGO_ONLINE"] }).notNull(),
  total_cents: integer("total_cents").notNull(),
  difference_cents: integer("difference_cents").notNull().default(0),
  created_at: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});
