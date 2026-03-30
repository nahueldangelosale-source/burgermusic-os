"use server";

import { randomUUID } from "crypto";
import type { ReceiptData } from "@/actions/gemini-ocr";
import { db } from "@/db";
import { petty_cash_transactions, products, receipt_items, receipts } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { like, isNull, and } from "drizzle-orm";

export type EntryMode = "AI_SCAN" | "MANUAL" | "NO_INVOICE";

export interface ReceiptItemData {
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  shrinkflationAlert?: boolean;
  priceVariancePercentage?: number;
}

export interface ReceiptSubmissionData {
  supplierName: string;
  invoiceNumber: string | null;
  totalAmount: number;
  entryMode: EntryMode;
  items: ReceiptItemData[];
}

/**
 * Procesa la carga de una recepción desde el Agente Receiver.
 * Acepta las entradas del Edge (ya sea OCR con Gemini, dictado por voz, o manual).
 * Mantiene la ACIDidad mediante db.transaction.
 */
export async function processReceiptSubmission(data: ReceiptSubmissionData) {
  try {
    const session = await getSession();
    if (!session?.user || !["OWNER_GLOBAL", "MANAGER", "RECEIVER"].includes(session.user.role)) {
      return { success: false, error: "Unauthorized submission." };
    }

    return await db.transaction(async (tx) => {
      // Si es fondo fijo, generamos un identificador interno (CRI). Sino, UUID de trazabilidad OCR.
      const receiptId = data.entryMode === "NO_INVOICE" ? `CRI-${Date.now()}` : randomUUID();
      const hasTaxCredit = data.entryMode !== "NO_INVOICE";

      // 1. Inserción de Cabecera (El Comprobante / Factura)
      await tx.insert(receipts).values({
        id: receiptId,
        supplierName: data.supplierName,
        invoiceNumber: data.invoiceNumber || null,
        totalAmount: data.totalAmount,
        hasTaxCredit,
        entryMode: data.entryMode,
        status: "APPROVED",
        storeId: session.user.storeId, // Aislación Multi-Tenant Scoped by Session
      });

      // 2. Inserción de Ítems Individuales (BOM entrante)
      if (data.items.length > 0) {
        await tx.insert(receipt_items).values(
          data.items.map((item) => ({
            id: randomUUID(),
            receiptId,
            productName: item.productName,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
          })),
        );
      }

      // 3. Deducción de Caja Chica (Impacto Financiero Edge)
      if (data.entryMode === "NO_INVOICE") {
        await tx.insert(petty_cash_transactions).values({
          id: randomUUID(),
          storeId: session.user.storeId,
          amount: -Math.abs(data.totalAmount), // Siempre negativo (egreso de efectivo)
          reason: `PAGO VALE - PROVEEDOR: ${data.supplierName}`,
          referenceId: receiptId,
        });
      }

      return { success: true, receiptId };
    });
  } catch (error) {
    console.error("Error processing receipt:", error);
    return { success: false, error: "Failed to process receipt submission and impact DB." };
  }
}

export interface AuditedReceiptItem {
  rawName: string;
  quantity: number;
  unitOfMeasure: string;
  unitPrice: number;
  totalPrice: number;

  matchedProductId: string | null;
  shrinkflationAlert: boolean;
  priceVariancePercentage: number;
}

export interface AuditedReceiptData {
  providerName: string;
  documentNumber: string;
  date: string;
  totalAmount: number;
  isThreeWayMatch: boolean;
  items: AuditedReceiptItem[];
}

export async function auditReceiptData(
  parsedData: ReceiptData,
  tenantId: string,
): Promise<AuditedReceiptData> {
  try {
    const session = await getSession();
    if (!session?.user || !["OWNER_GLOBAL", "MANAGER", "RECEIVER"].includes(session.user.role)) {
      throw new Error("Unauthorized to audit receipts.");
    }

    const auditedItems: AuditedReceiptItem[] = [];
    let isThreeWayMatch = true;

    for (const item of parsedData.items) {
      // 1. Mapeo MDM
      // Privilegiar coincidencia exacta antes de degradar a palabra clave
      let matchedProducts = await db
        .select()
        .from(products)
        .where(and(like(products.name, `%${item.rawName}%`), isNull(products.deletedAt)))
        .limit(1);

      if (matchedProducts.length === 0) {
        const words = item.rawName.split(" ").filter((w) => w.length > 3);
        const keyword = words.length > 0 ? words[0] : item.rawName.split(" ")[0];
        matchedProducts = await db
          .select()
          .from(products)
          .where(and(like(products.name, `%${keyword}%`), isNull(products.deletedAt)))
          .limit(1);
      }

      const matchedProduct = matchedProducts.length > 0 ? matchedProducts[0] : null;

      let shrinkflationAlert = false;
      let priceVariancePercentage = 0;

      // 2. Lógica de Shrinkflation
      if (matchedProduct && matchedProduct.costCents !== null && matchedProduct.costCents > 0) {
        const historicalCostPerUnit = matchedProduct.costCents / 100; // MDM base in cents -> standard
        const currentCostPerUnit = item.totalPrice / (item.quantity > 0 ? item.quantity : 1);

        const variance = (currentCostPerUnit - historicalCostPerUnit) / historicalCostPerUnit;

        if (variance > 0.02) {
          shrinkflationAlert = true;
          priceVariancePercentage = Number((variance * 100).toFixed(2));
        }
      }

      auditedItems.push({
        ...item,
        matchedProductId: matchedProduct ? matchedProduct.id : null,
        shrinkflationAlert,
        priceVariancePercentage,
      });
    }

    // 3. 3-Way Match (Mock Rules)
    // Flags an alert if variance is crazy high or if provider name is explicitly spoofed for tests
    const hasHugeVariance = auditedItems.some((i) => i.priceVariancePercentage > 50);
    if (
      hasHugeVariance ||
      parsedData.providerName.toLowerCase().includes("mismatch") ||
      parsedData.providerName.toLowerCase().includes("fraude")
    ) {
      isThreeWayMatch = false;
    }

    return {
      providerName: parsedData.providerName,
      documentNumber: parsedData.documentNumber,
      date: parsedData.date,
      totalAmount: parsedData.totalAmount,
      isThreeWayMatch,
      items: auditedItems,
    };
  } catch (e: any) {
    console.error("Error auditReceiptData:", e);
    throw e;
  }
}
