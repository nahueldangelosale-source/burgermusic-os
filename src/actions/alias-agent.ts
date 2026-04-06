"use server";

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

/**
 * ─────────────────────────────────────────────────────────────
 * Agentic Semantic Resolver (V2.0)
 * ─────────────────────────────────────────────────────────────
 * Evalúa SKUs huérfanos que fallaron el Strict Matching y el 
 * Heuristic Auto-Matcher Engine. Genera un mapeo semántico 
 * mediante GCD contra el catálogo maestro de DB.
 */
export async function generateSuggestedAliases(
  unknownNames: string[],
  catalog: { id: string; name: string }[]
) {
  // 1. Air-Gapped Catalog Injection
  const catalogContext = catalog
    .map((c) => `- ID: ${c.id} | NAME: ${c.name}`)
    .join("\n");

  const systemPrompt = `
Eres el Lead MDM Data Steward de BurgerMusic OS. Tu misión es reconciliar financieramente 
ítems de inventario huérfanos provenientes de ventas offline contra nuestro catálogo maestro oficial.

CATALOGO MAESTRO:
${catalogContext}

TAREA:
Se te entregará una lista de nombres ruidosos extraídos del CSV ('unknownNames').
Debes sugerir el ID oficial exacto de la base de datos para emparejarlos.
Debes basarte en similitud fonética, tipográfica, palabras clave (ej. 'hc' = 'hernan cattaneo').
Devuelve el 'suggestedSkuId' (el ID correspondiente del catálogo maestro).
Si el ítem es indudablemente un combo heterogéneo intratable o irreconocible con baja confianza, 
retorna suggestedSkuId como null.
Aplica estricta termodinámica de resolución limitándote ÚNICAMENTE a los IDs presentados en el catálogo.
Genera un confidenceScore de 0.0 a 1.0 representando tu rigor estadístico.
`;

  try {
    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      system: systemPrompt,
      output: "array",
      prompt: `Encuentra las coincidencias del catálogo maestro para los siguientes SKUs huérfanos:\n${unknownNames.join("\n")}`,
      schema: z.object({
        unknownName: z.string(),
        suggestedSkuId: z.string().nullable(),
        confidenceScore: z.number(),
      }),
    });

    const mappedData = object.map((s: any) => ({
      rawName: s.unknownName,
      suggestedSkuId: s.suggestedSkuId,
      confidenceScore: s.confidenceScore
    }));

    return { success: true, data: mappedData };
  } catch (error: any) {
    console.error("[Agentic Resolver] Error generating aliases:", error);
    return { success: false, error: error?.message || "AI resolution failed" };
  }
}
