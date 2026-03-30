"use client";

import { useState, useTransition } from "react";
import { executeHardReset } from "@/actions/hard-reset";
import { AlertOctagon, RefreshCcw } from "lucide-react";

export function PanicButton() {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  const handleDemolition = () => {
    startTransition(async () => {
      const res = await executeHardReset();
      setResult(res);
      setConfirming(false);
      setTimeout(() => setResult(null), 5000);
    });
  };

  return (
    <div className="relative inline-block mt-4 mb-8">
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="flex items-center gap-2 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200 hover:border-red-200 py-2 px-4 rounded-xl text-sm font-bold transition-all"
        >
          <AlertOctagon size={16} />
          HARD RESET (DANGER)
        </button>
      ) : (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 p-3 rounded-xl animate-in fade-in slide-in-from-left-4">
          <span className="text-red-800 text-xs font-bold uppercase tracking-widest hidden sm:inline-block">
            ¿Purgar DB?
          </span>
          <button
            disabled={isPending}
            onClick={handleDemolition}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white py-2 px-5 rounded-lg text-sm font-black transition-all shadow-sm shadow-red-600/20 disabled:opacity-50"
          >
            {isPending ? <RefreshCcw className="animate-spin" size={16} /> : "CONFIRMAR PURGA O(1)"}
          </button>
          <button 
            disabled={isPending}
            onClick={() => setConfirming(false)} 
            className="text-slate-500 hover:text-slate-800 text-sm font-bold px-3 py-2 disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      )}

      {result && (
        <div className={`absolute top-full left-0 mt-3 p-3 text-xs font-bold rounded-lg border w-[350px] shadow-lg z-50 animate-in fade-in slide-in-from-top-4 ${
          result.success ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-800 border-red-200"
        }`}>
          {result.message || result.error}
        </div>
      )}
    </div>
  );
}
