"use server";

import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Purga Termonuclear de Datos Operativos
 * ──────────────────────────────────────
 * Reinicia el Ledger financiero y los buffers de auditoría destructivamente,
 * manteniendo las configuraciones core inmutables (usuarios, locales, etc).
 */
import { authenticatedAction } from "@/lib/auth-action";

export const purgeDatabaseAction = authenticatedAction(async () => {
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
});
