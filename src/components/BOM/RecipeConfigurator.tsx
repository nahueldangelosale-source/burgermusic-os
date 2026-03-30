"use client";

import { updateRecipeBOM } from "@/actions/bom-actions";
import { useState, useTransition } from "react";

interface RecipeConfiguratorProps {
  recipeId: string;
  ingredientId: string;
  initialQty: number;
  productSku: string;
}

export default function RecipeConfigurator({
  recipeId,
  ingredientId,
  initialQty,
  productSku,
}: RecipeConfiguratorProps) {
  const [isPending, startTransition] = useTransition();

  // UI state excluye useEffect
  const [qtyString, setQtyString] = useState<string>(String(initialQty));
  const [feedback, setFeedback] = useState<string>("");

  const handleMutation = () => {
    const numericQty = Number.parseFloat(qtyString);

    // Math Sanity Check
    if (isNaN(numericQty) || numericQty <= 0) {
      setFeedback("ERROR: Masa teórica inválida.");
      return;
    }

    startTransition(async () => {
      try {
        setFeedback("Actualizando receta...");
        await updateRecipeBOM(recipeId, ingredientId, numericQty);
        setFeedback("BOM Alterado. Telemetría Aprobada.");
      } catch (err: any) {
        setFeedback(`Fricción Fallida: ${err.message}`);
      }
    });
  };

  return (
    <div className="bg-[#0B0F19] bg-opacity-80 border border-white/5 rounded-xl p-5 flex flex-col gap-4 shadow-xl backdrop-blur-md">
      <div className="flex justify-between items-center border-b border-white/5 pb-3">
        <span className="text-slate-100 font-bold tracking-wide">{productSku}</span>
        <span className="text-[10px] text-cyan-400 font-mono tracking-widest px-2 py-1 bg-cyan-500/10 rounded">
          CÓRTEX LINK
        </span>
      </div>

      <div className="flex items-center gap-3 mt-1">
        <div className="flex-1 relative">
          <input
            type="number"
            step="any"
            value={qtyString}
            onChange={(e) => {
              setQtyString(e.target.value);
              setFeedback("");
            }}
            className="w-full bg-black/40 border border-white/10 rounded-lg py-2.5 pl-3 pr-10 text-white focus:outline-none focus:border-cyan-500/50 font-mono text-sm shadow-inner transition-colors"
            disabled={isPending}
            placeholder="Masa (kg/lt/un)"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">
            Q
          </span>
        </div>

        <button
          onClick={handleMutation}
          disabled={isPending}
          className="relative overflow-hidden bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-40 text-cyan-400 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all group"
        >
          <span className="relative z-10">{isPending ? "OVERWRITING..." : "MUTAR BOM"}</span>
          {/* Hover Friccion Positiva */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent -translate-x-full group-hover:translate-x-full duration-500 ease-out z-0"></div>
        </button>
      </div>

      {/* Auditory Zero-Trust Feed */}
      {feedback && (
        <div
          className={`mt-1 text-[11px] font-mono tracking-tight px-3 py-2 rounded flex items-center gap-2
                    ${
                      feedback.includes("ERROR") || feedback.includes("Fallida")
                        ? "text-rose-400 bg-rose-500/10 border border-rose-500/20"
                        : "text-cyan-400 bg-cyan-500/10 border border-cyan-500/20"
                    }`}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${feedback.includes("ERROR") || feedback.includes("Fallida") ? "bg-rose-400 animate-pulse" : "bg-cyan-400"}`}
          ></div>
          {feedback.toUpperCase()}
        </div>
      )}
    </div>
  );
}
