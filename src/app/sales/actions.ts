// src/app/sales/actions.ts
"use server";

import { db } from "@/db";
import { products } from "@/db/schema";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { recordTransaction } from "@/core/stock-engine";

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

    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

    const newProductsFound = new Set<string>();

    // Cache de productos existentes
    const existingProducts = new Set(
        (await db.select({ id: products.id }).from(products)).map(p => p.id)
    );

    let processedCount = 0;
    let newProductsCount = 0;

    // 2. PROCESAMIENTO Y CARGA VÍA LEDGER (transacción ACID)
    await db.transaction(async (tx) => {
        for (const row of rows) {
            if (row.length < 4) continue;

            const ticketId = String(row[0]).trim();
            const fullDate = String(row[1]).trim();
            const rawName = String(row[2]).trim();
            const priceStr = String(row[3]).trim();

            // Filtros de ruido
            if (rawName.toUpperCase().includes("PRODUCTO") && rawName.length < 20) continue;
            if (rawName.toUpperCase() === "PRODUCTO") continue;
            if (rawName.startsWith("OBS:")) continue;
            if (rawName.includes("Adicional: ENVIO")) continue;
            if (priceStr === "NULL" || !priceStr) continue;

            const cleanName = rawName.replace(/\s*\(.*?\)\s*/g, "").trim();
            if (!cleanName) continue;

            const sku = cleanName.toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");

            // Detección de Productos Nuevos
            if (!existingProducts.has(sku) && !newProductsFound.has(sku)) {
                await tx.insert(products).values({
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

            // Manejo de Fechas
            let dateOnly = fullDate.split(" ")[0];
            if (!dateOnly.includes("-") && !dateOnly.includes("/")) {
                if (dateOnly.length < 5) dateOnly = new Date().toISOString().split('T')[0];
            }

            const priceValue = parseFloat(priceStr) || 0;

            // Grabar en el Ledger vía recordTransaction (aplica signo negativo)
            await recordTransaction(tx, {
                type: "SALE",
                productSku: sku,
                quantity: 1,
                costCentsAtTime: Math.round(priceValue * 100),
                referenceId: ticketId,
                notes: `CSV Upload — "${cleanName}"`,
                createdBy: "CSV_UPLOAD",
            });

            processedCount++;
        }
    });

    revalidatePath("/dashboard");
    return {
        success: true,
        message: `Carga Turbo completada: ${processedCount} ventas procesadas. ${newProductsCount} platos nuevos.`,
    };
}

