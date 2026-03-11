// src/agents/translator/schema.ts
import { z } from "zod";

// Definimos la estructura de un ítem detectado
export const DetectedItemSchema = z.object({
    rawInput: z.string().describe("El texto original del producto, ej: '3 cajas de pattys'"),
    matchedSkuId: z.string().optional().describe("El ID del producto oficial si se encontró coincidencia"),
    quantity: z.number().describe("La cantidad numérica extraída"),
    unit: z.string().describe("La unidad de medida mencionada"),
    confidence: z.number().min(0).max(1).describe("Nivel de confianza (0-1)"),
});

// Definimos la estructura del reporte completo
export const InventoryReportSchema = z.object({
    items: z.array(DetectedItemSchema),
    isInventoryRelated: z.boolean().describe("True si el texto contiene datos de inventario"),
});
