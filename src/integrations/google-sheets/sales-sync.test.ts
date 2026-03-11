// src/integrations/google-sheets/sales-sync.test.ts
// Tests de idempotencia y lógica ETL para la sincronización Google Sheets → Ledger

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── STATE ──────────────────────────────────────────────────
let mockSyncState: any = null;
let mockInsertedTransactions: any[] = [];
let mockSyncStateUpdates: any[] = [];
let mockSheetRows: string[][] = [];

// ─── MOCKS ──────────────────────────────────────────────────

// ─── MOCKS ──────────────────────────────────────────────────

vi.mock("@/db", () => ({
    db: {
        select: () => ({
            from: (table: any) => {
                // Products catalog query returns directly (no .where())
                // Must be thenable AND have .where() for syncState
                const result = table === "sync_state_table"
                    ? (mockSyncState ? [mockSyncState] : [])
                    : []; // Empty catalog — SKUs won't match, OK for idempotency tests

                const promiseLike = Promise.resolve(result);
                // Attach .where() for syncState query chain
                (promiseLike as any).where = () => Promise.resolve(result);
                return promiseLike;
            },
        }),
        transaction: async (fn: (tx: any) => Promise<void>) => {
            const tx = {
                insert: (table: any) => ({
                    values: (v: any) => {
                        if (table === "sync_state_table") {
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
    products: "products_table",
    syncState: "sync_state_table",
}));

vi.mock("drizzle-orm", () => ({
    eq: (...args: any[]) => args,
}));

vi.mock("./client", () => ({
    readSheetData: () => Promise.resolve(mockSheetRows),
}));

vi.mock("@/core/stock-engine", () => ({
    recordTransaction: async (_tx: any, entry: any) => {
        mockInsertedTransactions.push(entry);
    },
}));

// Set env for test
process.env.GOOGLE_SHEETS_SPREADSHEET_ID = "test-sheet-id";

import { syncSalesFromSheet } from "./sales-sync";

describe("Google Sheets ETL — Idempotencia (High-Water Mark)", () => {

    beforeEach(() => {
        mockSyncState = null;
        mockInsertedTransactions = [];
        mockSyncStateUpdates = [];
        mockSheetRows = [];
    });

    it("procesa todas las filas si no hay watermark previo", async () => {
        mockSheetRows = [
            ["Fecha", "Producto", "Cantidad", "Precio", "Ticket"],  // Header (row 0)
            ["2026-03-10", "Mala Fama Doble", "3", "2500", "T-001"],  // row 1
            ["2026-03-10", "Coca Cola", "2", "800", "T-001"],          // row 2
            ["2026-03-11", "Smash Burger", "1", "1800", "T-002"],      // row 3
        ];

        // Mock catálogo (fuzzy match retorna null porque nuestro mock no tiene catalog propio)
        // El test verifica la lógica de watermark, no el fuzzy match
        const result = await syncSalesFromSheet();

        // Todas las filas deberían ser nuevas (skipped por no encontrar SKU, pero procesadas)
        expect(result.newWatermark).toBe(3); // Última fila procesada
    });

    it("omite filas ya procesadas (watermark en fila 2)", async () => {
        mockSyncState = {
            id: "google_sheets_sales",
            lastSyncedRow: 2,
            lastSyncedDate: "2026-03-10",
            lastRunAt: "2026-03-10T20:00:00Z",
        };

        mockSheetRows = [
            ["Fecha", "Producto", "Cantidad", "Precio", "Ticket"],  // Header (row 0)
            ["2026-03-10", "Mala Fama Doble", "3", "2500", "T-001"],  // row 1 — ya procesada
            ["2026-03-10", "Coca Cola", "2", "800", "T-001"],          // row 2 — ya procesada
            ["2026-03-11", "Smash Burger", "1", "1800", "T-002"],      // row 3 — NUEVA
            ["2026-03-11", "Papas Fritas", "4", "600", "T-003"],      // row 4 — NUEVA
        ];

        const result = await syncSalesFromSheet();

        // Solo filas 3 y 4 son nuevas
        expect(result.newWatermark).toBe(4);
        // Las filas 1 y 2 no deben haberse procesado (0 transacciones de esas filas)
    });

    it("no duplica datos si se ejecuta dos veces con el mismo sheet", async () => {
        // Primera ejecución
        mockSheetRows = [
            ["Fecha", "Producto", "Cantidad", "Precio", "Ticket"],
            ["2026-03-10", "Hamburguesa", "5", "2000", "T-100"],
        ];

        const result1 = await syncSalesFromSheet();
        expect(result1.newWatermark).toBe(1);

        // Simular que el watermark se guardó
        mockSyncState = {
            id: "google_sheets_sales",
            lastSyncedRow: 1,
            lastSyncedDate: "2026-03-10",
            lastRunAt: new Date().toISOString(),
        };

        // Limpiar transacciones insertadas
        mockInsertedTransactions = [];

        // Segunda ejecución (mismo sheet, sin filas nuevas)
        const result2 = await syncSalesFromSheet();
        expect(result2.processed).toBe(0);
        expect(result2.newWatermark).toBe(1); // No cambió
        expect(mockInsertedTransactions.length).toBe(0); // No insertó nada
    });

    it("devuelve resultado vacío si el sheet solo tiene header", async () => {
        mockSheetRows = [
            ["Fecha", "Producto", "Cantidad", "Precio", "Ticket"],
        ];

        const result = await syncSalesFromSheet();
        expect(result.processed).toBe(0);
        expect(result.errors).toContain("Sheet vacío o solo tiene header");
    });

    it("reporta error en filas con fecha inválida sin abortar el sync", async () => {
        mockSheetRows = [
            ["Fecha", "Producto", "Cantidad", "Precio", "Ticket"],
            ["INVALIDA", "Hamburguesa", "5", "2000", "T-100"],
            ["2026-03-11", "Coca Cola", "2", "800", "T-101"],
        ];

        const result = await syncSalesFromSheet();
        // La primera fila de datos tiene fecha inválida, debería reportar error
        expect(result.errors.some(e => e.includes("fecha inválida"))).toBe(true);
        // La segunda fila debería procesarse (skipped por SKU no encontrado, pero procesada desde el Sheet)
        expect(result.newWatermark).toBe(2);
    });

    it("normaliza fechas en formato DD/MM/YYYY correctamente", async () => {
        mockSheetRows = [
            ["Fecha", "Producto", "Cantidad", "Precio", "Ticket"],
            ["10/03/2026", "Test Product", "1", "100", "T-200"],
        ];

        const result = await syncSalesFromSheet();
        // Should process row with DD/MM/YYYY format without error
        expect(result.newWatermark).toBe(1);
        expect(result.errors.filter(e => e.includes("fecha inválida")).length).toBe(0);
    });
});
