"use server";

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║    YIELD MANAGEMENT ENGINE — Manufactura de Medallones (O(1))              ║
 * ║    BurgerMusic OS v4.2 — Closed-Loop Supply Chain                         ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import { db } from "@/db";
import { inventory_kardex } from "@/db/schema";
import { requireManagerSession } from "@/lib/auth-action";
import { randomUUID } from "node:crypto";

export interface YieldData {
  roastBeefGr: number;
  tapaAsadoGr: number;
  grasaGr: number;
  producedMedallions: number;
}

export async function processMeatMedallions(yieldData: YieldData) {
  // ── 1. BARRERA C-LEVEL ZERO-TRUST O(1) ──
  const session = await requireManagerSession();
  if (!session.success || !session.data) {
    throw new Error(session.error || "AUTH_MISSING: Sesión huérfana interceptada.");
  }

  const STORE_ID = session.data.storeId;
  const BATCH_ID = `BATCH-${randomUUID().substring(0, 8).toUpperCase()}`;

  // ── 2. CÁLCULO TERMODINÁMICO DE MERMAS ──
  const inputWeightGr = yieldData.roastBeefGr + yieldData.tapaAsadoGr + yieldData.grasaGr;
  const outputWeightGr = yieldData.producedMedallions * 110; // Cada medallón debe pesar exactamente 110g
  const shrinkageGr = inputWeightGr - outputWeightGr;

  // ── 3. OPERACIÓN ACID SOBRE KARDEX V2 ──
  await db.transaction(async (tx) => {
    // 3.1: Deducción Innegociable de Materia Prima Cruda (GR)
    if (yieldData.roastBeefGr > 0) {
      await tx.insert(inventory_kardex).values({
        id: `KDX-${randomUUID().substring(0, 16)}`,
        storeId: STORE_ID,
        productSku: "MDM_ROAST_BEEF",
        movementType: "MANUFACTURING_CONSUMPTION",
        quantity: -yieldData.roastBeefGr, // Movimiento Negativo Equivalente Constante
        referenceId: BATCH_ID,
      });
    }
    
    if (yieldData.tapaAsadoGr > 0) {
      await tx.insert(inventory_kardex).values({
        id: `KDX-${randomUUID().substring(0, 16)}`,
        storeId: STORE_ID,
        productSku: "MDM_TAPA_ASADO",
        movementType: "MANUFACTURING_CONSUMPTION",
        quantity: -yieldData.tapaAsadoGr,
        referenceId: BATCH_ID,
      });
    }

    if (yieldData.grasaGr > 0) {
      await tx.insert(inventory_kardex).values({
        id: `KDX-${randomUUID().substring(0, 16)}`,
        storeId: STORE_ID,
        productSku: "MDM_GRASA_VACUNA",
        movementType: "MANUFACTURING_CONSUMPTION",
        quantity: -yieldData.grasaGr,
        referenceId: BATCH_ID,
      });
    }

    // 3.2: Incremento de Producto Terminado (UNITS)
    if (yieldData.producedMedallions > 0) {
      await tx.insert(inventory_kardex).values({
        id: `KDX-${randomUUID().substring(0, 16)}`,
        storeId: STORE_ID,
        productSku: "MDM_MEDALLON_110G",
        movementType: "MANUFACTURING_PRODUCTION",
        quantity: yieldData.producedMedallions, // Movimiento Positivo
        referenceId: BATCH_ID,
      });
    }

    // 3.3: Registro de Shrinkage (Merma de Producción)
    if (shrinkageGr !== 0) {
      await tx.insert(inventory_kardex).values({
        id: `KDX-${randomUUID().substring(0, 16)}`,
        storeId: STORE_ID,
        productSku: "METRIC_SHRINKAGE", // SKU virtual exclusivo para auditoría FinOps
        movementType: "MANUFACTURING_SHRINKAGE",
        quantity: shrinkageGr, 
        referenceId: BATCH_ID,
      });
    }
  });

  // ── 4. RESPUESTA Y TRAZA FINOPS ──
  const shrinkagePercentage = Number(((shrinkageGr / inputWeightGr) * 100).toFixed(2)) || 0;
  
  return {
    success: true,
    batchId: BATCH_ID,
    metrics: {
      inputWeightGr,
      outputWeightGr,
      shrinkageGr,
      shrinkagePercentage
    }
  };
}
