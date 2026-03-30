"use server";

import { db } from "@/db";
import { fact_sales, sales_mapping_dlq } from "@/db/schema";
import { trace } from "@opentelemetry/api";
import { revalidatePath } from "next/cache";

const tracer = trace.getTracer("burgermusic-sre-demolition", "1.0.0");

export async function executeHardReset() {
  return tracer.startActiveSpan("system_hard_reset", async (span) => {
    try {
      if (process.env.NODE_ENV !== "development") {
        span.addEvent("hard_reset_blocked", { reason: "production_env_protection" });
        span.setStatus({ code: 2, message: "Unauthorized ENV" });
        return { success: false, error: "Protección Zero-Trust: Hard Reset solo permitido en entorno de Development." };
      }

      span.setAttribute("db.system", "sqlite");
      span.setAttribute("tenant.id", "GLOBAL_SYSTEM_RESET");

      // 1. Purga de Fricción Positiva (DLQ)
      await db.delete(sales_mapping_dlq);
      span.addEvent("dlq_purged");

      // 2. Purga de Histórico Transaccional
      await db.delete(fact_sales);
      span.addEvent("fact_sales_purged");

      span.setStatus({ code: 1, message: "OK" });

      try {
        revalidatePath("/dashboard/sales");
        revalidatePath("/dashboard/command-center");
        revalidatePath("/dashboard/supply");
        revalidatePath("/dashboard/cashier");
      } catch (e) {
        // Ignorar error si se ejecuta vía CLI (Static Generation Store missing)
      }

      return { success: true, message: "Hard Reset Completado. Motor BOM y DLQ purgados." };
    } catch (err: any) {
      span.recordException(err);
      span.setStatus({ code: 2, message: err.message });
      console.error("[HardReset] Fallo crítico:", err);
      return { success: false, error: "Fallo durante la transacción de borrado atómico." };
    } finally {
      span.end();
    }
  });
}
