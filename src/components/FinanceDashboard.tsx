// src/components/FinanceDashboard.tsx
// Dashboard de Flujo de Caja — Visualización de cierres de caja diarios
"use client";

import { Banknote, CreditCard, Truck, AlertTriangle, TrendingDown, TrendingUp, CheckCircle } from "lucide-react";
import { GlassCard } from "@/components/ui/AntigravityAtoms";
import type { FinancialMetrics } from "@/app/dashboard/actions";

const currency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

export default function FinanceDashboard({ data }: { data: FinancialMetrics }) {
    if (data.closureCount === 0) {
        return (
            <div className="p-12 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                    <Banknote className="text-slate-400" size={32} />
                </div>
                <h3 className="text-lg font-bold text-ink-900">Sin Datos Financieros</h3>
                <p className="text-ink-500 max-w-md mx-auto mt-2">
                    Ejecutá la sincronización con Google Sheets para cargar los cierres de caja.
                    <br />
                    <code className="text-xs bg-slate-100 px-2 py-1 rounded mt-2 inline-block">POST /api/sync/sales</code>
                </p>
            </div>
        );
    }

    const varianceColor = (v: number | null) => {
        if (v === null) return "text-slate-400";
        if (v < 0) return "text-red-600";
        if (v > 0) return "text-emerald-600";
        return "text-slate-600";
    };

    const varianceBg = (v: number | null) => {
        if (v === null) return "bg-slate-50 border-slate-200";
        if (v < 0) return "bg-red-50/50 border-red-200";
        return "bg-emerald-50/50 border-emerald-200";
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* KPI CARDS - FILA SUPERIOR */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* INGRESOS DEL MES */}
                <div className="bg-white/50 backdrop-blur-md shadow-glass rounded-2xl p-6 border border-white/60">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-brand-glow/10 text-brand-DEFAULT rounded-xl">
                            <Banknote size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-ink-500 uppercase tracking-wider">
                                Ingresos {data.currentMonth}
                            </p>
                            <p className="text-2xl font-black text-ink-900">
                                {currency.format(data.monthlyRevenue)}
                            </p>
                            <p className="text-xs text-ink-400 mt-0.5">
                                {data.closureCount} cierres de caja
                            </p>
                        </div>
                    </div>
                </div>

                {/* DISTRIBUCIÓN DE PAGOS */}
                <div className="bg-white/50 backdrop-blur-md shadow-glass rounded-2xl p-6 border border-white/60">
                    <p className="text-sm font-bold text-ink-500 uppercase tracking-wider mb-4">
                        Distribución de Pagos
                    </p>

                    {/* Barra de progreso stacked */}
                    <div className="flex h-3 rounded-full overflow-hidden mb-4 bg-slate-100">
                        {data.cashPct > 0 && (
                            <div
                                className="bg-emerald-500 transition-all duration-500"
                                style={{ width: `${data.cashPct}%` }}
                                title={`Efectivo: ${data.cashPct}%`}
                            />
                        )}
                        {data.mpPct > 0 && (
                            <div
                                className="bg-blue-500 transition-all duration-500"
                                style={{ width: `${data.mpPct}%` }}
                                title={`MercadoPago: ${data.mpPct}%`}
                            />
                        )}
                        {data.deliveryPct > 0 && (
                            <div
                                className="bg-orange-500 transition-all duration-500"
                                style={{ width: `${data.deliveryPct}%` }}
                                title={`Delivery: ${data.deliveryPct}%`}
                            />
                        )}
                    </div>

                    <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between items-center">
                            <span className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                                <Banknote size={14} className="text-emerald-600" />
                                <span className="text-ink-600 font-medium">Efectivo</span>
                            </span>
                            <span className="font-bold text-ink-900">{data.cashPct}% — {currency.format(data.totalCash)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                                <CreditCard size={14} className="text-blue-600" />
                                <span className="text-ink-600 font-medium">MercadoPago</span>
                            </span>
                            <span className="font-bold text-ink-900">{data.mpPct}% — {currency.format(data.totalMp)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
                                <Truck size={14} className="text-orange-600" />
                                <span className="text-ink-600 font-medium">Delivery</span>
                            </span>
                            <span className="font-bold text-ink-900">{data.deliveryPct}% — {currency.format(data.totalDelivery)}</span>
                        </div>
                    </div>
                </div>

                {/* ALERTA DE CAJA */}
                <div className={`backdrop-blur-md shadow-glass rounded-2xl p-6 border ${varianceBg(data.yesterdayVariance)}`}>
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${
                            data.yesterdayVariance === null
                                ? "bg-slate-100 text-slate-400"
                                : data.yesterdayVariance < 0
                                    ? "bg-red-100 text-red-600"
                                    : "bg-emerald-100 text-emerald-600"
                        }`}>
                            {data.yesterdayVariance === null ? (
                                <AlertTriangle size={24} />
                            ) : data.yesterdayVariance < 0 ? (
                                <TrendingDown size={24} />
                            ) : (
                                <CheckCircle size={24} />
                            )}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-ink-500 uppercase tracking-wider">
                                Caja último cierre
                            </p>
                            {data.yesterdayVariance === null ? (
                                <p className="text-lg font-bold text-slate-400">Sin datos</p>
                            ) : (
                                <>
                                    <p className={`text-2xl font-black ${varianceColor(data.yesterdayVariance)}`}>
                                        {data.yesterdayVariance > 0 ? "+" : ""}{currency.format(data.yesterdayVariance)}
                                    </p>
                                    <p className="text-xs text-ink-400 mt-0.5">
                                        {data.yesterdayVariance < 0
                                            ? "⚠️ Faltan fondos en caja"
                                            : data.yesterdayVariance > 0
                                                ? "Sobran fondos en caja"
                                                : "Caja cuadrada ✓"
                                        }
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* TENDENCIA DE VARIANZA (últimos 7 días) */}
            {data.varianceTrend.length > 0 && (
                <GlassCard className="p-6">
                    <h3 className="text-sm font-bold text-ink-500 uppercase tracking-wider mb-4">
                        Tendencia de Diferencias de Caja — Últimos {data.varianceTrend.length} días
                    </h3>
                    <div className="grid grid-cols-7 gap-2">
                        {data.varianceTrend.map((day, i) => {
                            const dateLabel = day.date.split("-").slice(1).join("/");
                            const isNegative = day.variance < 0;
                            return (
                                <div
                                    key={i}
                                    className={`rounded-xl p-3 text-center transition-all border ${
                                        isNegative
                                            ? "bg-red-50 border-red-200"
                                            : day.variance > 0
                                                ? "bg-emerald-50 border-emerald-200"
                                                : "bg-slate-50 border-slate-200"
                                    }`}
                                >
                                    <p className="text-xs font-bold text-ink-400 mb-1">{dateLabel}</p>
                                    <p className={`text-sm font-black ${varianceColor(day.variance)}`}>
                                        {day.variance > 0 ? "+" : ""}
                                        {currency.format(day.variance)}
                                    </p>
                                    <div className="mt-1">
                                        {isNegative
                                            ? <TrendingDown size={14} className="text-red-400 mx-auto" />
                                            : <TrendingUp size={14} className="text-emerald-400 mx-auto" />
                                        }
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </GlassCard>
            )}
        </div>
    );
}
