"use server";

import { getSession } from "@/lib/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";

import { logger } from "@/lib/logger";
import { withGenAITrace } from "@/lib/otel-genai";
import { withAgenticGateway } from "@/middleware/agentic-gateway";
import { z } from "zod";

// ────────────────────────────────────────────
// Strict Zod Schema — Grammar Constrained Decoding
// ────────────────────────────────────────────
// Every string field is:
//   • trimmed (leading/trailing whitespace)
//   • length-bounded (max 500 chars to prevent payload inflation)
//   • regex-sanitized against prompt injection markers and HTML/SQL
// Every numeric field is:
//   • finite (no Infinity, no NaN)
//   • non-negative (invoices don't have negative amounts)

const SAFE_TEXT = z
  .string()
  .trim()
  .max(500, "Field exceeds 500 char limit")
  .refine(
    (v) =>
      !/(<script|javascript:|on\w+=|SELECT\s|DROP\s|INSERT\s|DELETE\s|UPDATE\s|--|;--)/i.test(v),
    { message: "Potential injection payload detected" },
  );

const SAFE_AMOUNT = z.number().finite("Must be a finite number").nonnegative("Must be >= 0");

const ReceiptSchema = z
  .object({
    providerName: SAFE_TEXT,
    documentNumber: SAFE_TEXT,
    date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    totalAmount: SAFE_AMOUNT,
    items: z
      .array(
        z.object({
          rawName: SAFE_TEXT,
          quantity: SAFE_AMOUNT,
          unitOfMeasure: SAFE_TEXT,
          unitPrice: SAFE_AMOUNT,
          totalPrice: SAFE_AMOUNT,
        }),
      )
      .min(1, "Invoice must have at least one line item")
      .max(200, "Invoice cannot exceed 200 line items"),
  })
  .strict() // Reject any unknown/extra keys the LLM might hallucinate
  .describe("Factura o Remito de Proveedor Gastronómico");

export type ReceiptData = z.infer<typeof ReceiptSchema>;

export async function analyzeReceiptImage(
  base64Image: string,
  mimeType: string,
): Promise<{ success: boolean; data?: ReceiptData; error?: string }> {
  try {
    const session = await getSession();
    if (!session?.user || !["OWNER_GLOBAL", "MANAGER", "RECEIVER"].includes(session.user.role)) {
      return { success: false, error: "Unauthorized access to OCR Engine." };
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        success: false,
        error: "Falta la clave de API de Google Gemini en el entorno.",
      };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const prompt = `
Actúa como un auditor senior de recepción de mercadería gastronómica.
Analiza la imagen adjunta correspondiente a una factura o remito de un proveedor.
Extrae la información solicitada en un formato JSON estricto.

Reglas:
1. 'providerName': Razón social completa o nombre de fantasía del proveedor.
2. 'documentNumber': El número de factura o número de remito comprobante. Si no hay, usa "".
3. 'date': Fecha en formato YYYY-MM-DD.
4. 'totalAmount': El importe total numérico (sin símbolos de moneda).
5. 'items': Un array donde cada línea debe tener:
   - 'rawName': El nombre o descripción exacta como aparece en la factura.
   - 'quantity': Cantidad numérica (ej. si dice "2 cajas", es 2).
   - 'unitOfMeasure': La unidad de medida (ej. "KG", "L", "UNIDAD", "CAJA", "BULTOS").
   - 'unitPrice': Precio por unidad.
   - 'totalPrice': Costo de esa línea.

Retorna SOLAMENTE un objeto JSON que coincida exactamente con la siguiente interfaz:
{
  "providerName": "string",
  "documentNumber": "string",
  "date": "string",
  "totalAmount": number,
  "items": [
    {
      "rawName": "string",
      "quantity": number,
      "unitOfMeasure": "string",
      "unitPrice": number,
      "totalPrice": number
    }
  ]
}
`;

    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType,
      },
    };

    // ── GenAI OTel Tracing: wrap the model call ─────────────────
    const parsedJson = await withGenAITrace(
      {
        system: "google_genai",
        model: "gemini-1.5-flash",
        operationName: "GEMINI_INVOICE_OCR",
        promptText: prompt,
      },
      async () => {
        const result = await model.generateContent([prompt, imagePart]);
        const responseText = result.response.text();

        // Extract token usage from the response metadata
        const usageMetadata = result.response.usageMetadata;
        const inputTokens = usageMetadata?.promptTokenCount ?? 0;
        const outputTokens = usageMetadata?.candidatesTokenCount ?? 0;

        let parsed: unknown;
        try {
          parsed = JSON.parse(responseText);
        } catch {
          throw new Error("La IA no devolvió un JSON válido.");
        }

        return {
          result: parsed,
          telemetry: {
            responseText,
            inputTokens,
            outputTokens,
          },
        };
      },
    );

    // Agentic Gateway Validation — Zod + RBAC + Immutable Audit
    const secureAction = withAgenticGateway(
      {
        agentName: "GEMINI_INVOICE_OCR",
        actionName: "EXTRACT_INVOICE_DATA",
        schema: ReceiptSchema,
      },
      async (validatedData) => validatedData,
    );

    const gatewayResult = await secureAction(parsedJson);

    if (!gatewayResult.success) {
      return { success: false, error: gatewayResult.error };
    }

    return { success: true, data: gatewayResult.data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    logger.error("Gemini OCR Error", { component: "GeminiOCR", error: msg });
    return {
      success: false,
      error:
        "Error de IA al procesar la imagen. Comprueba la calidad de la foto o cambia a carga manual.",
    };
  }
}
