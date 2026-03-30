"use client";

import { getCheapestSuppliers, getRawIngredients } from "@/actions/supplier-ops";
import SupplierArbitrageForm from "@/components/Suppliers/SupplierArbitrageForm";
import { Loader2, TrendingDown, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function ArbitrageTabClient() {
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ingRes, oppsRes] = await Promise.all([getRawIngredients(), getCheapestSuppliers()]);

      if (ingRes.success) {
        setIngredients(ingRes.data || []);
      }
      if (oppsRes) {
        setOpportunities(oppsRes);
      }
    } catch (error) {
      toast.error("Error al cargar datos del motor de arbitraje");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-gray-400">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start mt-4 animate-in fade-in duration-500 font-sans">
      <div className="md:col-span-1">
        <SupplierArbitrageForm ingredients={ingredients} />
      </div>

      <div className="md:col-span-2 flex flex-col gap-6">
        <div className="bg-[var(--bg-elevated)] border border-gray-200 p-6 rounded-3xl shadow-sm h-full flex flex-col min-h-[300px]">
          <h3 className="text-gray-900 font-black uppercase tracking-widest text-sm mb-4 flex items-center gap-2">
            <Zap className="text-amber-500" size={18} /> Oportunidades de Compra (Spread)
          </h3>

          {opportunities.length === 0 ? (
            <div className="flex-1 flex items-center justify-center flex-col text-center">
              <TrendingDown className="text-gray-300 mb-3" size={32} />
              <p className="text-gray-500 font-bold text-sm">Sin Cotizaciones Activas</p>
              <p className="text-gray-400 text-xs mt-1">
                Usa el formulario lateral para inyectar arbitraje.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {opportunities.map((opp: any, i: number) => (
                <div
                  key={i}
                  className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-blue-200 transition-colors"
                >
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-bold text-gray-900">{opp.ingredient_name}</p>
                    <p className="text-[10px] font-mono font-medium text-gray-500 uppercase tracking-widest">
                      {opp.supplier_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-emerald-600">
                      {new Intl.NumberFormat("es-AR", {
                        style: "currency",
                        currency: "ARS",
                      }).format(opp.price_cents / 100)}
                    </p>
                    <span className="text-[9px] uppercase tracking-widest font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full inline-block mt-1">
                      Lead
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
