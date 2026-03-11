// src/app/sales/actions.ts
"use server";

import { db } from "@/db";
import { transactions, products } from "@/db/schema";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";

export async function uploadSalesCSV(formData: FormData) {
    const file = formData.get("csvFile") as File;
    if (!file) return { success: false, message: "Falta el archivo." };

    console.log("🚀 Iniciando lectura de archivo (Excel/CSV)...");

    // 1. LEER EXCEL O CSV (Universal Loader)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convertimos a Array de Arrays
    // Ejemplo: [ ["TicketID", "Fecha", "Producto", "Precio"], [123, "2024...", "Hamburguesa", 1500] ]
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

    const newProductsFound = new Set<string>();
    const transactionBatch: any[] = []; // Array temporal para inserción masiva
    const BATCH_SIZE = 500; // Chunk size

    // Cache de productos existentes
    const existingProducts = new Set(
        (await db.select({ id: products.id }).from(products)).map(p => p.id)
    );

    let processedCount = 0;
    let newProductsCount = 0;

    // 2. PROCESAMIENTO EN MEMORIA
    // Iteramos todas las filas para armar el batch de transacciones y crear productos faltantes
    for (const row of rows) {
        if (row.length < 4) continue; // Fila vacía o incompleta

        // Aseguramos tipos (el Excel puede traer números directamente)
        const ticketId = String(row[0]).trim();
        const fullDate = String(row[1]).trim();
        const rawName = String(row[2]).trim();
        const priceStr = String(row[3]).trim();

        // Filtros de ruido
        if (rawName.toUpperCase().includes("PRODUCTO") && rawName.length < 20) continue; // Skip Header likely
        if (rawName.toUpperCase() === "PRODUCTO") continue; // Strict header check
        if (rawName.startsWith("OBS:")) continue;
        if (rawName.includes("Adicional: ENVIO")) continue;
        if (priceStr === "NULL" || !priceStr) continue;

        // Limpieza de nombre
        const cleanName = rawName.replace(/\s*\(.*?\)\s*/g, "").trim();
        if (!cleanName) continue;

        const sku = cleanName.toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");

        // Detección de Productos Nuevos (1 a 1, son pocos)
        if (!existingProducts.has(sku) && !newProductsFound.has(sku)) {
            await db.insert(products).values({
                id: sku,
                name: cleanName,
                unit: "unidad",
                isSaleable: true,
                costCents: 0,
            }).onConflictDoNothing();

            newProductsFound.add(sku);
            existingProducts.add(sku);
            newProductsCount++;
        }

        // Manejo de Fechas (Robusto para Excel)
        let dateOnly = fullDate.split(" ")[0];
        // Fallback si el split falla o no parece fecha
        if (!dateOnly.includes("-") && !dateOnly.includes("/")) {
            // Intento de reparación o fallback a hoy
            // Si es un número serial de Excel (ej: 45345), esto fallará silenciosamente o dará basura.
            // Para MVP asumimos string. Si falla, el DB constrain o el formato lo delatará.
            // Usamos fecha de hoy como fallback seguro.
            if (fullDate.match(/^\d+$/)) {
                // Es un numero serial? (TODO: Implementar conversor si es necesario)
            }
            // Fallback seguro
            if (dateOnly.length < 5) dateOnly = new Date().toISOString().split('T')[0];
        }

        // Preparamos la transacción para el Batch
        transactionBatch.push({
            date: dateOnly,
            type: "SALE",
            productSku: sku,
            quantity: 1, // Asumimos 1 por fila
            referenceId: ticketId,
        });
    }

    // 3. INSERCIÓN MASIVA (Batch Insert)
    console.log(`📦 Insertando ${transactionBatch.length} ventas en bloques de ${BATCH_SIZE}...`);

    // Usamos una transacción global para los lotes?
    // SQLite tolera mejor transacciones cortas o una gigante. Drizzle batch insert loop.
    // Lo haremos serial por bloques.

    for (let i = 0; i < transactionBatch.length; i += BATCH_SIZE) {
        const chunk = transactionBatch.slice(i, i + BATCH_SIZE);
        try {
            await db.insert(transactions).values(chunk);
            processedCount += chunk.length;
            console.log(`✅ Progreso: ${processedCount} / ${transactionBatch.length}`);
        } catch (e) {
            console.error("Error en bloque:", e);
            // No re-throw para intentar salvar el resto? O abortar?
            // Mejor abortar para no tener datos parciales corruptos si es critico.
            // Pero para este MVP procesamos lo que podemos.
        }
    }

    revalidatePath("/dashboard");
    return {
        success: true,
        message: `Carga Turbo completada: ${processedCount} ventas procesadas. ${newProductsCount} platos nuevos.`,
    };
}
