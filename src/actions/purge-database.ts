"use server";

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { requireManagerSession } from "@/lib/auth-action";

/**
 * Purga Termonuclear de Datos Operativos
 * ──────────────────────────────────────
 * RBAC: Solo OWNER_GLOBAL puede ejecutar esta operación destructiva.
 */
export async function purgeDatabaseAction() {
  const session = await requireManagerSession();
  if (!session.success || !session.data) {
    throw new Error(session.error || "ZERO_TRUST_VIOLATION: Acceso denegado.");
  }
  if (session.data.role !== "OWNER_GLOBAL") {
    throw new Error("UNAUTHORIZED_ACCESS: Solo C-Level puede ejecutar purgas de datos.");
  }

  console.log("Iniciando purga termonuclear P0...");

  // 1. Core Ledger & Transactional Storage
  await db.run(sql`DELETE FROM transactions`);
  await db.run(sql`DELETE FROM outbox_events`);
  await db.run(sql`DELETE FROM ai_audit_logs`);
  await db.run(sql`DELETE FROM fact_sales`);
  await db.run(sql`DELETE FROM cash_register_transactions`);
  await db.run(sql`DELETE FROM sales_mapping_dlq`);

  // 2. Tablas Adicionales
  try {
    await db.run(sql`DELETE FROM opex_ledger`);
  } catch (e) {}
  try {
    await db.run(sql`DELETE FROM accounts_payable`);
  } catch (e) {}

  console.log("Purga completada.");
  return { success: true, message: "Ledger transaccional Purgado Exitosamente." };
}
