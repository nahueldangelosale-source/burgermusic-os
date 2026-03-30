// @ts-nocheck
import { getFireRadarAlerts, getLeaderboard, getCashflowOracle } from "@/db/analytics-engine";
import Link from "next/link";

export function WidgetSkeleton({ className }: { className?: string }) {
  return (
    <div className={`bg-zinc-900/20 border border-zinc-800/30 rounded-3xl animate-pulse ${className}`} />
  );
}



export async function CashflowOracleWidget({ storeId }: { storeId?: string }) {
  const oracle = await getCashflowOracle(storeId);
  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex justify-between items-center mb-6">
        <span className="text-zinc-400 font-bold tracking-widest text-sm uppercase">Cashflow Oracle (7D)</span>
        <span className="text-xs bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full border border-indigo-500/30">LATEST PULL</span>
      </div>
      <div className="flex-1 flex items-end gap-2">
        {oracle.reverse().map((day, i) => {
          const heightPct = Math.min(100, (day.daily_revenue / 100) / 2000); // Dummy scaling
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
              <div className="w-full bg-zinc-800 rounded-t-md relative flex items-end justify-center group-hover:bg-zinc-700 transition-colors" style={{ height: '200px' }}>
                <div 
                  className="w-full bg-gradient-to-t from-indigo-900/50 to-indigo-500 rounded-t-md transition-all" 
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">{day.date.slice(5)}</span>
            </div>
          );
        })}
        {oracle.length === 0 && <div className="m-auto text-zinc-600 font-mono text-sm">NO DATA DETECTED</div>}
      </div>
    </div>
  );
}

export async function FireRadarWidget() {
  const radar = await getFireRadarAlerts();
  
  return (
    <div className="flex flex-col h-full overflow-hidden relative w-full border-l-4 border-red-500/50 pl-4 py-2">
      <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl" />
      <span className="text-red-400 font-bold tracking-widest text-sm uppercase mb-6 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        Fire Radar
      </span>
      <div className="flex flex-col gap-4 overflow-y-auto z-10 w-full pr-2">
        {radar.wasteAlerts.map((w, i) => (
          <Link href={`?drilldown=${w.id}`} key={`w-${i}`} className="bg-black/60 border border-red-900/60 p-4 rounded-xl flex flex-col hover:border-red-500 transition-colors w-full">
            <span className="text-xs font-mono text-red-500 uppercase tracking-tight">CRIT_WASTE</span>
            <span className="text-sm font-bold text-zinc-200 mt-1">Batch {w.batch_id.slice(0,8)}</span>
            <span className="text-xs text-zinc-500 mt-2">Qty: {w.waste_qty}g | Limit Yield: {w.yield_qty}g</span>
          </Link>
        ))}
        {radar.cashAlerts.map((c, i) => (
          <Link href={`?drilldown=${c.id}`} key={`c-${i}`} className="bg-black/60 border border-amber-900/60 p-4 rounded-xl flex flex-col hover:border-amber-500 transition-colors w-full">
             <span className="text-xs font-mono text-amber-500 uppercase tracking-tight">CASH_VARIANCE</span>
             <span className="text-sm font-bold text-zinc-200 mt-1">Shift {c.shift} · {c.date}</span>
             <span className="text-xs text-zinc-500 mt-2">Miss: ${(c.discrepancy/100).toFixed(2)}</span>
          </Link>
        ))}
        {radar.wasteAlerts.length === 0 && radar.cashAlerts.length === 0 && (
          <div className="text-emerald-500 font-mono text-sm flex items-center justify-center h-full my-auto opacity-70">
            [ SECURE PERIMETER ]
          </div>
        )}
      </div>
    </div>
  );
}

export async function LeaderboardWidget() {
  const leaders = await getLeaderboard();
  
  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex justify-between items-center mb-6">
        <span className="text-zinc-400 font-bold tracking-widest text-sm uppercase">Global Leaderboard GRID</span>
        <Link href="?" className="text-xs text-indigo-400 hover:text-white transition-colors uppercase tracking-widest font-mono bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/30">Clear Context</Link>
      </div>

      <div className="w-full flex-1 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 text-xs font-mono text-zinc-500 uppercase tracking-widest bg-zinc-900/20">
              <th className="py-4 px-4 rounded-tl-xl font-medium">Rank</th>
              <th className="py-4 px-4 font-medium">Store Unit</th>
              <th className="py-4 px-4 font-medium text-right">Transactions</th>
              <th className="py-4 px-4 rounded-tr-xl font-medium text-right">Net Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {leaders.map((store, i) => (
              <tr key={i} className="hover:bg-zinc-800/40 transition-colors group">
                <td className="py-4 px-4 text-zinc-400 font-mono">#{i + 1}</td>
                <td className="py-4 px-4">
                  <Link href={`?store=${store.store_id}`} className="text-indigo-300 font-bold hover:text-indigo-400 transition-colors block w-full outline-none">
                    {store.store_id === "global" ? "GLOBAL SYSTEM" : store.store_id.toUpperCase() + " HUB"}
                  </Link>
                </td>
                <td className="py-4 px-4 text-right text-zinc-500 font-mono">{store.total_items} TXNS</td>
                <td className="py-4 px-4 text-right">
                  <span className="font-mono text-emerald-400/90">${(store.revenue / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {leaders.length === 0 && <div className="text-zinc-600 font-mono text-sm text-center py-10 w-full border-t border-zinc-800/50">NO STORE DATA IN CORTEX</div>}
      </div>
    </div>
  );
}

