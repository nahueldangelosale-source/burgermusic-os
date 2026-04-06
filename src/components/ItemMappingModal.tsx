"use client";

import { useState } from "react";
// Asumiendo dependencias de UI preexistentes como lucide-react y componentes base,
// si no existen se usaran HTML tags estilizados con Tailwind.
import { AlertCircle, CheckCircle2, ChevronDown } from "lucide-react";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ZERO-TRUST UI: ITEM MAPPING MODAL (Fricción Positiva)
 * ─────────────────────────────────────────────────────────────────────────────
 * Estética "Silent Luxury SaaS": bg-slate-50, sin bordes neón, paleta monocromática
 * con contrastes altos para legibilidad ejecutiva.
 */

interface ItemMappingModalProps {
  isOpen: boolean;
  rawItemName: string;
  supplierId: string;
  supplierName: string;
  onClose: () => void;
  onSaveMapping: (mapping: {
    internalIngredientId: string;
    conversionFactor: number;
  }) => Promise<void>;
  // Mockeamos la prop de ingredientes disponibles (MDM)
  availableIngredients: Array<{ id: string; name: string; unit: string }>;
}

export function ItemMappingModal({
  isOpen,
  rawItemName,
  supplierName,
  onClose,
  onSaveMapping,
  availableIngredients,
}: ItemMappingModalProps) {
  const [selectedIngredient, setSelectedIngredient] = useState<string>("");
  const [conversionFactor, setConversionFactor] = useState<string>("1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async () => {
    try {
      setError(null);
      
      if (!selectedIngredient) {
        throw new Error("Selecciona un insumo interno.");
      }
      
      const factorValue = parseInt(conversionFactor, 10);
      if (isNaN(factorValue) || factorValue <= 0) {
        throw new Error("El factor de conversión debe ser un número entero positivo.");
      }

      setIsSubmitting(true);
      await onSaveMapping({
        internalIngredientId: selectedIngredient,
        conversionFactor: factorValue,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al guardar el mapeo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      {/* Caja modal con estética Silent Luxury */}
      <div className="w-full max-w-md bg-slate-50 rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-white px-6 py-5 border-b border-slate-100 flex items-start gap-4">
          <div className="bg-amber-100/50 p-2 rounded-lg text-amber-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-slate-800">
              Homologación Requerida
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              El proveedor envió un insumo desconocido. Para proteger el inventario WAC en O(1), homologa su unidad hacia nuestra matriz.
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6">
          
          {/* Supplier Context (Inmutable) */}
          <div className="bg-slate-100/50 rounded-lg p-3 border border-slate-100">
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Insumo Crudo</span>
              <span className="font-medium text-slate-800 break-words">{rawItemName}</span>
              <span className="text-slate-500 text-xs mt-1">Proveedor: {supplierName}</span>
            </div>
          </div>

          <div className="space-y-4">
            {/* MDM Match */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                1. Selección MDM (Insumo Base)
              </label>
              <div className="relative">
                <select
                  value={selectedIngredient}
                  onChange={(e) => setSelectedIngredient(e.target.value)}
                  className="w-full appearance-none bg-white border border-slate-200 text-slate-800 text-sm rounded-lg px-3 py-2.5 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all shadow-sm"
                >
                  <option value="" disabled>Seleccionar equivalente interno...</option>
                  {availableIngredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Factor Matemático O(1) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                2. Factor de Conversión (Gramos)
              </label>
              <div className="relative group">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={conversionFactor}
                  onChange={(e) => setConversionFactor(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 text-sm rounded-lg px-3 py-2.5 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all shadow-sm"
                  placeholder="Ej: 15000"
                />
                <div className="absolute top-11 left-0 z-10 w-full p-2 text-xs text-slate-600 bg-white border border-slate-200 rounded shadow-lg opacity-0 pointer-events-none group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity duration-200">
                  <span className="font-semibold text-slate-800 mb-1 block">Regla Inmutable:</span>
                  ¿Te envió "Caja de 15 Kg"? -&gt; Escribe 15000.<br/>
                  El factor traduce la unidad facturada hacia los gramos de Kardex.
                </div>
              </div>
            </div>
            
            {error && (
              <p className="text-red-500 text-xs font-medium bg-red-50 p-2 rounded">
                ● {error}
              </p>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-100/50 px-6 py-4 flex justify-end gap-3 border-t border-slate-200">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors focus:outline-none"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-all shadow shadow-slate-900/20 disabled:opacity-50"
          >
            {isSubmitting ? (
              "Guardando..."
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Interlock Mapping
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
