import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

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
