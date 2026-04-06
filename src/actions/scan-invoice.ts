"use server";

import { getSession } from "@/lib/auth";
import { ingestSupplierInvoice } from "@/actions/treasury-actions";
import { IngestInvoiceSchema, type IngestInvoicePayload } from "@/actions/treasury-schemas";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";

export async function scanInvoice(formData: FormData) {
  // Fail-Closed Guardrail - Aislamiento Zero-Trust (Regla 4)
  const session = await getSession();
  if (!session?.user?.storeId) {
    throw new Error("UNAUTHORIZED_ACCESS: Store ID missing from trusted session context.");
  }
  
  const VALID_STORE_ID = session.user.storeId;

  const file = formData.get("file") as File;
  if (!file) {
    throw new Error("MISSING_PAYLOAD: No invoice file provided in FormData.");
  }

  const buffer = await file.arrayBuffer();
  const fileBytes = new Uint8Array(buffer);

  // Extracción Multimodal Determinista con Zod Shield (Regla 1)
  const { object: extractedData } = await generateObject({
    model: google("gemini-2.0-flash"),
    schema: IngestInvoiceSchema,
    system: `
      Eres el Audit-OCR Automático C-Level. Tu objetivo es pre-procesar facturas al sistema de Accounts Payable.
      
      [RAZONAMIENTO MATEMÁTICO OBLIGATORIO - Regla 2]
      Antes de generar la salida estructurada, calcula mentalmente:
      (NET AMOUNT) + (TAX AMOUNT) + (WITHHOLDINGS) = (GROSS TOTAL)
      
      Todos los valores resultantes DEBEN expresarse estrictamente en CÉNTIMOS enteros (multiplica el decimal por 100).
      Si tu suma matemática no coincide exactamente con el Total Bruto del documento, revisa si hay percepciones o impuestos ocultos y asígnalos a 'tax_amount_cents' o 'withholdings_cents'. No alucines.
      Extrae el supplier_id deduciendo de qué proveedor se trata (devuelve el CUIT o ID de sistema si lo deduce el OCR).
      Convierte el expense_type al enum correspondiente (FIXED, VARIABLE, EXTRAORDINARY, PAYROLL, TAXES).
      Asegúrate de procesar due_date como una fecha válida ISO.
    `,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Procesa y extrae la información financiera obligatoria de esta factura." },
          { type: "file", data: fileBytes, mimeType: file.type },
        ],
      },
    ],
  });

  const payload = extractedData as IngestInvoicePayload;

  // Auto-Corrección y Fricción Positiva (Regla 3)
  try {
    const result = await ingestSupplierInvoice(payload);
    
    return {
      success: true,
      requires_human_review: false,
      extracted_data: payload,
      transaction_refs: result.transaction_refs,
    };
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Fail-Closed Loop de Intercepción Matemática
    if (errorMessage.includes("DATA_INTEGRITY_FAULT")) {
      console.warn(`[WARN] AI Math Hallucination Detected:`, {
        extracted_data: payload,
        fault: errorMessage
      });

      return {
        success: false,
        requires_human_review: true,
        extracted_data: payload,
        error: "Fallo de paridad fiscal", // Fricción Positiva
      };
    }

    // Re-throw de excepciones severas no relacionadas a la ilusión matemática del LLM
    throw error;
  }
}
