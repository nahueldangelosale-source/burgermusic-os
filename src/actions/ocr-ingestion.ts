"use server";

/**
 * ───────────────────────────────────────────────────────────────
 * OCR Ingestion Pipeline V3.2 — BurgerMusic OS (Antigravity 2026)
 * ───────────────────────────────────────────────────────────────
 *
 * Unified multimodal invoice ingestion pipeline.
 * Both the AI Scanner (OCR) and the Manual Form converge into
 * this single Server Action for Accounts Payable ingestion.
 *
 * Replaces: scan-invoice.ts (deprecated) + ocr-receiver.ts (deprecated)
 *
 * Pipeline:
 *  1. Session Gate (requireManagerSession)
 *  2. File extraction from FormData
 *  3. Gemini 2.0 Flash multimodal extraction (Structured Outputs via Vercel AI SDK)
 *  4. Zod enforcement + cents conversion
 *  5. Atomic ingestion via ingestSupplierInvoice (V3.2 ACID topology)
 *  6. AI Audit Trail in ai_audit_logs
 *  7. OTel span with gen_ai.usage telemetry
 *
 * Fail-Closed: Every branch terminates deterministically.
 */

import { db } from "@/db";
import { ai_audit_logs } from "@/db/schema";
import { requireManagerSession } from "@/lib/auth-utils";
import { ingestSupplierInvoice } from "@/actions/treasury-actions";
import { IngestInvoiceSchema, type IngestInvoicePayload } from "@/actions/treasury-schemas";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { trace, SpanStatusCode, SpanKind } from "@opentelemetry/api";
import { revalidatePath } from "next/cache";

const tracer = trace.getTracer("burger-music-treasury-ocr", "3.2.0");

// ─────────────────────────────────────────────────────────────
// AI Extraction Schema — Intermediate (pre-cents conversion)
// Structured Outputs enforced by @ai-sdk/google generateObject
// ─────────────────────────────────────────────────────────────

const AIInvoiceExtractionSchema = z.object({
  supplier_name: z.string().describe("Nombre comercial o razón social del proveedor"),
  supplier_cuit: z.string().optional().describe("CUIT o NIF del proveedor si es legible"),
  invoice_number: z.string().optional().describe("Número de factura o remito"),
  expense_type: z.enum(["FIXED", "VARIABLE", "EXTRAORDINARY", "PAYROLL", "TAXES"])
    .describe("Clasificación del gasto según el tipo de documento"),
  due_date: z.string().describe("Fecha de vencimiento en formato YYYY-MM-DD"),
  net_amount_cents: z.number().int().describe("Importe neto ESTRICTAMENTE en centavos enteros (multiplicar decimal × 100)"),
  tax_amount_cents: z.number().int().describe("IVA o impuestos ESTRICTAMENTE en centavos enteros"),
  withholdings_cents: z.number().int().default(0).describe("Retenciones en centavos (0 si no aplica)"),
  gross_amount_cents: z.number().int().describe("Total bruto ESTRICTAMENTE en centavos enteros (net + tax + wh)"),
  line_items: z.array(z.object({
    name: z.string().describe("Descripción del ítem"),
    quantity: z.number().positive().describe("Cantidad"),
    unit_price_cents: z.number().int().describe("Precio unitario en centavos enteros"),
    total_cents: z.number().int().describe("Total de línea en centavos enteros"),
  })).default([]).describe("Ítems individuales de la factura"),
});

// ─────────────────────────────────────────────────────────────
// Return Types — Zero `any`
// ─────────────────────────────────────────────────────────────

type OCRSuccessResult = {
  success: true;
  requires_human_review: false;
  extracted_data: IngestInvoicePayload;
  transaction_refs: { expenseId: string; ledgerEntryId: string };
};

type OCRReviewResult = {
  success: false;
  requires_human_review: true;
  extracted_data: Partial<IngestInvoicePayload>;
  error: string;
};

type OCRErrorResult = {
  success: false;
  requires_human_review: false;
  error: string;
};

export type OCRResult = OCRSuccessResult | OCRReviewResult | OCRErrorResult;

// ─────────────────────────────────────────────────────────────
// Primary Server Action — Multimodal OCR Pipeline
// ─────────────────────────────────────────────────────────────

export async function processInvoiceDocument(formData: FormData): Promise<OCRResult> {
  // ── 1. Zero-Trust Session Gate ─────────────────────────────
  const { userId, storeId } = await requireManagerSession();

  // ── 2. File Extraction ─────────────────────────────────────
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return { success: false, requires_human_review: false, error: "ZERO_TRUST: No se detectó payload binario válido." };
  }

  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = file.type || "image/jpeg";

  // ── 3. OTel Span Wrapper ───────────────────────────────────
  return tracer.startActiveSpan(
    "treasury.ocr.ingest",
    { kind: SpanKind.SERVER },
    async (span): Promise<OCRResult> => {
      const startTime = performance.now();

      try {
        span.setAttributes({
          "gen_ai.operation.name": "generate_object",
          "gen_ai.provider.name": "google",
          "gen_ai.system": "gemini",
          "gen_ai.request.model": "gemini-2.0-flash",
          "store_id": storeId,
          "user_id": userId,
          "file.mime_type": mimeType,
          "file.size_bytes": fileBytes.length,
        });

        // ── 4. Structured Extraction via Vercel AI SDK ─────────
        type AIExtracted = z.infer<typeof AIInvoiceExtractionSchema>;
        const { object, usage } = await generateObject({
          model: google("gemini-2.0-flash"),
          schema: AIInvoiceExtractionSchema,
          system: `Eres un auditor forense de facturas argentinas. Tu objetivo es extraer datos financieros estructurados con PRECISIÓN ABSOLUTA.

[REGLAS IMPERATIVAS]
1. Extrae: Nombre del Proveedor, CUIT (si visible), Fecha de Vencimiento, y totales financieros.
2. Devuelve TODOS los valores monetarios ESTRICTAMENTE en centavos enteros (cents). Multiplica el valor decimal por 100 y redondea al entero más cercano.
3. VERIFICACIÓN OBLIGATORIA: net_amount_cents + tax_amount_cents + withholdings_cents DEBE ser EXACTAMENTE IGUAL a gross_amount_cents.
4. Si hay discrepancias en los subtotales del documento, recalcula el total como la SUMA de las líneas.
5. Si no hay retenciones visibles, withholdings_cents = 0.
6. Clasifica el expense_type según contenido: facturas de servicios = FIXED, mercadería = VARIABLE, sueldos = PAYROLL, impuestos = TAXES, otros = EXTRAORDINARY.
7. NUNCA alucines datos faltantes. Si un campo no es legible, usa valores conservadores.
8. due_date DEBE estar en formato YYYY-MM-DD. Si no hay fecha de vencimiento clara, usa la fecha de emisión.`,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Procesá y extraé la información financiera obligatoria de esta factura o remito. Devolvé todos los montos en centavos enteros." },
                { type: "file", data: fileBytes, mimeType },
              ],
            },
          ],
        });
        const extracted = object as AIExtracted;

        // ── 5. Token Telemetry ─────────────────────────────────
        if (usage) {
          span.setAttributes({
            "gen_ai.usage.input_tokens": usage.promptTokens,
            "gen_ai.usage.output_tokens": usage.completionTokens,
            "gen_ai.usage.total_tokens": usage.totalTokens,
          });
        }

        const durationMs = Math.round(performance.now() - startTime);
        span.setAttribute("gen_ai.latency_ms", durationMs);

        // ── 6. Arithmetic Verification (Server-Side) ───────────
        const computedGross = extracted.net_amount_cents + extracted.tax_amount_cents + extracted.withholdings_cents;
        const finalGrossCents = computedGross !== extracted.gross_amount_cents ? computedGross : extracted.gross_amount_cents;

        // ── 7. Map to IngestInvoicePayload ─────────────────────
        const payload: IngestInvoicePayload = {
          supplier_id: extracted.supplier_cuit || extracted.supplier_name.substring(0, 20),
          expense_type: extracted.expense_type,
          due_date: new Date(extracted.due_date),
          net_amount_cents: extracted.net_amount_cents,
          tax_amount_cents: extracted.tax_amount_cents,
          withholdings_cents: extracted.withholdings_cents,
          gross_amount_cents: finalGrossCents,
          reference_id: extracted.invoice_number || null,
          line_items: extracted.line_items.map((li: AIExtracted["line_items"][number]) => ({
            name: li.name,
            quantity: li.quantity,
            unit_price_cents: li.unit_price_cents,
            total_cents: li.total_cents,
          })),
        };

        // ── 8. Validate against canonical Zod schema ───────────
        const parseResult = IngestInvoiceSchema.safeParse(payload);

        if (!parseResult.success) {
          // Zod Shield rejection → human review required
          const zodErrors = parseResult.error.issues
            .map((e) => `${e.path.join(".")}: ${e.message}`)
            .join(" | ");

          await recordAuditLog(storeId, userId, "REJECTED_BY_GUARDRAIL", payload, `Zod: ${zodErrors}`);

          span.setStatus({ code: SpanStatusCode.ERROR, message: "Zod validation failed" });
          span.setAttribute("ocr.result", "HUMAN_REVIEW");

          return {
            success: false,
            requires_human_review: true,
            extracted_data: payload,
            error: `Validación fallida: ${zodErrors}`,
          };
        }

        // ── 9. Atomic Ingestion via V3.2 Treasury Action ───────
        try {
          const result = await ingestSupplierInvoice(parseResult.data);

          await recordAuditLog(storeId, userId, "APPROVED", parseResult.data, null);

          span.setStatus({ code: SpanStatusCode.OK });
          span.setAttribute("ocr.result", "AUTO_COMMITTED");

          console.log(`[SRE-FINOPS] ✅ OCR PIPELINE COMPLETO | ${durationMs}ms | Tokens: ${usage?.promptTokens ?? 0}/${usage?.completionTokens ?? 0} | Ref: ${extracted.invoice_number || "N/A"}`);

          revalidatePath("/dashboard/treasury");

          return {
            success: true,
            requires_human_review: false,
            extracted_data: parseResult.data,
            transaction_refs: result.transaction_refs,
          };
        } catch (txError: unknown) {
          const txMsg = txError instanceof Error ? txError.message : "Unknown transaction error";

          // DATA_INTEGRITY_FAULT → Friction Positive → Human Review
          if (txMsg.includes("DATA_INTEGRITY_FAULT")) {
            await recordAuditLog(storeId, userId, "REJECTED_BY_GUARDRAIL", parseResult.data, txMsg);

            span.setStatus({ code: SpanStatusCode.ERROR, message: "Math parity fault" });
            span.setAttribute("ocr.result", "MATH_HALLUCINATION");

            return {
              success: false,
              requires_human_review: true,
              extracted_data: parseResult.data,
              error: "Fallo de paridad fiscal detectado. Revisión humana requerida.",
            };
          }

          // Non-recoverable transaction error
          throw txError;
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "OCR pipeline fatal error";
        const durationMs = Math.round(performance.now() - startTime);

        console.error(`[SRE-FINOPS] ❌ OCR FALLA | ${durationMs}ms | ${msg}`);

        span.recordException(error instanceof Error ? error : new Error(msg));
        span.setStatus({ code: SpanStatusCode.ERROR, message: msg });
        span.setAttribute("ocr.result", "FATAL_ERROR");

        return {
          success: false,
          requires_human_review: false,
          error: msg,
        };
      } finally {
        span.end();
      }
    },
  );
}

// ─────────────────────────────────────────────────────────────
// Audit Trail Helper — ai_audit_logs
// ─────────────────────────────────────────────────────────────

async function recordAuditLog(
  storeId: string,
  userId: string,
  status: "APPROVED" | "REJECTED_BY_GUARDRAIL" | "REJECTED_BY_RBAC",
  payload: Partial<IngestInvoicePayload>,
  rejectionReason: string | null,
): Promise<void> {
  try {
    await db.insert(ai_audit_logs).values({
      id: randomUUID(),
      agentName: "GEMINI_OCR_V3.2",
      action: "PROCESS_INVOICE_DOCUMENT",
      zodSchemaUsed: "IngestInvoiceSchema",
      status,
      storeId,
      userId,
      rejectionReason,
      payloadRef: JSON.stringify({
        reference_id: payload.reference_id ?? null,
        gross_amount_cents: payload.gross_amount_cents ?? 0,
        expense_type: payload.expense_type ?? "UNKNOWN",
      }),
    });
  } catch (auditError: unknown) {
    // Audit trail failure MUST NOT crash the primary pipeline
    console.error("[AUDIT_TRAIL_WARN]: Failed to record audit log:", auditError instanceof Error ? auditError.message : "Unknown");
  }
}
