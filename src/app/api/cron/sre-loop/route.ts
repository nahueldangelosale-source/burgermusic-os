/**
 * SRE Loop — Cron Endpoint
 * ─────────────────────────
 * Triggers the K-MAPE autonomous SRE cycle.
 * Intended to be called by Vercel Cron or an external scheduler.
 */

import { runKMAPECycle } from "@/lib/intelligence/sre-agent";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Auth: Vercel Cron header or Bearer token
  const authHeader = request.headers.get("authorization");
  const isCron =
    request.headers.get("x-vercel-cron") === "true" ||
    authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (process.env.NODE_ENV === "production" && !isCron) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    logger.info("K-MAPE SRE cycle triggered", { component: "SRECron" });

    const result = await runKMAPECycle();

    return Response.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    logger.error("SRE Cron critical failure", { component: "SRECron", error: msg });
    return Response.json({ success: false, error: msg }, { status: 500 });
  }
}
