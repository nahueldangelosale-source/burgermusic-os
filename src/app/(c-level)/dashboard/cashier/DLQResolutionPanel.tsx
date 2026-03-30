"use client";

import { useState, useRef } from "react";
import { resolveDLQItem } from "@/actions/shift-closure";
import { GlassCard } from "@/components/ui/AntigravityAtoms";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";

export function DLQResolutionPanel({ 
  dlqItems, 
  catalog 
}: { 
  dlqItems: any[];
  catalog: any[]; 
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: dlqItems?.length ?? 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 140, // Altura estimada de la tarjeta de fricción
    overscan: 5,
  });

  async function handleResolve(dlqId: string, targetSku: string) {
    if (!targetSku) return;
    setLoading(dlqId);
    await resolveDLQItem(dlqId, targetSku);
    setLoading(null);
  }

  if (!dlqItems || dlqItems.length === 0) {
    return (
      <GlassCard className="p-6 border-l-4 border-l-green-500 mb-8 bg-green-50/50">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="text-green-600" size={24} />
          <div>
            <h3 className="text-green-900 font-bold">Fricción Cero</h3>
            <p className="text-green-700 text-sm">El catálogo está 100% mapeado a las ventas.</p>
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-8 border-l-8 border-l-amber-500 mb-8 max-h-[800px] flex flex-col overflow-hidden">
      <div className="flex items-start gap-4 mb-6 flex-shrink-0">
        <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
          <AlertCircle size={28} />
        </div>
        <div>
          <h2 className="text-xl font-black text-ink-900 uppercase tracking-tight">
            Resolución de Fricción
          </h2>
          <p className="text-sm font-medium text-slate-500">
            Tienes {dlqItems.length} comprobantes no identificados. Enlázalos al SKU correcto para liberar el cierre de caja.
          </p>
        </div>
      </div>

      <div ref={parentRef} className="flex-1 overflow-y-auto relative p-1">
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const item = dlqItems[virtualRow.index];
            return (
              <div 
                key={item.id} 
                ref={rowVirtualizer.measureElement}
                data-index={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`
                }}
                className="p-4 bg-white/50 border border-slate-200 rounded-2xl flex flex-col md:flex-row gap-4 justify-between items-center hover:bg-white transition-colors mb-4"
              >
                <div className="flex-1">
                  <span className="text-xs font-bold text-amber-600 uppercase tracking-widest bg-amber-100 px-2 py-1 rounded-md mb-2 inline-block">Huérfano</span>
                  <p className="font-bold text-slate-900 text-lg uppercase">
                    {item.raw_name}
                  </p>
                  <p className="text-sm font-semibold text-slate-500">
                    Cant: {item.quantity} • Ingreso: ${(item.price / 100).toLocaleString('es-AR')}
                  </p>
                </div>
                
                <div className="flex gap-2 w-full md:w-auto">
                  <select 
                    id={`select-${item.id}`}
                    className="w-full md:w-64 bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-brand focus:border-brand p-3 font-semibold"
                    defaultValue=""
                  >
                    <option value="" disabled>Selecciona el SKU Real</option>
                    {catalog.map(c => (
                      <option key={c.id} value={c.id}>[{c.category}] {c.name}</option>
                    ))}
                  </select>
                  <button
                    disabled={loading === item.id}
                    onClick={(e) => {
                      const select = document.getElementById(`select-${item.id}`) as HTMLSelectElement;
                      handleResolve(item.id, select.value);
                    }}
                    className="bg-ink-900 hover:bg-black text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md disabled:opacity-50 flex-shrink-0"
                  >
                    {loading === item.id ? "Uniendo..." : "Enlazar"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}
