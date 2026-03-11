// src/core/stock-engine.test.ts
// Tests de seguridad para el Motor de Stock Perpetuo (Ledger / Kardex)

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── MOCKS ──────────────────────────────────────────────────
// Mockeamos la base de datos para testear la lógica pura del motor
// sin depender de Turso/libSQL.

const mockRows: any[] = [];
const mockInsertedValues: any[] = [];

vi.mock("@/db", () => ({
    db: {
        select: () => ({
            from: () => ({
                where: () => Promise.resolve(mockRows),
                groupBy: () => Promise.resolve(mockRows),
            }),
        }),
        transaction: async (fn: (tx: any) => Promise<void>) => {
            const tx = {
                insert: () => ({
                    values: (v: any) => {
                        mockInsertedValues.push(v);
                        return Promise.resolve();
                    },
                }),
            };
            await fn(tx);
        },
    },
}));

vi.mock("@/db/schema", () => ({
    transactions: {
        quantity: "quantity",
        productSku: "product_sku",
    },
    products: {},
    TRANSACTION_TYPES: ["RECEIPT", "SALE", "ADJUSTMENT", "WASTE", "COUNT"],
}));

vi.mock("drizzle-orm", () => ({
    eq: (...args: any[]) => args,
    sql: (strings: TemplateStringsArray, ...values: any[]) => ({ strings, values }),
    sum: (col: any) => col,
}));

// ─── IMPORTAR DESPUÉS DE MOCKS ─────────────────────────────
import { getCurrentStock, getAllCurrentStock, recordTransaction } from "./stock-engine";
import { db } from "@/db";

describe("Stock Engine — Ledger Pattern", () => {

    beforeEach(() => {
        mockRows.length = 0;
        mockInsertedValues.length = 0;
    });

    // ─── getCurrentStock ────────────────────────────────────

    it("devuelve 0 para un SKU sin transacciones", async () => {
        mockRows.push({ total: null });
        const stock = await getCurrentStock("SKU_INEXISTENTE");
        expect(stock).toBe(0);
    });

    it("devuelve el SUM correcto para un SKU con transacciones", async () => {
        mockRows.push({ total: "42.5" });
        const stock = await getCurrentStock("CARNE_HAMBURGUESA");
        expect(stock).toBe(42.5);
    });

    // ─── getAllCurrentStock ──────────────────────────────────

    it("devuelve un Map con stock de múltiples SKUs", async () => {
        mockRows.push(
            { sku: "PAN_PAPA", total: "100" },
            { sku: "QUESO_CHEDDAR", total: "25.5" },
        );
        const map = await getAllCurrentStock();
        expect(map.get("PAN_PAPA")).toBe(100);
        expect(map.get("QUESO_CHEDDAR")).toBe(25.5);
        expect(map.size).toBe(2);
    });

    // ─── recordTransaction — Convención de Signos ───────────

    it("RECEIPT siempre almacena cantidad positiva", async () => {
        const mockTx = {
            insert: () => ({
                values: (v: any) => { mockInsertedValues.push(v); return Promise.resolve(); }
            })
        };

        await recordTransaction(mockTx as any, {
            type: "RECEIPT",
            productSku: "CARNE_HAMBURGUESA",
            quantity: 50,
            costCentsAtTime: 1200,
            referenceId: "REC-001",
        });

        expect(mockInsertedValues.length).toBe(1);
        expect(mockInsertedValues[0].quantity).toBe(50); // Positivo
        expect(mockInsertedValues[0].type).toBe("RECEIPT");
        expect(mockInsertedValues[0].costCentsAtTime).toBe(1200);
    });

    it("SALE siempre almacena cantidad negativa", async () => {
        const mockTx = {
            insert: () => ({
                values: (v: any) => { mockInsertedValues.push(v); return Promise.resolve(); }
            })
        };

        await recordTransaction(mockTx as any, {
            type: "SALE",
            productSku: "MALA_FAMA_DOBLE",
            quantity: 3, // El caller pasa positivo
            referenceId: "VENTA-123",
        });

        expect(mockInsertedValues[0].quantity).toBe(-3); // Negativo automático
    });

    it("WASTE siempre almacena cantidad negativa", async () => {
        const mockTx = {
            insert: () => ({
                values: (v: any) => { mockInsertedValues.push(v); return Promise.resolve(); }
            })
        };

        await recordTransaction(mockTx as any, {
            type: "WASTE",
            productSku: "PAN_PAPA",
            quantity: 2,
            notes: "Pan vencido",
        });

        expect(mockInsertedValues[0].quantity).toBe(-2); // Negativo automático
        expect(mockInsertedValues[0].notes).toBe("Pan vencido");
    });

    it("ADJUSTMENT respeta el signo del caller", async () => {
        const mockTx = {
            insert: () => ({
                values: (v: any) => { mockInsertedValues.push(v); return Promise.resolve(); }
            })
        };

        // Ajuste negativo (encontraron menos de lo esperado)
        await recordTransaction(mockTx as any, {
            type: "ADJUSTMENT",
            productSku: "QUESO_CHEDDAR",
            quantity: -1.5,
            notes: "Error de conteo anterior",
        });

        expect(mockInsertedValues[0].quantity).toBe(-1.5); // Respeta signo

        // Ajuste positivo (encontraron más de lo esperado)
        await recordTransaction(mockTx as any, {
            type: "ADJUSTMENT",
            productSku: "QUESO_CHEDDAR",
            quantity: 3,
            notes: "Stock encontrado en cámara",
        });

        expect(mockInsertedValues[1].quantity).toBe(3); // Respeta signo
    });

    it("COUNT respeta el signo del caller (delta de conteo)", async () => {
        const mockTx = {
            insert: () => ({
                values: (v: any) => { mockInsertedValues.push(v); return Promise.resolve(); }
            })
        };

        await recordTransaction(mockTx as any, {
            type: "COUNT",
            productSku: "LECHUGA_CAPUCHINA",
            quantity: -0.5,
            notes: "Ajuste por conteo físico. Reportado: 9.5, Calculado: 10.00",
            createdBy: "KITCHEN",
        });

        expect(mockInsertedValues[0].quantity).toBe(-0.5);
        expect(mockInsertedValues[0].type).toBe("COUNT");
        expect(mockInsertedValues[0].createdBy).toBe("KITCHEN");
    });
});
