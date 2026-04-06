import React from "react";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SUPPLIER EFFICIENCY RADAR — UI
 * Server Component visualizer para comparar Lead Time real vs esperado.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface SupplierEfficiency {
  supplierId: string;
  supplierName: string;
  promisedLeadTimeDays: number;
  actualLeadTimeDays: number;
}

export function SupplierEfficiencyRadar({ efficiencyData }: { efficiencyData: SupplierEfficiency[] }) {
  if (!efficiencyData || efficiencyData.length === 0) {
    return (
      <div className="p-8 border border-slate-200 rounded-xl bg-slate-50 text-center text-slate-500 text-sm">
        Datos de Lead Time insuficientes.
      </div>
    );
  }

  // Ordenar por el proveedor más desviado
  const sorted = [...efficiencyData].sort((a, b) => {
    const diffA = a.actualLeadTimeDays - a.promisedLeadTimeDays;
    const diffB = b.actualLeadTimeDays - b.promisedLeadTimeDays;
    return diffB - diffA; // Orden descendente por desfase
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Radar de Eficiencia B2B</h2>
          <p className="text-xs text-slate-500 mt-1">Lead Time Histórico vs Acuerdos (Prometido)</p>
        </div>
      </div>

      <div className="space-y-4">
        {sorted.map((data) => {
          const deviation = data.actualLeadTimeDays - data.promisedLeadTimeDays;
          const isDelayed = deviation > 0;
          const isSeverelyDelayed = deviation > 1.5;

          return (
            <div key={data.supplierId} className="flex flex-col gap-2 p-3 rounded-lg border border-slate-100 bg-slate-50/50">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-800">{data.supplierName}</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded text-slate-600 bg-slate-200/60">
                  Acuerdo: {data.promisedLeadTimeDays.toFixed(1)}d
                </span>
              </div>
              
              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Real (WMA):</span>
                  <span className={`text-sm font-bold ${isSeverelyDelayed ? 'text-rose-600' : isDelayed ? 'text-amber-500' : 'text-emerald-600'}`}>
                    {data.actualLeadTimeDays.toFixed(2)} días
                  </span>
                </div>
                {isDelayed && (
                  <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
                    +{deviation.toFixed(1)}d Retraso
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
