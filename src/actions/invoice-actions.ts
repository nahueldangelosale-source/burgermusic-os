"use server";

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║    MOTOR TRANSACCIONAL DE FACTURAS — BurgerMusic OS v4.1                   ║
 * ║    Estándar WAC Móvil O(1) | ACID | Fail-Closed | Zero-Trust Zod Shield    ║
 * ║    CTO Mandate: Todo costo en _cents (integer). Sin float en libros.        ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Arquitectura:
 *   1. Zod Shield → valida payload innegociablemente antes de tocar la DB
 *   2. db.transaction() → ACID: o todo ocurre, o nada ocurre
 *   3. WAC O(1) → fórmula en memoria sin tablas auxiliares FIFO
 *   4. Kardex → ledger de movimientos de stock para trazabilidad total
 *   5. revalidatePath() → hidrata la UI en el borde tras la mutación
 */

import { db } from "@/db";
import {
  purchases,
  purchase_items,
  inventory_kardex,
  ai_audit_logs,
  fact_supplier_ledger,
  products,
} from "@/db/schema";
import { inventory_items, stock_movements } from "@/db/schema/supply";
import { requireManagerSession } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// § ZOD SHIELD — Coacción de Payload Innegociable
// Todos los costos son integer (cents). Sin floats en el libro mayor.
// ─────────────────────────────────────────────────────────────────────────────

const InvoiceItemSchema = z.object({
  /**
   * FK a inventory_items.id — El insumo recibido.
   * Se valida contra MDM en runtime dentro de la transacción.
   */
  inventory_item_id: z.string().min(1, "inventory_item_id es requerido"),

  /** Cantidad física recibida (puede ser fraccionaria: kg, litros) */
  quantity: z
    .number()
    .positive("quantity debe ser > 0")
    .finite("quantity debe ser un número finito"),

  /**
   * Precio unitario en centavos (integer).
   * Ej: $1.250,00 ARS → 125000 cents
   * El frontend DEBE enviar centavos. El backend NO convierte ARS→cents.
   */
  unit_price_cents: z
    .number()
    .int("unit_price_cents debe ser entero (cents)")
    .positive("unit_price_cents debe ser > 0"),
});

const ProcessInvoiceSchema = z.object({
  /** Proveedor. FK lógica a suppliers.id (opcional para proveedores no MDM) */
  supplier_id: z.string().optional(),

  /** Nombre del proveedor (desnormalizado para inmutabilidad del libro mayor) */
  supplier_name: z.string().min(1, "supplier_name es requerido"),

  /** Número de factura del proveedor (A-0001-00012345, B-0001, etc.) */
  invoice_number: z.string().optional(),

  /** Fecha de la factura (YYYY-MM-DD). Si ausente, usa fecha del servidor. */
  invoice_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "invoice_date debe ser YYYY-MM-DD")
    .optional(),

  /** Al menos 1 línea de ítem. El motor revertirá si alguna falla. */
  items: z
    .array(InvoiceItemSchema)
    .min(1, "La factura debe tener al menos un ítem"),
});

export type ProcessInvoicePayload = z.infer<typeof ProcessInvoiceSchema>;
export type InvoiceItemData = z.infer<typeof InvoiceItemSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// § TIPOS DE RESPUESTA — Discriminated Union para type-safety en el cliente
// ─────────────────────────────────────────────────────────────────────────────

export type InvoiceSuccessResult = {
  success: true;
  purchaseId: string;
  itemCount: number;
  totalComputedCents: number;
  wacUpdates: Array<{
    inventoryItemId: string;
    oldWacCents: number;
    newWacCents: number;
    newStock: number;
  }>;
};

export type InvoiceErrorResult = {
  success: false;
  error: string;
  code:
    | "ZOD_SHIELD_REJECTION"
    | "UNAUTHORIZED"
    | "ITEM_NOT_FOUND"
    | "ACID_TRANSACTION_FAILURE";
};

export type InvoiceResult = InvoiceSuccessResult | InvoiceErrorResult;

// ─────────────────────────────────────────────────────────────────────────────
// § MOTOR PRINCIPAL — processIncomingInvoice()
// ─────────────────────────────────────────────────────────────────────────────

export async function processIncomingInvoice(
  payload: unknown,
): Promise<InvoiceResult> {
  // ── GATE 1: Zero-Trust Session (Transport Layer Only) ──────────────────────
  let session: { userId: string; storeId: string; userName: string };
  try {
    session = await requireManagerSession();
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "UNAUTHORIZED_ACCESS",
      code: "UNAUTHORIZED",
    };
  }
  
  return executeInvoiceTransaction(payload, session.userId, session.storeId, session.userName);
}

// ─────────────────────────────────────────────────────────────────────────────
// § CORE DOMAIN — Función Pura (Hexagonal DDD)
// ─────────────────────────────────────────────────────────────────────────────

export async function executeInvoiceTransaction(
  payload: unknown,
  userId: string,
  storeId: string,
  userName: string
): Promise<InvoiceResult> {

  // ── GATE 2: Zod Shield ─────────────────────────────────────────────────────
  const parseResult = ProcessInvoiceSchema.safeParse(payload);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues
      .map((e) => `[${e.path.join(".")}]: ${e.message}`)
      .join(" | ");
    return {
      success: false,
      error: `Zod Shield Rejection: ${errorMsg}`,
      code: "ZOD_SHIELD_REJECTION",
    };
  }
  const validated = parseResult.data;

  // ── PRE-CÓMPUTO (server-side truth) ───────────────────────────────────────
  // Nunca confiar en totales del cliente. El servidor recomputa desde líneas.
  const computedTotalCents = validated.items.reduce(
    (acc, item) => acc + Math.round(item.unit_price_cents * item.quantity),
    0,
  );

  const invoiceDate =
    validated.invoice_date ?? new Date().toISOString().split("T")[0];
  const purchaseId = `INV-${randomUUID()}`;
  const nowIso = new Date().toISOString();

  // ── GATE 3: ACID Transaction ───────────────────────────────────────────────
  try {
    const wacUpdates: InvoiceSuccessResult["wacUpdates"] = [];

    await db.transaction(async (tx) => {
      // ──────────────────────────────────────────────────────────────────────
      // PASO 1: INSERT Invoice Header con status PENDING
      //   (El status se actualizará a COMPLETED sólo si todo el pipeline
      //   de Kardex y WAC finaliza exitosamente — inmutabilidad de estados)
      // ──────────────────────────────────────────────────────────────────────
      await tx.insert(purchases).values({
        id: purchaseId,
        store_id: storeId,
        supplier_id: validated.supplier_id ?? null,
        supplier_name: validated.supplier_name,
        invoice_number: validated.invoice_number ?? null,
        total_cents: computedTotalCents,
        status: "PENDING",
        audited_by: userId,
      });

      // ──────────────────────────────────────────────────────────────────────
      // PASO 2: Por cada ítem → secuencia ACID completa
      //   2a) INSERT purchase_items (línea de factura)
      //   2b) LECTURA MDM para WAC (se hace dentro de la tx para consistencia)
      //   2c) CÁLCULO WAC O(1) en memoria
      //   2d) UPDATE inventory_items (stock + WAC)
      //   2e) INSERT inventory_kardex (ledger de movimiento)
      //   2f) INSERT stock_movements (event sourcing secundario)
      // ──────────────────────────────────────────────────────────────────────
      for (const item of validated.items) {
        const lineId = `INVL-${randomUUID()}`;
        const totalLineCents = Math.round(
          item.unit_price_cents * item.quantity,
        );

        // 2a — INSERT línea de factura
        await tx.insert(purchase_items).values({
          id: lineId,
          store_id: storeId,
          purchase_id: purchaseId,
          inventory_item_id: item.inventory_item_id,
          quantity: item.quantity,
          total_line_cents: totalLineCents,
        });

        // 2b — LECTURA MDM: stock actual + WAC actual
        //   Si el ítem no existe → Fail-Closed: la transacción se revierte
        const [mdmRow] = await tx
          .select({
            id: inventory_items.id,
            current_stock: inventory_items.current_stock,
            cost_per_unit_cents: inventory_items.cost_per_unit_cents,
          })
          .from(inventory_items)
          .where(
            and(
              eq(inventory_items.id, item.inventory_item_id),
              eq(inventory_items.store_id, storeId),
              eq(inventory_items.is_active, true),
            ),
          );

        if (!mdmRow) {
          // Fail-Closed: este throw revierte TODA la transacción (tx.rollback implícito)
          throw new Error(
            `ITEM_NOT_FOUND: inventory_item_id '${item.inventory_item_id}' no existe en el MDM para storeId '${storeId}'. Transacción revertida.`,
          );
        }

        // 2b-bis — FÍSICA DE MASA: Alerta de Reduflación (Shrinkflation Centinela)
        // CTO Rule: Comparamos el peso facturado contra el peso nominal base estático en catálogo
        const [catalogRow] = await tx
          .select({
            weight_grams: products.weight_grams,
          })
          .from(products)
          .where(eq(products.id, item.inventory_item_id));

        const peso_nominal_gramos = catalogRow?.weight_grams || 0;
        const peso_facturado_gramos = item.quantity; // En 2026, quantity es puramente G o quantity unitaria sin float

        if (peso_nominal_gramos > 0) {
          const variance = (peso_nominal_gramos - peso_facturado_gramos) / peso_nominal_gramos;
          if (variance > 0.035) {
            throw new Error(`REQUIRES_HUMAN_AUDIT: Merma física por reduflación detectada. Nominal: ${peso_nominal_gramos}g, Recibido: ${peso_facturado_gramos}g`);
          }
        }

        // 2c — MATEMÁTICA WAC O(1) (Weighted Average Cost Móvil)
        //
        //   Fórmula canónica (sin floating point en el libro mayor):
        //     oldStock = stock físico existente (puede ser 0 en primer ingreso)
        //     oldWAC   = costo promedio ponderado previo en cents
        //     newQty   = cantidad del ítem en esta factura
        //     newPrice = precio unitario de esta compra en cents
        //
        //   New WAC (cents) = floor(
        //     ((oldStock * oldWAC) + (newQty * newPrice)) / (oldStock + newQty)
        //   )
        //
        //   Invariantes de seguridad:
        //   - Si oldStock < 0 (ajuste manual posterior), se clampea a 0
        //     para evitar WAC negativo con denominador incorrecto.
        //   - Math.round() → integer, regla CTO inmutable.

        const oldStock = Math.max(0, mdmRow.current_stock ?? 0);
        const oldWacCents = mdmRow.cost_per_unit_cents ?? 0;
        const newQty = item.quantity;
        const newPriceCents = item.unit_price_cents;

        const numeratorCents =
          oldStock * oldWacCents + newQty * newPriceCents;
        const denominator = oldStock + newQty;

        // Protección division-by-zero (denominador nunca puede ser 0 aqui
        // porque newQty > 0 está garantizado por Zod, pero robustez explícita)
        const newWacCents =
          denominator > 0
            ? Math.round(numeratorCents / denominator)
            : newPriceCents; // fallback: usar precio de compra actual

        const newStock = oldStock + newQty;

        // 2d — UPDATE MDM: stock físico + WAC + LPP (Last Purchase Price)
        await tx
          .update(inventory_items)
          .set({
            current_stock: newStock,
            cost_per_unit_cents: newWacCents, // WAC móvil reemplaza el costo promedio
            updated_at: nowIso,
            audited_at: nowIso,
            audited_by: userId,
          })
          .where(
            and(
              eq(inventory_items.id, item.inventory_item_id),
              eq(inventory_items.store_id, storeId),
            ),
          );

        // 2e — INSERT Kardex (Ledger Primario de Inventario)
        //   Este ledger es el patrón de auditoría de Stock. Cada entrada
        //   es inmutable y permite reconstruir el saldo en cualquier punto
        //   temporal (event sourcing completo).
        await tx.insert(inventory_kardex).values({
          id: `KDX-${randomUUID()}`,
          storeId,
          productSku: item.inventory_item_id,
          quantity: item.quantity, // +positivo = entrada
          referenceId: purchaseId,
          updatedAt: nowIso,
        });

        // 2f — INSERT stock_movements (Event Sourcing Secundario)
        //   Este ledger alimenta el motor de analytics de consumo.
        await tx.insert(stock_movements).values({
          id: randomUUID(),
          store_id: storeId,
          item_id: item.inventory_item_id,
          movement_type: "IN",
          quantity: item.quantity,
          reference_id: purchaseId,
        });

        // Acumular resultado para respuesta al cliente
        wacUpdates.push({
          inventoryItemId: item.inventory_item_id,
          oldWacCents,
          newWacCents,
          newStock,
        });
      }

      // ──────────────────────────────────────────────────────────────────────
      // PASO 3: Actualizar Invoice Header a COMPLETED
      //   (Solo alcanza este punto si TODOS los ítems procesaron sin error)
      // ──────────────────────────────────────────────────────────────────────
      await tx
        .update(purchases)
        .set({ status: "COMPLETED", audited_at: nowIso })
        .where(eq(purchases.id, purchaseId));

      // ──────────────────────────────────────────────────────────────────────
      // PASO 4: Registro en Cuenta Corriente del Proveedor (Ledger Supplier)
      //   Registra la deuda como +positivo en el libro mayor del proveedor.
      // ──────────────────────────────────────────────────────────────────────
      if (validated.supplier_id) {
        await tx.insert(fact_supplier_ledger).values({
          id: `FSL-${randomUUID()}`,
          storeId,
          supplier_id: validated.supplier_id,
          type: "INVOICE",
          invoice_number: validated.invoice_number ?? null,
          description: `Factura ${validated.invoice_number ?? purchaseId} — ${validated.supplier_name}`,
          amount_cents: computedTotalCents, // +positivo = deuda generada
          balance_cents: computedTotalCents,
          reference_id: purchaseId,
          date: invoiceDate,
        });
      }

      // ──────────────────────────────────────────────────────────────────────
      // PASO 5: AI Audit Log (Trazabilidad de Fricción Positiva)
      //   Mandatorio para el AI Decision Ledger del CTO.
      // ──────────────────────────────────────────────────────────────────────
      await tx.insert(ai_audit_logs).values({
        id: `AUDT-${randomUUID()}`,
        agentName: "INVOICE_TRANSACTION_ENGINE_v4",
        action: "PROCESS_INCOMING_INVOICE",
        zodSchemaUsed: "ProcessInvoiceSchema",
        status: "APPROVED",
        storeId,
        userId,
        payloadRef: JSON.stringify({
          purchaseId,
          supplierName: validated.supplier_name,
          invoiceNumber: validated.invoice_number,
          itemCount: validated.items.length,
          totalCents: computedTotalCents,
          operatedBy: userName,
        }),
      });
    });

    // ── REVALIDACIÓN DE PATHS (UI Hydration en el Borde) ──────────────────
    revalidatePath("/dashboard/supply");
    revalidatePath("/dashboard/purchases");
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/finance");

    return {
      success: true,
      purchaseId,
      itemCount: validated.items.length,
      totalComputedCents: computedTotalCents,
      wacUpdates,
    };
  } catch (error: unknown) {
    const msg =
      error instanceof Error
        ? error.message
        : "Unknown ACID Transaction Error";

    console.error("[INVOICE_ENGINE_FATAL]:", {
      error: msg,
      storeId,
      userId,
      timestamp: nowIso,
    });

    // Determinar código de error semánticamente
    const code = msg.includes("ITEM_NOT_FOUND")
      ? "ITEM_NOT_FOUND"
      : "ACID_TRANSACTION_FAILURE";

    return { success: false, error: msg, code };
  }
}
