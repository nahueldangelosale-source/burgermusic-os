"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSkuMapping } from "@/actions/analytics-actions";
import { X, ChevronDown, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface SkuWithMapping {
  id: string;
  skuName: string;
  isMapped: boolean;
  mappingId: string | null;
  mdmIngredientId: string | null;
  conversionFactor: number | null;
}

interface MdmIngredient {
  id: string;
  name: string;
}

interface SupplierDrillDownProps {
  supplierId: string;
  supplierName: string;
  skus: SkuWithMapping[];
  mdmCatalog: MdmIngredient[];
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROW MAPPER (Individual SKU Row — ACL Friction)
// ─────────────────────────────────────────────────────────────────────────────
function SkuMappingRow({
  sku,
  supplierId,
  mdmCatalog,
}: {
  sku: SkuWithMapping;
  supplierId: string;
  mdmCatalog: MdmIngredient[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedIngredient, setSelectedIngredient] = useState(sku.mdmIngredientId ?? "");
  const [factor, setFactor] = useState(String(sku.conversionFactor ?? ""));
  const [saved, setSaved] = useState(sku.isMapped);
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    setError(null);
    if (!selectedIngredient) {
      setError("Selecciona un insumo MDM.");
      return;
    }
    const factorInt = parseInt(factor, 10);
    if (isNaN(factorInt) || factorInt <= 0) {
      setError("Factor debe ser entero positivo.");
      return;
    }

    startTransition(async () => {
      try {
        await saveSkuMapping({
          supplierId,
          supplierItemName: sku.skuName,
          mdmIngredientId: selectedIngredient,
          conversionFactor: factorInt,
        });
        setSaved(true);
        router.refresh();
      } catch (e: any) {
        setError(e.message);
      }
    });
  };

  return (
    <div className={`p-4 rounded-xl border transition-all ${saved ? "bg-emerald-50/50 border-emerald-200" : "bg-white border-slate-200"}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-slate-800 truncate max-w-[60%]">
          {sku.skuName}
        </span>
        {saved ? (
          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" /> Mapeado
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" /> Sin Mapear
          </span>
        )}
      </div>

      {!saved && (
        <div className="space-y-3">
          <div className="relative">
            <select
              value={selectedIngredient}
              onChange={(e) => setSelectedIngredient(e.target.value)}
              className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg px-3 py-2.5 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all"
            >
              <option value="" disabled>Seleccionar insumo MDM...</option>
              {mdmCatalog.map((ing) => (
                <option key={ing.id} value={ing.id}>{ing.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Factor de Conversión (Gramos/ML)
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={factor}
              onChange={(e) => setFactor(e.target.value)}
              placeholder="Ej: 15000 (15kg en gramos)"
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg px-3 py-2.5 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 font-medium bg-red-50 p-2 rounded">● {error}</p>
          )}

          <button
            onClick={handleSave}
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors"
          >
            {isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
            ) : (
              <><CheckCircle2 className="w-4 h-4" /> Interlock Mapping</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRILL-DOWN SLIDE-OVER (Fricción Positiva Modal)
// ─────────────────────────────────────────────────────────────────────────────
export function SupplierDrillDown({ supplierId, supplierName, skus, mdmCatalog, onClose }: SupplierDrillDownProps) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />

      {/* Slide-over Panel */}
      <div className="relative w-full max-w-md bg-slate-50 border-l border-slate-200 shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold tracking-tight text-slate-900">{supplierName}</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              {skus.filter(s => !s.isMapped).length} SKU(s) pendientes de homologación
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body: SKU list */}
        <div className="p-6 space-y-3">
          {skus.map((sku) => (
            <SkuMappingRow
              key={sku.id}
              sku={sku}
              supplierId={supplierId}
              mdmCatalog={mdmCatalog}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
