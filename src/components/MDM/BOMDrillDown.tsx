"use client";

import { updateRecipeQuantity } from "@/actions/bom-mutations";
import { useTransition } from "react";
import { toast } from "sonner";

export type RecipeRow = {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
};

export default function BOMDrillDown({
  productId,
  userId,
  storeId,
  ingredients,
}: {
  productId: string;
  userId: string;
  storeId: string;
  ingredients: RecipeRow[];
}) {
  const [isPending, startTransition] = useTransition();

  const handleUpdate = (ingredientId: string, rawVal: string) => {
    const newQty = Number.parseFloat(rawVal);
    if (isNaN(newQty) || newQty < 0) return;

    startTransition(async () => {
      const result = await updateRecipeQuantity(productId, ingredientId, newQty, userId, storeId);
      if (result.success) {
        toast.success("Catálogo mutado atómicamente");
      } else {
        toast.error("Fallo de Inmutabilidad BOM. Revisar Console.");
      }
    });
  };

  return (
    <div className="w-full bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden @container">
      <div className="grid grid-cols-[3fr_2fr] gap-4 p-4 border-b border-gray-800 bg-gray-900/50 tracking-widest text-[10px] md:text-xs text-gray-400 font-black uppercase">
        <div>SKU Ingrediente Base (Referencia)</div>
        <div className="text-right">Deducción Marginal</div>
      </div>
      <div className="divide-y divide-gray-900/80">
        {ingredients.map((ing) => (
          <div
            key={ing.ingredientId}
            className="grid grid-cols-[3fr_2fr] gap-4 px-4 py-3 items-center transition-colors hover:bg-gray-900/30"
          >
            <div className="font-mono text-sm text-gray-300 flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand-500,#8b5cf6)] shadow-[0_0_8px_var(--color-brand-500,#8b5cf6)]"></div>
              <span className="truncate">{ing.ingredientName}</span>
            </div>
            <div className="flex justify-end relative">
              <input
                type="number"
                step="0.001"
                defaultValue={ing.quantity}
                disabled={isPending}
                onBlur={(e) => handleUpdate(ing.ingredientId, e.target.value)}
                className="w-24 bg-gray-950 hover:bg-gray-900 border border-gray-800 text-right text-gray-200 p-2 rounded-lg focus:outline-none focus:border-[var(--color-brand-500,#8b5cf6)] focus:ring-1 focus:ring-[var(--color-brand-500,#8b5cf6)] font-mono text-sm transition-all disabled:opacity-50"
              />
              {isPending && (
                <div className="absolute -right-5 top-3 animate-pulse w-2 h-2 bg-[var(--color-brand-500,#8b5cf6)] rounded-full"></div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
