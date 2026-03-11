// src/integrations/google-sheets/sales-sync.ts
// Motor ETL: Extract (Google Sheets) → Transform (fuzzy match) → Load (recordTransaction)

import { db } from "@/db";
import { products, syncState } from "@/db/schema";
import { eq } from "drizzle-orm";
import { readSheetData } from "./client";
import { recordTransaction } from "@/core/stock-engine";

const SYNC_ID = "google_sheets_sales";

// ─── TIPOS ──────────────────────────────────────────────────

interface SyncResult {
    processed: number;
    skipped: number;
    errors: string[];
    newWatermark: number;
}

interface ParsedRow {
    rowIndex: number;
    date: string;
    productName: string;
    quantity: number;
    priceUnit: number;
    ticketId: string;
}

// ─── UTILIDADES ─────────────────────────────────────────────

/**
 * Normaliza una fecha en formato DD/MM/YYYY o YYYY-MM-DD a ISO YYYY-MM-DD.
 */
function normalizeDate(raw: string): string | null {
    if (!raw) return null;
    const trimmed = raw.trim();

    // YYYY-MM-DD (ya está OK)
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

    // DD/MM/YYYY
    const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (ddmmyyyy) {
        const [, dd, mm, yyyy] = ddmmyyyy;
        return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    }

    // Fallback: intentar parseo JS
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];

    return null;
}

/**
 * Fuzzy match: busca el producto más cercano del catálogo.
 * Misma lógica simple que /receive.
 */
function fuzzyMatchProduct(
    rawName: string,
    catalog: { id: string; name: string; synonyms: string[] | null }[]
): string | null {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9áéíóúñü]/g, "");
    const target = normalize(rawName);

    for (const p of catalog) {
        const pName = normalize(p.name);
        if (pName === target || pName.includes(target) || target.includes(pName)) {
            return p.id;
        }
        // Buscar en sinónimos
        if (p.synonyms) {
            for (const syn of p.synonyms) {
                const nSyn = normalize(syn);
                if (nSyn === target || nSyn.includes(target) || target.includes(nSyn)) {
                    return p.id;
                }
            }
        }
    }
    return null;
}

// ─── ETL PRINCIPAL ──────────────────────────────────────────

/**
 * Sincroniza ventas desde Google Sheets al Ledger.
 * Implementa idempotencia con High-Water Mark (lastSyncedRow).
 */
export async function syncSalesFromSheet(): Promise<SyncResult> {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not defined in environment variables");
    }

    // 1. EXTRACT: Leer datos del Sheet
    const rawRows = await readSheetData(spreadsheetId);
    if (rawRows.length <= 1) {
        return { processed: 0, skipped: 0, errors: ["Sheet vacío o solo tiene header"], newWatermark: 0 };
    }

    // 2. Obtener el High-Water Mark actual
    const [state] = await db
        .select()
        .from(syncState)
        .where(eq(syncState.id, SYNC_ID));

    const lastSyncedRow = state?.lastSyncedRow ?? 0;

    // 3. Obtener catálogo de productos para fuzzy match
    const catalog = await db
        .select({ id: products.id, name: products.name, synonyms: products.synonyms })
        .from(products);

    // 4. TRANSFORM: Parsear y filtrar filas nuevas (skip header = fila 0)
    const newRows: ParsedRow[] = [];
    const errors: string[] = [];

    for (let i = 1; i < rawRows.length; i++) {
        // Solo procesar filas después del watermark
        if (i <= lastSyncedRow) continue;

        const row = rawRows[i];
        if (!row || row.length < 3) continue;

        const date = normalizeDate(String(row[0]));
        if (!date) {
            errors.push(`Fila ${i + 1}: fecha inválida "${row[0]}"`);
            continue;
        }

        const productName = String(row[1] || "").trim();
        if (!productName) continue;

        const quantity = parseFloat(String(row[2] || "0"));
        if (isNaN(quantity) || quantity <= 0) {
            errors.push(`Fila ${i + 1}: cantidad inválida "${row[2]}"`);
            continue;
        }

        const priceUnit = parseFloat(String(row[3] || "0")) || 0;
        const ticketId = String(row[4] || "").trim();

        newRows.push({ rowIndex: i, date, productName, quantity, priceUnit, ticketId });
    }

    if (newRows.length === 0) {
        return { processed: 0, skipped: errors.length, errors, newWatermark: lastSyncedRow };
    }

    // 5. LOAD: Insertar transacciones en el Ledger dentro de una transacción ACID
    let processed = 0;
    let skipped = 0;
    let maxRow = lastSyncedRow;

    await db.transaction(async (tx) => {
        for (const row of newRows) {
            // Fuzzy match del producto
            const matchedSku = fuzzyMatchProduct(row.productName, catalog as any);

            if (!matchedSku) {
                console.warn(
                    `⚠️ Sync: Fila ${row.rowIndex + 1} omitida — SKU no encontrado para "${row.productName}"`
                );
                errors.push(`Fila ${row.rowIndex + 1}: SKU no encontrado para "${row.productName}"`);
                skipped++;
                // Track max row even for skipped rows (they were "processed" from the Sheet's perspective)
                if (row.rowIndex > maxRow) maxRow = row.rowIndex;
                continue;
            }

            // Grabar en el Ledger vía recordTransaction (aplica signo negativo automáticamente)
            await recordTransaction(tx, {
                type: "SALE",
                productSku: matchedSku,
                quantity: row.quantity,          // Motor aplica signo -
                costCentsAtTime: Math.round(row.priceUnit * 100),
                referenceId: row.ticketId || `GSHEET-ROW-${row.rowIndex + 1}`,
                notes: `Sync Google Sheets — "${row.productName}"`,
                createdBy: "SHEETS_ETL",
            });

            processed++;
            if (row.rowIndex > maxRow) maxRow = row.rowIndex;
        }

        // 6. Actualizar High-Water Mark (solo si hubo éxito)
        if (maxRow > lastSyncedRow) {
            if (state) {
                await tx
                    .update(syncState)
                    .set({
                        lastSyncedRow: maxRow,
                        lastSyncedDate: newRows[newRows.length - 1].date,
                        lastRunAt: new Date().toISOString(),
                    } as any)
                    .where(eq(syncState.id, SYNC_ID));
            } else {
                await tx.insert(syncState).values({
                    id: SYNC_ID,
                    lastSyncedRow: maxRow,
                    lastSyncedDate: newRows[newRows.length - 1].date,
                    lastRunAt: new Date().toISOString(),
                } as any);
            }
        }
    });

    return { processed, skipped, errors, newWatermark: maxRow };
}
