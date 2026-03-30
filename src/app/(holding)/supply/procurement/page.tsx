import { Suspense } from "react";
import { SmartOrderingAction, ThreeWayMatchRow, YieldMasterChart } from "./procurement-client";

export default function SupplyChainPage() {
  const chartData = [
    { insumo: "Carne Premium", "Precio Lista": 8500, "True Cost (BOM)": 9250 },
    { insumo: "Pan Brioche", "Precio Lista": 1200, "True Cost (BOM)": 1400 },
    { insumo: "Papas Fritas", "Precio Lista": 3500, "True Cost (BOM)": 5100 },
  ];

  return (
    <div className="min-h-screen bg-[oklch(0.95_0.02_250)] p-6 lg:p-10 font-sans">
      <header className="mb-8">
        <h1 className="text-3xl font-black tracking-tighter text-[oklch(0.15_0.02_250)] flex items-center gap-4">
           <span className="w-4 h-10 bg-indigo-500 rounded-sm inline-block shadow-lg"></span>
           B2B PROCUREMENT & YIELD
        </h1>
        <p className="text-[oklch(0.45_0.02_250)] font-mono text-xs tracking-widest uppercase mt-2">
           Split-View Audit Engine · Glassmorphism 2.0
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* SECCIÓN A: Smart Ordering */}
        <div className="col-span-1 lg:col-span-4 flex flex-col gap-6">
           <div className="bg-[oklch(0.98_0.01_250)] p-6 rounded-3xl ring-1 ring-amber-500/50 shadow-sm flex flex-col border-t-4 border-t-amber-500">
              <span className="font-mono text-xs tracking-widest text-amber-600 font-bold uppercase mb-4">Stock Crítico (Quiebre a 48hs)</span>
              <span className="text-2xl font-black text-[oklch(0.15_0.02_250)]">Carne Premium (Cajas)</span>
              <span className="text-sm font-mono text-[oklch(0.45_0.02_250)] mt-2">Sugerido: 150 Bultos</span>
           </div>
           <SmartOrderingAction />
        </div>

        {/* SECCIÓN B & C: Three-Way Match & Yield Chart */}
        <div className="col-span-1 lg:col-span-8 flex flex-col gap-8">
           <div className="bg-[oklch(0.98_0.01_250)] rounded-3xl overflow-hidden ring-1 ring-zinc-200 shadow-sm p-6">
              <h2 className="font-mono uppercase tracking-widest text-[oklch(0.45_0.02_250)] mb-6 font-bold">Three-Way Match Audit</h2>
              <div className="flex flex-col gap-4">
                 <ThreeWayMatchRow po={85000} recepcion={85000} invoice={85000} />
                 {/* Alerta Cinética Activada en el delta */}
                 <ThreeWayMatchRow po={42000} recepcion={42000} invoice={45500} /> 
              </div>
           </div>

           <Suspense fallback={<div className="h-80 bg-zinc-200/50 animate-pulse rounded-2xl" />}>
              <YieldMasterChart data={chartData} />
           </Suspense>
        </div>
      </div>
    </div>
  );
}
