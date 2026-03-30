// @ts-nocheck
"use client";

import useSWR from "swr";
import { getGlobalHealth, getLeaderboard, getFireRadarAlerts } from "@/db/analytics-engine";
import { TrendingDown, TrendingUp, AlertTriangle, ArrowDownRight, ArrowUpRight, DollarSign, Percent, Scale, Activity, Flame, ChevronRight, BarChart3, Store } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

// Formateadores
const formatCurrency = (cents: number) => `$ ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatPct = (num: number) => `${num.toFixed(1)}%`;

export function HealthBarClient({ storeId }: { storeId?: string }) {
  const fetcher = async () => await getGlobalHealth(storeId);
  const { data, isLoading } = useSWR(["globalHealth", storeId], fetcher, { refreshInterval: 10000 });

  if (isLoading || !data) {
    return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full h-[140px] animate-pulse">
      {[1,2,3,4].map(i => <div key={i} className="bg-white/50 rounded-2xl ring-1 ring-slate-200" />)}
    </div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      {/* 1. Dinero Real */}
      <motion.div whileHover={{ y: -6 }} className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-100 relative group cursor-default overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[4px] bg-emerald-400 group-hover:bg-emerald-500 transition-colors" />
        <div className="flex items-center gap-4 mb-4 mt-1">
          <div className="w-12 h-12 bg-emerald-50 rounded-[14px] flex items-center justify-center border border-emerald-100 group-hover:scale-110 transition-transform">
            <DollarSign className="text-emerald-500 w-6 h-6" />
          </div>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Dinero Real</p>
        </div>
        <div className="mt-2"><h3 className="text-3xl font-black text-slate-900 tracking-tighter tabular-nums">{formatCurrency(data.totalRevenue)}</h3></div>
      </motion.div>

      {/* 2. Márgenes */}
      <motion.div whileHover={{ y: -6 }} className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-100 relative group cursor-default overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[4px] bg-blue-400 group-hover:bg-blue-500 transition-colors" />
        <div className="flex items-center gap-4 mb-4 mt-1">
          <div className="w-12 h-12 bg-blue-50 rounded-[14px] flex items-center justify-center border border-blue-100 group-hover:scale-110 transition-transform">
            <Percent className="text-blue-500 w-6 h-6" />
          </div>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Margen Bruto</p>
        </div>
        <div className="mt-2"><h3 className="text-3xl font-black text-slate-900 tracking-tighter tabular-nums">{formatPct(data.grossMarginPct)}</h3></div>
      </motion.div>

      {/* 3. Varianza */}
      <motion.div whileHover={{ y: -6 }} className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-100 relative group cursor-default overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[4px] bg-rose-400 group-hover:bg-rose-500 transition-colors" />
        <div className="flex items-center gap-4 mb-4 mt-1">
          <div className="w-12 h-12 bg-rose-50 rounded-[14px] flex items-center justify-center border border-rose-100 group-hover:scale-110 transition-transform">
            <TrendingDown className="text-rose-500 w-6 h-6" />
          </div>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Varianza Log.</p>
        </div>
        <div className="mt-2"><h3 className="text-3xl font-black text-slate-900 tracking-tighter tabular-nums">{formatCurrency(data.variance)}</h3></div>
      </motion.div>

      {/* 4. Liquidez */}
      <motion.div whileHover={{ y: -6 }} className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-100 relative group cursor-default overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[4px] bg-indigo-400 group-hover:bg-indigo-500 transition-colors" />
        <div className="flex items-center gap-4 mb-4 mt-1">
          <div className="w-12 h-12 bg-indigo-50 rounded-[14px] flex items-center justify-center border border-indigo-100 group-hover:scale-110 transition-transform">
            <Scale className="text-indigo-500 w-6 h-6" />
          </div>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Liquidez Neta</p>
        </div>
        <div className="mt-2"><h3 className="text-3xl font-black text-slate-900 tracking-tighter tabular-nums">{formatCurrency(data.liquidity)}</h3></div>
      </motion.div>
    </div>
  );
}

export function FireRadar() {
  const fetcher = async () => await getFireRadarAlerts();
  const { data, isLoading } = useSWR(["fireRadar"], fetcher, { refreshInterval: 5000 });

  return (
    <div className="bg-white rounded-2xl p-6 h-full flex flex-col relative overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200">
      <div className="absolute -right-10 -bottom-10 opacity-5 pointer-events-none"><Flame w={200} h={200} className="text-rose-500" /></div>
      
      <div className="flex items-center gap-2 mb-6 z-10 border-b border-slate-100 pb-4">
        <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
        <h3 className="text-slate-900 font-bold tracking-tight text-lg">Fire Radar</h3>
      </div>

      <div className="space-y-4 z-10 flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
        {isLoading && <div className="h-16 animate-pulse bg-slate-50 rounded-xl border border-slate-100" />}
        {!isLoading && data?.wasteAlerts.map((a: any) => (
          <Link key={a.id} href="/inventory" className="block bg-rose-50 border border-rose-200 rounded-xl p-4 hover:bg-rose-100 transition-colors group shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                   <AlertTriangle className="text-rose-500 w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Merma Crítica</p>
                  <p className="text-[11px] text-slate-500 font-medium">Yield: {a.yield_qty} | Waste: <span className="text-rose-600 font-bold">{a.waste_qty}</span></p>
                </div>
              </div>
              <ChevronRight className="text-rose-300 w-5 h-5 group-hover:translate-x-1 group-hover:text-rose-500 transition-all" />
            </div>
          </Link>
        ))}
        {!isLoading && data?.cashAlerts.map((a: any) => (
          <Link key={a.id} href="/treasury" className="block bg-amber-50 border border-amber-200 rounded-xl p-4 hover:bg-amber-100 transition-colors group shadow-sm">
             <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                   <AlertTriangle className="text-amber-500 w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Discrepancia Caja</p>
                  <p className="text-[11px] text-slate-500 font-medium">Turno: {a.shift} | <span className="text-amber-600 font-bold">{formatCurrency(a.discrepancy)}</span></p>
                </div>
              </div>
              <ChevronRight className="text-amber-300 w-5 h-5 group-hover:translate-x-1 group-hover:text-amber-500 transition-all" />
            </div>
          </Link>
        ))}
        {!isLoading && data?.wasteAlerts.length === 0 && data?.cashAlerts.length === 0 && (
          <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-100">
            <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-bold tracking-widest uppercase">Operación Nominal</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function LeaderboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStore = searchParams.get("storeId");

  const fetcher = async () => await getLeaderboard();
  const { data, isLoading } = useSWR(["leaderboard"], fetcher, { refreshInterval: 15000 });

  return (
    <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 overflow-hidden flex flex-col h-full group transition-all hover:border-blue-400/50 hover:shadow-md">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
         <h3 className="font-bold text-slate-900 tracking-tight text-xl">Leaderboard Topológico</h3>
         <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:scale-110 transition-transform">
           <BarChart3 className="w-5 h-5" />
         </div>
      </div>
      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-[10px] text-slate-500 uppercase tracking-widest bg-slate-50/50">
            <tr>
              <th className="px-6 py-3 font-bold">Sucursal</th>
              <th className="px-6 py-3 font-bold text-right">Ingresos</th>
              <th className="px-6 py-3 font-bold text-right">Items Movidos</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-xs animate-pulse">Cargando métricas de sucursales...</td></tr>
            ) : data?.map((row: any, i: number) => {
               const isActive = currentStore === row.store_id || (!currentStore && row.store_id === 'centro');
               const name = row.store_id === 'centro' ? 'Pizza Centro' : row.store_id === 'funes' ? 'Burger Funes' : row.store_id;
               
               return (
                <tr 
                  key={row.store_id} 
                  onClick={() => router.push(`/command-center?storeId=${row.store_id}`)}
                  className={`border-b border-slate-50 last:border-0 cursor-pointer transition-colors ${isActive ? 'bg-indigo-50/50 hover:bg-indigo-50' : 'hover:bg-slate-50'}`}
                >
                  <td className="px-6 py-4 font-semibold text-slate-900 flex items-center gap-3">
                    <span className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${i===0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{i+1}</span>
                    {name}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-emerald-600 font-mono tracking-tight">{formatCurrency(row.revenue)}</td>
                  <td className="px-6 py-4 text-right text-slate-500 font-mono">{row.total_items}</td>
                  <td className="px-6 py-4 text-right">
                    {isActive ? <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-1 rounded font-bold tracking-widest uppercase">Visualizando</span> : <ChevronRight className="w-4 h-4 text-slate-400 inline-block" />}
                  </td>
                </tr>
               )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

