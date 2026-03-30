/**
 * Airlock Dispatcher — Transactional Outbox Worker
 * ─────────────────────────────────────────────────
 * Consumes PENDING events from the outbox_events table and dispatches
 * them to the Corporate HQ Data Warehouse with HMAC-SHA256 egress signing.
 *
 * Zero-Trust invariants:
 *   1. Atomic claim: SELECT-then-UPDATE is replaced by a single
 *      UPDATE...RETURNING that atomically transitions PENDING→PROCESSING,
 *      eliminating race conditions between concurrent cron invocations.
 *   2. Bulk I/O: Post-dispatch status flip uses a single UPDATE...WHERE IN
 *      instead of N individual queries (eradicates the N+1 anti-pattern).
 *   3. Fail-closed secrets: If WEBHOOK_SECRET is not set, the route
 *      returns 500 immediately. No hardcoded fallback.
 *   4. Dead-letter resilience: If the simulated egress POST throws,
 *      claimed events are reverted from PROCESSING→FAILED so they are
 *      never silently lost.
 */

import { createHmac } from "crypto";
import { db } from "@/db";
import { outbox_events } from "@/db/schema";
import { logger } from "@/lib/logger";
import { eq, inArray, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // ── 0. Auth: Vercel Cron header or Bearer token ───────────────
  const authHeader = request.headers.get("authorization");
  const isCron =
    request.headers.get("x-vercel-cron") === "true" ||
    authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (process.env.NODE_ENV === "production" && !isCron) {
    return new Response("Unauthorized", { status: 401 });
  }

  // ── 1. Fail-closed: require WEBHOOK_SECRET ────────────────────
  const hmacSecret = process.env.WEBHOOK_SECRET;
  if (!hmacSecret) {
    logger.error("WEBHOOK_SECRET is not defined. Aborting egress.", {
      component: "AirlockDispatcher",
    });
    return Response.json(
      { success: false, error: "WEBHOOK_SECRET not configured. Egress aborted." },
      { status: 500 },
    );
  }

  try {
    // ── 2. Atomic claim: PENDING → PROCESSING ───────────────────
    //    A single UPDATE ... WHERE status = 'PENDING' ... RETURNING *
    //    atomically claims a batch. Any concurrent invocation will see
    //    zero PENDING rows for the same IDs because SQLite serialises
    //    write transactions. This eliminates the race condition entirely.
    const claimed = await db
      .update(outbox_events)
      .set({ status: "PROCESSING" })
      .where(eq(outbox_events.status, "PENDING"))
      .returning();

    // Drizzle's SQLite driver doesn't support LIMIT on UPDATE...RETURNING,
    // so we claim all pending rows. In practice the outbox stays small
    // because the cron fires frequently. If scale demands it, a raw SQL
    // subquery with LIMIT can be added.

    if (claimed.length === 0) {
      return Response.json({ message: "No pending events to dispatch." });
    }

    const claimedIds = claimed.map((e) => e.id);

    // ── 3. HMAC-SHA256 egress signing ───────────────────────────
    const payloadString = JSON.stringify({ events: claimed });
    const signature = createHmac("sha256", hmacSecret).update(payloadString).digest("hex");

    // ── 4. Simulated egress POST to HQ Data Warehouse ───────────
    //    Wrapped in its own try/catch so failures trigger dead-letter
    //    recovery instead of leaving events stuck in PROCESSING.
    try {
      logger.info(`Dispatching ${claimed.length} events`, {
        component: "AirlockDispatcher",
        eventCount: claimed.length,
        signature: `sha256=${signature}`,
      });

      // Replace with real fetch when HQ endpoint is provisioned:
      // await fetch("https://hq-warehouse.burgermusic.com/api/ingest", {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //     "X-Hub-Signature-256": `sha256=${signature}`,
      //   },
      //   body: payloadString,
      // });

      // Simulate network latency
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (egressError: unknown) {
      // ── 4b. Egress failed → Dead-letter: PROCESSING → FAILED ──
      const msg = egressError instanceof Error ? egressError.message : "Unknown egress error";
      logger.error(`Egress failed. Dead-lettering ${claimedIds.length} events:`, {
        component: "AirlockDispatcher",
        error: msg,
        eventCount: claimedIds.length,
      });

      await db
        .update(outbox_events)
        .set({ status: "FAILED", processedAt: new Date().toISOString() })
        .where(inArray(outbox_events.id, claimedIds));

      return Response.json(
        {
          success: false,
          error: `Egress failed: ${msg}. ${claimedIds.length} events moved to FAILED.`,
        },
        { status: 502 },
      );
    }

    // ── 5. Bulk update: PROCESSING → PROCESSED (single query) ───
    const now = new Date().toISOString();
    await db
      .update(outbox_events)
      .set({ status: "PROCESSED", processedAt: now })
      .where(inArray(outbox_events.id, claimedIds));

    logger.info(`Successfully processed ${claimed.length} events.`, {
      component: "AirlockDispatcher",
      eventCount: claimed.length,
    });

    return Response.json({
      success: true,
      dispatched: claimed.length,
      signature: `sha256=${signature}`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    logger.error("Critical dispatcher failure", { component: "AirlockDispatcher", error: msg });
    return Response.json({ success: false, error: msg }, { status: 500 });
  }
}
