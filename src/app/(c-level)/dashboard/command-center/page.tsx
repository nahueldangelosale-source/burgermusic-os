import React from 'react';
import Link from 'next/link';
import { Metric, Flex, BadgeDelta, AreaChart } from '@tremor/react';
import { getGlobalHealth, getTopSellingItems, getLeaderboard, getFireRadarAlerts } from '@/db/analytics-engine';
import { ClientBarList } from './ClientBarList';
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CommandCenterPage() {
  const health = await getGlobalHealth();
  const topItems = await getTopSellingItems();
  const storeLeaderboard = await getLeaderboard();
  const radar = await getFireRadarAlerts();

  // Motor O(1) Edge-First: Data inmutada y pre-procesada de los módulos integrados
  const kpiData = [
    { 
      title: "Revenue Global Neto", 
      metric: Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(health.totalRevenue / 100), 
      delta: "Ventas Registradas", 
      deltaType: "increase" as const,
      subtitle: "Módulo Ventas (Opex)",
      color: "blue",
      data: [{ date: "S1", value: 0 }], // Simplificado
      href: "/dashboard/treasury"
    },
    { 
      title: "COGS Total (Costo)", 
      metric: Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(health.cogs / 100), 
      delta: "Inventario Drenado", 
      deltaType: "moderateDecrease" as const,
      subtitle: "Motor BOM",
      color: "emerald",
      data: [{ date: "S1", value: 0 }],
      href: "/kitchen"
    },
    { 
      title: "Margen Bruto O(1)", 
      metric: `${health.grossMarginPct.toFixed(2)}%`, 
      delta: "+2.1%", 
      deltaType: "increase" as const,
      subtitle: "Rentabilidad Directa",
      color: "indigo",
      data: [{ date: "S1", value: 0 }],
      href: "/dashboard/treasury"
    },
    { 
      title: "SKU Estrella (Más Vol.)", 
      metric: (topItems[0]?.sku || "N/A").replace(/^PRD_/, '').replace(/^SRV_/, '').replace(/_/g, ' '), 
      delta: `${topItems[0]?.total_units || 0} unidades`, 
      deltaType: "increase" as const,
      subtitle: "Top Seller DB",
      color: "cyan",
      data: [{ date: "S1", value: 0 }],
      href: "/dashboard/supply"
    },
  ];

  const topSellingData = topItems.map(item => ({
    name: item.sku,
    value: item.total_units,
    color: 'emerald'
  }));

  const branchesData = storeLeaderboard.map((store: any) => ({
    name: store.store_id,
    value: store.revenue / 100,
    color: 'indigo'
  }));

  const fireRadarAlerts = [
    ...radar.wasteAlerts.map(w => ({
      id: w.id, type: w.type, message: `Lote ${w.batch_id} con exceso de merma irreversible.`, severity: "critical", link: "/kitchen"
    })),
    ...radar.cashAlerts.map(c => ({
      id: c.id, type: c.type, message: `Descuadre ${c.discrepancy} ARS en fecha ${c.date} (Suc. ${c.store_id || 'Centro'})`, severity: "high", link: "/dashboard/treasury"
    })),
    // Alertas por defecto si está vacío
    ...(radar.wasteAlerts.length === 0 && radar.cashAlerts.length === 0 ? [
       { id: "M1", type: "SISTEMA ESTABLE", message: "Motor Analítico FinOps O(1) Operando sin Discrepancias", severity: "medium", link: "/dashboard" }
    ] : [])
  ];

  return (
    <div className="min-h-screen bg-[oklch(0.95_0.02_250)] p-6 lg:p-10 font-sans selection:bg-blue-500/30">
      <header className="mb-10 flex justify-between items-end border-b border-zinc-200/50 pb-6 group">
        <div>
          <h1 className="text-4xl font-black flex items-center gap-4 text-[oklch(0.15_0.02_250)] tracking-tighter">
            <span className="w-5 h-10 bg-slate-800 rounded-sm inline-block shadow-[0_4px_14px_rgba(0,0,0,0.25)] group-hover:scale-y-110 transition-transform duration-300"></span>
            C-LEVEL COMMAND CENTER
          </h1>
          <p className="text-[oklch(0.45_0.02_250)] font-mono text-sm tracking-widest uppercase mt-3 hover:text-slate-800 transition-colors">
            Control Estructural · Edge-First O(1) Integration
          </p>
        </div>
      </header>

      {/* Grid General 12 Columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* ZONA 1: KPIs Integrados (12 cols) */}
        <div className="col-span-1 lg:col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 tracking-tight">
          {kpiData.map((item) => (
            <Link key={item.title} href={item.href} prefetch={true} className="block group relative bg-[oklch(0.98_0.01_250)] p-6 rounded-3xl ring-1 ring-zinc-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] flex flex-col border-t-4 border-t-slate-800 hover:-translate-y-1.5 transition-all duration-300 ease-out cursor-pointer overflow-hidden">
              {/* Subtle background glow on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              
              <Flex alignItems="start" className="mb-3 relative z-10">
                <span className="font-mono text-[11px] tracking-widest text-slate-500 font-bold uppercase">{item.title}</span>
                <BadgeDelta deltaType={item.deltaType} size="xs" className="rounded-full shadow-sm">{item.delta}</BadgeDelta>
              </Flex>
              
              <div className="mt-1 truncate relative z-10 flex items-center justify-between">
                <Metric className="text-[oklch(0.15_0.02_250)] tracking-tighter text-2xl lg:text-3xl font-black group-hover:text-black transition-colors truncate pr-2">{item.metric}</Metric>
                <span className="text-zinc-300 group-hover:text-slate-800 group-hover:translate-x-1 transition-all text-xl flex-shrink-0">→</span>
              </div>

              {/* Sparkline Chart */}
              <div className="h-14 w-full mt-4 opacity-70 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                <AreaChart 
                  data={item.data} 
                  index="date" 
                  categories={["value"]} 
                  colors={[item.color as any]} 
                  className="h-full w-full" 
                  showLegend={false} 
                  showYAxis={false} 
                  showXAxis={false} 
                  showGridLines={false}
                  curveType="monotone"
                />
              </div>

              <span className="text-xs font-mono text-[oklch(0.45_0.02_250)] mt-4 relative z-10 font-bold">Ref: {item.subtitle}</span>
            </Link>
          ))}
        </div>

        {/* ZONA 2: Leaderboard Sucursales y SKUs (8 cols) */}
        <div className="col-span-1 lg:col-span-8 flex flex-col gap-6">
          <Link href="/dashboard/treasury" prefetch={true} className="block bg-[oklch(0.98_0.01_250)] rounded-3xl overflow-hidden ring-1 ring-zinc-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1 p-8 flex-1 transition-all duration-300 group cursor-pointer">
            <div className="flex justify-between items-start mb-3">
              <h2 className="font-mono uppercase tracking-widest text-[oklch(0.45_0.02_250)] font-bold group-hover:text-slate-800 transition-colors">Volumen por Sucursal (Revenue)</h2>
              <span className="text-zinc-300 group-hover:text-slate-800 group-hover:translate-x-1 transition-all font-bold text-2xl">→</span>
            </div>
            <p className="text-sm text-[oklch(0.45_0.02_250)] mb-10 leading-relaxed font-medium">Lectura desde Drizzle (Fact Sales).</p>
            <div className="mt-4 pointer-events-none">
              <ClientBarList 
                data={branchesData} 
                className="w-full font-semibold text-[oklch(0.15_0.02_250)]"
                type="currency"
              />
            </div>
          </Link>
          
          <Link href="/dashboard/supply" prefetch={true} className="block bg-[oklch(0.98_0.01_250)] rounded-3xl overflow-hidden ring-1 ring-zinc-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 flex-1 transition-all duration-300 group">
             <div className="flex justify-between items-start mb-3">
              <h2 className="font-mono uppercase tracking-widest text-[oklch(0.45_0.02_250)] font-bold group-hover:text-slate-800 transition-colors">Artículos Más Vendidos (Cantidades)</h2>
            </div>
            <div className="mt-4 pointer-events-none">
              <ClientBarList 
                data={topSellingData.map(d => ({ ...d, name: d.name.replace(/^PRD_/, '').replace(/^SRV_/, '').replace(/_/g, ' ') }))} 
                className="w-full font-semibold text-emerald-900" 
                type="units"
              />
            </div>
          </Link>
        </div>

        {/* ZONA 3: Radar de Fuego (4 cols) */}
        <div className="col-span-1 lg:col-span-4 flex flex-col">
          <div className="bg-[oklch(0.98_0.01_250)] rounded-3xl overflow-hidden ring-1 ring-red-500/20 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_15px_40px_rgba(239,68,68,0.15)] p-8 flex-1 border-t-4 border-t-red-500 transition-all duration-300 relative">
            <h2 className="font-mono uppercase tracking-widest text-red-600 mb-3 font-bold flex items-center gap-3 relative z-10">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] shadow-[0_0_15px_rgba(239,68,68,0.8)]"></span>
              Radar de Alertas
            </h2>
            <p className="text-sm text-[oklch(0.45_0.02_250)] mb-8 font-medium relative z-10">Triggers automáticos procedentes de módulos periféricos.</p>

            <div className="space-y-4 relative z-10">
              {fireRadarAlerts.map((alert) => (
                <Link key={String(alert.id)} href={alert.link} className="block group/alert">
                  <div className={`p-5 rounded-2xl border transition-all duration-300 transform group-hover/alert:translate-x-1 group-hover/alert:shadow-md ${
                    alert.severity === 'critical' ? 'bg-red-50/70 border-red-200/80 hover:bg-red-100/80 hover:border-red-300' : 
                    alert.severity === 'high' ? 'bg-amber-50/70 border-amber-200/80 hover:bg-amber-100/80 hover:border-amber-300' : 
                    'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/80 hover:border-slate-300'
                  }`}>
                    <div className="flex justify-between items-center mb-3">
                      <span className={`text-[11px] font-black uppercase tracking-widest ${
                        alert.severity === 'critical' ? 'text-red-700' : 
                        alert.severity === 'high' ? 'text-amber-700' : 'text-slate-700'
                      }`}>
                        {String(alert.type)}
                      </span>
                      <span className="text-zinc-400 group-hover/alert:text-[oklch(0.15_0.02_250)] transition-transform group-hover/alert:translate-x-1 font-bold">→</span>
                    </div>
                    <p className={`text-[13px] tracking-tight font-semibold leading-relaxed ${
                      alert.severity === 'critical' ? 'text-red-950' : 
                      alert.severity === 'high' ? 'text-amber-950' : 'text-slate-900'
                    }`}>
                      {alert.message}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
            
            {/* Ambient background glow */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-red-500/5 rounded-full blur-3xl pointer-events-none"></div>
          </div>
        </div>

      </div>
    </div>
  );
}
