"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { TrendingUp, AlertOctagon, DollarSign, Package, BarChart3, Banknote } from "lucide-react";
import { GlassCard, VarianceBadge } from "@/components/ui/AntigravityAtoms";
import { AnalyticsSummary, FinancialMetrics } from "@/app/dashboard/actions";
import FinanceDashboard from "./FinanceDashboard";

// Lazy-load recharts-heavy component for fluid tab switching
const AnalyticsDashboard = dynamic(() => import("./AnalyticsDashboard"), {
    ssr: false,
    loading: () => (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
            <div className="col-span-1 lg:col-span-2 bg-white/50 rounded-2xl h-96 border border-slate-100" />
            <div className="bg-white/50 rounded-2xl h-80 border border-slate-100" />
            <div className="bg-white/50 rounded-2xl h-80 border border-slate-100" />
        </div>
    ),
});

// Interface for the data returned by getAuditData
interface AuditData {
    items: any[]; // Using any for now to match current state, or defining type if possible
    totalVarianceCost: number;
    totalSales: number;
    stockEffectiveness: number;
    lastAuditDate: string | null;
}

interface AuditDashboardProps {
    initialData: AuditData;
    analyticsData: AnalyticsSummary;
    financialData: FinancialMetrics;
}

export default function AuditDashboard({ initialData, analyticsData, financialData }: AuditDashboardProps) {
    const { items, totalVarianceCost, totalSales, stockEffectiveness, lastAuditDate } = initialData;
    const [activeTab, setActiveTab] = useState<"AUDIT" | "ANALYTICS" | "FINANCE">("AUDIT");
    const [isPending, startTransition] = useTransition();

    const switchTab = (tab: "AUDIT" | "ANALYTICS" | "FINANCE") => {
        startTransition(() => setActiveTab(tab));
    };

    // Formateadores
    const currency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
    const decimal = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });

    const formattedDate = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div className="min-h-screen bg-canvas-50 p-4 sm:p-8 font-sans text-ink-900">

            {/* ENCABEZADO */}
            <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tight mb-2 text-ink-900 uppercase">
                        Auditoría de Cierre
                    </h1>
                    <p className="text-xl font-medium text-ink-500 capitalize">
                        {formattedDate} • <span className="text-sm font-bold text-ink-400">Última captura: {lastAuditDate ? new Date(lastAuditDate).toLocaleTimeString() : 'Pendiente'}</span>
                    </p>
                </div>

                {/* TABS */}
                <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 inline-flex">
                    <button
                        onClick={() => switchTab("AUDIT")}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "AUDIT" ? "bg-brand-100 text-brand-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                    >
                        Tabla de Control
                    </button>
                    <button
                        onClick={() => switchTab("ANALYTICS")}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "ANALYTICS" ? "bg-brand-100 text-brand-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                    >
                        Análisis Gráfico
                    </button>
                    <button
                        onClick={() => switchTab("FINANCE")}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "FINANCE" ? "bg-emerald-100 text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                    >
                        <span className="flex items-center gap-1.5"><Banknote size={14} /> Finanzas</span>
                    </button>
                </div>
            </header>

            {/* KPI SUPERIORES (Flotantes) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-white/50 backdrop-blur-md shadow-glass rounded-2xl p-6 border border-white/60">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-brand-glow/10 text-brand-DEFAULT rounded-xl">
                            <DollarSign size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-ink-500 uppercase tracking-wider">Ventas Totales</p>
                            <p className="text-2xl font-black text-ink-900">{currency.format(totalSales)}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white/50 backdrop-blur-md shadow-glass rounded-2xl p-6 border border-white/60">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${totalVarianceCost < 0 ? 'bg-critical/10 text-critical' : 'bg-profit/10 text-profit'}`}>
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-ink-500 uppercase tracking-wider">Varianza Financiera</p>
                            <p className={`text-2xl font-black ${totalVarianceCost < -100 ? 'text-critical' : 'text-profit'}`}>
                                {totalVarianceCost > 0 ? '+' : ''}{currency.format(totalVarianceCost)}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white/50 backdrop-blur-md shadow-glass rounded-2xl p-6 border border-white/60">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                            <Package size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-ink-500 uppercase tracking-wider">Efectividad de Stock</p>
                            <p className="text-2xl font-black text-ink-900">{stockEffectiveness}%</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* CONTENIDO PRINCIPAL */}
            <div className={`transition-opacity duration-200 ${isPending ? 'opacity-60' : 'opacity-100'}`}>
                {activeTab === "AUDIT" ? (
                    <GlassCard className="overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                        {items.length === 0 ? (
                            <div className="p-12 text-center">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                                    <Package className="text-slate-400" size={32} />
                                </div>
                                <h3 className="text-lg font-bold text-ink-900">Sin Datos de Auditoría</h3>
                                <p className="text-ink-500">Carga ventas y reportes de stock para ver el análisis.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-3">Ingrediente</th>
                                            <th className="px-6 py-3 text-right">Inicial</th>
                                            <th className="px-6 py-3 text-right text-brand-600 bg-brand-50/50">Entradas (+)</th>
                                            <th className="px-6 py-3 text-right">Teórico</th>
                                            <th className="px-6 py-3 text-right">Real</th>
                                            <th className="px-6 py-3 text-right">Varianza</th>
                                            <th className="px-6 py-3 text-right">Impacto ($)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {items.map((item) => {
                                            const varianceVal = item.variance * item.cost;
                                            return (
                                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center">
                                                            <div>
                                                                <div className="text-sm font-bold text-ink-900">{item.name}</div>
                                                                <div className="text-xs text-ink-500 font-mono">{item.id}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono text-ink-500">
                                                        0.00 <span className="text-xs opacity-70">{item.unit}</span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono text-brand-600 font-bold bg-brand-50/30">
                                                        +{decimal.format(item.purchases)} <span className="text-xs opacity-70">{item.unit}</span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono text-ink-500">
                                                        {decimal.format(item.theoretical)} <span className="text-xs opacity-70">{item.unit}</span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono text-ink-900 font-bold">
                                                        {decimal.format(item.real)} <span className="text-xs opacity-70 text-ink-500">{item.unit}</span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono">
                                                        <VarianceBadge value={item.variance} />
                                                    </td>
                                                    <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-mono font-bold ${varianceVal < -100 ? "text-red-600 bg-red-50" : "text-slate-600"
                                                        }`}>
                                                        {currency.format(varianceVal)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </GlassCard>
                ) : activeTab === "ANALYTICS" ? (
                    <AnalyticsDashboard data={analyticsData} />
                ) : (
                    <FinanceDashboard data={financialData} />
                )}
            </div>
        </div>
    );
}
