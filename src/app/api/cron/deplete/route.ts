import { trace, SpanStatusCode } from "@opentelemetry/api";
import { runDepletionCycle } from "@/actions/depletion-engine";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const tracer = trace.getTracer("burgermusic-cron", "1.0.0");
const DEFAULT_STORE_ID = "centro"; // Tienda matriz

export async function GET(request: Request) {
  // ── Zero-Trust: CRON Authorization Shield ─────────────────────
  const authHeader = request.headers.get("Authorization");
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expectedAuth) {
    return Response.json(
      { error: "Unauthorized: Invalid CRON Secret" },
      { status: 401 }
    );
  }

  // ── Observability Context ─────────────────────────────────────
  return tracer.startActiveSpan("cron.inventory.depletion.cycle", async (span) => {
    try {
      span.setAttribute("burgeros.depletion.store_id", DEFAULT_STORE_ID);
      span.setAttribute("burgeros.cron.trigger", "vercel_cron");

      // ── Closed-Loop: Orquestación del Motor de Descarga ───────
      const result = await runDepletionCycle(DEFAULT_STORE_ID);

      if (result.status === "error") {
        span.setStatus({ code: SpanStatusCode.ERROR, message: result.error });
        span.recordException(new Error(result.error));
        return Response.json(
          { success: false, error: result.error, timestamp: new Date().toISOString() },
          { status: 500 }
        );
      }

      span.setAttribute("burgeros.depletion.processed_tickets", result.processed);
      span.setAttribute("burgeros.depletion.items_affected", result.depletedItems);
      span.setStatus({ code: SpanStatusCode.OK });

      return Response.json({
        success: true,
        processed: result.processed,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      // ── Fricción Positiva en Errores no controlados ──────────
      const message = error instanceof Error ? error.message : "Unknown Fatal Error";
      span.recordException(error instanceof Error ? error : new Error(message));
      span.setStatus({ code: SpanStatusCode.ERROR, message });

      return Response.json(
        { success: false, error: "Internal Server Error" },
        { status: 500 }
      );
    } finally {
      span.end();
    }
  });
}
