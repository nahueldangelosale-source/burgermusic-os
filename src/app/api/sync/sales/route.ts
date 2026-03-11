// src/app/api/sync/sales/route.ts
// API Route protegida para ejecutar la sincronización de ventas desde Google Sheets.
// Puede ser llamada manualmente o vía Vercel Cron.

import { NextResponse } from "next/server";
import { syncSalesFromSheet } from "@/integrations/google-sheets/sales-sync";
import { getSession } from "@/lib/auth";

export async function POST(request: Request) {
    try {
        // Verificar autenticación (solo MANAGER puede disparar sync)
        const session = await getSession();
        if (!session || session.user.role !== "MANAGER") {
            return NextResponse.json(
                { error: "No autorizado. Solo el Manager puede ejecutar la sincronización." },
                { status: 401 }
            );
        }

        console.log("🔄 Iniciando sincronización Google Sheets → Ledger...");

        const result = await syncSalesFromSheet();

        console.log(`✅ Sync completado: ${result.processed} procesadas, ${result.skipped} omitidas`);

        return NextResponse.json({
            success: true,
            data: {
                processed: result.processed,
                skipped: result.skipped,
                errors: result.errors,
                newWatermark: result.newWatermark,
            },
            message: `Sincronización completada: ${result.processed} ventas cargadas, ${result.skipped} omitidas. Marca de agua: fila ${result.newWatermark}.`,
        });
    } catch (error: any) {
        console.error("❌ Sync Error:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
