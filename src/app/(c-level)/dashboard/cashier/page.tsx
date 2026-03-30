import { GlassCard } from "@/components/ui/AntigravityAtoms";
import { Banknote } from "lucide-react";
import CashierForm from "./CashierForm";
import { DLQResolutionPanel } from "./DLQResolutionPanel";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getSellableProducts } from "@/actions/bom-simulator";
import { getSession } from "@/lib/auth";
import { system_alerts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { AnomalyResolutionForm } from "./AnomalyResolutionForm";

export const dynamic = "force-dynamic";

export default async function CashierPage() {
  const session = await getSession();
  const VALID_STORE_ID = session?.user?.storeId || "MAIN_STORE_001"; // Fallback for MVP simplicity if auth fails

  const dlqItems = await db.all(sql`SELECT * FROM sales_mapping_dlq WHERE resolved = 0`);
  const catalog = await getSellableProducts();

  // 1. Detección de Bloqueos Operativos (Autonomous Lock Check)
  const activeLock = await db.query.system_alerts.findFirst({
    where: and(
      eq(system_alerts.storeId, VALID_STORE_ID),
      eq(system_alerts.isLocked, true)
    ),
  });

  return (
    <div className="p-4 sm:p-10 max-w-4xl mx-auto min-h-screen">
      <header className="mb-10">
        <h1 className="text-4xl font-black tracking-tight text-ink-900 uppercase italic">
          Cierre <span className="text-brand">Caja</span>
        </h1>
        <p className="text-slate-500 font-bold mt-2">
          Reporte diario de ventas y flujos financieros.
        </p>
      </header>

      {/* RENDERIZADO CONDICIONAL: TRIBUNAL ALGORÍTMICO vs FLUJO NOMINAL */}
      {activeLock ? (
        <AnomalyResolutionForm 
          alertId={activeLock.id} 
          anomalyReason={activeLock.details.reasoning} 
        />
      ) : (
        <>
          <DLQResolutionPanel dlqItems={dlqItems as any[]} catalog={catalog as any[]} />

          <GlassCard className="p-10 border-t-8 border-t-indigo-600">
            <div className="flex items-center gap-4 mb-10">
              <div className="p-4 bg-indigo-50 text-indigo-600 rounded-3xl">
                <Banknote size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-ink-900 uppercase tracking-tight">
                  Planilla Z de Cierre
                </h2>
                <p className="text-xs font-bold text-slate-400">
                  Punto de Ingesta Oficial de Tesorería
                </p>
              </div>
            </div>

            <CashierForm />
          </GlassCard>
        </>
      )}
    </div>
  );
}
