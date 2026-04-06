"use client";

import { useState, useTransition } from "react";
import { autoResolveOrphans, getUnresolvedOrphans } from "@/actions/alias-engine";
import { saveSkuAlias } from "@/actions/sku-aliases";
import { toast } from "sonner";

interface AliasResolutionCenterProps {
  initialOrphans: string[];
  initialProducts: { id: string; name: string }[];
}

export function AliasResolutionCenter({ initialOrphans, initialProducts }: AliasResolutionCenterProps) {
  const [orphans, setOrphans] = useState(initialOrphans);
  const [products] = useState(initialProducts);
  const [isAutoMatching, startAutoMatch] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [manualMappings, setManualMappings] = useState<Record<string, string>>({});
  const [autoMatchResult, setAutoMatchResult] = useState<{
    autoResolved: number;
    unresolvedCount: number;
  } | null>(null);

  const handleAutoMatch = () => {
    startAutoMatch(async () => {
      try {
        const result = await autoResolveOrphans();
        setAutoMatchResult({
          autoResolved: result.autoResolved,
          unresolvedCount: result.unresolvedCount,
        });
        toast.success(
          `Motor Heurístico: ${result.autoResolved} SKUs resueltos automáticamente. ${result.unresolvedCount} pendientes.`
        );
        // Refresh orphan list
        const fresh = await getUnresolvedOrphans();
        setOrphans(fresh.orphans);
      } catch (e: any) {
        toast.error("Error en Auto-Match: " + e.message);
      }
    });
  };

  const handleManualSave = (rawSku: string) => {
    const productId = manualMappings[rawSku];
    if (!productId) {
      toast.error("Seleccioná un producto para mapear.");
      return;
    }
    startSave(async () => {
      try {
        await saveSkuAlias(rawSku, productId);
        toast.success(`Alias guardado: "${rawSku}" → ${products.find(p => p.id === productId)?.name}`);
        setOrphans(prev => prev.filter(o => o !== rawSku));
        setManualMappings(prev => {
          const next = { ...prev };
          delete next[rawSku];
          return next;
        });
      } catch (e: any) {
        toast.error("Error: " + e.message);
      }
    });
  };

  return (
    <div className="flex flex-col gap-8">
      {/* HEADER + AUTO-MATCH BUTTON */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-black tracking-tighter text-slate-900 uppercase">
            Centro de Resolución de Alias
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            {orphans.length} SKUs huérfanos pendientes de resolución humana
          </p>
        </div>
        <button
          onClick={handleAutoMatch}
          disabled={isAutoMatching}
          className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-indigo-500/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
        >
          {isAutoMatching ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Procesando...
            </>
          ) : (
            <>⚡ Ejecutar Auto-Match Heurístico</>
          )}
        </button>
      </div>

      {/* AUTO-MATCH RESULT BANNER */}
      {autoMatchResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-2xl">🎯</div>
          <div>
            <p className="font-bold text-emerald-900">
              Motor Heurístico ejecutado exitosamente
            </p>
            <p className="text-sm text-emerald-700">
              <span className="font-black">{autoMatchResult.autoResolved}</span> SKUs resueltos automáticamente •{" "}
              <span className="font-black">{autoMatchResult.unresolvedCount}</span> requieren intervención manual
            </p>
          </div>
        </div>
      )}

      {/* ORPHAN LIST (POSITIVE FRICTION) */}
      {orphans.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-16 flex flex-col items-center justify-center shadow-sm">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4 text-3xl">✅</div>
          <h3 className="text-xl font-black text-slate-800 tracking-tighter">Estado Limpio</h3>
          <p className="text-sm text-slate-500 mt-1">Todos los SKUs han sido resueltos. Entropía semántica eliminada.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="sticky top-0 bg-slate-50 px-6 py-4 border-b border-slate-200 grid grid-cols-12 gap-4">
            <span className="col-span-5 text-[10px] font-black uppercase tracking-widest text-slate-400">SKU Huérfano (Raw)</span>
            <span className="col-span-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Asignar Producto</span>
            <span className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Acción</span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {orphans.slice(0, 100).map((orphan) => (
              <div key={orphan} className="px-6 py-4 grid grid-cols-12 gap-4 items-center hover:bg-slate-50/50 transition-colors">
                <div className="col-span-5">
                  <span className="font-mono text-sm font-bold text-red-700 bg-red-50 px-3 py-1 rounded-lg border border-red-100">
                    {orphan}
                  </span>
                </div>
                <div className="col-span-5">
                  <select
                    value={manualMappings[orphan] || ""}
                    onChange={(e) => setManualMappings(prev => ({ ...prev, [orphan]: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none"
                  >
                    <option value="">— Seleccionar producto —</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <button
                    onClick={() => handleManualSave(orphan)}
                    disabled={isSaving || !manualMappings[orphan]}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider disabled:opacity-30 hover:bg-indigo-700 transition-colors"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            ))}
          </div>

          {orphans.length > 100 && (
            <div className="px-6 py-4 bg-amber-50 border-t border-amber-200 text-sm font-bold text-amber-800">
              ⚠️ Mostrando 100 de {orphans.length} huérfanos. Ejecutá el Auto-Match para reducir la lista.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
