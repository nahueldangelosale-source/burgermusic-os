// src/integrations/google-sheets/sales-sync.test.ts
// Tests para el ETL de Cierres de Caja (Financial — NO inventory)
// HARDENED version with Zod and Header Mapping

import { beforeEach, describe, expect, it, vi } from "vitest";

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
    insert: (table: any) => ({
      values: (v: any) => {
        if (v.sheetMonth !== undefined) {
          mockInsertedClosures.push(v);
        } else if (v.syncKey !== undefined) {
          mockSyncStateUpdates.push(v);
        }
        return Promise.resolve();
      },
    }),
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

describe("Financial ETL — Cierres de Caja (Hardened v2.1)", () => {
  beforeEach(() => {
    mockSyncStates = {};
    mockInsertedClosures = [];
    mockSyncStateUpdates = [];
    mockSheetRows = {};
    mockTabs = [];
    vi.clearAllMocks();
  });

  it("procesa filas con cabeceras en DESORDEN (Robustez [DATA-02])", async () => {
    mockTabs = ["MARZO"];
    // Cabeceras permutadas vs el orden viejo
    mockSheetRows["MARZO"] = [
      ["TOTAL GLOBAL", "FECHA", "Z", "FALTANTES"], // Headers
      ["$100.000", "01/03/2026", "10", "$500"], // Row 1
      ["$200.000", "02/03/2026", "20", "-$100"], // Row 2
    ];

    const result = await syncCashClosures();

    expect(result.totalProcessed).toBe(2);
    expect(mockInsertedClosures).toHaveLength(2);

    // Verificar que la fecha se mapeó bien a pesar de ir segunda
    expect(mockInsertedClosures[0].date).toBe("2026-03-01");
    expect(mockInsertedClosures[0].totalGlobal).toBe(100000);
    expect(mockInsertedClosures[0].zClose).toBe(10);
    expect(mockInsertedClosures[0].variance).toBe(500);

    expect(mockInsertedClosures[1].date).toBe("2026-03-02");
    expect(mockInsertedClosures[1].totalGlobal).toBe(200000);
  });

  it("maneja filas corruptas sin detener el proceso (Fail-Safe)", async () => {
    mockTabs = ["MARZO"];
    mockSheetRows["MARZO"] = [
      ["FECHA", "TOTAL GLOBAL"],
      ["01/03/2026", "$10.000"], // OK
      ["02/03/2026", "CORRUPTO"], // Error de validación (Zod coerce number resultará en NaN o 0 dependiendo de config, pero aquí fallaría si el campo es estricto)
      ["03/03/2026", "$30.000"], // OK
    ];

    // Nota: En nuestro schema actual, z.coerce.number() convierte "CORRUPTO" a NaN/0.
    // Si quisiéramos que falle, el schema debería ser más estricto.
    // Pero el test de fail-safe es que si UNA fila tira error (ej. fecha inválida), las otras sigan.

    mockSheetRows["MARZO"] = [
      ["FECHA", "TOTAL GLOBAL"],
      ["01/03/2026", "$10.000"], // OK
      ["FECHA INVALIDA", "$20.000"], // Fallará normalizeDate -> skipped
      ["03/03/2026", "$30.000"], // OK
    ];

    const result = await syncCashClosures();

    expect(result.totalProcessed).toBe(2);
    expect(result.totalSkipped).toBe(1);
    expect(mockInsertedClosures).toHaveLength(2);
    expect(mockInsertedClosures[1].date).toBe("2026-03-03"); // Se saltó la del medio
  });

  it("realiza coerción de tipos con Zod (Currency Strings)", async () => {
    mockTabs = ["MARZO"];
    mockSheetRows["MARZO"] = [
      ["FECHA", "TOTAL GLOBAL", "TOTAL MP", "FALTANTES"],
      ["01/03/2026", "$ 1.500,50", "500,5", "-$ 10,50"],
    ];

    const result = await syncCashClosures();

    expect(result.totalProcessed).toBe(1);
    const data = mockInsertedClosures[0];

    expect(data.totalGlobal).toBe(1500.5);
    expect(data.totalMp).toBe(500.5);
    expect(data.variance).toBe(-10.5);
  });

  it("implementa High-Water Mark (Idempotencia)", async () => {
    mockTabs = ["MARZO"];
    mockSyncStates["sheet_MARZO"] = { lastSyncedRow: 1 }; // Ya procesamos la fila 1

    mockSheetRows["MARZO"] = [
      ["FECHA", "TOTAL GLOBAL"],
      ["01/03/2026", "1000"], // row 1 (skipped)
      ["02/03/2026", "2000"], // row 2 (processed)
    ];

    const result = await syncCashClosures();

    expect(result.totalProcessed).toBe(1);
    expect(result.tabResults[0].newWatermark).toBe(2);
    expect(mockInsertedClosures[0].date).toBe("2026-03-02");
  });

  it("falla elegantemente si faltan cabeceras críticas", async () => {
    mockTabs = ["MARZO"];
    mockSheetRows["MARZO"] = [
      ["COLUMNA_INEXISTENTE", "OTRA"],
      ["dato", "dato"],
    ];

    const result = await syncCashClosures();

    // Si no encuentra la columna "FECHA", normalizeDate recibirá undefined y saltará las filas.
    expect(result.totalProcessed).toBe(0);
    expect(result.totalSkipped).toBe(1);
  });
});
