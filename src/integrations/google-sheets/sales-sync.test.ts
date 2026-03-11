// src/integrations/google-sheets/sales-sync.test.ts
// Tests para el ETL de Cierres de Caja (Financial — NO inventory)

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── STATE ──────────────────────────────────────────────────
let mockSyncStates: Record<string, any> = {};
let mockInsertedClosures: any[] = [];
let mockSyncStateUpdates: any[] = [];
let mockSheetRows: Record<string, string[][]> = {};
let mockTabs: string[] = [];

// ─── MOCKS ──────────────────────────────────────────────────

vi.mock("@/db", () => ({
    db: {
        select: () => ({
            from: (table: any) => {
                const result: any[] = [];
                const promiseLike = Promise.resolve(result);
                (promiseLike as any).where = (condition: any) => {
                    // Extract sync_key from the condition mock
                    const key = condition?.[1];
                    if (key && mockSyncStates[key]) {
                        return Promise.resolve([mockSyncStates[key]]);
                    }
                    return Promise.resolve([]);
                };
                return promiseLike;
            },
        }),
        transaction: async (fn: (tx: any) => Promise<void>) => {
            const tx = {
                insert: (table: any) => ({
                    values: (v: any) => {
                        // Detect if it's a cash closure or sync_state insert
                        if (v.sheetMonth !== undefined) {
                            mockInsertedClosures.push(v);
                        } else if (v.syncKey !== undefined) {
                            mockSyncStateUpdates.push(v);
                        }
                        return Promise.resolve();
                    },
                }),
                update: () => ({
                    set: (v: any) => ({
                        where: () => {
                            mockSyncStateUpdates.push(v);
                            return Promise.resolve();
                        },
                    }),
                }),
            };
            await fn(tx);
        },
    },
}));

vi.mock("@/db/schema", () => ({
    dailyCashClosures: "daily_cash_closures_table",
    syncState: "sync_state_table",
}));

vi.mock("drizzle-orm", () => ({
    eq: (col: any, val: any) => [col, val],
}));

vi.mock("./client", () => ({
    readSheetData: (_id: string, range: string) => {
        const tab = range.split("!")[0];
        return Promise.resolve(mockSheetRows[tab] || []);
    },
    listSheetTabs: () => Promise.resolve(mockTabs),
}));

// Set env for test
process.env.GOOGLE_SHEETS_SPREADSHEET_ID = "test-sheet-id";

import { syncCashClosures } from "./sales-sync";

// ─── TESTS ──────────────────────────────────────────────────

describe("Financial ETL — Cierres de Caja (Multi-pestaña)", () => {

    beforeEach(() => {
        mockSyncStates = {};
        mockInsertedClosures = [];
        mockSyncStateUpdates = [];
        mockSheetRows = {};
        mockTabs = [];
    });

    it("procesa todas las filas de una pestaña sin watermark previo", async () => {
        mockTabs = ["MARZO"];
        mockSheetRows["MARZO"] = [
            ["Fecha", "Día", "Caja Z", "Turno", "V.Mostrador", "V.MP QR", "V.PedidosYa", "Total MP", "Total Ef", "Total Delivery", "Total Global", "Sobran/faltan"],
            ["01/03/2026", "Sábado", "1", "Noche", "$150000", "$85000", "$42000", "$127000", "$150000", "$42000", "$319000", "$2500"],
            ["02/03/2026", "Domingo", "2", "Noche", "$180000", "$95000", "$38000", "$133000", "$180000", "$38000", "$351000", "-$1200"],
        ];

        const result = await syncCashClosures();

        expect(result.totalProcessed).toBe(2);
        expect(result.tabResults).toHaveLength(1);
        expect(result.tabResults[0].tab).toBe("MARZO");
        expect(result.tabResults[0].newWatermark).toBe(2);
    });

    it("procesa múltiples pestañas mensuales", async () => {
        mockTabs = ["MARZO", "FEBRERO", "Configuración"]; // "Configuración" no es un mes
        mockSheetRows["MARZO"] = [
            ["Fecha", "Día", "Caja Z"],
            ["01/03/2026", "Sábado", "1"],
        ];
        mockSheetRows["FEBRERO"] = [
            ["Fecha", "Día", "Caja Z"],
            ["01/02/2026", "Sábado", "1"],
            ["02/02/2026", "Domingo", "2"],
        ];

        const result = await syncCashClosures();

        expect(result.totalProcessed).toBe(3); // 1 de MARZO + 2 de FEBRERO
        expect(result.tabResults).toHaveLength(2); // Solo MARZO y FEBRERO, no "Configuración"
    });

    it("omite filas ya procesadas por pestaña (idempotencia)", async () => {
        mockTabs = ["MARZO"];
        mockSyncStates["sheet_MARZO"] = {
            id: 1,
            syncKey: "sheet_MARZO",
            lastSyncedRow: 2,
            updatedAt: "2026-03-10T20:00:00Z",
        };

        mockSheetRows["MARZO"] = [
            ["Fecha", "Día", "Caja Z", "Turno", "V.Mostrador"],
            ["01/03/2026", "Sábado", "1", "Noche", "$150000"],   // row 1 — ya procesada
            ["02/03/2026", "Domingo", "2", "Noche", "$180000"],  // row 2 — ya procesada
            ["03/03/2026", "Lunes", "3", "Noche", "$120000"],    // row 3 — NUEVA
        ];

        const result = await syncCashClosures();

        expect(result.totalProcessed).toBe(1); // Solo fila 3
        expect(result.tabResults[0].newWatermark).toBe(3);
        expect(mockInsertedClosures).toHaveLength(1);
        expect(mockInsertedClosures[0].sheetMonth).toBe("MARZO");
    });

    it("no duplica datos si se ejecuta dos veces con el mismo sheet", async () => {
        mockTabs = ["MARZO"];
        mockSheetRows["MARZO"] = [
            ["Fecha", "Día", "Caja Z"],
            ["01/03/2026", "Sábado", "1"],
        ];

        const result1 = await syncCashClosures();
        expect(result1.totalProcessed).toBe(1);

        // Simular que el watermark se guardó
        mockSyncStates["sheet_MARZO"] = {
            id: 1,
            syncKey: "sheet_MARZO",
            lastSyncedRow: 1,
            updatedAt: new Date().toISOString(),
        };
        mockInsertedClosures = [];

        // Segunda ejecución
        const result2 = await syncCashClosures();
        expect(result2.totalProcessed).toBe(0);
        expect(mockInsertedClosures).toHaveLength(0);
    });

    it("parsea correctamente valores de moneda en formato argentino", async () => {
        mockTabs = ["MARZO"];
        mockSheetRows["MARZO"] = [
            ["Fecha", "Día", "Caja Z", "Turno", "V.Mostrador", "V.MP QR", "V.PedidosYa", "Total MP", "Total Ef", "Total Delivery", "Total Global", "Sobran/faltan"],
            ["05/03/2026", "Miércoles", "5", "Noche", "$150.000", "$85.000,50", "$42.000", "$127.000,50", "$150.000", "$42.000", "$319.000,50", "-$1.200"],
        ];

        const result = await syncCashClosures();

        expect(result.totalProcessed).toBe(1);
        expect(mockInsertedClosures[0].salesCounter).toBe(150000);
        expect(mockInsertedClosures[0].salesMpQr).toBe(85000.5);
        expect(mockInsertedClosures[0].totalGlobal).toBe(319000.5);
        expect(mockInsertedClosures[0].variance).toBe(-1200);
    });

    it("ignora pestañas que no son meses válidos", async () => {
        mockTabs = ["MARZO", "Configuración", "Resumen Anual", "ABRIL"];
        mockSheetRows["MARZO"] = [
            ["Fecha", "Día"], ["01/03/2026", "Sábado"],
        ];
        mockSheetRows["ABRIL"] = [
            ["Fecha", "Día"], ["01/04/2026", "Martes"],
        ];

        const result = await syncCashClosures();

        expect(result.tabResults).toHaveLength(2); // Solo MARZO y ABRIL
        expect(result.tabResults.map(t => t.tab)).toEqual(["MARZO", "ABRIL"]);
    });

    it("omite filas sin fecha (totales, subtítulos, filas vacías)", async () => {
        mockTabs = ["MARZO"];
        mockSheetRows["MARZO"] = [
            ["Fecha", "Día", "Caja Z"],
            ["01/03/2026", "Sábado", "1"],    // OK
            ["", "", ""],                       // Fila vacía
            ["TOTAL", "", "$500000"],           // Fila de total
            ["02/03/2026", "Domingo", "2"],    // OK
        ];

        const result = await syncCashClosures();

        expect(result.totalProcessed).toBe(2);
        expect(result.tabResults[0].skipped).toBe(2); // 2 filas sin fecha válida
    });
});
