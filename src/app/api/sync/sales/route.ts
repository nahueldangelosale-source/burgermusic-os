// src/app/api/sync/sales/route.ts
// API Route para sincronizar cierres de caja desde Google Sheets.
// ⚠️ Este endpoint carga datos FINANCIEROS, NO de inventario.

import { NextResponse } from "next/server";
import { syncCashClosures } from "@/integrations/google-sheets/sales-sync";
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

        console.log("🔄 Iniciando sincronización Google Sheets → Cierres de Caja...");

        const result = await syncCashClosures();

        console.log(`✅ Sync completado: ${result.totalProcessed} cierres cargados`);

        return NextResponse.json({
            success: true,
            data: {
                totalProcessed: result.totalProcessed,
                totalSkipped: result.totalSkipped,
                tabs: result.tabResults.map(t => ({
                    tab: t.tab,
                    processed: t.processed,
                    skipped: t.skipped,
                    errors: t.errors,
                    watermark: t.newWatermark,
                })),
            },
            message: `Sincronización completada: ${result.totalProcessed} cierres de caja cargados de ${result.tabResults.length} pestaña(s).`,
        });
    } catch (error: any) {
        console.error("❌ Sync Error:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
