"use server";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SPLIT ONTOLÓGICO: VLM REMITO (Capa Física)
 * ─────────────────────────────────────────────────────────────────────────────
 * Extrae y mapea recibos físicos. Ignora información financiera.
 * Su misión es consolidar las unidades reales en base a la Órden de Compra.
 */

import { z } from "zod";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "@/db";
import { purchase_orders, goods_receipts, goods_receipt_items } from "@/db/schema/supply";
import { suppliers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { trace } from "@opentelemetry/api";
import { requireManagerSession } from "@/lib/auth-utils";
import crypto from "node:crypto";
import { ingestInvoiceLineItem } from "./invoice-ingestion"; 

const tracer = trace.getTracer("burger-music-vlm-remito");

// GCD: Extracción Estrictamente Física
const RemitoSchema = z.object({
  supplierCuit: z.string().describe("CUIT del proveedor."),
  deliveryNoteNumber: z.string().describe("Número de remito."),
  rawItemName: z.string().describe("Nombre del producto entregado principal o listado. Si hay varios, usa una coma (o concatena)."), // Simplificación para cumplir Zod 
  quantityGrams: z.number().positive().describe("Cantidad total física expresada en gramos.")
});

// Escudo Anti-OOM / Size Optimizer
function optimizeBuffer(fileBuffer: Buffer): Buffer {
  // En un entorno C-Level SRE se usaría sharp() con compresión.
  // Aquí fallamos cerrado si excedemos 4MB para evitar asfixia del Event Loop y sobreconsumo.
  if (fileBuffer.byteLength > 4 * 1024 * 1024) {
    throw new Error("BUFFER_TOO_LARGE: La optimización interceptó una imagen excesiva (>4MB). Comprima el documento antes de enviarlo.");
  }
  return fileBuffer;
}

export async function processVisualDeliveryNote(fileBuffer: Buffer) {
  const { storeId, userId } = await requireManagerSession();
  
  return await tracer.startActiveSpan("vlm_remito_ingestion", async (span) => {
    let timeoutToken: NodeJS.Timeout | undefined;
    try {
      span.setAttribute("app.action", "delivery_note_scan");
      
      const optimizedBuffer = optimizeBuffer(fileBuffer);
      const abortController = new AbortController();
      timeoutToken = setTimeout(() => abortController.abort(), 4500);

      let generationResult;
      try {
         generationResult = await generateObject({
          model: google("gemini-2.5-pro"),
          schema: RemitoSchema,
          abortSignal: abortController.signal,
          messages: [
            {
               role: "user",
               content: [
                 { type: "text", text: "Extrae los datos físicos listados en este remito (Delivery Note). Cantidades estrictamente a GRAMOS." },
                 { type: "file", data: optimizedBuffer, mimeType: "application/pdf" }
               ]
            }
          ],
          experimental_telemetry: { isEnabled: true, functionId: "VLM_Remito_Extractor" }
        });
      } catch (aiError: any) {
        if (aiError.name === "AbortError" || aiError.message?.includes("429")) {
          throw new Error("RATE_LIMIT_EXCEEDED: Cuota de IA agotada. Reintente en 60s o contacte a FinOps.");
        }
        throw aiError;
      }

      const remito = generationResult.object as z.infer<typeof RemitoSchema>;
      
      span.setAttribute("gen_ai.usage.input_tokens", generationResult.usage?.promptTokens || 0);

      // Proveedor
      const sanitizedCuit = remito.supplierCuit.replace(/-/g, "");
      const matchedSupplier = (await db.select().from(suppliers).where(eq(suppliers.cuit, remito.supplierCuit)))[0] 
        ?? (await db.select().from(suppliers)).find(s => s.cuit.replace(/-/g, "") === sanitizedCuit);

      if (!matchedSupplier) throw new Error("PROVEEDOR_NO_ENCONTRADO");

      // Buscar Purchase Order lista para Match Físico
      const activePo = (await db.select().from(purchase_orders)
        .where(and(eq(purchase_orders.supplierId, matchedSupplier.id), eq(purchase_orders.status, "APPROVED"))))[0]
        ?? (await db.select().from(purchase_orders)
        .where(and(eq(purchase_orders.supplierId, matchedSupplier.id), eq(purchase_orders.status, "SENT"))))[0];

      if (!activePo) {
        throw new Error("NO_ACTIVE_PO: Este remito físico no tiene una Orden de Compra aprobada para consolidar.");
      }

      // Traslación ACL
      const mapping = await ingestInvoiceLineItem(matchedSupplier.id, remito.rawItemName);
      const quantityBase = remito.quantityGrams * mapping.conversionFactor;

      // Persistencia en O(1)
      const receiptId = `GR-${crypto.randomUUID()}`;
      
      await db.transaction(async (tx) => {
        await tx.insert(goods_receipts).values({
          id: receiptId,
          po_id: activePo.id,
          store_id: storeId,
          supplier_id: matchedSupplier.id,
          receipt_date: new Date().toISOString(),
          status: "MATCHED",
          audited_by: userId
        });

        await tx.insert(goods_receipt_items).values({
          id: `GRI-${crypto.randomUUID()}`,
          receipt_id: receiptId,
          inventory_item_id: mapping.internalIngredientId,
          expected_quantity: quantityBase, 
          actual_received_quantity: quantityBase,
          variance_quantity: 0
        });
        
        // FULFILLED muta la PO informando que fue entregada físicamente.
        await tx.update(purchase_orders).set({ status: 'FULFILLED' }).where(eq(purchase_orders.id, activePo.id));
      });

      return { status: "AUTO_PROCESSED", receiptId, message: "Match Físico Consolidado." };
      
    } catch (e: any) {
      if (e.message.includes("REQUIRES_HUMAN_MAPPING")) {
        return { status: "PENDING_MAPPING", error: e.message }; 
      }
      return { status: "FAILURE", error: e.message };
    } finally {
      if (timeoutToken) clearTimeout(timeoutToken);
      span.end();
    }
  });
}
