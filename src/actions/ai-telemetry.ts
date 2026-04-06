"use server";

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { db } from "@/db";
import { fact_sales } from "@/db/schema";
import { sql } from "drizzle-orm";

const InsightSchema = z.object({
  top_time_slot: z.string().describe("El día y franja horaria más rentable."),
  most_profitable_combo: z.string().describe("El combo o producto que lidera el revenue."),
  upsell_strategy: z.string().describe("Propuesta táctica de marketing cruzado en < 20 palabras.")
});

export async function generateStrategicInsights() {
  try {
    // 1. Extracción de Telemetría (Agregación Rápida)
    const salesData = await db.select({
      hour: sql<string>`strftime('%H', ${fact_sales.createdAt})`,
      revenue: sql<number>`SUM(${fact_sales.net_price_cents})`
    })
    .from(fact_sales)
    .groupBy(sql`strftime('%H', ${fact_sales.createdAt})`)
    .orderBy(sql`SUM(${fact_sales.net_price_cents}) DESC`)
    .limit(5);

    // 2. Inyección de Contexto al LLM (Zero-Trust Prompting)
    const systemPrompt = `
      Eres el Chief AI Engineer de BurgerMusic OS.
      Analiza estos patrones de ventas de una hamburguesería: ${JSON.stringify(salesData)}.
      Devuelve 3 insights accionables basados estrictamente en los datos. No alucines.
    `;

    // 3. Coerción Criptográfica de la Respuesta
    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: InsightSchema,
      prompt: systemPrompt,
      temperature: 0.2, // Baja temperatura para determinismo financiero
    });

    return { success: true, data: object };
  } catch (error) {
    console.error("[AI_TELEMETRY_ERROR]", error);
    return { success: false, error: "Fallo en la inferencia del Agente." };
  }
}
