"use client";

import { useState, useEffect, useTransition } from "react";
import { getInventoryCatalog, consolidateAudit } from "@/actions/audit";
import { CheckCircle2, AlertTriangle, Save, Loader2, PackageSearch } from "lucide-react";

export function AuditClient() {
  const [items, setItems] = useState<any[]>([]);
  const [auditCounts, setAuditCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const res = await getInventoryCatalog();
        if (res.success && res.data) {
          setItems(res.data);
        } else {
          setError((res as any).error || "Failed to load catalog");
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const handleConsolidate = async () => {
    const payloadItems = Object.keys(auditCounts).map(itemId => {
      const item = items.find(i => i.id === itemId);
      const actual_count = auditCounts[itemId];
      const difference = actual_count - (item?.current_stock || 0);
      return { item_id: itemId, actual_count, difference };
    });

    if (payloadItems.length === 0) return;

    startTransition(async () => {
      try {
        const res = await consolidateAudit({ items: payloadItems });
        if (res.success) {
          alert("Auditoría Consolidada en BD con éxito");
          setAuditCounts({});
          
          // Recargar el catálogo (O(1) state refresh)
          const reload = await getInventoryCatalog();
          if (reload.success && reload.data) setItems(reload.data);
        } else {
          alert("Error: " + res.error);
        }
      } catch (err: any) {
        alert("Error crítico: " + err.message);
      }
    });
  };

  if (isLoading) return <div className="p-8 text-center text-slate-500 animate-pulse">Cargando Motor O(1)...</div>;
  if (error) return <div className="p-8 text-red-500 font-bold bg-red-50 border border-red-200">Error: {error}</div>;

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-slate-950 p-6 rounded-[24px] border border-slate-800 shadow-2xl">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <PackageSearch className="w-5 h-5 text-indigo-400" /> Auditoría de Mermas (O1 Shrinkage Engine)
          </h2>
          <p className="text-sm text-slate-400 font-medium mt-1">Saneamiento y Conciliación Física de Inventario. Fail-Closed.</p>
        </div>
        <button 
          onClick={handleConsolidate} 
          disabled={isPending || Object.keys(auditCounts).length === 0}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border border-indigo-500 shadow-indigo-500/20 shadow-lg"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Consolidar Auditoría
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-700 rounded-[24px] shadow-2xl overflow-hidden min-h-[500px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-950 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Insumo (MDM)</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Categoría</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest text-[10px] text-right">Stock Teórico</th>
                <th className="px-6 py-4 font-bold text-indigo-400 uppercase tracking-widest text-[10px] text-center">Conteo Físico Real</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest text-[10px] text-right">Diferencia (Merma)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {items.map((item) => {
                const rawPhysicalCount = auditCounts[item.id] !== undefined ? auditCounts[item.id] : "";
                const physicalCount = typeof rawPhysicalCount === "number" ? rawPhysicalCount : "";
                const diff = auditCounts[item.id] !== undefined ? auditCounts[item.id] - Number(item.current_stock) : null;
                const isLoss = diff !== null && diff < 0;
                const isPerfect = diff !== null && diff === 0;
                const isSurplus = diff !== null && diff > 0;
                
                return (
                  <tr key={item.id} className={`transition-colors hover:bg-slate-800/50 ${diff !== null ? 'bg-slate-800/30' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-200">{item.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono tracking-widest">{item.measurement_unit}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-800 text-slate-300 text-[9px] font-bold px-2 py-1 rounded-full uppercase tracking-wider border border-slate-700">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-mono text-slate-300 font-medium">{Number(item.current_stock).toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4">
                       <input 
                         type="number"
                         step="0.01"
                         className={`w-full max-w-[120px] mx-auto block bg-slate-950 border text-center rounded-lg px-3 py-2 text-sm font-mono text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${diff !== null ? 'border-indigo-500/50' : 'border-slate-700'}`}
                         placeholder="0.00"
                         value={rawPhysicalCount === "" ? "" : physicalCount}
                         onChange={(e) => {
                           const val = e.target.value;
                           if (val === "") {
                             const newState = { ...auditCounts };
                             delete newState[item.id];
                             setAuditCounts(newState);
                           } else {
                             const parsed = parseFloat(val);
                             if (!isNaN(parsed)) {
                               setAuditCounts(prev => ({ ...prev, [item.id]: parsed }));
                             }
                           }
                         }}
                       />
                    </td>
                    <td className="px-6 py-4 text-right">
                      {diff === null ? (
                        <span className="text-slate-600 font-mono">-</span>
                      ) : (
                        <div className="flex flex-col items-end justify-center">
                          {isPerfect && (
                            <span className="text-emerald-500 font-bold font-mono flex items-center gap-1 text-sm bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              <CheckCircle2 className="w-4 h-4" /> 0.00
                            </span>
                          )}
                          {isLoss && (
                            <>
                              <span className="text-red-500 font-bold font-mono text-sm bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                                {diff.toFixed(2)} {item.measurement_unit}
                              </span>
                              <span className="text-[10px] text-red-500 flex items-center gap-1 mt-1 uppercase font-bold tracking-tight">
                                <AlertTriangle className="w-3 h-3" /> Fuga: ${ (Math.abs(diff) * (Number(item.cost_per_unit_cents) / 100)).toLocaleString('es-AR', {minimumFractionDigits: 2}) }
                              </span>
                            </>
                          )}
                          {isSurplus && (
                            <span className="text-indigo-400 font-bold font-mono text-sm bg-indigo-400/10 px-2 py-0.5 rounded border border-indigo-400/20">
                              +{diff.toFixed(2)} {item.measurement_unit}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {items.length === 0 && !isLoading && (
             <div className="p-12 text-center text-slate-500 text-sm font-bold">
               Catálogo de inventario vacío (Zero-Trust state).
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
