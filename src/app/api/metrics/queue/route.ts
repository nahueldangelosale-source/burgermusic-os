import { getQueueMetrics } from "@/lib/queue";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const metrics = await getQueueMetrics();
    return NextResponse.json(metrics);
  } catch (e) {
    console.error("Queue Metrics API Error", e);
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }
}
