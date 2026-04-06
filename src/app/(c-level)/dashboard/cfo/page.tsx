import { Suspense } from "react";
import { generateDailyPnL, generateRangePnL } from "@/actions/PnLEngine";

export const dynamic = "force-dynamic";

const fmt = (cents: number) =>
  `$${(Math.abs(cents) / 100).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;

const fmtPct = (pct: number) => `${pct.toFixed(1)}%`;

export default async function CFODashboardPage() {
  const today = new Date().toISOString().split("T")[0];

  // Rango Q1 2026 para análisis acumulado
  const q1Start = `${today.slice(0, 4)}-01-01`;

  const [daily, cumulative] = await Promise.all([
    generateDailyPnL(today),
    generateRangePnL(q1Start, today),
  ]);

  const isZombie = daily.isZombie;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-10 font-sans">

      {/* ─── HEADER ─── */}
      <header className="mb-10">
        <h1 className="text-4xl font-black tracking-tighter text-slate-900 italic">
          CFO COMMAND CENTER
        </h1>
        <p className="text-slate-500 font-medium mt-2 tracking-wide uppercase text-xs">
          P&L Reactor • Unified Financial Intelligence • {today}
        </p>
      </header>

      <Suspense fallback={<div className="h-1 bg-indigo-500/20 w-full animate-pulse rounded-full" />}>
        {/* ═══════════════════════════════════════════════════════════ */}
        {/* TSV — Total Strategic Value (Hero Card)                    */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <div
          className={`rounded-2xl p-8 mb-8 border-2 transition-all duration-500 ${
            isZombie
              ? "bg-red-50 border-red-400 shadow-[0_0_60px_-10px_rgba(239,68,68,0.3)]"
              : "bg-white border-slate-200 shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2
                className={`text-2xl font-black tracking-tight ${
                  isZombie ? "text-red-600" : "text-slate-900"
                }`}
              >
                {isZombie
                  ? "⚠️ ALERTA: Rentabilidad Crítica — Turno Zombie"
                  : "✅ Margen Saludable — Silent Luxury"}
              </h2>
              <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${isZombie ? "text-red-400" : "text-slate-400"}`}>
                P&L Diario: {today}
              </p>
            </div>
            <div
              className={`text-5xl font-black font-mono tabular-nums ${
                isZombie ? "text-red-600 animate-pulse" : "text-emerald-600"
              }`}
            >
              {fmtPct(daily.marginPercent)}
            </div>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <KPICard
              label="Revenue Bruto"
              value={fmt(daily.revenue)}
              accent={isZombie ? "text-red-700" : "text-slate-900"}
              border={isZombie ? "border-red-200" : "border-slate-200"}
              bg={isZombie ? "bg-red-50/50" : "bg-slate-50"}
            />
            <KPICard
              label="COGS Total"
              value={fmt(daily.cogs)}
              accent={isZombie ? "text-red-600" : "text-slate-700"}
              border={isZombie ? "border-red-200" : "border-slate-200"}
              bg={isZombie ? "bg-red-50/50" : "bg-slate-50"}
            />
            <KPICard
              label="Margen Bruto"
              value={fmt(daily.grossMargin)}
              accent={daily.grossMargin >= 0 ? "text-emerald-600" : "text-red-600"}
              border={isZombie ? "border-red-200" : "border-emerald-200"}
              bg={isZombie ? "bg-red-50/50" : "bg-emerald-50/50"}
            />
            <KPICard
              label="Shrinkage (Faltante)"
              value={daily.shrinkage > 0 ? `-${fmt(daily.shrinkage)}` : "$0,00"}
              accent="text-amber-600"
              border={isZombie ? "border-red-200" : "border-amber-200"}
              bg={isZombie ? "bg-red-50/50" : "bg-amber-50/50"}
            />
            <KPICard
              label="Margen Neto"
              value={fmt(daily.netMargin)}
              accent={isZombie ? "text-red-700" : "text-emerald-700"}
              border={isZombie ? "border-red-300" : "border-emerald-300"}
              bg={isZombie ? "bg-red-100/50" : "bg-emerald-50"}
              bold
            />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* CANAL BREAKDOWN (Treasury)                                 */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5">
              Distribución por Canal de Cobro
            </h3>
            {daily.channelBreakdown.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-10 italic">
                Sin cierres de caja para esta fecha.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {daily.channelBreakdown
                  .sort((a, b) => b.total_cents - a.total_cents)
                  .map((ch) => {
                    const maxVal = Math.max(...daily.channelBreakdown.map(c => c.total_cents), 1);
                    const pct = (ch.total_cents / maxVal) * 100;
                    return (
                      <div key={ch.method} className="flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                            {ch.method.replace(/_/g, " ")}
                          </span>
                          <span className="text-sm font-mono font-bold text-slate-800">
                            {fmt(ch.total_cents)}
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* CUMULATIVE P&L */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5">
              P&L Acumulado ({q1Start.slice(5)} → {today.slice(5)})
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <MiniKPI label="Revenue Acumulado" value={fmt(cumulative.revenue)} />
              <MiniKPI label="COGS Acumulado" value={fmt(cumulative.cogs)} />
              <MiniKPI label="Margen Bruto Acum." value={fmt(cumulative.grossMargin)} />
              <MiniKPI label="Shrinkage Acum." value={cumulative.shrinkage > 0 ? `-${fmt(cumulative.shrinkage)}` : "$0,00"} />
              <MiniKPI label="Margen Neto Acum." value={fmt(cumulative.netMargin)} highlight />
              <MiniKPI label="% Margen Acum." value={fmtPct(cumulative.marginPercent)} highlight />
            </div>
            {cumulative.isZombie && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-bold uppercase tracking-wider text-center">
                ⚠️ Margen Acumulado Crítico — Revisión C-Level Requerida
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* THERMODYNAMIC FORMULA                                      */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
            Fórmula Termodinámica del Margen
          </h3>
          <div className="flex flex-wrap items-center gap-3 font-mono text-sm">
            <span className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 font-bold">
              Revenue {fmt(daily.revenue)}
            </span>
            <span className="text-slate-400 font-bold">−</span>
            <span className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-bold">
              COGS {fmt(daily.cogs)}
            </span>
            <span className="text-slate-400 font-bold">−</span>
            <span className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 font-bold">
              Shrinkage {fmt(daily.shrinkage)}
            </span>
            <span className="text-slate-400 font-bold">=</span>
            <span
              className={`px-4 py-2 border-2 rounded-lg font-black text-base ${
                isZombie
                  ? "bg-red-50 border-red-400 text-red-700"
                  : "bg-emerald-50 border-emerald-400 text-emerald-700"
              }`}
            >
              Net {fmt(daily.netMargin)} ({fmtPct(daily.marginPercent)})
            </span>
          </div>
        </div>
      </Suspense>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-Components (Colocated — Zero Import Fragmentation)
// ─────────────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  accent,
  border,
  bg,
  bold,
}: {
  label: string;
  value: string;
  accent: string;
  border: string;
  bg: string;
  bold?: boolean;
}) {
  return (
    <div className={`${bg} border ${border} p-4 rounded-xl`}>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
        {label}
      </p>
      <p className={`${bold ? "text-xl" : "text-lg"} font-bold font-mono ${accent}`}>
        {value}
      </p>
    </div>
  );
}

function MiniKPI({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`p-3 rounded-lg ${highlight ? "bg-indigo-50 border border-indigo-200" : "bg-slate-50 border border-slate-200"}`}>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-base font-mono font-bold ${highlight ? "text-indigo-700" : "text-slate-800"}`}>{value}</p>
    </div>
  );
}
