"use server";

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║    VLM INVOICE INGESTION & GCD ENFORCEMENT — BurgerMusic OS v4.1           ║
 * ║    Visión Computacional + OpenTelemetry + Decodificación Restringida       ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import { z } from "zod";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { trace, SpanStatusCode } from "@opentelemetry/api";
import { ingestInvoiceLineItem } from "./invoice-ingestion";
import { executeInvoiceTransaction } from "./invoice-actions";
import { requireManagerSession } from "@/lib/auth-utils";

// ─────────────────────────────────────────────────────────────────────────────
// § GRAMMAR CONSTRAINED DECODING (GCD) - Zod Zhield Innegociable
//   Fuerza al modelo multimodal a emitir un JSON estrictamente estructurado.
//   Evita prompt injection via PDFs maliciosos.
// ─────────────────────────────────────────────────────────────────────────────
const InvoiceVlmSchema = z.object({
  supplierCuit: z
    .string()
    .describe("El CUIT del proveedor emisor de la factura. Ejemplo: '30-70000001-1' o '30700000011'"),
  invoiceNumber: z
    .string()
    .describe("El número de factura completo. Ejemplo: 'A-0001-00001234'"),
  totalAmountCents: z
    .number()
    .int()
    .positive()
    .describe("El importe total de la factura expresado en centavos."),
  items: z
    .array(
      z.object({
        rawItemName: z
          .string()
          .describe("El nombre textual crudo del insumo tal como aparece en el documento."),
        quantityGrams: z
          .number()
          .positive()
          .describe("Cantidad numérica exacta del ítem recibida, expresada en gramos."),
        unitPriceCents: z
          .number()
          .int()
          .positive()
          .describe("Precio unitario expresado estrictamente en centavos sin decimales (Ej: $15.50 -> 1550)"),
      })
    )
    .min(1, "El VLM debe extraer al menos un ítem"),
});

// ─────────────────────────────────────────────────────────────────────────────
// § TIPOS DE RESPUESTA DEL ORQUESTADOR
// ─────────────────────────────────────────────────────────────────────────────
export type OcrScanResult =
  | {
      status: "AUTO_PROCESSED";
      purchaseId: string;
      itemCount: number;
    }
  | {
      status: "PENDING_MAPPING";
      supplierId: string;
      supplierName: string;
      dirtyItems: Array<{ rawItemName: string; quantityGrams: number; unitPriceCents: number }>;
    }
  | {
      status: "FAILURE";
      error: string;
    };

// Tracer semántico (OTel)
const tracer = trace.getTracer("burger-music-vlm-ocr");

// ─────────────────────────────────────────────────────────────────────────────
// § MOTOR DE EXTRACCIÓN VISUAL (VLM)
// ─────────────────────────────────────────────────────────────────────────────
export async function scanInvoiceDocument(fileBuffer: Buffer): Promise<OcrScanResult> {
  return await tracer.startActiveSpan("scanInvoiceDocument", async (span): Promise<OcrScanResult> => {
    try {
      span.setAttribute("app.action", "invoice_ocr_scan");
      
      // 1. Invocación del VLM con Zod Shield (GCD) + Telemetría Nativa Vercel AI
      const generationResult = await generateObject({
        model: google("gemini-2.5-pro"),
        schema: InvoiceVlmSchema,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extrae los datos tabulares de la siguiente factura.
                  INSTRUCCIONES CLAVES:
                  1. Localiza el CUIT del emisor, número de factura y el monto total en centavos.
                  2. Extrae todas las líneas de detalle (insumos).
                  3. Transforma los precios unitarios estrictamente a CENTAVOS (entero). Si el precio es $12.50, tú debes escribir 1250.
                  4. La cantidad debe ser obligatoriamente evaluada en GRAMOS.`,
              },
              {
                type: "file",
                data: fileBuffer,
                mimeType: "application/pdf", // Asumimos PDF como baseline para OCR
              },
            ],
          },
        ],
        // Activamos OpenTelemetry nativo de Vercel (gen_ai.* semantic conventions)
        experimental_telemetry: {
          isEnabled: true,
          functionId: "VLM_Invoice_Extractor",
        },
      });

      const rawInvoice = generationResult.object as z.infer<typeof InvoiceVlmSchema>;
      const usage = generationResult.usage;

      // Registrar métricas semánticas FinOps obligatorias por C-Level
      span.setAttribute("gen_ai.system", "gemini");
      span.setAttribute("gen_ai.request.model", "gemini-2.5-pro");
      if (usage) {
        span.setAttribute("gen_ai.usage.input_tokens", usage.promptTokens);
        span.setAttribute("gen_ai.usage.output_tokens", usage.completionTokens);
      }

      // 2. Traducción de Proveedor
      // El VLM nos trajo el CUIT (ej: "30-12345678-9"). Limpio guiones para tolerar varianza
      const sanitizedCuit = rawInvoice.supplierCuit.replace(/-/g, "");
      
      // Consultamos catálogo
      const [supplier] = await db
        .select({ id: suppliers.id, name: suppliers.name, cuit: suppliers.cuit })
        .from(suppliers);
        // Filtrado en memoria / SQL tolerando guiones
      
      // Alternativa exacta (ya que nuestro DB guarda cuit idealmente con guiones según el seeder)
      const matchedSupplier = (await db.select({ id: suppliers.id, name: suppliers.name, cuit: suppliers.cuit }).from(suppliers).where(eq(suppliers.cuit, rawInvoice.supplierCuit)))[0] 
        ?? (await db.select({ id: suppliers.id, name: suppliers.name, cuit: suppliers.cuit }).from(suppliers)).find(s => s.cuit.replace(/-/g, "") === sanitizedCuit);

      if (!matchedSupplier) {
        throw new Error(`PROVEEDOR_NO_ENCONTRADO: El CUIT ${rawInvoice.supplierCuit} no existe en el MDM.`);
      }

      // 3. Orquestación Zero-Trust (Verificación de ACL)
      const processedItems: Array<{ inventory_item_id: string; quantity: number; unit_price_cents: number }> = [];
      const dirtyItems: Array<{ rawItemName: string; quantityGrams: number; unitPriceCents: number }> = [];

      for (const item of rawInvoice.items) {
        try {
          // Fallará cerrado con REQUIRES_HUMAN_MAPPING si no existe la homologación
          const mapping = await ingestInvoiceLineItem(matchedSupplier.id, item.rawItemName);
          
          // Tratamos quantityGrams directo. Evaluamos si el ingester aplica conversión o usamos cantidad extraida
          const convertedQuantity = item.quantityGrams * mapping.conversionFactor;

          // Recalculamos el precio unitario acorde a la nueva unidad (precio por gramo)
          // Operaciones estrictas en enteros
          const unitPriceCentsPerGrams = Math.round(item.unitPriceCents / mapping.conversionFactor);

          processedItems.push({
            inventory_item_id: mapping.internalIngredientId,
            quantity: convertedQuantity,
            unit_price_cents: unitPriceCentsPerGrams,
          });
        } catch (error: any) {
          if (error.message.includes("REQUIRES_HUMAN_MAPPING")) {
            // Recolectar ítems sucios para la UI de Fricción Positiva
            dirtyItems.push(item);
          } else {
            throw error; // Propagar fallas no relacionadas con mapeo (ej DB error)
          }
        }
      }

      // 4. Decisión de bifurcación
      if (dirtyItems.length > 0) {
        span.setStatus({ code: SpanStatusCode.OK, message: "Bloqueado por falla en ACL (Fricción Positiva)" });
        span.setAttribute("app.outcome", "PENDING_MAPPING");
        span.setAttribute("app.dirty_items_count", dirtyItems.length);
        
        return {
          status: "PENDING_MAPPING" as const,
          supplierId: matchedSupplier.id,
          supplierName: matchedSupplier.name,
          dirtyItems,
        };
      }

      // 5. Success Pipeline — Inyección al WAC O(1) usando Pure Function
      // Extraemos la sesión ya que ocr-agent es un Server Action llamado desde Frontend
      const { storeId, userId, userName } = await requireManagerSession();

      const processPayload = {
        supplier_id: matchedSupplier.id,
        supplier_name: matchedSupplier.name,
        invoice_number: rawInvoice.invoiceNumber,
        items: processedItems,
      };

      const result = await executeInvoiceTransaction(processPayload, userId, storeId, userName);

      if (!result.success || !result.purchaseId || result.itemCount === undefined) {
        throw new Error(`INVOICE_ENGINE_REJECTED: ${(result as any).code || 'Internal Error'}`);
      }

      span.setStatus({ code: SpanStatusCode.OK, message: "Factura completamente ingestada al Kardex" });
      span.setAttribute("app.outcome", "AUTO_PROCESSED");
      
      return {
        status: "AUTO_PROCESSED" as const,
        purchaseId: result.purchaseId,
        itemCount: result.itemCount,
      };

    } catch (error: any) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message || "Failed generic VLM",
      });
      console.error("[VLM_INVOICE_FATAL_ERROR]", error);
      return {
        status: "FAILURE" as const,
        error: error.message || "Error procesando el documento.",
      };
    } finally {
      span.end();
    }
  });
}
