import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ─────────────────────────────────────────────────────────────
// ZOMBIE SHIFT AUDITS — Closed-Loop Governance Ledger
// Antigravity 2026: Immutable Crisis Registry
// ─────────────────────────────────────────────────────────────

export const zombie_audit_status_enum = ["PENDING", "RESOLVED"] as const;

export const zombie_shift_audits = sqliteTable("zombie_shift_audits", {
  id: text("id").primaryKey(),
  store_id: text("store_id").notNull(),
  target_date: text("target_date").notNull(),
  reported_margin_percent: integer("reported_margin_percent").notNull(), // stored as basis points (1550 = 15.50%)
  reported_revenue_cents: integer("reported_revenue_cents").notNull().default(0),
  reported_cogs_cents: integer("reported_cogs_cents").notNull().default(0),
  reported_shrinkage_cents: integer("reported_shrinkage_cents").notNull().default(0),
  status: text("status", { enum: zombie_audit_status_enum }).notNull().default("PENDING"),
  manager_justification: text("manager_justification"),
  resolved_at: text("resolved_at"),
  resolved_by: text("resolved_by"),
  created_at: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});
