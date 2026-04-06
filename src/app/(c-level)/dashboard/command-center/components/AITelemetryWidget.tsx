"use client";

import { useState } from "react";
import { generateStrategicInsights } from "@/actions/ai-telemetry";
import { Sparkles, X, Activity } from "lucide-react";

export function AITelemetryWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    top_time_slot?: string;
    most_profitable_combo?: string;
    upsell_strategy?: string;
  } | null>(null);

  const toggleInsights = async () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    setIsOpen(true);
    if (!data && !loading) {
      setLoading(true);
      try {
        const response = await generateStrategicInsights();
        if (response.success && response.data) {
          setData(response.data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="relative">
      <button
        onClick={toggleInsights}
        className="bg-indigo-50 border border-indigo-100 text-indigo-600 px-4 py-2.5 flex items-center gap-2 rounded-xl shadow-sm text-sm font-semibold hover:bg-indigo-100 hover:shadow-md transition-all"
      >
        <Sparkles size={16} className={loading && isOpen ? "animate-pulse" : ""} />
        {isOpen ? "Cerrar Táctica" : "✨ Insights (Gemini)"}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-14 w-80 bg-white border border-slate-200 shadow-xl rounded-2xl p-5 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Sparkles size={14} className="text-indigo-500" /> Decisión Táctica
            </h3>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 bg-slate-50 p-1 rounded-full transition-colors">
              <X size={14} />
            </button>
          </div>
          
          {loading ? (
             <div className="flex flex-col items-center justify-center py-6 space-y-3">
                <Activity size={20} className="text-indigo-400 animate-spin" />
                <p className="text-center text-slate-500 text-xs font-medium animate-pulse">Invocando Clúster Analítico...</p>
             </div>
          ) : data ? (
            <div className="space-y-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase mb-0.5">Ventana Tracción</p>
                <p className="font-semibold text-slate-800 text-xs">{data.top_time_slot}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase mb-0.5">Activo Estrella (BOM)</p>
                <p className="font-semibold text-slate-800 text-xs">{data.most_profitable_combo}</p>
              </div>
              <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                <p className="text-[10px] text-indigo-500 font-bold tracking-wider uppercase mb-0.5">Táctica Sugerida</p>
                <p className="font-medium text-slate-800 text-xs leading-relaxed">{data.upsell_strategy}</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-red-500 text-xs font-semibold">Inferencia bloqueada (Timeout).</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
