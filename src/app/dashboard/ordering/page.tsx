import { calculateRestockNeeds } from "@/lib/intelligence/forecasting";
import { GlassCard } from "@/components/ui/AntigravityAtoms";
import { ShoppingCart, MessageCircle, Send } from "lucide-react";
import { OrderingTable } from "./ordering-table"; // We'll create this client component next

export const dynamic = 'force-dynamic';

export default async function OrderingPage() {
    const suggestions = await calculateRestockNeeds(7); // Default 7 days coverage

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-ink-900 tracking-tight">El Oráculo</h1>
                    <p className="text-slate-500 font-medium">Predicción de Compras & Reabastecimiento</p>
                </div>
            </header>

            {suggestions.length === 0 ? (
                <GlassCard className="text-center py-20">
                    <div className="bg-slate-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ShoppingCart className="text-slate-400" size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-ink-900">Sin Sugerencias de Compra</h3>
                    <p className="text-slate-500">Parece que tienes stock suficiente para los próximos 7 días.</p>
                </GlassCard>
            ) : (
                <div className="grid grid-cols-1 gap-8">
                    {suggestions.map((supplierSuggestion) => (
                        <div key={supplierSuggestion.supplierId} className="space-y-4">
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-1 bg-brand-100 text-brand-700 rounded-full text-xs font-bold uppercase tracking-wider">
                                    Proveedor
                                </span>
                                <h2 className="text-2xl font-black text-ink-900">{supplierSuggestion.supplierName}</h2>
                            </div>

                            <OrderingTable suggestion={supplierSuggestion} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
