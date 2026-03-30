"use client";

import { useTransition, useState } from "react";
import { resolveAnomaly } from "@/actions/resolve-anomaly";
import { toast } from "sonner";
import { Loader2, ShieldAlert, CheckCircle2 } from "lucide-react";

interface AnomalyResolutionFormProps {
  alertId: string;
  anomalyReason: string;
}

export function AnomalyResolutionForm({ alertId, anomalyReason }: AnomalyResolutionFormProps) {
  const [isPending, startTransition] = useTransition();
  const [justification, setJustification] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    startTransition(async () => {
      try {
        const res = await resolveAnomaly({ alertId, justification });
        if (res.success) {
          toast.success(res.message);
        } else {
          toast.error(res.message);
        }
      } catch (error) {
        toast.error("Error al procesar la resolución.");
      }
    });
  };

  return (
    <div className="bg-red-950 border-4 border-red-500 rounded-[2.5rem] p-10 shadow-[0_0_50px_rgba(239,68,68,0.3)] animate-pulse-subtle">
      <div className="flex items-center gap-6 mb-8">
        <div className="p-5 bg-red-500 text-white rounded-full shadow-lg shadow-red-500/50">
          <ShieldAlert size={48} strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">
            Bloqueo de Seguridad <span className="text-red-400">FinOps</span>
          </h2>
          <p className="text-red-200 font-bold text-lg mt-1">
            Detección de Anomalía Crítica en el Margen Operativo.
          </p>
        </div>
      </div>

      <div className="bg-black/40 border border-red-500/30 rounded-3xl p-6 mb-10">
        <p className="text-red-400 text-sm font-black uppercase tracking-widest mb-2">Hallazgo del Sentinel:</p>
        <p className="text-white font-medium text-lg leading-relaxed">
          {anomalyReason}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div>
          <label className="block text-red-200 text-sm font-black uppercase tracking-[0.2em] mb-3 ml-2">
            Justificación Técnica Obligatoria
          </label>
          <textarea
            required
            disabled={isPending}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            className="w-full h-48 bg-black/60 border-2 border-red-500/50 rounded-3xl p-6 text-white text-lg font-bold placeholder:text-red-900 focus:border-red-400 focus:ring-4 focus:ring-red-500/20 transition-all outline-none resize-none"
            placeholder="Explique detalladamente la causa raíz del desvío (mín. 20 caracteres)..."
          />
          <p className="text-red-400/60 text-xs font-bold mt-3 ml-2 uppercase">
            * Su respuesta será evaluada por el Tribunal Algorítmico (LLM-as-a-Judge) para liberar el bloqueo.
          </p>
        </div>

        <button
          type="submit"
          disabled={isPending || justification.length < 20}
          className="w-full h-20 bg-white hover:bg-red-100 disabled:bg-slate-800 disabled:text-slate-600 disabled:border-slate-700 text-red-600 rounded-[2rem] text-2xl font-black uppercase italic tracking-tighter flex items-center justify-center gap-4 transition-all hover:scale-[1.02] active:scale-95 border-b-8 border-slate-200 disabled:border-0"
        >
          {isPending ? (
            <Loader2 className="animate-spin" size={32} />
          ) : (
            <>
              Presentar ante el Tribunal <CheckCircle2 size={32} />
            </>
          )}
        </button>
      </form>

      <style jsx>{`
        @keyframes pulse-subtle {
          0% { box-shadow: 0 0 50px rgba(239,68,68,0.2); }
          50% { box-shadow: 0 0 70px rgba(239,68,68,0.4); }
          100% { box-shadow: 0 0 50px rgba(239,68,68,0.2); }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 4s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
}
