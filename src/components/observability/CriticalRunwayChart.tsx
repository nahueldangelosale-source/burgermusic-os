import React from "react";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CRITICAL RUNWAY CHART — UI DADA (Zero-Trust Observability)
 * Renderizado desde Server Component. Calcula visualmente días de vida restando.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface RunwayItem {
  id: string;
  name: string;
  currentStock: number;
  burnRateDaily: number;
  safetyStock: number;
}

export function CriticalRunwayChart({ items }: { items: RunwayItem[] }) {
  if (!items || items.length === 0) {
    return (
      <div className="p-8 border border-slate-200 rounded-xl bg-slate-50 text-center text-slate-500 text-sm">
        No hay datos de consumo termo-dinámico suficientes.
      </div>
    );
  }

  // Ordenar por nivel más crítico primero (runway más bajo)
  const sortedItems = [...items].sort((a, b) => {
    const runwayA = a.burnRateDaily > 0 ? (a.currentStock - a.safetyStock) / a.burnRateDaily : 999;
    const runwayB = b.burnRateDaily > 0 ? (b.currentStock - b.safetyStock) / b.burnRateDaily : 999;
    return runwayA - runwayB;
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Runway Crítico</h2>
          <p className="text-xs text-slate-500 mt-1">Días de stock remanente proyectando el Burn Rate (14d)</p>
        </div>
      </div>

      <div className="space-y-4">
        {sortedItems.slice(0, 8).map((item) => {
          const runwayDays = item.burnRateDaily > 0 
            ? (item.currentStock - item.safetyStock) / item.burnRateDaily 
            : 0;
            
          const isCritical = runwayDays <= 2;
          const isWarning = runwayDays > 2 && runwayDays <= 5;
          const fillWidth = Math.min(100, Math.max(0, runwayDays * 10)); // Scale para visualizacion
          
          let barColor = "bg-slate-800";
          if (isCritical) barColor = "bg-rose-600";
          else if (isWarning) barColor = "bg-amber-500";

          return (
            <div key={item.id} className="group">
               <div className="flex justify-between items-end mb-1.5">
                 <span className="text-sm font-medium text-slate-700 truncate">{item.name}</span>
                 <span className={`text-xs font-bold ${isCritical ? 'text-rose-600' : 'text-slate-500'}`}>
                    {item.burnRateDaily === 0 ? "Sin consumo" : `${runwayDays.toFixed(1)} días`}
                 </span>
               </div>
               <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                 <div 
                   className={`h-full ${barColor} transition-all duration-700 ease-out rounded-full`} 
                   style={{ width: `${item.burnRateDaily === 0 ? 100 : fillWidth}%` }}
                 />
               </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
