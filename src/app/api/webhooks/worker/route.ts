import { processSaleItem } from "@/core/stock-engine";
import { db } from "@/db";
import { dequeueTransactions, enqueueToDLQ, recordVelocityMetric } from "@/lib/queue";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { type NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // Max execution time for Vercel/Next.js

/**
 * EL CONSUMER ASÍNCRONO (Background Worker)
 * Extrae tickets de Redis y ejecuta el motor matemático BOM secuencialmente
 * para evitar Table Locks en la base de datos de producción durante picos.
 */
async function handler(req: NextRequest) {
  const traceId = req.headers.get("upstash-message-id") || `manual-${Date.now()}`;
  const startTime = Date.now();
  console.log(`[OTel Trace][Worker][TraceID: ${traceId}] Started Asynchronous Processing...`);

  // 1. Extraer hasta 10 tickets de la cola
  const BATCH_SIZE = 10;
  const items = await dequeueTransactions(BATCH_SIZE);

  if (!items || items.length === 0) {
    return NextResponse.json({ status: "success", message: "Queue is empty", processed: 0 });
  }

  console.log(`[WORKER] Dequeued ${items.length} POS transactions for processing`);

  let processedCount = 0;

  // 2. Ejecución Secuencial controlada
  for (const transaction of items) {
    try {
      await db.transaction(async (tx) => {
        for (const item of transaction.items) {
          for (let i = 0; i < item.qty; i++) {
            await processSaleItem(
              tx,
              item.name,
              transaction.store_id,
              transaction.ticket_id,
              "BACKGROUND_WORKER",
            );
          }
        }
      });
      processedCount++;
      console.log(`[WORKER] Ticket ${transaction.ticket_id} BOM fully resolved and committed.`);
    } catch (dbError: any) {
      // Idempotency Check
      if (
        dbError.message?.includes("UNIQUE constraint failed") ||
        dbError.code === "SQLITE_CONSTRAINT_UNIQUE" ||
        dbError.code === "SQLITE_CONSTRAINT"
      ) {
        console.log(`[WORKER] Idempotency Hit for Ticket ${transaction.ticket_id}, skipping.`);
        processedCount++; // We consider it "processed" so we don't DLQ it
        continue;
      }

      // 3. DEAD LETTER QUEUE (DLQ) Fallback
      console.error(
        `[WORKER] Critical DB Failure for Ticket ${transaction.ticket_id}. Enqueueing to DLQ.`,
      );
      await enqueueToDLQ(transaction, dbError.message || "Unknown Database Transaction Error");
    }
  }

  console.log(
    `[OTel Trace][Worker][TraceID: ${traceId}] Batch completed in ${Date.now() - startTime}ms. Processed: ${processedCount}/${items.length}`,
  );

  // 4. Update Queue Action Center Velocity Metrics
  if (processedCount > 0) {
    await recordVelocityMetric(processedCount);
  }

  return NextResponse.json({
    status: "success",
    message: "Batch processed",
    processed: processedCount,
    batch_size: items.length,
  });
}

// Empaquetar el handler con la validación Criptográfica de QStash para evitar intrusiones
export const POST = verifySignatureAppRouter(handler);
