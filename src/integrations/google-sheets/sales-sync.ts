// src/integrations/google-sheets/sales-sync.ts
// ETL de Cierres de Caja — Extract (Google Sheets multi-pestaña) → Transform → Load
//
// ⚠️ REGLA INNEGOCIABLE: Este módulo NO toca recordTransaction() ni stock-engine.ts.
// Los datos son financieros (flujo de caja), NO de inventario.

import { db } from "@/db";
import { dailyCashClosures, syncState } from "@/db/schema";
import { eq } from "drizzle-orm";
import { listSheetTabs, readSheetData } from "./client";

import { DailyClosureRowSchema, HEADER_MAP, VALID_MONTHS } from "./schemas";

// ─── TIPOS ──────────────────────────────────────────────────

interface SyncResult {
  totalProcessed: number;
  totalSkipped: number;
  totalFailed: number;
  tabResults: TabResult[];
}

interface TabResult {
  tab: string;
  processed: number;
  skipped: number;
  failed: number;
  errors: string[];
  newWatermark: number;
}

// ─── UTILIDADES ─────────────────────────────────────────────

/**
 * Mapea las cabeceras de la primera fila del Sheet a los índices de columna correspondientes.
 */
function extractHeaderIndices(headerRow: string[]): Map<keyof any, number> {
  const indicesMap = new Map<string, number>();

  headerRow.forEach((cell, index) => {
    const normalized = cell.trim().toUpperCase();
    // Buscar si esta cabecera está en nuestro mapa oficial
    const schemaKey = HEADER_MAP[normalized];
    if (schemaKey) {
      indicesMap.set(schemaKey as string, index);
    }
  });

  return indicesMap;
}

/**
 * Normaliza una fecha. Acepta DD/MM/YYYY, YYYY-MM-DD, o texto con día incluido (ej: "Jueves 2 de enero").
 */
function normalizeDate(raw: string, refYear: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();

  // 1. Caso YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // 2. Caso DD/MM/YYYY
  const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  // 3. Caso Texto "Jueves 2 de enero"
  const monthsMap: Record<string, string> = {
    enero: "01",
    febrero: "02",
    marzo: "03",
    abril: "04",
    mayo: "05",
    junio: "06",
    julio: "07",
    agosto: "08",
    septiembre: "09",
    octubre: "10",
    noviembre: "11",
    diciembre: "12",
  };

  // Quitamos el nombre del día
  const cleanedText = trimmed.replace(
    /^(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\s+/i,
    "",
  );

  // Si tiene el formato "2 de enero"
  const parts = cleanedText.split(/\s+de\s+/);
  if (parts.length === 2) {
    const day = parts[0].padStart(2, "0");
    const month = monthsMap[parts[1].toLowerCase()];
    if (month && /^\d{2}$/.test(day)) return `${refYear}-${month}-${day}`;
  }

  // Como último recurso, si parece ser un día numérico puro (ej: "5")
  if (/^\d{1,2}$/.test(cleanedText)) {
    // No es suficiente información para una fecha, omitir.
    return null;
  }

  return null; // Si no es ninguno de los formatos conocidos, es inválido.
}

// ─── ETL PRINCIPAL ──────────────────────────────────────────

export async function syncCashClosures(): Promise<SyncResult> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not defined");

  const allTabs = await listSheetTabs(spreadsheetId);
  const monthTabs = allTabs.filter((tab) =>
    VALID_MONTHS.some((month: string) => tab.toUpperCase().includes(month)),
  );

  if (monthTabs.length === 0) {
    throw new Error(`No se encontraron pestañas válidas. Encontradas: ${allTabs.join(", ")}`);
  }

  console.log(`📊 Sincronizando: ${monthTabs.join(", ")}`);

  const tabResults: TabResult[] = [];
  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const tab of monthTabs) {
    const result = await syncSingleTab(spreadsheetId, tab);
    tabResults.push(result);
    totalProcessed += result.processed;
    totalSkipped += result.skipped;
    totalFailed += result.failed;
  }

  return { totalProcessed, totalSkipped, totalFailed, tabResults };
}

async function syncSingleTab(spreadsheetId: string, tab: string): Promise<TabResult> {
  const syncKey = `sheet_${tab.toUpperCase()}`;
  const errors: string[] = [];
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  const rawRows = await readSheetData(spreadsheetId, `${tab}!A:M`); // Leemos un poco más de L por las dudas
  if (rawRows.length <= 1) {
    return { tab, processed: 0, skipped: 0, failed: 0, errors: ["Pestaña vacía"], newWatermark: 0 };
  }

  // A. Mapear Cabeceras
  const headerRow = rawRows[0];
  const headerIndices = extractHeaderIndices(headerRow);

  // B. Obtener Watermark
  const [state] = await db.select().from(syncState).where(eq(syncState.syncKey, syncKey));
  const lastSyncedRow = state?.lastSyncedRow ?? 0;
  let maxRow = lastSyncedRow;

  const yearMatch = tab.match(/\d{4}/);
  const refYear = yearMatch ? yearMatch[0] : new Date().getFullYear().toString();

  // C. Procesamiento Iterativo (Fail-Safe)
  for (let i = 1; i < rawRows.length; i++) {
    if (i <= lastSyncedRow) continue;

    const row = rawRows[i];
    if (!row || row.length < 1) continue;

    try {
      // 1. Transform: Convertir array de row a objeto tipado basado en headers
      const rowData: any = {};
      headerIndices.forEach((colIndex, key) => {
        rowData[key] = row[colIndex];
      });

      // 2. Normalize: Manejo de fecha (crítico)
      const normalizedDate = normalizeDate(String(rowData.date || ""), refYear);
      if (!normalizedDate) {
        skipped++;
        if (i > maxRow) maxRow = i;
        continue;
      }
      rowData.date = normalizedDate;

      // 3. Validate: Zod Schema enforce rules
      const validation = DailyClosureRowSchema.safeParse(rowData);
      if (!validation.success) {
        const errorMsg = `Fila ${i + 1} corrupta: ${validation.error.issues.map((i) => i.message).join(", ")}`;
        console.warn(`⚠️ [${tab}] ${errorMsg}`);
        errors.push(errorMsg);
        failed++;
        continue;
      }

      const cleanRow = validation.data;

      // 4. Load: Database Insert
      await db.insert(dailyCashClosures).values({
        date: cleanRow.date,
        day: cleanRow.day,
        zClose: cleanRow.zClose,
        shift: cleanRow.shift,
        salesDelivery: cleanRow.salesDelivery,
        totalMp: cleanRow.totalMp,
        totalDelivery: cleanRow.totalDelivery,
        totalGlobal: cleanRow.totalGlobal,
        variance: cleanRow.variance,
        laborCost: cleanRow.laborCost,
        sheetMonth: tab.toUpperCase(),
      } as any);

      processed++;
      if (i > maxRow) maxRow = i;
    } catch (e: any) {
      const errorMsg = `Error fatal en fila ${i + 1}: ${e.message}`;
      console.error(`❌ [${tab}] ${errorMsg}`);
      errors.push(errorMsg);
      failed++;
    }
  }

  // D. Update Watermark
  if (maxRow > lastSyncedRow) {
    await db.transaction(async (tx) => {
      if (state) {
        await tx
          .update(syncState)
          .set({ lastSyncedRow: maxRow, updatedAt: new Date().toISOString() } as any)
          .where(eq(syncState.syncKey, syncKey));
      } else {
        await tx
          .insert(syncState)
          .values({ syncKey, lastSyncedRow: maxRow, updatedAt: new Date().toISOString() } as any);
      }
    });
  }

  console.log(`  📊 ${tab}: ${processed} OK, ${failed} Fallidos, ${skipped} Omitidos`);
  return { tab, processed, skipped, failed, errors, newWatermark: maxRow };
}
