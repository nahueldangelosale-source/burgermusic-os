"use client";

import React, { useState, useEffect, useTransition } from "react";
import { mapSkuAliasesBatch } from "@/actions/alias-engine";
import { generateSuggestedAliases } from "@/actions/alias-agent";
import { createProductInline } from "@/actions/product-actions";

export default function OrphanageTray({ items, catalog }: { items: string[], catalog: {id: string, name: string}[] }) {
  const [loading, setLoading] = useState<boolean>(false);
  const [mappingState, setMappingState] = useState<Record<string, string>>({});
  const [aiSuggestions, setAiSuggestions] = useState<Set<string>>(new Set());

  // Estado para Mapeo Híbrido (Creación Inline)
  const [localCatalog, setLocalCatalog] = useState(catalog);
  const [inlineCreationItem, setInlineCreationItem] = useState<string | null>(null);
  const [inlineName, setInlineName] = useState("");
  const [inlineCategory, setInlineCategory] = useState("Menu");
  const [isPending, startTransition] = useTransition();

  // Mantenemos sincronizado el catálogo local si el prop cambia
  useEffect(() => {
    setLocalCatalog(catalog);
  }, [catalog]);

  if (!items || items.length === 0) return null;

  async function handleAutoMatch() {
    setLoading(true);
    const result = await generateSuggestedAliases(items, catalog);
    
    if (result.success && result.data) {
      const newMapping: Record<string, string> = { ...mappingState };
      const newAiSet = new Set(aiSuggestions);
      
      result.data.forEach((suggestion: any) => {
        if (suggestion.suggestedSkuId && suggestion.confidenceScore > 0.6) {
          newMapping[suggestion.rawName] = suggestion.suggestedSkuId;
          newAiSet.add(suggestion.rawName);
        }
      });
      
      setMappingState(newMapping);
      setAiSuggestions(newAiSet);
    } else {
      alert("Error en el motor semántico de AI: " + result.error);
    }
    setLoading(false);
  }

  async function handleBulkSave() {
    // Solo toma los ítems que tienen algo mapeado
    const mappingsToSave = Object.entries(mappingState).map(([raw, mappedId]) => ({
      rawString: raw,
      officialSkuId: mappedId
    })).filter(m => m.officialSkuId !== "");

    if (mappingsToSave.length === 0) {
      alert("No hay ningún mapeo válido seleccionado.");
      return;
    }

    setLoading(true);
    const result = await mapSkuAliasesBatch(mappingsToSave);
    
    if (!result.success) {
      alert("Error consolidando alias: " + result.error);
    }
    setLoading(false);
    // Si sale bien, revalidatePath ejecutará el re-render por lo que el parent refectcheará la bandeja
  }

  const handleSelectChange = (item: string, selectedId: string) => {
    setMappingState(prev => ({
      ...prev,
      [item]: selectedId
    }));
    // Si el humano edita manualmente, eliminamos la estrellita de IA match
    if (aiSuggestions.has(item)) {
      const newAiSet = new Set(aiSuggestions);
      newAiSet.delete(item);
      setAiSuggestions(newAiSet);
    }
  }

  function handleCreateInline(rawName: string) {
    if (!inlineName) return;
    startTransition(async () => {
      try {
        const newProduct = await createProductInline(inlineName, inlineCategory);
        if (newProduct && newProduct.id) {
          // Closed-Loop: Materializamos en memoria sin recargar la página
          setLocalCatalog(prev => 
            prev.some(p => p.id === newProduct.id) 
              ? prev 
              : [...prev, newProduct].sort((a,b) => a.name.localeCompare(b.name))
          );
          setMappingState(prev => ({ ...prev, [rawName]: newProduct.id }));
          
          if (aiSuggestions.has(rawName)) {
            const newAiSet = new Set(aiSuggestions);
            newAiSet.delete(rawName);
            setAiSuggestions(newAiSet);
          }
          
          setInlineCreationItem(null);
        }
      } catch(err) {
        alert("Error creando SKU directamente en la base de datos.");
        console.error(err);
      }
    });
  }

  return (
    <div className="mt-6 border-l-4 border-red-500 bg-red-950/20 p-6 rounded relative">
      <div className="absolute -top-3 left-6 px-2 bg-red-600 text-white text-xs font-bold rounded uppercase tracking-wider shadow">
        MDM DLQ / Silent Drop Alerta
      </div>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
        <div>
          <h3 className="text-red-400 font-bold uppercase tracking-wide">
            {items.length} SKUs Desconocidos - Facturación Congelada
          </h3>
          <p className="text-sm text-red-300/80 mt-1">
            Mapea manualmente o utiliza el Semantic Resolver. La ingesta se normalizará globalmente.
          </p>
        </div>
        
        <button
          onClick={handleAutoMatch}
          disabled={loading}
          className="mt-4 md:mt-0 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-emerald-50 px-4 py-2 rounded shadow transition-colors font-semibold tooltip disabled:opacity-50"
        >
          {loading ? "Procesando..." : "⚡ Auto-Match con IA"}
        </button>
      </div>

      <div className="space-y-3 mb-6">
        {items.map((item, i) => {
          const isAiMatched = aiSuggestions.has(item);
          return (
            <div 
              key={i} 
              className={`flex flex-col md:flex-row md:items-center justify-between p-3 rounded bg-black/40 border transition-colors duration-300 ${isAiMatched ? 'border-emerald-600/60 shadow-[0_0_15px_rgba(5,150,105,0.15)]' : 'border-red-900/50'}`}
            >
              <div className="flex items-center gap-2 mb-2 md:mb-0">
                <span className="font-mono text-sm text-red-200 truncate">{item}</span>
                {isAiMatched && <span className="text-emerald-400 text-xs" title="Emparejado usando V2.0 Semantic Resolver">✨ IA Match</span>}
              </div>
              <div className="flex gap-2">
                {inlineCreationItem === item ? (
                  <div className="flex flex-col md:flex-row items-stretch md:items-center p-2 rounded-lg bg-black/40 backdrop-blur-md border border-indigo-500/40 shadow-inner w-full min-w-[300px]">
                    <div className="flex gap-2 flex-grow">
                      <input 
                        type="text" 
                        className="bg-black/50 border border-indigo-500/30 rounded text-sm p-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-full" 
                        value={inlineName}
                        onChange={(e) => setInlineName(e.target.value)}
                        placeholder="Nombre Oficial"
                        disabled={isPending}
                        autoFocus
                      />
                      <select 
                        className="bg-black/50 border border-indigo-500/30 rounded text-sm p-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        value={inlineCategory}
                        onChange={(e) => setInlineCategory(e.target.value)}
                        disabled={isPending}
                      >
                        <option value="Menu">Menu</option>
                        <option value="Insumo">Insumo</option>
                        <option value="Servicio">Servicio</option>
                      </select>
                    </div>
                    <div className="flex gap-2 mt-2 md:mt-0 md:ml-3">
                      <button 
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded text-xs font-bold disabled:opacity-50 transition-colors shadow-sm"
                        disabled={isPending || !inlineName}
                        onClick={() => handleCreateInline(item)}
                      >
                        {isPending ? "INJETANDO..." : "GUARDAR"}
                      </button>
                      <button 
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded text-xs font-bold disabled:opacity-50 transition-colors border border-slate-600"
                        disabled={isPending}
                        onClick={() => setInlineCreationItem(null)}
                      >
                        X
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <select
                      className={`bg-black/50 border rounded text-sm p-2 w-full md:w-64 focus:outline-none focus:ring-1 transition-colors ${isAiMatched ? 'border-emerald-700/80 text-emerald-200 focus:ring-emerald-500' : 'border-slate-700 text-slate-300 focus:ring-red-500'}`}
                      onChange={(e) => handleSelectChange(item, e.target.value)}
                      disabled={loading || isPending}
                      value={mappingState[item] || ""}
                    >
                      <option value="" disabled>-- Seleccionar SKU Manualmente --</option>
                      {localCatalog.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    
                    <button 
                      onClick={() => {
                        setInlineCreationItem(item);
                        setInlineName(item); // Pre-fill para máxima velocidad
                        setInlineCategory("Menu");
                      }}
                      disabled={loading || isPending}
                      className="bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 px-2 md:px-3 py-1 text-[10px] md:text-xs font-semibold rounded shadow-sm backdrop-blur-sm transition-all whitespace-nowrap min-w-fit"
                      title="Crear un nuevo producto en caliente para materializar este SKU fantasma"
                    >
                      [+ Nuevo SKU]
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-4 border-t border-red-900/40">
        <button
          onClick={handleBulkSave}
          disabled={loading || Object.keys(mappingState).length === 0}
          className="bg-red-800 hover:bg-red-700 text-red-50 px-6 py-2 rounded shadow uppercase text-sm font-bold tracking-widest disabled:opacity-50 transition-opacity"
        >
          {loading ? "Reconciliando..." : "Guardar Todos los Alias"}
        </button>
      </div>
    </div>
  );
}
