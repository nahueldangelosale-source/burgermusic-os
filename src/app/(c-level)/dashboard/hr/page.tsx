import { db } from "@/db";
import { employees } from "@/db/schema";
import HrClient from "./HrClient";
import { Suspense } from "react";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function HrDashboardPage() {
  // 1. Fetch nómina inmutada
  const activeEmployees = await db
    .select()
    .from(employees)
    .where(eq(employees.active, true))
    .all();

  const totalCents = activeEmployees.reduce((acc, emp) => acc + emp.hourly_rate, 0);
  const avgHourlyRate = totalCents / (activeEmployees.length || 1);

  // 2. Headcount metrics
  const metrics = {
    totalActivos: activeEmployees.length,
    costoHoraPromedio: avgHourlyRate,
    proyeccionMensual: totalCents * 160 // asumiendo 160hs mensuales promedio
  };

  return (
    <div className="min-h-screen bg-[oklch(0.95_0.02_250)] text-slate-900 p-6 md:p-10 font-sans selection:bg-emerald-500/30">
      <header className="mb-8 flex justify-between items-end border-b border-zinc-200/50 pb-6 group">
        <div>
          <h1 className="text-4xl font-black flex items-center gap-4 text-[oklch(0.15_0.02_250)] tracking-tighter">
            <span className="w-5 h-10 bg-emerald-600 rounded-sm inline-block shadow-[0_4px_14px_rgba(16,185,129,0.25)] group-hover:scale-y-110 transition-transform duration-300"></span>
            CAPITAL HUMANO (RRHH)
          </h1>
          <p className="text-[oklch(0.45_0.02_250)] font-mono text-sm tracking-widest uppercase mt-3">
            Nómina Consolidada · Edge-First
          </p>
        </div>
      </header>

      <Suspense fallback={<div className="w-full h-[600px] bg-white/60 rounded-[24px] animate-pulse border border-slate-100 shadow-sm" />}>
         <HrClient payload={activeEmployees} metrics={metrics} />
      </Suspense>
    </div>
  );
}
