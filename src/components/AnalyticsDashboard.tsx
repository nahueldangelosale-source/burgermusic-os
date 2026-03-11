"use client";

import React from "react";
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from "recharts";
import { GlassCard } from "@/components/ui/AntigravityAtoms";
import { AnalyticsSummary } from "@/app/dashboard/actions";

// Colors
const COLORS = ["#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

export default function AnalyticsDashboard({ data }: { data: AnalyticsSummary }) {
    const currency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* 1. SALES TREND (Line Chart) */}
            <GlassCard className="col-span-1 lg:col-span-2 p-6">
                <h3 className="text-lg font-black text-ink-900 mb-4 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-8 bg-brand-500 rounded-full"></span>
                    Tendencia de Ventas (30 Días)
                </h3>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.salesTrend}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 12 }}
                                tickFormatter={(val) => new Date(val).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                            />
                            <YAxis
                                tickFormatter={(val) => `$${val / 1000}k`}
                            />
                            <Tooltip
                                formatter={(val: any) => currency.format(val as number)}
                                labelFormatter={(label) => new Date(label).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                            />
                            <Line
                                type="monotone"
                                dataKey="amount"
                                stroke="#2563EB"
                                strokeWidth={4}
                                dot={{ r: 4, strokeWidth: 2 }}
                                activeDot={{ r: 8 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </GlassCard>

            {/* 2. TOP PRODUCTS (Bar Chart) */}
            <GlassCard className="p-6">
                <h3 className="text-lg font-black text-ink-900 mb-4 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-8 bg-emerald-500 rounded-full"></span>
                    Top 5 Productos
                </h3>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.topProducts} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                            <XAxis type="number" hide />
                            <YAxis
                                dataKey="name"
                                type="category"
                                width={100}
                                tick={{ fontSize: 11, fontWeight: 600 }}
                            />
                            <Tooltip
                                cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                formatter={(val: any) => [val, 'Unidades']}
                            />
                            <Bar dataKey="quantity" fill="#10B981" radius={[0, 4, 4, 0]} barSize={32} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </GlassCard>

            {/* 3. COST COMPOSITION (Donut Chart) */}
            <GlassCard className="p-6">
                <h3 className="text-lg font-black text-ink-900 mb-4 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-8 bg-amber-500 rounded-full"></span>
                    Composición de Stock ($)
                </h3>
                <div className="h-80 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data.categoryComposition}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {data.categoryComposition.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(val: any) => currency.format(val as number)}
                            />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </GlassCard>

        </div>
    );
}
