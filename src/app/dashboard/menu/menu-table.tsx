"use client";

import { useState } from "react";
import { type MenuMarginItem } from "@/lib/intelligence/profitability"; // Ensure this path is correct
import { updateProductFinancials } from "./actions";
import { GlassCard } from "@/components/ui/AntigravityAtoms";
import { Loader2, TrendingUp, TrendingDown, Edit2, Check, X } from "lucide-react";

interface MenuTableProps {
    items: MenuMarginItem[];
}

export function MenuTable({ items }: MenuTableProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<{ price: string, target: string } | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount / 100);
    };

    const handleEdit = (item: MenuMarginItem) => {
        setEditingId(item.id);
        setEditValues({
            price: (item.sellingPrice / 100).toString(),
            target: item.targetMargin.toString()
        });
    };

    const handleSave = async (item: MenuMarginItem) => {
        if (!editValues) return;
        setIsSaving(true);
        const newPriceCents = Math.round(parseFloat(editValues.price) * 100);
        const newTarget = parseInt(editValues.target);

        await updateProductFinancials(item.id, newPriceCents, newTarget);

        setIsSaving(false);
        setEditingId(null);
        setEditValues(null);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "DANGER": return "bg-red-50 text-red-700 border-red-200";
            case "WARNING": return "bg-orange-50 text-orange-700 border-orange-200";
            case "HEALTHY": return "bg-green-50 text-green-700 border-green-200";
            default: return "bg-slate-50 text-slate-700";
        }
    };

    return (
        <GlassCard className="overflow-hidden p-0">
            <table className="w-full text-sm text-left">
                <thead className="text-xs font-bold text-slate-400 uppercase bg-slate-50/50">
                    <tr>
                        <th className="px-6 py-4">Producto</th>
                        <th className="px-6 py-4 text-right">Costo Vivo</th>
                        <th className="px-6 py-4 text-right">PVP Actual</th>
                        <th className="px-6 py-4 text-right">Margen %</th>
                        <th className="px-6 py-4 text-center">Estado</th>
                        <th className="px-6 py-4 text-center">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {items.map((item) => {
                        const isEditing = editingId === item.id;
                        return (
                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4 font-medium text-ink-900">
                                    {item.name}
                                    <div className="text-xs font-mono text-slate-400">{item.id}</div>
                                </td>

                                {/* COSTO (Live Recursive) */}
                                <td className="px-6 py-4 text-right font-mono text-slate-600">
                                    {formatCurrency(item.cost)}
                                </td>

                                {/* PVP (Editable) */}
                                <td className="px-6 py-4 text-right font-bold text-ink-900">
                                    {isEditing ? (
                                        <input
                                            type="number"
                                            className="w-24 p-1 text-right border border-brand-300 rounded focus:outline-brand-500"
                                            value={editValues?.price}
                                            onChange={(e) => setEditValues(prev => prev ? ({ ...prev, price: e.target.value }) : null)}
                                        />
                                    ) : (
                                        formatCurrency(item.sellingPrice)
                                    )}
                                </td>

                                {/* MARGEN (Dynamic) */}
                                <td className="px-6 py-4 text-right">
                                    <div className={`flex items-center justify-end gap-1 font-bold ${item.marginPercent < item.targetMargin ? 'text-red-500' : 'text-green-600'}`}>
                                        {item.marginPercent.toFixed(1)}%
                                        {item.marginPercent < item.targetMargin ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                                    </div>
                                    <span className="text-xs text-slate-400">Target: {isEditing ? (
                                        <input
                                            type="number"
                                            className="w-12 p-0.5 text-center border border-slate-200 rounded text-xs"
                                            value={editValues?.target}
                                            onChange={(e) => setEditValues(prev => prev ? ({ ...prev, target: e.target.value }) : null)}
                                        />
                                    ) : item.targetMargin}%</span>
                                </td>

                                {/* STATUS */}
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getStatusColor(item.status)}`}>
                                        {item.status}
                                    </span>
                                </td>

                                {/* ACTIONS */}
                                <td className="px-6 py-4 text-center">
                                    {isEditing ? (
                                        <div className="flex justify-center gap-2">
                                            <button
                                                onClick={() => handleSave(item)}
                                                disabled={isSaving}
                                                className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                                            >
                                                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                            </button>
                                            <button
                                                onClick={() => setEditingId(null)}
                                                disabled={isSaving}
                                                className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleEdit(item)}
                                            className="p-1.5 text-brand-500 hover:bg-brand-50 rounded-lg transition-colors"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </GlassCard>
    );
}
