"use server";
// HMR_FORCE_RELOAD: 2026-03-27_10:48

import { db } from "@/db";
import { fact_supplier_ledger, fact_taxes, ai_audit_logs, products } from "@/db/schema";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { z } from "zod";
import { requireManagerSession } from "@/lib/auth-action";
import { withTenant } from "@/lib/tenant-db";
import { InvoiceSchema, ManualInvoiceSchema } from "@/schemas/treasury";
import type { InvoiceInput } from "@/schemas/treasury";

/**
 * OCR Zero-Trust Receiver — Gemini Vision + Zod Enforcement
 * 
 * Pipeline:
 * 1. Recibe imagen de factura/remito via FormData
 * 2. GoogleGenAI extrae datos estructurados forzando InvoiceSchema
 * 3. Zod valida la salida del modelo
 * 4. Impacta fact_supplier_ledger + fact_taxes atómicamente via db.batch()
 */

// --- Schema interno para la extracción AI (más flexible que el InvoiceSchema final) ---
const AIExtractionSchema = z.object({
  supplier_name: z.string().optional(),
  invoice_number: z.string(),
  issue_date: z.string(),
  subtotal: z.number(),
  tax_amount: z.number().default(0),
  total: z.number(),
  items: z.array(z.object({
    description: z.string(),
    quantity: z.number(),
    unit_price: z.number(),
    total: z.number(),
  })),
});

import { trace, SpanStatusCode, SpanKind } from "@opentelemetry/api";

const tracer = trace.getTracer("burger-music-ocr");

// --- Server Action: OCR Invoice Processing (Nativo React 19) ---
export async function processInvoiceOCR(prevState: any, formData: FormData) {
  const file = formData.get("file") as File;
  const supplierId = formData.get("supplier_id") as string;

  if (!file || !(file instanceof File)) return { success: false, error: "ZERO_TRUST: No se detectó payload binario válido." };
  if (!supplierId) return { success: false, error: "ZERO_TRUST: supplier_id es obligatorio." };

  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  const storeId = session?.user?.storeId;

  if (!storeId) return { success: false, error: "No autorizado: Sesión inválida." };

  return await tracer.startActiveSpan(
    "invoice_ocr_inference",
    { kind: SpanKind.SERVER },
    async (span) => {
      const startTime = performance.now();
      try {
        span.setAttributes({
          "gen_ai.operation.name": "generate_content",
          "gen_ai.provider.name": "google",
          "gen_ai.system": "gemini",
          "store_id": storeId,
        });

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const ai = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");
        const model = ai.getGenerativeModel({
          model: "gemini-1.5-flash",
        });

        const result = await model.generateContent({
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType: file.type || "image/jpeg",
                    data: buffer.toString("base64"),
                  },
                },
                {
                  text: `Extraé los datos de esta factura/remito de proveedor argentino.
             Devolvé un JSON con: invoice_number, issue_date (YYYY-MM-DD), subtotal, tax_amount (IVA), total, 
             y un array items con cada línea: description, quantity, unit_price, total.
             Si no podés determinar el IVA, calculalo como subtotal * 0.21.`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: SchemaType.OBJECT,
              properties: {
                invoice_number: { type: SchemaType.STRING },
                issue_date: { type: SchemaType.STRING },
                subtotal: { type: SchemaType.NUMBER },
                tax_amount: { type: SchemaType.NUMBER },
                total: { type: SchemaType.NUMBER },
                items: {
                  type: SchemaType.ARRAY,
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      description: { type: SchemaType.STRING },
                      quantity: { type: SchemaType.NUMBER },
                      unit_price: { type: SchemaType.NUMBER },
                      total: { type: SchemaType.NUMBER },
                    },
                    required: ["description", "quantity", "unit_price", "total"],
                  },
                },
              },
              required: ["invoice_number", "issue_date", "subtotal", "total", "items"],
            },
          },
        });

        const response = result.response;
        const usage = response.usageMetadata;

        if (usage) {
          span.setAttributes({
            "gen_ai.usage.input_tokens": usage.promptTokenCount,
            "gen_ai.usage.output_tokens": usage.candidatesTokenCount,
          });
        }

        const parsedText = response.text();
        if (!parsedText) throw new Error("ZERO_TRUST: Gemini devolvió respuesta vacía.");

        // 3. Zod Enforcement Layer
        const aiData = AIExtractionSchema.parse(JSON.parse(parsedText));

        // 4. Normalize to InvoiceSchema
        const invoiceData: InvoiceInput = {
          supplier_id: supplierId,
          invoice_number: aiData.invoice_number,
          issue_date: aiData.issue_date.substring(0, 10),
          subtotal: aiData.subtotal,
          tax_amount: aiData.tax_amount,
          total: aiData.total,
          items: aiData.items,
        };

        // 5. Validate with canonical schema
        const validated = InvoiceSchema.parse(invoiceData);
        const duration = Math.round(performance.now() - startTime);

        console.log(`\n[SRE-FINOPS] 🚀 INFERENCIA COMPLETADA`);
        console.log(`| Latencia: ${duration}ms`);
        console.log(`| Tokens: ${usage?.promptTokenCount || 0} (IN) / ${usage?.candidatesTokenCount || 0} (OUT)`);
        console.log(`| Escudo Zod: PASS ✅`);
        console.log(`| Invoice: ${validated.invoice_number}\n`);

        span.setStatus({ code: SpanStatusCode.OK });

        return {
          success: true,
          data: {
            invoice: validated,
            itemCount: validated.items.length,
          }
        };
      } catch (error: any) {
        const duration = Math.round(performance.now() - startTime);
        console.error(`\n[SRE-FINOPS] ❌ FALLA EN INFERENCIA`);
        console.log(`| Latencia: ${duration}ms`);
        console.log(`| Escudo Zod: FAIL 🛑`);
        console.log(`| Error: ${error.message}\n`);

        span.recordException(error);
        span.setStatus({ 
          code: SpanStatusCode.ERROR, 
          message: error.message 
        });
        span.setAttribute("error.type", error.constructor.name);
        
        return { success: false, error: error.message };
      } finally {
        span.end();
      }
    }
  );
}

// --- Server Action: Confirm and Commit Ledger (Audit Approval) ---
export async function confirmAndCommitLedger(payload: InvoiceInput) {
  const session = await requireManagerSession();
  if (!session.success || !session.data) {
    throw new Error(session.error || "ZERO_TRUST_VIOLATION: Acceso denegado.");
  }
  const storeId = session.data.storeId;

  const validated = InvoiceSchema.parse(payload);
  
  // 1. IDs determinísticos/aleatorios para el COMMIT físico
  const ledgerId = `INV-${randomUUID()}`;
  const taxId = `TAX-${randomUUID()}`;
  const today = validated.issue_date;

  await db.batch([
    // Impacto en Cuentas Corrientes → DEUDA
    db.insert(fact_supplier_ledger).values({
      id: ledgerId,
      storeId,
      supplier_id: validated.supplier_id,
      type: "INVOICE",
      invoice_number: validated.invoice_number,
      description: `Factura Certificada ${validated.invoice_number} (${validated.items.length} ítems)`,
      amount_cents: Math.round(validated.total * 100),
      balance_cents: Math.round(validated.total * 100),
      date: today,
    }),
    // Impacto fiscal → IVA
    db.insert(fact_taxes).values({
      id: taxId,
      storeId,
      source_type: "INVOICE",
      source_id: ledgerId,
      tax_type: "IVA_21",
      base_amount_cents: Math.round(validated.subtotal * 100),
      tax_amount_cents: Math.round(validated.tax_amount * 100),
      date: today,
    }),
    // Audit trail de aprobación humana
    db.insert(ai_audit_logs).values({
      id: randomUUID(),
      agentName: "HUMAN_AUDITOR_B2B",
      action: "COMMIT_LEDGER_APPROVED",
      zodSchemaUsed: "InvoiceSchema",
      status: "APPROVED",
      storeId,
      payloadRef: JSON.stringify({ 
        invoice: validated.invoice_number, 
        total: validated.total,
        approver: session.data.name || session.data.email 
      }),
    } as any),
  ]);

  return {
    success: true,
    ledgerId,
    invoiceNumber: validated.invoice_number
  };
}

// --- Server Action: Manual Invoice Upsert ---
export async function upsertManualInvoice(payload: z.infer<typeof ManualInvoiceSchema>) {
  const session = await requireManagerSession();
  if (!session.success || !session.data) {
    throw new Error(session.error || "ZERO_TRUST_VIOLATION: Acceso denegado.");
  }
  const storeId = session.data.storeId;

  const validated = ManualInvoiceSchema.parse(payload);

  const ledgerId = `MINV-${randomUUID()}`;
  const taxId = `MTAX-${randomUUID()}`;

  await db.batch([
    // Impacto en Cuentas Corrientes → DEUDA
    db.insert(fact_supplier_ledger).values({
      id: ledgerId,
      storeId,
      supplier_id: validated.supplier_id,
      type: "INVOICE",
      invoice_number: validated.invoice_number,
      description: validated.notes || `Factura Manual ${validated.invoice_number}`,
      amount_cents: Math.round(validated.total * 100),
      balance_cents: Math.round(validated.total * 100),
      date: validated.issue_date,
    }),
    // Impacto fiscal → IVA
    db.insert(fact_taxes).values({
      id: taxId,
      storeId,
      source_type: "INVOICE",
      source_id: ledgerId,
      tax_type: "IVA_21",
      base_amount_cents: Math.round(validated.subtotal * 100),
      tax_amount_cents: Math.round(validated.tax_amount * 100),
      date: validated.issue_date,
    }),
  ]);

  return {
    success: true,
    ledgerId,
    invoiceNumber: validated.invoice_number,
    totalCents: Math.round(validated.total * 100),
  };
}
