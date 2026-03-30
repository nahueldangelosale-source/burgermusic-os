"use client";

import { GlassCard, VarianceBadge } from "@/components/ui/AntigravityAtoms";
import { BarChart3, DollarSign, Package, PieChart, TrendingUp } from "lucide-react";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart as RechartsPie,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Interface for the data returned by getAuditData
interface AuditData {
  items: any[];
  totalVarianceCost: number;
  totalSales: number;
  stockEffectiveness: number;
  lastAuditDate: string | null;
}

interface AuditDashboardProps {
  initialData: AuditData;
  analyticsData: any;
}

export default function AuditDashboard({ initialData, analyticsData }: AuditDashboardProps) {
  const { items, totalVarianceCost, totalSales, stockEffectiveness, lastAuditDate } = initialData;
  const [activeTab, setActiveTab] = useState<"control" | "stats">("control");

  const currency = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
  const decimal = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
  const formattedDate = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-canvas-50 p-4 sm:p-10 font-sans text-ink-900">
      {/* ENCABEZADO PREMIUM */}
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black tracking-tight mb-3 text-ink-900 uppercase italic">
            Control <span className="text-brand">Inventario</span>
          </h1>
          <div className="flex items-center gap-3">
            <p className="text-lg font-bold text-ink-500 capitalize">{formattedDate}</p>
            <span className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
            <span className="text-sm font-black text-brand uppercase tracking-widest">
              {lastAuditDate
                ? `Captura: ${new Date(lastAuditDate).toLocaleTimeString()}`
                : "Captura Pendiente"}
            </span>
          </div>
        </div>
      </header>

      {/* KPI GRID - REUSE PREMIUM STYLE FROM DASHBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <GlassCard className="p-8 border-t-8 border-t-slate-900">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
            Ventas Brutas
          </p>
          <div className="flex items-center justify-between">
            <p className="text-3xl font-black text-ink-900 tracking-tighter">
              {currency.format(totalSales)}
            </p>
            <div className="p-2 bg-slate-100 rounded-lg text-slate-400">
              <DollarSign size={20} />
            </div>
          </div>
        </GlassCard>

        <GlassCard
          className={`p-8 border-t-8 ${totalVarianceCost < -100 ? "border-t-critical shadow-critical-glow" : "border-t-profit"}`}
        >
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
            Pérdida Financiera
          </p>
          <div className="flex items-center justify-between">
            <p
              className={`text-3xl font-black tracking-tighter ${totalVarianceCost < -100 ? "text-critical" : "text-profit"}`}
            >
              {totalVarianceCost > 0 ? "+" : ""}
              {currency.format(totalVarianceCost)}
            </p>
            <div
              className={`p-2 rounded-lg ${totalVarianceCost < -100 ? "bg-critical/10 text-critical" : "bg-profit/10 text-profit"}`}
            >
              <TrendingUp size={20} />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-8 border-t-8 border-t-brand">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
            Efectividad de Conteo
          </p>
          <div className="flex items-center justify-between">
            <p className="text-3xl font-black text-ink-900 tracking-tighter">
              {stockEffectiveness}%
            </p>
            <div className="p-2 bg-brand/10 text-brand rounded-lg">
              <Package size={20} />
            </div>
          </div>
        </GlassCard>
      </div>

      {/* TAB SWITCHER */}
      <div className="flex border-b border-slate-200 mb-8 gap-8 px-4">
        <button
          onClick={() => setActiveTab("control")}
          className={`pb-4 text-sm font-black uppercase tracking-widest transition-colors relative ${activeTab === "control" ? "text-brand" : "text-slate-400 hover:text-slate-600"}`}
        >
          <div className="flex items-center gap-2">
            <Package size={16} /> Control de Mermas
          </div>
          {activeTab === "control" && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("stats")}
          className={`pb-4 text-sm font-black uppercase tracking-widest transition-colors relative ${activeTab === "stats" ? "text-blue-600" : "text-slate-400 hover:text-slate-600"}`}
        >
          <div className="flex items-center gap-2">
            <BarChart3 size={16} /> Estadísticas y Analítica
          </div>
          {activeTab === "stats" && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full" />
          )}
        </button>
      </div>

      {/* MAIN CONTENT AREA */}
      <GlassCard className="overflow-hidden shadow-2xl border-0 p-0 rounded-3xl animate-in fade-in duration-500">
        {activeTab === "control" ? (
          items.length === 0 ? (
            <div className="p-24 text-center">
              <Package className="mx-auto text-slate-200 mb-6" size={80} />
              <h3 className="text-2xl font-black text-ink-900 uppercase">
                Sin Actividad Registrada
              </h3>
              <p className="text-slate-400 font-bold mt-2">
                Carga reportes de stock para activar el centro de análisis.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em]">
                  <tr>
                    <th className="px-8 py-6">Insumo / Referencia</th>
                    <th className="px-6 py-6 text-right">Inicial</th>
                    <th className="px-6 py-6 text-right bg-brand/10 text-brand">Compras (+)</th>
                    <th className="px-6 py-6 text-right">Teórico</th>
                    <th className="px-6 py-6 text-right font-black">Real</th>
                    <th className="px-6 py-6 text-right">Varianza</th>
                    <th className="px-8 py-6 text-right">Fricción ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white/50">
                  {items.map((item) => {
                    const varianceVal = item.variance * item.cost;
                    return (
                      <tr key={item.id} className="hover:bg-brand/5 transition-all group">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center font-black text-slate-400 group-hover:border-brand transition-colors">
                              {item.name[0]}
                            </div>
                            <div>
                              <div className="text-sm font-black text-ink-900">{item.name}</div>
                              <div className="text-[10px] text-slate-400 font-black uppercase tracking-tight italic">
                                ID: {item.id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right font-mono text-slate-400 font-bold">
                          0.00 <span className="text-[10px] opacity-70">{item.unit}</span>
                        </td>
                        <td className="px-6 py-5 text-right font-mono text-brand font-black bg-brand/5 group-hover:bg-brand/10 transition-colors">
                          +{decimal.format(item.purchases)}{" "}
                          <span className="text-[10px] opacity-70">{item.unit}</span>
                        </td>
                        <td className="px-6 py-5 text-right font-mono text-slate-400 font-bold">
                          {decimal.format(item.theoretical)}{" "}
                          <span className="text-[10px] opacity-70">{item.unit}</span>
                        </td>
                        <td className="px-6 py-5 text-right font-mono text-ink-900 font-black text-lg">
                          {decimal.format(item.real)}{" "}
                          <span className="text-[10px] text-slate-400">{item.unit}</span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <VarianceBadge value={item.variance} />
                        </td>
                        <td
                          className={`px-8 py-5 text-right font-mono font-black text-base ${varianceVal < -100 ? "text-critical" : "text-slate-900"}`}
                        >
                          {currency.format(varianceVal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 bg-slate-50/50">
            {/* Ventas Trend Area Chart */}
            <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                <TrendingUp size={16} /> Tendencia de Ventas (Cash Flow)
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analyticsData.salesTrend}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" hide />
                    <YAxis hide />
                    <Tooltip formatter={(val: any) => currency.format(val || 0)} />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#10b981"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorSales)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Products Bar Chart */}
            <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                <Package size={16} /> Productos de Alta Rotación
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.topProducts} layout="vertical" margin={{ left: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={100}
                      tick={{ fontSize: 10, fill: "#64748b", fontWeight: "bold" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip formatter={(val: any) => [val || 0, "Unidades"]} />
                    <Bar dataKey="quantity" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
