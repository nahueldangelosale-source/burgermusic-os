"use server";

import { db } from "@/db";
import { data_runs, labor_costs, supplier_metrics } from "@/db/schema";
import { enqueueTransaction } from "@/lib/queue";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

// Schema for Sales
const SalesRowSchema = z.object({
  SUCURSAL: z.string().min(1),
  COMPROBANTE: z.string().min(1),
  FECHA: z.string().optional(),
  ARTICULO: z.string().min(1),
  CANTIDAD: z.union([z.string(), z.number()]).transform((v) => Number(v)),
  IMPORTE: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .optional(),
});

// Schema for Labor
const LaborRowSchema = z.object({
  TIPO_REGISTRO: z.literal("LABORAL"),
  SUCURSAL: z.string().min(1),
  FECHA: z.string().min(1),
  TURNO: z.string().optional(),
  HORAS_TRABAJADAS: z.union([z.string(), z.number()]).transform((v) => Number(v)),
  COSTO_LABORAL: z.union([z.string(), z.number()]).transform((v) => Number(v)),
});

// Schema for Supplier Metrics
const SupplierRowSchema = z.object({
  TIPO_REGISTRO: z.literal("PROVEEDOR"),
  PROVEEDOR_ID: z.string().min(1),
  FECHA: z.string().min(1),
  LEAD_TIME_HS: z.union([z.string(), z.number()]).transform((v) => Number(v)),
  OTIF_COMPLETO: z
    .union([z.string(), z.number(), z.boolean()])
    .transform((v) => v === "true" || v === true || v === 1),
  OTIF_A_TIEMPO: z
    .union([z.string(), z.number(), z.boolean()])
    .transform((v) => v === "true" || v === true || v === 1),
});

export async function importHistoricalSales(rows: any[], fileName = "Manual Upload") {
  try {
    const session = await getSession();
    if (!session?.user || !["OWNER_GLOBAL", "MANAGER"].includes(session.user.role)) {
      return { success: false, error: "Permissions denied. Admin required." };
    }

    let successCount = 0;
    let skippedCount = 0;

    const runId = uuidv4();
    await db.insert(data_runs).values({
      id: runId,
      fileName,
      status: "PROCESSING",
    });

    // Agrupar filas de venta por ticket (COMPROBANTE)
    const ticketsMap = new Map<
      string,
      {
        store_id: string;
        ticket_id: string;
        items: { name: string; qty: number; price?: number }[];
      }
    >();

    for (const row of rows) {
      if (row.TIPO_REGISTRO === "LABORAL") {
        const parse = LaborRowSchema.safeParse(row);
        if (parse.success) {
          await db.insert(labor_costs).values({
            storeId: parse.data.SUCURSAL,
            date: parse.data.FECHA,
            shift: parse.data.TURNO || "General",
            totalHours: parse.data.HORAS_TRABAJADAS,
            costAmount: parse.data.COSTO_LABORAL,
          });
          successCount++;
        } else {
          skippedCount++;
        }
      } else if (row.TIPO_REGISTRO === "PROVEEDOR") {
        const parse = SupplierRowSchema.safeParse(row);
        if (parse.success) {
          await db.insert(supplier_metrics).values({
            supplierId: parse.data.PROVEEDOR_ID,
            date: parse.data.FECHA,
            leadTimeHours: parse.data.LEAD_TIME_HS,
            isFull: parse.data.OTIF_COMPLETO,
            isOnTime: parse.data.OTIF_A_TIEMPO,
          });
          successCount++;
        } else {
          skippedCount++;
        }
      } else {
        // Assume Sales fallback
        const parseResult = SalesRowSchema.safeParse(row);
        if (!parseResult.success) {
          skippedCount++;
          continue;
        }

        const data = parseResult.data;
        if (isNaN(data.CANTIDAD) || data.CANTIDAD <= 0) {
          skippedCount++;
          continue;
        }

        const storeId = data.SUCURSAL;
        const ticketId = data.COMPROBANTE;
        const ticketKey = `${storeId}-${ticketId}`;

        if (!ticketsMap.has(ticketKey)) {
          ticketsMap.set(ticketKey, {
            store_id: storeId,
            ticket_id: ticketId,
            items: [],
          });
        }

        ticketsMap.get(ticketKey)!.items.push({
          name: data.ARTICULO,
          qty: data.CANTIDAD,
          price: data.IMPORTE,
        });
      }
    }

    // Enviar tickets de venta a la cola
    for (const ticket of ticketsMap.values()) {
      try {
        await enqueueTransaction(ticket);
        successCount++; // Cuenta como éxito el ticket completo
      } catch (e) {
        console.error("Error encolando ticket histórico:", ticket.ticket_id, e);
        skippedCount += ticket.items.length;
      }
    }

    await db
      .update(data_runs)
      .set({
        status: skippedCount > 0 ? (successCount > 0 ? "PARTIAL" : "FAILED") : "SUCCESS",
        rowsProcessed: successCount,
        rowsFailed: skippedCount,
      })
      .where(eq(data_runs.id, runId));

    return { success: true, processedTickets: successCount, skippedRows: skippedCount, runId };
  } catch (e: any) {
    console.error("Error importHistoricalSales:", e);
    return { success: false, error: e.message };
  }
}

export async function getDataRuns() {
  try {
    const session = await getSession();
    if (!session?.user || !["OWNER_GLOBAL", "MANAGER"].includes(session.user.role)) {
      return { success: false, error: "Permissions denied. Admin required." };
    }

    const runs = await db.select().from(data_runs).orderBy(desc(data_runs.createdAt)).limit(20);
    return { success: true, data: runs };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
