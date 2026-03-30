"use client";

import React, { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { upsertTaxConfig } from "@/actions/tax-actions";

function PendingButton() {
  const { pending } = useFormStatus();
  return (
    <button 
      type="submit" 
      disabled={pending}
      className="w-full mt-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold py-2.5 rounded-md hover:bg-zinc-800 transition-colors disabled:opacity-50"
    >
      {pending ? "Sincronizando..." : "Confirmar Devengamiento"}
    </button>
  );
}

export default function TaxForm() {
  const [state, formAction] = useActionState(async (prevState: any, formData: FormData) => {
    const result = await upsertTaxConfig(formData);
    if (result.success) {
      alert(result.data?.message || "Éxito");
      return { success: true };
    }
    return { error: result.error };
  }, null);

  const [calcType, setCalcType] = React.useState<"FIXED" | "PERCENTAGE">("FIXED");

  return (
    <div className="bento-card p-6 bg-white dark:bg-zinc-900 rounded-xl shadow border border-zinc-100 dark:border-zinc-800 transition-all">
      <h2 className="text-xl font-light text-zinc-800 dark:text-zinc-200 mb-6 tracking-wide">
        Tesorería C-Level: Parámetros Fiscales
      </h2>
      
      <form action={formAction} className="space-y-6">
        <div>
          <label className="text-sm font-medium text-zinc-500 mb-1 block">Descripción Incurrida</label>
          <input 
            name="description"
            required
            className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md focus:ring-1 focus:ring-zinc-400 focus:outline-none" 
            placeholder="Ej: Ingresos Brutos Provinciales" 
          />
        </div>

        <div className="flex gap-4 items-center">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input 
              type="radio" 
              name="calculationType"
              value="FIXED" 
              checked={calcType === "FIXED"}
              onChange={() => setCalcType("FIXED")}
              className="text-zinc-800 focus:ring-zinc-800"
            />
            <span className="text-zinc-700 dark:text-zinc-300 font-medium">Monto Fijo</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input 
              type="radio" 
              name="calculationType"
              value="PERCENTAGE" 
              checked={calcType === "PERCENTAGE"}
              onChange={() => setCalcType("PERCENTAGE")}
              className="text-zinc-800 focus:ring-zinc-800"
            />
            <span className="text-zinc-700 dark:text-zinc-300 font-medium">Porcentaje de Ventas</span>
          </label>
        </div>

        {calcType === "PERCENTAGE" ? (
          <div className="animate-in fade-in slide-in-from-top-1">
            <label className="text-sm font-medium text-zinc-500 mb-1 block">Rátio alícuota (%)</label>
            <input 
              name="percentageRate"
              type="number" 
              step="0.01" 
              required
              className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md focus:ring-1 focus:ring-zinc-400 focus:outline-none" 
              placeholder="3.00" 
            />
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-top-1">
            <label className="text-sm font-medium text-zinc-500 mb-1 block">Pasivo Total Fijo ($)</label>
            <input 
              name="fixedAmount"
              type="number" 
              required
              className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md focus:ring-1 focus:ring-zinc-400 focus:outline-none" 
              placeholder="150000" 
            />
          </div>
        )}

        {state?.error && (
          <p className="text-red-500 text-sm mt-2">{state.error}</p>
        )}

        <PendingButton />
      </form>
    </div>
  );
}
