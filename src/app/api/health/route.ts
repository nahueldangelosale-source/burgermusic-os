import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        // 1. Ping DB
        const start = performance.now();
        await db.run(sql`SELECT 1`);
        const duration = Math.round(performance.now() - start);

        return NextResponse.json({
            status: "OPERATIONAL",
            environment: process.env.NODE_ENV,
            database_latency: `${duration}ms`,
            timestamp: new Date().toISOString(),
        }, { status: 200 });
    } catch (error) {
        console.error("Health Check Failed:", error);
        return NextResponse.json({
            status: "CRITICAL_FAILURE",
            error: "Database Unreachable",
        }, { status: 500 });
    }
}
