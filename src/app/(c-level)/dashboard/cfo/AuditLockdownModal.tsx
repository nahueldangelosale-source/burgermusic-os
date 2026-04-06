"use client";

import { useState, useTransition } from "react";
import { resolveZombieAudit } from "@/actions/PnLEngine";
import { useRouter } from "next/navigation";

// ─────────────────────────────────────────────────────────────
// AUDIT LOCKDOWN MODAL — Non-Dismissable Governance Friction
// Antigravity 2026: Zero-Escape Accountability
// ─────────────────────────────────────────────────────────────

export function AuditLockdownModal({
  auditId,
  targetDate,
  marginPercent,
}: {
  auditId: string;
  targetDate: string;
  marginPercent: number;
}) {
  const router = useRouter();
  const [justification, setJustification] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const charCount = justification.trim().length;
  const isValid = charCount >= 50;

  const handleSubmit = () => {
    if (!isValid) {
      setError("La justificación debe tener mínimo 50 caracteres.");
      return;
    }

    startTransition(async () => {
      const result = await resolveZombieAudit(auditId, justification);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error || "Error al resolver la auditoría.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center backdrop-blur-lg bg-black/90">
      <div className="max-w-xl w-full mx-4 bg-white rounded-2xl shadow-2xl border-2 border-red-400 overflow-hidden">
        {/* Header */}
        <div className="bg-red-50 border-b-2 border-red-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-2xl animate-pulse">
              🚨
            </div>
            <div>
              <h2 className="text-lg font-black text-red-700 uppercase tracking-tight">
                Auditoría de Gobernanza Obligatoria
              </h2>
              <p className="text-xs font-bold text-red-400 uppercase tracking-widest">
                Turno Zombie Detectado • {targetDate}
              </p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-red-100 border border-red-200 rounded-xl">
            <p className="text-sm font-bold text-red-700">
              El margen neto ha caído a{" "}
              <span className="text-xl font-black font-mono">{marginPercent.toFixed(1)}%</span>{" "}
              (umbral mínimo: 15%). Este panel permanecerá bloqueado hasta que un
              responsable autorizado justifique la anomalía.
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3">
            Justificación del Responsable (mín. 50 caracteres)
          </label>
          <textarea
            className="w-full h-36 p-4 text-sm font-medium text-slate-800 bg-slate-50 border-2 border-slate-200 rounded-xl resize-none outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all placeholder:text-slate-300"
            placeholder="Explique por qué el COGS, el shrinkage o factores operacionales destruyeron el margen este turno. Detalle las medidas correctivas que se tomarán..."
            value={justification}
            onChange={(e) => {
              setJustification(e.target.value);
              setError("");
            }}
            disabled={isPending}
          />
          <div className="flex items-center justify-between mt-2">
            <span
              className={`text-xs font-mono font-bold ${
                isValid ? "text-emerald-600" : "text-slate-400"
              }`}
            >
              {charCount}/50
              {isValid && " ✓"}
            </span>
            {error && (
              <span className="text-xs font-bold text-red-500">{error}</span>
            )}
          </div>
        </div>

        {/* Footer  */}
        <div className="bg-slate-50 border-t border-slate-200 p-6 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={!isValid || isPending}
            className={`px-8 py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-all ${
              isValid && !isPending
                ? "bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-500/30 cursor-pointer"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            {isPending ? "Registrando Resolución..." : "Confirmar Justificación"}
          </button>
        </div>
      </div>
    </div>
  );
}
