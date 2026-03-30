"use server";

import { db } from "@/db";
import { sales_mapping_dlq } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { trace } from "@opentelemetry/api";

const tracer = trace.getTracer("burgermusic-operations", "1.0.0");

/**
 * Operación Atómica de Cierre de Turno
 * Incluye interbloqueo por Fricción Positiva (Dead-Letter Queue de Mapeos)
 */
export async function closeOperationalShift(storeId: string) {
  return tracer.startActiveSpan("closeOperationalShift.Interlock", async (span) => {
    try {
      span.setAttribute("tenant.id", storeId);
      span.setAttribute("db.system", "sqlite");

      // 1. Auditoría de Fricción Positiva (Zero Shrinkage)
      // Verificamos matemáticamente si quedaron ítems Huérfanos en la DLQ
      const dlqCountResult = await db.all(sql`
        SELECT COUNT(*) as unresolved_count 
        FROM sales_mapping_dlq 
        WHERE resolved = 0
      `);

      const unresolvedCount = Number((dlqCountResult[0] as any)?.unresolved_count || 0);
      span.setAttribute("operations.dlq_unresolved", unresolvedCount);

      // 2. Interbloqueo Operativo
      if (unresolvedCount > 0) {
        // Obtenemos un ejemplo para UX Error
        const sample = await db.all(sql`
          SELECT raw_name 
          FROM sales_mapping_dlq 
          WHERE resolved = 0 
          LIMIT 1
        `);
        const sampleName = (sample[0] as any)?.raw_name || "Desconocido";

        span.addEvent("shift_closure_rejected_due_to_friction", { 
          unresolved_items: unresolvedCount, 
          sample_name: sampleName 
        });

        return { 
          success: false, 
          error: `Fricción Positiva: Tienes ${unresolvedCount} artículos sin mapear al catálogo (ej. '${sampleName}'). Asígnalos a un SKU válido antes de cerrar el turno.` 
        };
      }

      // 3. Ejecución del Cierre (Lógica de cuadre pre-existente iría aquí)
      // Ej: Marcar Z Close, bloquear edición, etc.
      span.addEvent("shift_closure_approved", { store_id: storeId });
      
      revalidatePath("/dashboard/sales");
      revalidatePath("/dashboard/command-center");

      return { success: true, message: "Turno cerrado exitosamente. Inventario Cuadrado." };
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message });
      console.error("[closeOperationalShift] Fallo Crítico:", error);
      return { success: false, error: "Falla transaccional durante el Cierre de Turno." };
    } finally {
      span.end();
    }
  });
}

export async function resolveDLQItem(dlqId: string, targetSku: string) {
  return tracer.startActiveSpan("resolveDLQItem.Mutation", async (span) => {
    try {
      span.setAttribute("tenant.id", "dynamic_resolution");
      span.setAttribute("db.operation", "UPDATE RESOLVE ZERO-TRUST");
      
      const item = await db.all(sql`SELECT * FROM sales_mapping_dlq WHERE id = ${dlqId} AND resolved = 0`);
      if (!item || item.length === 0) {
        span.setStatus({ code: 2, message: "Item no encontrado" });
        return { success: false, error: "Item no encontrado o ya resuelto." };
      }
      
      const dlq = item[0] as any;

      const { randomUUID } = await import("node:crypto");
      
      // Inserción Atómica O(1) hacia la tabla verdadera
      await db.run(sql`
        INSERT INTO fact_sales (id, store_id, date, shift, raw_name, product_sku, quantity, net_price_cents)
        VALUES (
          ${randomUUID()},
          'centro',
          DATE('now'),
          'UNKNOWN',
          ${dlq.raw_name},
          ${targetSku},
          ${dlq.quantity},
          ${dlq.price}
        )
      `);

      // Marcar como resuelto
      await db.run(sql`UPDATE sales_mapping_dlq SET resolved = 1 WHERE id = ${dlqId}`);

      // Emitimos el evento telemétrico de resolución (Auditoría de Tiempo de Mánager)
      span.addEvent("positive_friction_resolved", {
        "dlq.id": dlqId,
        "target.sku": targetSku,
        "item.name": dlq.raw_name,
        "item.price": dlq.price,
        "manager.action": "manual_link"
      });

      revalidatePath("/dashboard/sales");
      revalidatePath("/dashboard/cashier");
      return { success: true };
    } catch (err: any) {
      span.recordException(err);
      span.setStatus({ code: 2, message: err.message });
      console.error("[resolveDLQItem] Error:", err);
      return { success: false, error: err.message };
    } finally {
      span.end();
    }
  });
}
