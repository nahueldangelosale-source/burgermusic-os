"use client";

import { upsertIngredientQuote, upsertSupplier } from "@/actions/supplier-ops";
import { BadgeDollarSign, Factory, FileSearch, Loader2, TrendingDown } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type Ingredient = {
  id: string;
  name: string;
};

export default function SupplierArbitrageForm({ ingredients }: { ingredients: Ingredient[] }) {
  const [isPending, startTransition] = useTransition();

  // Internal state
  const [supplierName, setSupplierName] = useState("");
  const [cuit, setCuit] = useState("");
  const [ingredientSku, setIngredientSku] = useState("");
  const [priceDisplay, setPriceDisplay] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierName || !cuit || !ingredientSku || !priceDisplay) {
      toast.error("Todos los campos son obligatorios");
      return;
    }

    // Fricción Positiva - ZT Math
    const priceFloat = Number.parseFloat(priceDisplay.replace(",", "."));
    if (isNaN(priceFloat) || priceFloat <= 0) {
      toast.error("Por favor ingresa un monto válido");
      return;
    }
    const priceCents = Math.round(priceFloat * 100);

    startTransition(async () => {
      try {
        // Upsert del Proveedor (Puro y Drizzle idempotente)
        const resSupplier = await upsertSupplier({
          name: supplierName,
          cuit: cuit,
          category: "Insumos",
          paymentTerms: "Contado",
          paymentMethods: ["TRANSFERENCIA"],
          invoiceType: "FACTURA",
          leadTime: 24,
        });

        if (!resSupplier.success || !resSupplier.supplierId) {
          throw new Error("Fallo al insertar proveedor base");
        }

        // Upsert de Cotización Competitiva
        const resQuote = await upsertIngredientQuote(
          resSupplier.supplierId,
          ingredientSku,
          priceCents,
        );

        if (!resQuote.success) throw new Error("Fallo al actualizar el Motor de Arbitraje");

        toast.success("Cotización inyectada en el Libro Mayor");
        setPriceDisplay(""); // Clear just the price, keep supplier for mass entry
      } catch (err: any) {
        toast.error(err.message || "Error catastrófico en la tubería de arbitraje");
      }
    });
  };

  return (
    <div className="bg-[var(--bg-sunken)] backdrop-blur-md border border-white/20 p-6 rounded-3xl shadow-2xl animate-in fade-in zoom-in-95 duration-500 font-sans">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
          <TrendingDown className="text-blue-600" size={24} />
        </div>
        <div>
          <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">
            Carga Viva de Arbitraje
          </h2>
          <p className="text-xs text-gray-500 font-medium tracking-wide">
            Inyecte cotizaciones. El motor calculará el Lead.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-bold tracking-widest text-gray-500 flex items-center gap-2">
            <Factory size={14} /> Proveedor (Razón Social)
          </label>
          <input
            type="text"
            required
            disabled={isPending}
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-gray-900"
            placeholder="Ej: Molinos Río"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold tracking-widest text-gray-500 flex items-center gap-2">
            <FileSearch size={14} /> CUIT Comercial
          </label>
          <input
            type="text"
            required
            disabled={isPending}
            value={cuit}
            onChange={(e) => setCuit(e.target.value)}
            className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-mono text-gray-900"
            placeholder="30-12345678-9"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold tracking-widest text-gray-500">
            Insumo Base de Catálogo
          </label>
          <select
            required
            disabled={isPending}
            value={ingredientSku}
            onChange={(e) => setIngredientSku(e.target.value)}
            className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-gray-900"
          >
            <option value="" disabled>
              Seleccione el Insumo Canónico
            </option>
            {ingredients.map((ing) => (
              <option key={ing.id} value={ing.id}>
                {ing.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold tracking-widest text-gray-500 flex items-center gap-2">
            <BadgeDollarSign size={14} className="text-emerald-500" /> Precio Unitario Bruto ($)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            disabled={isPending}
            value={priceDisplay}
            onChange={(e) => setPriceDisplay(e.target.value)}
            className="w-full px-4 py-4 bg-emerald-50 border border-emerald-200 rounded-xl text-lg font-black focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all text-emerald-900 placeholder:text-emerald-300"
            placeholder="0.00"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full mt-4 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white font-bold uppercase tracking-widest text-sm px-6 py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md group"
        >
          {isPending ? (
            <>
              <Loader2 className="animate-spin" size={20} /> Cotizando...
            </>
          ) : (
            <>
              <TrendingDown size={20} className="group-hover:scale-110 transition-transform" />{" "}
              Consolidar Spread
            </>
          )}
        </button>
      </form>
    </div>
  );
}
