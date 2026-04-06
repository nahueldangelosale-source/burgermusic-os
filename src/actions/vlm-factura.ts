"use server";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SPLIT ONTOLÓGICO: VLM FACTURA (Capa Financiera 3-Way Match)
 * ─────────────────────────────────────────────────────────────────────────────
 * Extrae pasivos financieros generados por el proveedor.
 * Exige cuadre perfecto contra la PO y el Remito físico homologado (3.5% tolerancia).
 */

import { z } from "zod";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "@/db";
import { purchase_orders, purchase_order_items, goods_receipts, goods_receipt_items } from "@/db/schema/supply";
import { suppliers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { trace } from "@opentelemetry/api";
import { requireManagerSession } from "@/lib/auth-utils";
import { executeInvoiceTransaction } from "./invoice-actions"; // O(1) Kardex Engine

const tracer = trace.getTracer("burger-music-vlm-factura");

const FacturaSchema = z.object({
  supplierCuit: z.string(),
  invoiceNumber: z.string(),
  relatedDeliveryNote: z.string().describe("Número del remito asociado cruzado a esta factura."),
  subtotalCents: z.number().int(),
  taxCents: z.number().int(),
  totalAmountCents: z.number().int()
});

function optimizeBuffer(fileBuffer: Buffer): Buffer {
  if (fileBuffer.byteLength > 4 * 1024 * 1024) {
    throw new Error("BUFFER_TOO_LARGE: Optimización interceptó exceso de RAM > 4MB.");
  }
  return fileBuffer;
}

export async function processVisualInvoice(fileBuffer: Buffer) {
  const { storeId, userId, userName } = await requireManagerSession();
  
  return await tracer.startActiveSpan("vlm_factura_ingestion", async (span) => {
    let timeoutToken: NodeJS.Timeout | undefined;
    try {
      span.setAttribute("app.action", "invoice_financial_scan");
      
      const optimizedBuffer = optimizeBuffer(fileBuffer);
      const abortController = new AbortController();
      timeoutToken = setTimeout(() => abortController.abort(), 4500);

      let generationResult;
      try {
         generationResult = await generateObject({
          model: google("gemini-2.5-pro"),
          schema: FacturaSchema,
          abortSignal: abortController.signal,
          messages: [
            {
               role: "user",
               content: [
                 { type: "text", text: "Extrae los pasivos financieros de la factura. Todo estrictamente cruzado a CENTAVOS enteros (Ej: 12.50 = 1250)." },
                 { type: "file", data: optimizedBuffer, mimeType: "application/pdf" }
               ]
            }
          ],
          experimental_telemetry: { isEnabled: true, functionId: "VLM_Factura_Extractor" }
        });
      } catch (aiError: any) {
         if (aiError.name === "AbortError" || aiError.message?.includes("429")) {
          throw new Error("RATE_LIMIT_EXCEEDED: Cuota de IA agotada. Reintente en 60s o contacte a FinOps.");
        }
        throw aiError;
      }

      const factura = generationResult.object as z.infer<typeof FacturaSchema>;
      span.setAttribute("gen_ai.usage.input_tokens", generationResult.usage?.promptTokens || 0);

      // Match Proveedor
      const sanitizedCuit = factura.supplierCuit.replace(/-/g, "");
      const matchedSupplier = (await db.select().from(suppliers).where(eq(suppliers.cuit, factura.supplierCuit)))[0] 
        ?? (await db.select().from(suppliers)).find(s => s.cuit.replace(/-/g, "") === sanitizedCuit);

      if (!matchedSupplier) throw new Error("PROVEEDOR_NO_ENCONTRADO");

      // Buscar el Receipt para cumplir el 3-Way Match
      const receipt = (await db.select().from(goods_receipts)
        .where(and(eq(goods_receipts.supplier_id, matchedSupplier.id), eq(goods_receipts.status, "MATCHED"))))[0];

      if (!receipt) {
        throw new Error("3_WAY_MATCH_FAILED: No existe Remito Físico homologado para cruzar esta factura.");
      }

      const activePo = (await db.select().from(purchase_orders).where(eq(purchase_orders.id, receipt.po_id)))[0];
      const receiptItems = await db.select().from(goods_receipt_items).where(eq(goods_receipt_items.receipt_id, receipt.id));
      const poItems = await db.select().from(purchase_order_items).where(eq(purchase_order_items.poId, activePo.id));

      let expectedFinancialCents = 0;
      const verifiedItemsForLedger = [];

      for (const rItem of receiptItems) {
        // Buscamos el precio pactado en matriz original PO
        const posItem = poItems.find(pi => pi.ingredientId === rItem.inventory_item_id);
        if (posItem) {
           expectedFinancialCents += (rItem.actual_received_quantity * posItem.unitPriceCents);
           
           verifiedItemsForLedger.push({
             inventory_item_id: rItem.inventory_item_id,
             quantity: rItem.actual_received_quantity,
             unit_price_cents: posItem.unitPriceCents
           });
        }
      }

      // Tolerancia Matemática 3.5% (Reduflación Financiera / 3-Way Tolerance)
      const variance = expectedFinancialCents > 0 ? (Math.abs(expectedFinancialCents - factura.totalAmountCents) / expectedFinancialCents) : 1;
      
      if (variance > 0.035) {
         span.setAttribute("app.outcome", "PENDING_AUDIT");
         return { 
           status: "PENDING_AUDIT", 
           message: "Discrepancia del 3-Way Match superó el 3.5%. Requiere auditoría financiera por un humano. Falló cerrado."
         };
      }

      // 3-Way Match exitoso: Inyección al Ledger Financiero Transaccional (Kardex & AP)
      const processPayload = {
        supplier_id: matchedSupplier.id,
        supplier_name: matchedSupplier.name,
        invoice_number: factura.invoiceNumber,
        items: verifiedItemsForLedger,
      };

      await executeInvoiceTransaction(processPayload, userId, storeId, userName);

      span.setAttribute("app.outcome", "AUTO_PROCESSED");
      return { status: "AUTO_PROCESSED", message: "3-Way Match Completado. Factura consolidada." };

    } catch (e: any) {
      return { status: "FAILURE", error: e.message };
    } finally {
      if (timeoutToken) clearTimeout(timeoutToken);
      span.end();
    }
  });
}
