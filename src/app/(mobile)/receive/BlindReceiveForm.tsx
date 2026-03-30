"use client";
import { submitBlindReception } from "@/actions/receive-actions";
import { useState, useTransition } from "react";

export function BlindReceiveForm({
  suppliers,
  ingredients,
}: { suppliers: any[]; ingredients: any[] }) {
  const [supplierId, setSupplierId] = useState("");
  const [ingredientSku, setIngredientSku] = useState("");
  const [qtyText, setQtyText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [statusMsg, setStatusMsg] = useState({ text: "", type: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      setStatusMsg({ text: "Cifrando...", type: "text-amber-500" });
      const res = await submitBlindReception({ supplierId, ingredientSku, qtyText });

      if (res.success) {
        setStatusMsg({ text: "PESAJE REGISTRADO EXITOSAMENTE.", type: "text-emerald-400" });
        setQtyText("");
        setIngredientSku("");
      } else {
        setStatusMsg({ text: `RECHAZADO: ${res.error}`, type: "text-rose-400" });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col space-y-5 mt-4">
      <div className="space-y-2">
        <label className="text-[10px] text-slate-400 font-semibold tracking-wider">
          PROVEEDOR EN PUERTA
        </label>
        <select
          required
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="w-full bg-slate-900 border border-white/10 text-white p-4 rounded-xl text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 appearance-none"
        >
          <option value="" disabled>
            Seleccione Proveedor...
          </option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} (CUIT: {s.cuit})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] text-slate-400 font-semibold tracking-wider">
          INSUMO (MDM BÚSQUEDA)
        </label>
        <select
          required
          value={ingredientSku}
          onChange={(e) => setIngredientSku(e.target.value)}
          className="w-full bg-slate-900 border border-white/10 text-white p-4 rounded-xl text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 appearance-none"
        >
          <option value="" disabled>
            Seleccione Insumo Físico...
          </option>
          {ingredients.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] text-slate-400 font-semibold tracking-wider">
          PESAJE BÁSCULA (KGs / UNs)
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          required
          value={qtyText}
          onChange={(e) => setQtyText(e.target.value)}
          placeholder="Ej. 24.50"
          className="w-full bg-slate-900 border border-white/10 text-white p-4 rounded-xl text-lg font-bold placeholder-slate-600 focus:border-amber-500 focus:outline-none text-center focus:ring-1 focus:ring-amber-500/50"
        />
      </div>

      <div className="pt-4 pb-2 text-center h-8">
        {statusMsg.text && (
          <p className={`text-xs font-bold ${statusMsg.type}`}>{statusMsg.text}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm py-4 rounded-xl transition-all disabled:opacity-50 tracking-widest shadow-[0_0_15px_rgba(245,158,11,0.2)]"
      >
        {isPending ? "PROCESANDO MATRIZ LÓGICA..." : "INGRESAR STOCK (CIEGO)"}
      </button>
    </form>
  );
}
