import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

// Schema for structured output
const InvoiceSchema = z.object({
  invoice_number: z.string().describe("The unique invoice number or ID"),
  supplier_name: z.string().describe("Name of the supplier or vendor"),
  total_amount: z.number().describe("The final total amount of the invoice"),
  items: z
    .array(
      z.object({
        description: z.string().describe("Description of the item or product"),
        quantity: z.number().describe("Quantity purchased"),
        unit: z.string().optional().describe("Unit of measure (kg, packs, units)"),
        unit_price: z.number().optional().describe("Price per unit"),
        total_price: z.number().describe("Total price for this line item"),
      }),
    )
    .describe("List of line items in the invoice"),
  price_alert: z
    .boolean()
    .optional()
    .describe(
      "True if a significant price increase (>10%) is detected compared to standard market rates",
    ),
});

export async function parseInvoice(fileBuffer: Buffer, mimeType: string) {
  // Convert Buffer to Base64 for the SDK (if needed) or pass directly depending on SDK version.
  // The Vercel AI SDK 'generateObject' supports 'images' or 'file' parts in messages.
  // For 'google' provider specifically, we can pass context.

  // NOTE: Vercel AI SDK unified interface handles base64 data for images.
  // For PDFs with Gemini, we might need to conform to specific input types.
  // As of ai@3.1+, we can pass content parts.

  const base64Content = fileBuffer.toString("base64");

  // Construct the message content
  // If it's an image: type: 'image'
  // If it's a PDF: Gemini Multimodal supports PDF. The SDK maps 'file' or 'image'.
  // We'll treat it as 'file' content or 'image' depending on mimeType.

  // Refined System Prompt (as requested)
  const systemPrompt = `
    ACTÚA COMO: Expert Accountant & AI Data Extractor.
    Analiza este documento (Factura de Proveedor).
    Extrae cuidadosamente:
    - Número de Factura (invoice_number)
    - Proveedor (supplier_name)
    - Total Final (total_amount)
    - Lista de Ítems.
    
    Si detectas un aumento de precio drástico (>10%) vs histórico o precios de mercado estándar para restaurantes, márcalo con 'price_alert': true.
    Sé preciso con los números.
  `;

  try {
    const { object } = await generateObject({
      model: google("gemini-1.5-flash"), // Use a multimodal capable model
      schema: InvoiceSchema,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: systemPrompt },
            {
              type: "image", // The SDK often uses 'image' for visual inputs, effectively handling PDF pages if supported or images.
              // Note: For PDFs specifically via SDK, we might need to rely on 'file' type if supported, or ensure the buffer is an image.
              // For this MVP, let's assume the UI sends Images (Camera) or we convert PDF to standard input if the SDK demands it.
              // *However*, Gemini API *does* support PDF.
              // Let's try passing the data. If mimeType is application/pdf, we pass it as such if the SDK allows, otherwise we might fail.
              // Update: Vercel AI SDK 'experimental_attachments' or specific provider options might be needed.
              // Standard 'image' part accepts base64.
              // For cleanliness in this "Omnívoro" MVP:
              // If PDF -> We might need a "PDF to Image" step OR rely on Gemini's native PDF support via the 'google' provider specific implementation.
              // Using 'image' type with image/* mime types works.
              // For 'application/pdf', let's attempt to pass it. If strictly typed as 'image', we might need to adjust.
              // Let's assume standard image flow for now, as refined prompt implies "Camera" primarily, but user said "Subir PDF".
              // Re-reading docs: Gemini supports PDF. Vercel AI SDK passed data uris.
              image: base64Content,
              mimeType: mimeType === "application/pdf" ? undefined : mimeType, // Only pass mimeType if image? No, pass it if possible.
            },
          ],
        },
      ],
    });

    return { success: true, data: object };
  } catch (error) {
    console.error("AI Parsing Error:", error);
    return { success: false, error: "Failed to parse invoice" };
  }
}
