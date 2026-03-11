"use client";

import { useState } from "react";
import { type RestockSuggestion } from "@/lib/intelligence/forecasting";
import { GlassCard } from "@/components/ui/AntigravityAtoms";
import { Copy, Check, MessageSquare } from "lucide-react";

interface OrderingTableProps {
    suggestion: RestockSuggestion;
}

export function OrderingTable({ suggestion }: OrderingTableProps) {
    const [items, setItems] = useState(suggestion.items);
    const [copied, setCopied] = useState(false);

    const handleQuantityChange = (productId: string, newVal: string) => {
        const val = parseFloat(newVal);
        setItems(prev => prev.map(item =>
            item.productId === productId ? { ...item, suggestedQuantity: val } : item
        ));
    };

    const generateWhatsAppText = () => {
        let text = `👋 Hola *${suggestion.supplierName}*, pedido para *BurgerMusic*:\n\n`;
        items.forEach(item => {
            if (item.suggestedQuantity > 0) {
                text += `▪️ ${item.suggestedQuantity} ${item.unit} de ${item.productName}\n`;
            }
        });
        text += `\nGracias!`;
        return text;
    };

    const copyToClipboard = () => {
        const text = generateWhatsAppText();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <GlassCard className="p-0 overflow-hidden border-t-4 border-t-brand-500">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500">
                    <tr>
                        <th className="px-6 py-4">Producto</th>
                        <th className="px-6 py-4 text-center">Consumo Diario (7d)</th>
                        <th className="px-6 py-4 text-center">Stock Estimado</th>
                        <th className="px-6 py-4 text-right">A Pedir</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {items.map((item) => (
                        <tr key={item.productId} className="hover:bg-slate-50/50">
                            <td className="px-6 py-4 font-bold text-ink-900">
                                {item.productName}
                            </td>
                            <td className="px-6 py-4 text-center font-mono text-slate-500">
                                {item.avgDailyConsumption.toFixed(2)} {item.unit}
                            </td>
                            <td className="px-6 py-4 text-center font-mono text-slate-500">
                                {item.currentStock} {item.unit}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <input
                                        type="number"
                                        className="w-20 p-2 text-right border border-brand-200 rounded font-bold text-lg focus:ring-brand-500 focus:border-brand-500"
                                        value={item.suggestedQuantity}
                                        onChange={(e) => handleQuantityChange(item.productId, e.target.value)}
                                    />
                                    <span className="text-xs font-bold text-slate-400 w-8">{item.unit}</span>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="bg-slate-50/80">
                    <tr>
                        <td colSpan={4} className="px-6 py-4">
                            <div className="flex justify-end">
                                <button
                                    onClick={copyToClipboard}
                                    className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-green-200"
                                >
                                    {copied ? <Check size={20} /> : <MessageSquare size={20} />}
                                    {copied ? "COPIADO AL PORTAPAPELES" : "COPIAR PEDIDO WHATSAPP"}
                                </button>
                            </div>
                        </td>
                    </tr>
                </tfoot>
            </table>
        </GlassCard>
    );
}
