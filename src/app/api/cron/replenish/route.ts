import { NextResponse } from "next/server";
import { runReplenishmentCycle } from "@/actions/procurement-daemon";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Zero-Trust: CRON_SECRET is required to trigger automated procurement
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "UNAUTHORIZED_CRON_ACCESS" }, { status: 401 });
  }

  try {
    const result = await runReplenishmentCycle();
    
    // Fail-Closed status handling
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      draftsGenerated: result.draftPOIds.length,
      poIds: result.draftPOIds
    }, { status: 200 });

  } catch (err: any) {
    console.error("[CRON_REPLENISH_ERROR]", err);
    return NextResponse.json({ error: "Catastrophic failure in Heartbeat" }, { status: 500 });
  }
}
