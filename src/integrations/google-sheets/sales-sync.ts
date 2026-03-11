// src/integrations/google-sheets/sales-sync.ts
// ETL de Cierres de Caja — Extract (Google Sheets multi-pestaña) → Transform → Load
//
// ⚠️ REGLA INNEGOCIABLE: Este módulo NO toca recordTransaction() ni stock-engine.ts.
// Los datos son financieros (flujo de caja), NO de inventario.

import { db } from "@/db";
import { dailyCashClosures, syncState } from "@/db/schema";
import { eq } from "drizzle-orm";
import { readSheetData, listSheetTabs } from "./client";

// ─── TIPOS ──────────────────────────────────────────────────

interface SyncResult {
    totalProcessed: number;
    totalSkipped: number;
    tabResults: TabResult[];
}

interface TabResult {
    tab: string;
    processed: number;
    skipped: number;
    errors: string[];
    newWatermark: number;
}

// Meses válidos en español (para filtrar pestañas)
const VALID_MONTHS = [
    "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
    "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
];

// ─── UTILIDADES ─────────────────────────────────────────────

/**
 * Limpia un valor de moneda: quita "$", ".", comas y espacios.
 * "$12.500,50" → 12500.50
 * "12500" → 12500
 */
function parseCurrency(raw: string | undefined | null): number {
    if (!raw || raw === "" || raw === "-") return 0;
    const cleaned = String(raw)
        .replace(/\$/g, "")        // Quitar $
        .replace(/\s/g, "")        // Quitar espacios
        .replace(/\./g, "")        // Quitar puntos de miles (formato AR)
        .replace(",", ".");        // Coma decimal → punto decimal
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : val;
}

/**
 * Normaliza una fecha. Acepta DD/MM/YYYY, YYYY-MM-DD, o texto con día incluido.
 */
function normalizeDate(raw: string): string | null {
    if (!raw) return null;
    const trimmed = raw.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

    const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (ddmmyyyy) {
        const [, dd, mm, yyyy] = ddmmyyyy;
        return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    }

    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];

    return null;
}

// ─── ETL PRINCIPAL ──────────────────────────────────────────

/**
 * Sincroniza cierres de caja desde TODAS las pestañas mensuales del Google Sheet.
 * Implementa idempotencia por pestaña con High-Water Mark (sync_key = "sheet_MARZO").
 */
export async function syncCashClosures(): Promise<SyncResult> {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not defined");
    }

    // 1. Obtener lista de pestañas del spreadsheet
    const allTabs = await listSheetTabs(spreadsheetId);

    // Filtrar solo pestañas que parezcan meses válidos
    const monthTabs = allTabs.filter(tab =>
        VALID_MONTHS.includes(tab.toUpperCase().trim())
    );

    if (monthTabs.length === 0) {
        throw new Error(
            `No se encontraron pestañas con nombres de meses válidos. Pestañas encontradas: ${allTabs.join(", ")}`
        );
    }

    console.log(`📊 Pestañas detectadas: ${monthTabs.join(", ")}`);

    // 2. Procesar cada pestaña
    const tabResults: TabResult[] = [];
    let totalProcessed = 0;
    let totalSkipped = 0;

    for (const tab of monthTabs) {
        const result = await syncSingleTab(spreadsheetId, tab);
        tabResults.push(result);
        totalProcessed += result.processed;
        totalSkipped += result.skipped;
    }

    return { totalProcessed, totalSkipped, tabResults };
}

/**
 * Sincroniza una pestaña individual (ej. "MARZO").
 */
async function syncSingleTab(spreadsheetId: string, tab: string): Promise<TabResult> {
    const syncKey = `sheet_${tab.toUpperCase()}`;
    const errors: string[] = [];

    // 1. EXTRACT: Leer datos del Sheet (pestaña específica)
    const rawRows = await readSheetData(spreadsheetId, `${tab}!A:L`);
    if (rawRows.length <= 1) {
        return { tab, processed: 0, skipped: 0, errors: ["Pestaña vacía o solo header"], newWatermark: 0 };
    }

    // 2. Obtener High-Water Mark para esta pestaña
    const [state] = await db
        .select()
        .from(syncState)
        .where(eq(syncState.syncKey, syncKey));

    const lastSyncedRow = state?.lastSyncedRow ?? 0;

    // 3. TRANSFORM + LOAD: Parsear y cargar filas nuevas
    let processed = 0;
    let skipped = 0;
    let maxRow = lastSyncedRow;

    await db.transaction(async (tx) => {
        for (let i = 1; i < rawRows.length; i++) {
            // Solo procesar filas después del watermark
            if (i <= lastSyncedRow) continue;

            const row = rawRows[i];
            if (!row || row.length < 3) continue;

            // Columna A = Fecha
            const date = normalizeDate(String(row[0] || ""));
            if (!date) {
                // Si no tiene fecha, probablemente es una fila de encabezado/total/vacía
                skipped++;
                if (i > maxRow) maxRow = i;
                continue;
            }

            // Mapeo de columnas: A=Fecha, B=Día, C=CajaZ, D=Turno,
            // E=VentasMostrador, F=VentasMPQR, G=VentasPedidosYa,
            // H=TotalMP, I=TotalEf, J=TotalDelivery, K=TotalGlobal, L=Sobran/faltan
            await tx.insert(dailyCashClosures).values({
                date,
                day: String(row[1] || "").trim() || null,
                zClose: parseCurrency(row[2]),
                shift: String(row[3] || "").trim() || null,
                salesCounter: parseCurrency(row[4]),
                salesMpQr: parseCurrency(row[5]),
                salesDelivery: parseCurrency(row[6]),
                totalMp: parseCurrency(row[7]),
                totalCash: parseCurrency(row[8]),
                totalDelivery: parseCurrency(row[9]),
                totalGlobal: parseCurrency(row[10]),
                variance: parseCurrency(row[11]),
                sheetMonth: tab.toUpperCase(),
            } as any);

            processed++;
            if (i > maxRow) maxRow = i;
        }

        // 4. Actualizar High-Water Mark para esta pestaña
        if (maxRow > lastSyncedRow) {
            if (state) {
                await tx
                    .update(syncState)
                    .set({
                        lastSyncedRow: maxRow,
                        updatedAt: new Date().toISOString(),
                    } as any)
                    .where(eq(syncState.syncKey, syncKey));
            } else {
                await tx.insert(syncState).values({
                    syncKey,
                    lastSyncedRow: maxRow,
                    updatedAt: new Date().toISOString(),
                } as any);
            }
        }
    });

    console.log(`  ✅ ${tab}: ${processed} cierres cargados, ${skipped} filas omitidas`);

    return { tab, processed, skipped, errors, newWatermark: maxRow };
}
