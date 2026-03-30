"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useState, useRef, useMemo, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { simulateInflationImpact, applyNewCostsToLedger, upsertRawMaterial, deleteRawMaterial } from "@/actions/bom-simulator";
import { getRecipeForProduct, addIngredientToRecipe, removeIngredientFromRecipe, updateRecipeIngredient } from "@/actions/recipes";
import { upsertSupplier, deleteSupplier, calculateSupplierScore, calculateSupplierBalance } from "@/actions/suppliers";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertTriangle, DatabaseZap, Search, Filter, X, BarChart2, PackageOpen, TrendingUp, Coins, ChevronRight, Plus, Trash2, Users, Building, Phone, CalendarClock, Briefcase, Activity, Edit2, Save } from "lucide-react";
import { updateProduct } from "@/actions/products";
import { repairProductCatalog } from "@/actions/repair-catalog";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, ComposedChart, Line } from "recharts";
import { useEffect } from "react";

export function SupplyClient({ catalog, productsCatalog, suppliersCatalog, performanceData = [], defaultTab }: { catalog: any[], productsCatalog: any[], suppliersCatalog: any[], performanceData?: any[], defaultTab: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const defaultTabParam = searchParams?.get("tab") || defaultTab;
  const [activeTab, setActiveTab] = useState(defaultTabParam);

  // Tab 4 (Simulador)
  const [selectedIngredient, setSelectedIngredient] = useState("");
  const [inflationPct, setInflationPct] = useState<number>(0);
  const [simulationResults, setSimulationResults] = useState<any[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  // Tab 2 (Gestor de Recetas)
  const [selectedRecipeProduct, setSelectedRecipeProduct] = useState<any>(null);
  const [currentRecipe, setCurrentRecipe] = useState<any[]>([]);
  const [isRecipeLoading, setIsRecipeLoading] = useState(false);
  const [isAddIngredientOpen, setIsAddIngredientOpen] = useState(false);
  const [newIngId, setNewIngId] = useState("");
  const [newIngQty, setNewIngQty] = useState("");

  const loadRecipe = async (product: any) => {
    setSelectedRecipeProduct(product);
    setIsRecipeLoading(true);
    const res = await getRecipeForProduct(product.id);
    if (res.success) {
      setCurrentRecipe(res.data || []);
    }
    setIsRecipeLoading(false);
  };

  // Tab 3 (Proveedores)
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [isSupplierDrawerOpen, setIsSupplierDrawerOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [supplierSearchSearch, setSupplierSearchSearch] = useState("");
  const [supplierScoreData, setSupplierScoreData] = useState<any>(null);
  const [supplierBalanceData, setSupplierBalanceData] = useState<any>(null);

  useEffect(() => {
    if (selectedSupplier) {
      setSupplierScoreData(null);
      setSupplierBalanceData(null);
      calculateSupplierScore(selectedSupplier.id).then(res => {
        if(res.success) setSupplierScoreData(res);
      });
      calculateSupplierBalance(selectedSupplier.id).then(res => {
         if(res.success) setSupplierBalanceData(res);
      });
    }
  }, [selectedSupplier]);

  const supplierChartData = useMemo(() => {
    if(!selectedSupplier) return [];
    const mats = catalog.filter(c => c.supplierId === selectedSupplier.id || c.supplier_id === selectedSupplier.id);
    return mats.map(m => ({
      name: m.name,
      precioPagado: (m.grossCostCents || m.gross_cost_cents || 0)/100,
      costoPostMerma: (m.trueCostPerUnitCents || m.true_cost_per_unit_cents || ( (m.grossCostCents||m.gross_cost_cents||0)*100 / ( (1 - (m.historicalYieldPct || 0))*100 ) ) ) / 100,
      yield: Math.round((m.historicalYieldPct || 1)*100)
    }));
  }, [catalog, selectedSupplier]);

  const filteredSuppliers = useMemo(() => {
    return suppliersCatalog.filter(s => 
      s.name?.toLowerCase().includes(supplierSearchSearch.toLowerCase()) || 
      s.cuit?.includes(supplierSearchSearch)
    );
  }, [suppliersCatalog, supplierSearchSearch]);

  // Tanstack Virtualizer (Tab 1 Insumos)
  const [insumoSearch, setInsumoSearch] = useState("");
  const [insumoFilterUnit, setInsumoFilterUnit] = useState("ALL");
  const [insumoFilterCategory, setInsumoFilterCategory] = useState("ALL");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Tab 2 (Productos de Venta) logic
  const [productSearch, setProductSearch] = useState("");
  const [productFilterCategory, setProductFilterCategory] = useState("ALL");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const uniqueCategories = useMemo(() => {
    const cats = new Set(catalog.map(c => c.category || "INGREDIENTES"));
    return Array.from(cats);
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      const matchSearch = item.name?.toLowerCase().includes(insumoSearch.toLowerCase()) || item.id?.toLowerCase().includes(insumoSearch.toLowerCase());
      const matchUnit = insumoFilterUnit === "ALL" || item.unit === insumoFilterUnit || item.base_unit === insumoFilterUnit;
      const matchCat = insumoFilterCategory === "ALL" || (item.category || "INGREDIENTES") === insumoFilterCategory;
      return matchSearch && matchUnit && matchCat;
    });
  }, [catalog, insumoSearch, insumoFilterUnit, insumoFilterCategory]);

  const uniqueProductCategories = useMemo(() => {
    const cats = new Set(productsCatalog.map(p => p.category || "GENERAL"));
    return Array.from(cats).sort();
  }, [productsCatalog]);

  const filteredProducts = useMemo(() => {
    return productsCatalog.filter(p => {
      const matchSearch = p.id.toLowerCase().includes(productSearch.toLowerCase()) || p.sku?.toLowerCase().includes(productSearch.toLowerCase()) || (p as any).name?.toLowerCase().includes(productSearch.toLowerCase());
      const matchCat = productFilterCategory === "ALL" || p.category === productFilterCategory;
      return matchSearch && matchCat;
    });
  }, [productsCatalog, productSearch, productFilterCategory]);

  const chartData = useMemo(() => {
    // Agrupar por Categoría para el gráfico Top 5
    const counts: Record<string, number> = {};
    catalog.forEach(c => {
      const cat = c.category || "INGREDIENTES";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value)
      .slice(0, 6);
  }, [catalog]);

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredCatalog.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56, // Altura de fila
    overscan: 5,
  });

  // Tab persistence
  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleSimulate = async () => {
    if (!selectedIngredient || inflationPct === 0) return;
    setIsSimulating(true);
    try {
      const results = await simulateInflationImpact({ 
        ingredient_id: selectedIngredient, 
        inflation_percentage: inflationPct 
      });
      setSimulationResults(results);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleApply = async () => {
    if (!selectedIngredient || simulationResults.length === 0) return;
    const item = catalog.find(c => c.id === selectedIngredient);
    if (!item) return;
    
    const newCost = Math.round(item.cost_cents * (1 + (inflationPct / 100)));
    await applyNewCostsToLedger({ ingredient_id: selectedIngredient, new_cost_cents: newCost });
    alert("Nuevos costos inyectados atmómicamente al Ledger Drizzle.");
    setSimulationResults([]);
  };

  return (
    <TabsPrimitive.Root defaultValue={defaultTab} onValueChange={handleTabChange} className="w-full flex flex-col gap-6">
      <TabsPrimitive.List className="flex gap-4 border-b border-slate-200 overflow-x-auto scrollbar-hide">
        <TabsPrimitive.Trigger value="insumos" className="px-6 py-3 font-bold text-sm text-slate-500 hover:text-slate-900 data-[state=active]:text-indigo-600 data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 transition-colors whitespace-nowrap">
          Catálogo de Insumos
        </TabsPrimitive.Trigger>
        <TabsPrimitive.Trigger value="productos" className="px-6 py-3 font-bold text-sm text-slate-500 hover:text-slate-900 data-[state=active]:text-indigo-600 data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 transition-colors whitespace-nowrap">
          Productos de Venta
        </TabsPrimitive.Trigger>
        <TabsPrimitive.Trigger value="recetas" className="px-6 py-3 font-bold text-sm text-slate-500 hover:text-slate-900 data-[state=active]:text-indigo-600 data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 transition-colors whitespace-nowrap">
          Gestor de Recetas
        </TabsPrimitive.Trigger>
        <TabsPrimitive.Trigger value="proveedores" className="px-6 py-3 font-bold text-sm text-slate-500 hover:text-slate-900 data-[state=active]:text-indigo-600 data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 transition-colors whitespace-nowrap">
          Directorio Proveedores
        </TabsPrimitive.Trigger>
        <TabsPrimitive.Trigger value="analitica" className="px-6 py-3 font-bold text-sm text-slate-500 hover:text-slate-900 data-[state=active]:text-indigo-600 data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 transition-colors whitespace-nowrap">
          Analítica y Simulación (BOM)
        </TabsPrimitive.Trigger>
      </TabsPrimitive.List>

      {/* PESTAÑA 1: INSUMOS */}
      <TabsPrimitive.Content value="insumos" className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div className="flex justify-between items-center bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Catálogo de Insumos (MDM)</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{catalog.length} INSUMOS TOTALES</span>
              <p className="text-sm text-slate-500 font-medium">Bases de Datos de Materia Prima y Rendimientos</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => { setEditingInsumo(null); setIsDrawerOpen(true); }}
              className="bg-white border-2 border-indigo-100 text-indigo-600 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-50 hover:border-indigo-200 transition-colors shadow-sm"
            >
              + Nuevo Insumo
            </button>
            <label className={`cursor-pointer ${isUploading ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800'} text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm flex items-center gap-2`}>
              <DatabaseZap className={`w-4 h-4 ${isUploading ? 'animate-pulse' : ''}`} /> {isUploading ? "Inyectando MDM..." : "Importar Catálogo CSV"}
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                disabled={isUploading}
                onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setIsUploading(true);
                  try {
                    const text = await file.text();
                    const { processBomCsv } = await import("@/actions/mdm-ingestion");
                    const res = await processBomCsv(text);
                    if (res.success) {
                      alert(`Inyección O(1) Exitosa: ${res.rawMaterialsCreated} insumos creados.`);
                      window.location.reload();
                    } else {
                      alert("Error en inyección: " + res.error);
                      setIsUploading(false);
                    }
                  } catch(err: any) {
                    alert("Error catastrófico: " + err.message);
                    setIsUploading(false);
                  }
                }} 
              />
            </label>
          </div>
        </div>

        {/* Panel Resumen Analítico */}
        {catalog.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center">
              <div className="w-12 h-12 bg-indigo-50 flex items-center justify-center rounded-2xl mb-4 text-indigo-500">
                <PackageOpen size={24} />
              </div>
              <div className="text-4xl font-black text-slate-800">{catalog.length}</div>
              <div className="text-sm font-bold text-slate-400 tracking-widest uppercase mt-1">Total Insumos Mapeados</div>
            </div>
            <div className="lg:col-span-2 bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm h-40">
              <div className="flex justify-between items-center mb-2">
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                   <BarChart2 size={14} /> Distribución por Categoría
                 </h3>
              </div>
              <div className="h-24 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm min-h-[500px] flex flex-col">
          {/* Barra de Filtros */}
          <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-50/50 p-2 rounded-xl border border-slate-100 mb-4 gap-4">
             <div className="flex flex-1 items-center gap-2 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm w-full sm:w-auto">
               <Search size={16} className="text-slate-400" />
               <input 
                 className="outline-none text-sm font-medium w-full text-slate-700 bg-transparent placeholder-slate-400" 
                 placeholder="Buscar por nombre o ID interno..."
                 value={insumoSearch}
                 onChange={(e) => setInsumoSearch(e.target.value)}
               />
             </div>
             <div className="flex items-center gap-2 w-full sm:w-auto">
               <Filter size={16} className="text-slate-400" />
               <select 
                 className="outline-none text-sm font-bold text-slate-700 bg-white border border-slate-200 px-4 py-2 rounded-lg shadow-sm cursor-pointer"
                 value={insumoFilterCategory}
                 onChange={(e) => setInsumoFilterCategory(e.target.value)}
               >
                 <option value="ALL">Todas las Categorías</option>
                 {uniqueCategories.map(c => (
                    <option key={c as string} value={c as string}>{c as string}</option>
                 ))}
               </select>

               <select 
                 className="outline-none text-sm font-bold text-slate-700 bg-white border border-slate-200 px-4 py-2 rounded-lg shadow-sm cursor-pointer"
                 value={insumoFilterUnit}
                 onChange={(e) => setInsumoFilterUnit(e.target.value)}
               >
                 <option value="ALL">Todas las Unidades</option>
                 <option value="UNIT">UNIT</option>
                 <option value="GR">GR</option>
                 <option value="ML">ML</option>
                 <option value="OTRO">S/D</option>
               </select>
             </div>
          </div>

          <div className="flex-1 overflow-x-auto rounded-xl border border-slate-100 bg-white">
            <div className="min-w-full inline-block align-middle">
              <div className="border-b border-slate-100 bg-slate-50 relative z-10 w-full">
                <table className="min-w-full text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  <thead>
                    <tr>
                      <th className="px-6 py-4 w-[30%]">ID / Nombre Insumo</th>
                      <th className="px-6 py-4 w-[20%]">Categoría</th>
                      <th className="px-6 py-4 w-[15%]">Unidad Base</th>
                      <th className="px-6 py-4 w-[20%]">Costo Bruto</th>
                      <th className="px-6 py-4 w-[15%] text-right">Acciones</th>
                    </tr>
                  </thead>
                </table>
              </div>
              <div ref={parentRef} className="h-[400px] overflow-auto scrollbar-thin">
                <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                  <table className="min-w-full text-sm text-left align-top">
                    <tbody className="divide-y divide-slate-100">
                      {rowVirtualizer.getVirtualItems().length === 0 ? (
                        <tr>
                          <td className="px-6 py-12 text-center text-slate-400 font-medium" colSpan={4}>
                            No hay insumos registrados. Importa el catálogo CSV para comenzar.
                          </td>
                        </tr>
                      ) : (
                        rowVirtualizer.getVirtualItems().map(virtualRow => {
                          const item = filteredCatalog[virtualRow.index];
                          return (
                            <tr 
                              key={virtualRow.key}
                              data-index={virtualRow.index}
                              ref={rowVirtualizer.measureElement}
                              className="hover:bg-slate-50 transition-colors absolute top-0 left-0 w-full flex items-center"
                              style={{
                                transform: `translateY(${virtualRow.start}px)`,
                              }}
                            >
                              <td className="px-6 py-4 font-bold text-slate-900 w-[30%] flex flex-col">
                                <span className="truncate">{item.name}</span>
                                <span className="text-[10px] font-mono text-slate-400 truncate">{item.id}</span>
                              </td>
                              <td className="px-6 py-4 w-[20%]">
                                 <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest border border-slate-200">
                                   {item.category || "INGREDIENTES"}
                                 </span>
                              </td>
                              <td className="px-6 py-4 w-[15%] text-slate-600 font-medium">{item.unit || item.baseUnit || item.base_unit || "N/A"}</td>
                              <td className="px-6 py-4 w-[20%] font-mono text-indigo-600">${((item.cost_cents || item.grossCostCents || item.gross_cost_cents || 0)/100).toLocaleString('es-AR')}</td>
                              <td className="px-6 py-4 w-[15%] text-right">
                                <button 
                                  onClick={() => { setEditingInsumo(item); setIsDrawerOpen(true); }}
                                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  Editar
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MODAL NATIVO (Manual Insumo) */}
        {isDrawerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200 p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)} />
            <form 
              className="w-full max-w-lg bg-white rounded-[24px] shadow-2xl relative flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]"
              onSubmit={async (e: any) => {
                e.preventDefault();
                setIsUploading(true);
                const formData = new FormData(e.target);
                const payload = {
                  name: formData.get("name"),
                  category: formData.get("category"),
                  baseUnit: formData.get("baseUnit"),
                  historicalYieldPct: 1 - (parseFloat(formData.get("yield") as string) / 100),
                  grossCostCents: Math.round(parseFloat(formData.get("cost") as string) * 100),
                };
                
                const res = await upsertRawMaterial({ ...payload, id: editingInsumo?.id || undefined });
                if (res.success) {
                  window.location.reload();
                } else {
                  alert("Error al guardar: " + res.error);
                  setIsUploading(false);
                }
              }}
            >
              <div className="flex justify-between items-center p-6 border-b border-slate-100">
                <div>
                  <h3 className="text-xl font-black text-slate-800">{editingInsumo ? "Editar Insumo" : "Nuevo Insumo"}</h3>
                  <p className="text-sm font-medium text-slate-400 mt-1">Ficha Maestra (MDM)</p>
                </div>
                <div className="flex items-center gap-2">
                  {editingInsumo && (
                    <button 
                      type="button" 
                      onClick={async () => {
                        if(confirm("¿Destruir Insumo Atómicamente? Esto romperá recetas asociadas.")) {
                           setIsUploading(true);
                           const res = await deleteRawMaterial(editingInsumo.id);
                           if(res.success) window.location.reload();
                        }
                      }}
                      className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold text-xs rounded-lg transition-colors border border-rose-100"
                    >
                      Eliminar
                    </button>
                  )}
                  <button type="button" onClick={() => setIsDrawerOpen(false)} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div>
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Nombre del Insumo</label>
                   <input required name="name" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" defaultValue={editingInsumo?.name || ""} placeholder="Ej: Cheddar Premium" />
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Categoría</label>
                   <input required name="category" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" defaultValue={editingInsumo?.category || ""} placeholder="Ej: Lácteos" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Unidad Base</label>
                     <select name="baseUnit" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" defaultValue={editingInsumo?.baseUnit || editingInsumo?.unit || "UNIT"}>
                       <option value="UNIT">UNIT</option>
                       <option value="GR">GR</option>
                       <option value="ML">ML</option>
                     </select>
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Merma Teórica (%)</label>
                     <input required type="number" step="0.1" name="yield" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" defaultValue={editingInsumo?.historicalYieldPct ? Math.round((1 - editingInsumo.historicalYieldPct)*100) : 0} />
                  </div>
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Costo Bruto (ARS)</label>
                   <input required type="number" step="0.01" name="cost" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono text-indigo-600 font-bold outline-none focus:ring-2 focus:ring-indigo-500" defaultValue={(editingInsumo?.cost_cents || editingInsumo?.gross_cost_cents || editingInsumo?.grossCostCents || 0)/100} />
                </div>

                <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl flex gap-3 text-indigo-800">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5 text-indigo-500" />
                  <p className="text-xs font-medium leading-relaxed">Las alteraciones manuales modificarán los pronósticos del Simulador BOM O(1) inmediatamente para todas las recetas vinculadas a este nodo.</p>
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-[24px]">
                <button type="submit" disabled={isUploading} className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all shadow-md active:scale-[0.98]">
                  {isUploading ? "Mutando Ledger..." : (editingInsumo ? "Guardar Contrato en Ledger" : "Inyectar Insumo a B.D.")}
                </button>
              </div>
            </form>
          </div>
        )}
      </TabsPrimitive.Content>

      {/* PESTAÑA AÑADIDA: PRODUCTOS DE VENTA */}
      <TabsPrimitive.Content value="productos" className="flex flex-col gap-6 animate-in fade-in duration-500">
        
        {productsCatalog.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm flex flex-col">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Distribución (Top 3)</h3>
              <div className="flex-1 flex flex-col justify-center gap-2 mt-2">
                {Object.entries((productsCatalog as any[]).reduce((acc: any, p: any) => { 
                  const cat = p.category || "GENERAL";
                  acc[cat] = (acc[cat] || 0) + 1; 
                  return acc; 
                }, {})).sort((a: any, b: any) => (b[1] as number)-(a[1] as number)).slice(0,3).map(([cat, count]) => (
                  <div key={cat} className="flex justify-between items-center text-sm">
                    <span className="font-bold text-slate-700 truncate mr-2">{cat}</span>
                    <span className="font-mono text-slate-400 bg-slate-50 px-2 flex-shrink-0 py-0.5 rounded-md">{Number(count)} SKUs</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-[24px] p-6 text-white shadow-xl shadow-indigo-500/20 flex flex-col relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-20"><TrendingUp size={64}/></div>
               <h3 className="text-indigo-100 text-xs font-bold uppercase tracking-widest mb-1">Producto Estrella</h3>
               <div className="flex-1 flex flex-col justify-end z-10">
                 <div className="text-2xl font-black truncate">
                   {(() => {
                     const topPerf = [...performanceData].sort((a,b) => (b.totalVolume||0) - (a.totalVolume||0))[0];
                     if (!topPerf) return "N/A";
                     return topPerf.productSku.replace('PROD-', '');
                   })()}
                 </div>
                 <div className="text-indigo-200 text-sm font-medium mt-1">Líder en Volumen de Ventas Reales</div>
               </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-[24px] p-6 text-white shadow-xl shadow-emerald-500/20 flex flex-col relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-20"><Coins size={64}/></div>
               <h3 className="text-emerald-100 text-xs font-bold uppercase tracking-widest mb-1">Rey de la Caja</h3>
               <div className="flex-1 flex flex-col justify-end z-10">
                 <div className="text-2xl font-black truncate">
                    {(() => {
                     const topRev = [...performanceData].sort((a,b) => (b.totalRevenue||0) - (a.totalRevenue||0))[0];
                     if (!topRev) return "N/A";
                     return topRev.productSku.replace('PROD-', '');
                   })()}
                 </div>
                 <div className="text-emerald-200 text-sm font-medium mt-1">Mayor Aporte a la Facturación Bruta</div>
               </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[600px] h-[70vh]">
          <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:justify-between lg:items-center bg-slate-50/50 gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                Productos de Venta (Menú)
                <span className="bg-indigo-100 text-indigo-700 py-0.5 px-2.5 rounded-full text-xs font-bold">{productsCatalog.length} SKU TOTALES</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1">Control maestro de precios y clasificaciones comerciales.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button 
                onClick={async () => {
                  if(!confirm("¿Deseas restaurar el Catálogo Maestro PDR_?")) return;
                  const res = await repairProductCatalog();
                  if(res.success) {
                    alert((res as any).data?.message || "Sincronización exitosa");
                    window.location.reload();
                  } else {
                    alert("Error: " + res.error);
                  }
                }}
                className="bg-amber-50 border-2 border-amber-100 text-amber-700 px-4 py-2 rounded-xl font-bold text-xs hover:bg-amber-100 transition-colors flex items-center gap-2"
              >
                <DatabaseZap size={14} /> Sincronizar PDR_
              </button>
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm w-full sm:w-64">
                <Search size={16} className="text-slate-400" />
                <input 
                  className="outline-none text-sm font-medium w-full text-slate-700 bg-transparent placeholder-slate-400" 
                  placeholder="Buscar SKU o Nombre..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-slate-400" />
                <select 
                  className="outline-none text-xs font-bold text-slate-700 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm cursor-pointer"
                  value={productFilterCategory}
                  onChange={(e) => setProductFilterCategory(e.target.value)}
                >
                  <option value="ALL">Categorías (Todas)</option>
                  {uniqueProductCategories.map(c => (
                     <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-white">
            <table className="min-w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black tracking-widest text-slate-400 uppercase w-[35%]">Producto / SKU</th>
                  <th className="px-6 py-4 text-[10px] font-black tracking-widest text-slate-400 uppercase w-[25%]">Categoría</th>
                  <th className="px-6 py-4 text-[10px] font-black tracking-widest text-slate-400 uppercase text-right w-[25%]">Precio de Venta (ARS)</th>
                  <th className="px-6 py-4 text-[10px] font-black tracking-widest text-slate-400 uppercase text-center w-[15%]">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const isEditing = editingProductId === p.id;
                  return (
                    <tr key={p.id} className={`hover:bg-slate-50 transition-all group ${isEditing ? 'bg-indigo-50/30' : ''}`}>
                      <td className="px-6 py-4">
                        {isEditing ? (
                          <div className="space-y-2">
                             <input 
                               className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                               defaultValue={p.name || p.id}
                               onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                             />
                             <input 
                               className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-1 text-[10px] font-mono text-slate-500 outline-none"
                               defaultValue={p.sku}
                               onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                             />
                          </div>
                        ) : (
                          <>
                            <div className="font-bold text-slate-800 text-sm">{p.name || p.id}</div>
                            <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5">{p.sku}</div>
                          </>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {isEditing ? (
                          <input 
                            className="bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500"
                            defaultValue={p.category}
                            onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                          />
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-black tracking-tighter bg-slate-100 text-slate-500 border border-slate-200 uppercase">
                            {p.category}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center bg-white border border-indigo-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 ml-auto w-32 shadow-sm">
                            <span className="px-2 py-1.5 text-slate-400 bg-slate-50 border-r border-indigo-100 text-sm">$</span>
                            <input 
                              type="number"
                              className="w-full px-2 py-1.5 outline-none bg-transparent font-mono text-indigo-700 font-bold text-sm text-right"
                              defaultValue={p.price / 100}
                              onChange={(e) => setEditForm({ ...editForm, price: Math.round(parseFloat(e.target.value) * 100) })}
                            />
                          </div>
                        ) : (
                          <div className="font-mono text-sm font-black text-slate-700">
                             ${(p.price / 100).toLocaleString('es-AR')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-2">
                             <button 
                               disabled={isUploading}
                               onClick={async () => {
                                 setIsUploading(true);
                                 const res = await updateProduct({ id: p.id, data: editForm });
                                 if (res.success) {
                                   setEditingProductId(null);
                                   setEditForm({});
                                   window.location.reload();
                                 } else {
                                   alert("Error al actualizar: " + res.error);
                                   setIsUploading(false);
                                 }
                               }}
                               className="p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors shadow-md shadow-emerald-200"
                             >
                               {isUploading ? <DatabaseZap className="w-4 h-4 animate-pulse" /> : <Save size={16} />}
                             </button>
                             <button 
                               onClick={() => { setEditingProductId(null); setEditForm({}); }}
                               className="p-2 bg-slate-100 text-slate-400 rounded-xl hover:bg-slate-200 transition-colors"
                             >
                               <X size={16} />
                             </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => { setEditingProductId(p.id); setEditForm({}); }}
                            className="p-2 bg-white border border-slate-100 text-slate-400 rounded-xl hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm opacity-0 group-hover:opacity-100"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredProducts.length === 0 && (
              <div className="w-full h-full flex flex-col items-center justify-center p-12 text-slate-400">
                <Search size={48} className="mb-4 opacity-20" />
                <p className="font-bold text-sm">No se encontraron productos con esos filtros.</p>
              </div>
            )}
          </div>
        </div>
      </TabsPrimitive.Content>

      {/* PESTAÑA 2: RECETAS */}
      <TabsPrimitive.Content value="recetas" className="animate-in fade-in duration-500">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-[800px]">
          
          {/* Panel Izquierdo: Lista de Productos */}
          <div className="xl:col-span-1 bg-white border border-slate-100 rounded-[24px] shadow-sm flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Menú Comercial</h3>
              <p className="text-[11px] font-bold text-slate-400 tracking-wide mt-1">Selecciona para ensamblar BOM</p>
            </div>
            <div className="flex-1 overflow-auto divide-y divide-slate-100 p-2">
              {productsCatalog.map(p => (
                <button
                  key={p.id}
                  onClick={() => loadRecipe(p)}
                  className={`w-full text-left p-4 rounded-xl flex items-center justify-between transition-all group ${selectedRecipeProduct?.id === p.id ? 'bg-indigo-50 border border-indigo-100 shadow-sm' : 'hover:bg-slate-50 border border-transparent'}`}
                >
                  <div>
                    <div className={`font-bold text-sm ${selectedRecipeProduct?.id === p.id ? 'text-indigo-900' : 'text-slate-700'}`}>{p.id.replace('PROD-', '')}</div>
                    <div className="text-[10px] font-mono text-slate-400">PVP: ${(p.price / 100).toLocaleString('es-AR')}</div>
                  </div>
                  <ChevronRight size={16} className={`${selectedRecipeProduct?.id === p.id ? 'text-indigo-500' : 'text-slate-300 group-hover:text-slate-400'}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Panel Derecho: Canvas de la Receta */}
          <div className="xl:col-span-2 bg-white border border-slate-100 rounded-[24px] shadow-sm flex flex-col relative overflow-hidden">
            {selectedRecipeProduct ? (
              <>
                <div className="p-6 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-black flex items-center gap-3">
                      <span className="w-3 h-6 bg-emerald-500 rounded-sm"></span>
                      Receta Maestra: {selectedRecipeProduct.id.replace('PROD-', '')}
                    </h2>
                    <p className="text-sm text-slate-400 mt-1 font-medium">Motor O(1) de Acoplamiento de MDM</p>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">PVP Comercial</div>
                    <div className="text-2xl font-mono font-black text-emerald-400">${(selectedRecipeProduct.price / 100).toLocaleString('es-AR')}</div>
                  </div>
                </div>

                {isRecipeLoading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col p-6 bg-slate-50/30">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2">
                        <DatabaseZap size={16} className="text-indigo-500"/> Ensalmblaje Estructural (BOM)
                      </h3>
                      <button
                        onClick={() => setIsAddIngredientOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 font-bold text-xs uppercase tracking-widest rounded-lg flex items-center gap-2 shadow-sm transition-colors"
                      >
                        <Plus size={14}/> Añadir Insumo
                      </button>
                    </div>

                    <div className="bg-white border flex-1 border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">MDM (Insumo)</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Costo MDM (Base)</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cant. Receta</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Subtotal BOM</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {currentRecipe.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-medium text-sm">El producto no tiene insumos acoplados. Su costo base actual es $0.</td></tr>
                          ) : (
                            currentRecipe.map(ingLine => {
                               const matchItem = catalog.find(c => (c as any).id === ingLine.childId) as any || { name: ingLine.childId, cost_cents: 0, unit: 'UNIT', base_unit: 'UNIT', baseUnit: 'UNIT' };
                               const itemCost = (matchItem.cost_cents || matchItem.grossCostCents || matchItem.gross_cost_cents || 0);
                               const multiplier = (ingLine as any).unitMultiplier || 1.0;
                               const subtotal = Math.round(itemCost * ingLine.quantity * multiplier);
                              return (
                                <tr key={ingLine.id} className="hover:bg-slate-50">
                                  <td className="px-6 py-3 font-bold text-slate-800 text-sm">{matchItem.name}</td>
                                  <td className="px-4 py-2">
                                     <div className="flex items-center bg-white border border-slate-200 rounded-md overflow-hidden text-sm focus-within:ring-2 focus-within:ring-indigo-500 shadow-sm w-32">
                                        <input 
                                           title={`Costo por ${matchItem.unit || matchItem.baseUnit || matchItem.base_unit || 'Unidad'}`}
                                           type="number" 
                                           defaultValue={itemCost/100}
                                           step="0.01"
                                           onBlur={async (e) => {
                                              const newVal = Math.round(parseFloat(e.target.value) * 100);
                                               if (newVal !== itemCost && !isNaN(newVal)) {
                                                  await updateRecipeIngredient((ingLine as any).id, (ingLine as any).quantity, (ingLine as any).unitMultiplier || 1.0, matchItem.id, newVal);
                                                  startTransition(() => {
                                                    router.refresh();
                                                    loadRecipe(selectedRecipeProduct);
                                                  });
                                               }
                                           }}
                                           className="w-full px-2 py-1.5 outline-none bg-transparent font-mono text-slate-700 font-bold"
                                         />
                                         <span 
                                           onClick={async () => {
                                              const currentBase = matchItem.unit || matchItem.baseUnit || matchItem.base_unit || 'UNIT';
                                              let nextBase = currentBase;
                                              let nextMult = (ingLine as any).unitMultiplier || 1.0;
                                              
                                              if (currentBase === 'GR') { nextBase = 'KG'; nextMult = 0.001; }
                                              else if (currentBase === 'KG') { nextBase = 'GR'; nextMult = 1.0; }
                                              else if (currentBase === 'ML') { nextBase = 'L'; nextMult = 0.001; }
                                              else if (currentBase === 'L') { nextBase = 'ML'; nextMult = 1.0; }
                                              
                                              await updateRecipeIngredient((ingLine as any).id, (ingLine as any).quantity, nextMult, matchItem.id, itemCost, nextBase);
                                              startTransition(() => {
                                                router.refresh();
                                                loadRecipe(selectedRecipeProduct);
                                              });
                                           }}
                                           className="px-2 py-1.5 text-[10px] font-black text-slate-400 bg-slate-50 border-l border-slate-200 cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                                           title="Clic para cambiar Unidad Maestra (Ej: de GR a KG)"
                                         >
                                           / {(matchItem.unit || matchItem.baseUnit || matchItem.base_unit || 'UNIT')}
                                         </span>
                                     </div>
                                  </td>
                                  <td className="px-4 py-2 bg-indigo-50/30">
                                     <div className="flex gap-2">
                                        <input 
                                          title="Cantidad Teórica (BOM)"
                                          type="number"
                                          defaultValue={ingLine.quantity}
                                          step="0.001"
                                          onBlur={async (e) => {
                                            const newQty = parseFloat(e.target.value);
                                             if (newQty !== ingLine.quantity && !isNaN(newQty)) {
                                               await updateRecipeIngredient((ingLine as any).id, newQty, (ingLine as any).unitMultiplier || 1.0, matchItem.id, itemCost);
                                               loadRecipe(selectedRecipeProduct);
                                             }
                                          }}
                                          className="w-20 px-2 py-1.5 border border-indigo-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-mono text-indigo-700 font-bold shadow-sm"
                                        />
                                        <select 
                                          title="Unidad de Medida (MDM)"
                                          value={ ((ingLine as any).unitMultiplier === 0.001) ? ( (matchItem.unit || matchItem.baseUnit || matchItem.base_unit) === 'KG' ? 'GR' : 'ML' ) : (matchItem.unit || matchItem.baseUnit || matchItem.base_unit || 'UNIT') }
                                          onChange={async (e) => {
                                               const newUnit = e.target.value;
                                               const baseUnit = matchItem.unit || matchItem.baseUnit || matchItem.base_unit || 'UNIT';
                                               let multiplier = 1.0;
                                               if ((baseUnit === 'KG' && newUnit === 'GR') || (baseUnit === 'L' && newUnit === 'ML')) {
                                                  multiplier = 0.001;
                                               }
                                               await updateRecipeIngredient((ingLine as any).id, (ingLine as any).quantity, multiplier, matchItem.id, itemCost);
                                               startTransition(() => {
                                                 router.refresh();
                                                 loadRecipe(selectedRecipeProduct);
                                               });
                                           }}
                                          className="w-[72px] px-1 py-1.5 border border-indigo-200 rounded-md text-xs font-bold uppercase tracking-widest text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm cursor-pointer"
                                        >
                                          <option value="UNIT">UNI</option>
                                          <option value="GR">GR</option>
                                          <option value="ML">ML</option>
                                          <option value="KG">KG</option>
                                          <option value="L">L</option>
                                        </select>
                                     </div>
                                  </td>
                                  <td className="px-6 py-3 font-mono text-indigo-700 font-bold text-right text-sm">${(subtotal/100).toLocaleString('es-AR')}</td>
                                  <td className="px-6 py-3 text-center">
                                    <button 
                                      onClick={async () => {
                                        const res = await removeIngredientFromRecipe(ingLine.id);
                                        if(res.success) loadRecipe(selectedRecipeProduct);
                                      }}
                                      className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                    >
                                      <Trash2 size={16}/>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                        <tfoot className="bg-slate-900 border-t border-slate-700 text-white">
                          <tr>
                            <td colSpan={3} className="px-6 py-4 text-right font-black uppercase tracking-widest text-xs text-slate-300">Costo Total MDM (BOM)</td>
                            <td className="px-6 py-4 font-mono font-black text-emerald-400 text-right text-lg">
                               ${(currentRecipe.reduce((acc, current) => {
                                 const match = catalog.find(c => c.id === current.childId);
                                 const costCenter = match ? (match.cost_cents || match.grossCostCents || match.gross_cost_cents || 0) : 0;
                                 const mult = current.unitMultiplier || 1.0;
                                 return acc + (costCenter * current.quantity * mult);
                               }, 0) / 100).toLocaleString('es-AR')}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/30 p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mb-4">
                  <DatabaseZap size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest">Sin Selección Activa</h3>
                <p className="text-slate-400 text-sm mt-2 max-w-sm">Selecciona un producto del catálogo maestro en el panel izquierdo para mapear y explosionar su estructura de costos.</p>
              </div>
            )}
            
            {/* Modal: Añadir Insumo */}
            {isAddIngredientOpen && (
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-20 flex items-center justify-center animate-in fade-in duration-200">
                <div className="bg-white w-[90%] max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h4 className="font-bold text-slate-800 text-sm uppercase tracking-widest">Inyección Vectorial</h4>
                    <button onClick={() => setIsAddIngredientOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Selección MDM (Insumo)</label>
                      <select 
                        value={newIngId} onChange={e => setNewIngId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 px-3 py-2 text-sm font-medium"
                      >
                        <option value="">Seleccionar del catálogo o DB...</option>
                        {catalog.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({(c.unit || c.baseUnit || c.base_unit || 'UNIT')})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Cantidad (Teórica)</label>
                      <input 
                        type="number" step="0.001" value={newIngQty} onChange={e => setNewIngQty(e.target.value)}
                        placeholder="Ej: 0.125"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 px-3 py-2 text-sm font-mono font-bold"
                      />
                    </div>
                    <button 
                      disabled={!newIngId || !newIngQty || isNaN(parseFloat(newIngQty))}
                      onClick={async () => {
                        const res = await addIngredientToRecipe({ 
                          productId: selectedRecipeProduct.id, 
                          ingredientId: newIngId, 
                          qty: parseFloat(newIngQty) 
                        });
                        if(res.success) {
                          setNewIngId(""); setNewIngQty(""); setIsAddIngredientOpen(false);
                          loadRecipe(selectedRecipeProduct);
                        } else alert("Fallo en mutación: " + res.error);
                      }}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold uppercase tracking-widest text-[10px] py-3 rounded-lg shadow-sm mt-2 transition-colors"
                    >
                      Acoplar Insumo Atómicamente
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </TabsPrimitive.Content>
      
      {/* PESTAÑA 3: PROVEEDORES */}
      <TabsPrimitive.Content value="proveedores" className="animate-in fade-in duration-500">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-[800px]">
          
          {/* Panel Izquierdo: Lista de Proveedores */}
          <div className="xl:col-span-1 bg-white border border-slate-100 rounded-[24px] shadow-sm flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Directorio B2B</h3>
                  <p className="text-[11px] font-bold text-slate-400 tracking-wide mt-1">{suppliersCatalog.length} Entidades Activas</p>
                </div>
                <button 
                  onClick={() => { setEditingSupplier(null); setIsSupplierDrawerOpen(true); }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-xl transition-colors shadow-sm"
                >
                  <Plus size={18} />
                </button>
              </div>
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm w-full">
                 <Search size={16} className="text-slate-400" />
                 <input 
                   className="outline-none text-sm font-medium w-full text-slate-700 bg-transparent placeholder-slate-400" 
                   placeholder="Buscar CUIT, Nombre..."
                   value={supplierSearchSearch}
                   onChange={(e) => setSupplierSearchSearch(e.target.value)}
                 />
              </div>
            </div>
            <div className="flex-1 overflow-auto divide-y divide-slate-100 p-2">
              {filteredSuppliers.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSupplier(s)}
                  className={`w-full text-left p-4 rounded-xl flex items-center justify-between transition-all group ${selectedSupplier?.id === s.id ? 'bg-indigo-50 border border-indigo-100 shadow-sm' : 'hover:bg-slate-50 border border-transparent'}`}
                >
                  <div>
                    <div className={`font-bold text-sm flex items-center gap-2 ${selectedSupplier?.id === s.id ? 'text-indigo-900' : 'text-slate-700'}`}>
                      {s.name}
                      {!s.active && <span className="bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full text-[9px] uppercase tracking-widest">Inactivo</span>}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 mt-1">CUIT: {s.cuit}</div>
                  </div>
                  <ChevronRight size={16} className={`${selectedSupplier?.id === s.id ? 'text-indigo-500' : 'text-slate-300 group-hover:text-slate-400'}`} />
                </button>
              ))}
              {filteredSuppliers.length === 0 && (
                <div className="p-8 text-center text-slate-400 font-medium text-xs">No se encontraron entidades.</div>
              )}
            </div>
          </div>

          {/* Panel Derecho: Ficha Maestra del Proveedor */}
          <div className="xl:col-span-2 bg-white border border-slate-100 rounded-[24px] shadow-sm flex flex-col relative overflow-hidden">
            {selectedSupplier ? (
              <>
                <div className="p-8 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-start relative overflow-hidden">
                  <div className="absolute -right-8 -top-8 text-slate-800 opacity-20 rotate-12">
                    <Building size={160} />
                  </div>
                  <div className="z-10">
                    <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest inline-block mb-4">
                      {selectedSupplier.category}
                    </span>
                    <h2 className="text-3xl font-black">{selectedSupplier.name}</h2>
                    <div className="flex items-center gap-4 mt-3 text-slate-400 text-sm font-medium">
                      <span className="flex items-center gap-1"><Briefcase size={14}/> CUIT: <span className="font-mono text-slate-200">{selectedSupplier.cuit}</span></span>
                      <span className="flex items-center gap-1"><Phone size={14}/> Tel: <span className="font-mono text-slate-200">{selectedSupplier.phone || 'S/D'}</span></span>
                    </div>
                  </div>
                  <div className="z-10">
                    <button 
                      onClick={() => { setEditingSupplier(selectedSupplier); setIsSupplierDrawerOpen(true); }}
                      className="bg-white text-slate-900 hover:bg-slate-100 px-4 py-2 font-bold text-xs uppercase tracking-widest rounded-lg flex items-center gap-2 shadow-sm transition-colors"
                    >
                      Editar Ficha
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-8 bg-slate-50/50">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-4 opacity-5"><Coins size={80}/></div>
                       <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Coins size={14}/> Cuentas por Pagar (Al Vuelo)</h4>
                       
                       {supplierBalanceData ? (
                         <div className="space-y-4 relative z-10">
                           <div>
                             <div className="text-xs text-slate-500 mb-1">Saldo Deudor Dinámico</div>
                             <div className={`text-2xl font-black ${supplierBalanceData.balanceCents > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                               ${(supplierBalanceData.balanceCents/100).toLocaleString('es-AR')}
                             </div>
                           </div>
                           <div className="grid grid-cols-2 gap-4 mt-2 border-t border-slate-100 pt-3">
                             <div>
                               <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Aprobado</div>
                               <div className="text-sm font-mono text-slate-700">${(supplierBalanceData.totalBilledCents/100).toLocaleString('es-AR')}</div>
                             </div>
                             <div>
                               <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Pagado</div>
                               <div className="text-sm font-mono text-slate-700">${(supplierBalanceData.totalPaidCents/100).toLocaleString('es-AR')}</div>
                             </div>
                           </div>
                         </div>
                       ) : (
                          <div className="h-24 animate-pulse bg-slate-50 rounded-xl w-full"></div>
                       )}
                    </div>
                    
                    <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 p-6 rounded-2xl border border-indigo-800 shadow-sm flex flex-col text-white relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-4 opacity-10"><Activity size={80}/></div>
                       <h4 className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mb-4 flex items-center gap-2 z-10"><Activity size={14}/> Puntuación de Rendimiento (Yield)</h4>
                       
                       {supplierScoreData ? (
                         <div className="space-y-4 z-10">
                           <div className="flex items-end gap-3">
                             <div className="text-4xl font-black text-indigo-100">{supplierScoreData.score.toFixed(1)}</div>
                             <div className="text-xs font-bold text-indigo-300 mb-2 uppercase tracking-widest">Score General</div>
                           </div>
                           <div className="w-full bg-indigo-950 rounded-full h-1.5 mb-4">
                              <div className="bg-indigo-400 h-1.5 rounded-full" style={{ width: `${supplierScoreData.score}%` }}></div>
                           </div>
                           <div className="flex gap-4 text-xs font-medium text-indigo-200">
                             <div><span className="text-white font-bold">{supplierScoreData.yieldPct.toFixed(1)}%</span> Avg Yield</div>
                             <div><span className="text-white font-bold">{supplierScoreData.matchRatePct.toFixed(1)}%</span> Match Rate (3V)</div>
                           </div>
                         </div>
                       ) : (
                          <div className="h-24 animate-pulse bg-indigo-900/50 rounded-xl w-full"></div>
                       )}
                    </div>
                  </div>
                  
                  {/* Gráfico Cruzado: Precio vs Costo Verdadero */}
                  <div className="mt-6 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col h-72">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                       <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Desviación: Precio Pagado vs Costo Post-Merma (ARS)</h4>
                       <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">O(N) Live Rendering</span>
                    </div>
                    <div className="flex-1 p-4 w-full h-full">
                       {supplierChartData.length > 0 ? (
                         <ResponsiveContainer width="100%" height="100%">
                           <ComposedChart data={supplierChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                             <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                             <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                             <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                             <Tooltip 
                               contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                               formatter={(value: any) => [`$${Number(value || 0).toLocaleString('es-AR')} ARS`, '']}
                             />
                             <Bar dataKey="precioPagado" name="Precio Lista" fill="#94a3b8" radius={[4,4,0,0]} maxBarSize={40} />
                             <Line type="monotone" dataKey="costoPostMerma" name="Costo Real (Post-Merma)" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} />
                           </ComposedChart>
                         </ResponsiveContainer>
                       ) : (
                         <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 font-medium text-sm">
                           No hay insumos acoplados a esta entidad en la tabla raw_materials.
                         </div>
                       )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/30 p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mb-4">
                  <Building size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest">Cero Fricción B2B</h3>
                <p className="text-slate-400 text-sm mt-2 max-w-sm">Selecciona una entidad comercial del panel izquierdo para auditar SLA, CBUs y riesgo financiero.</p>
              </div>
            )}
            
            {/* Modal: Editar/Añadir Proveedor */}
            {isSupplierDrawerOpen && (
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-20 flex items-center justify-center animate-in fade-in duration-200">
                <form 
                  className="bg-white w-[90%] max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]"
                  onSubmit={async (e: any) => {
                    e.preventDefault();
                    setIsUploading(true);
                    const formData = new FormData(e.target);
                    const payload: any = {
                      name: String(formData.get("name") || ""),
                      cuit: String(formData.get("cuit") || ""),
                      cbu: String(formData.get("cbu") || ""),
                      category: String(formData.get("category") || "Insumos"),
                      paymentMethod: String(formData.get("paymentMethod") || "TRANSFERENCIA"),
                      paymentTerms: String(formData.get("paymentTerms") || "Contado"),
                      leadTime: parseInt(formData.get("leadTime") as string || "24"),
                      invoiceType: String(formData.get("invoiceType") || "FACTURA"),
                      phone: String(formData.get("phone") || ""),
                      active: formData.get("active") === "on",
                      storeId: "global", // Suppliers are usually global in this system
                    };
                    const res = await upsertSupplier({ ...payload, id: editingSupplier?.id || undefined });
                    if(res.success) {
                      window.location.reload();
                    } else {
                      alert("Error: " + res.error);
                      setIsUploading(false);
                    }
                  }}
                >
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                      <h4 className="font-black text-slate-800 text-lg">{editingSupplier ? "Editar Entidad" : "Nueva Entidad a Ledger"}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Alta temprana y Prevención de Riesgo</p>
                    </div>
                    <div className="flex gap-2">
                       {editingSupplier && (
                         <button 
                           type="button"
                           onClick={async () => {
                             if(confirm("¿Eliminar este proveedor atómicamente?")) {
                               setIsUploading(true);
                               await deleteSupplier(editingSupplier.id);
                               window.location.reload();
                             }
                           }}
                           className="p-2 border border-rose-100 bg-rose-50 text-rose-500 rounded-full hover:bg-rose-100 transition-colors"
                         >
                           <Trash2 size={18}/>
                         </button>
                       )}
                       <button type="button" onClick={() => setIsSupplierDrawerOpen(false)} className="bg-white border border-slate-200 text-slate-400 hover:text-slate-600 rounded-full p-2"><X size={18}/></button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto p-6 space-y-6">
                     <div className="grid grid-cols-2 gap-6">
                       <div>
                         <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Razón Social</label>
                         <input required name="name" defaultValue={editingSupplier?.name} className="w-full bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 px-3 py-2 text-sm font-bold text-slate-800" />
                       </div>
                       <div>
                         <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">CUIT Comercial</label>
                         <input required name="cuit" defaultValue={editingSupplier?.cuit} placeholder="Ej: 30-71112223-4" className="w-full bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 px-3 py-2 text-sm font-mono text-slate-700" />
                       </div>
                       <div>
                         <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Categoría</label>
                         <select required name="category" defaultValue={editingSupplier?.category || "Insumos"} className="w-full bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 px-3 py-2 text-sm font-bold text-slate-700">
                           <option value="Insumos">Insumos (Alimentos)</option>
                           <option value="Servicios">Servicios Generales</option>
                           <option value="Mantenimiento">Mantenimiento</option>
                           <option value="Otros">Otros</option>
                         </select>
                       </div>
                       <div>
                         <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">CBU / Alias Bancario</label>
                         <input name="cbu" defaultValue={editingSupplier?.cbu} className="w-full bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 px-3 py-2 text-sm font-mono text-indigo-700 font-bold" />
                       </div>
                       <div>
                         <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Método de Pago</label>
                         <select required name="paymentMethod" defaultValue={editingSupplier?.paymentMethod || "TRANSFERENCIA"} className="w-full bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 px-3 py-2 text-sm font-bold text-slate-700">
                           <option value="TRANSFERENCIA">Transferencia</option>
                           <option value="EFECTIVO">Efectivo</option>
                           <option value="CHEQUE">Cheque</option>
                           <option value="CRIPTO">Criptoactivos</option>
                         </select>
                       </div>
                       <div>
                         <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Condición (Plazo)</label>
                         <input required name="paymentTerms" defaultValue={editingSupplier?.paymentTerms || "Contado"} placeholder="Ej: A 30 Días" className="w-full bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 px-3 py-2 text-sm font-medium text-slate-700" />
                       </div>
                       <div>
                         <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">SLA (Lead Time Hrs)</label>
                         <input required type="number" name="leadTime" defaultValue={editingSupplier?.leadTime || 24} className="w-full bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 px-3 py-2 text-sm font-mono text-slate-700" />
                       </div>
                       <div>
                         <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Tipo de Factura</label>
                         <select required name="invoiceType" defaultValue={editingSupplier?.invoiceType || "FACTURA"} className="w-full bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 px-3 py-2 text-sm font-bold text-slate-700">
                           <option value="FACTURA">Factura Fiscalizada</option>
                           <option value="REMITO">Remito Interno (X)</option>
                           <option value="AMBAS">Ambas Permutadas</option>
                         </select>
                       </div>
                       <div>
                         <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Teléfono</label>
                         <input name="phone" defaultValue={editingSupplier?.phone} className="w-full bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 px-3 py-2 text-sm font-medium text-slate-700" />
                       </div>
                       <div className="flex items-center gap-3 mt-4">
                         <input type="checkbox" name="active" defaultChecked={editingSupplier ? editingSupplier.active : true} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" />
                         <label className="text-xs font-bold text-slate-700">Entidad Habilitada para Transacciones</label>
                       </div>
                     </div>
                  </div>
                  <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                     <button type="button" onClick={() => setIsSupplierDrawerOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200 transition-colors">Cancelar</button>
                     <button type="submit" disabled={isUploading} className="px-5 py-2.5 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2">
                       {isUploading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
                       Guardar en Ledger
                     </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </TabsPrimitive.Content>

      {/* PESTAÑA 4: ANALÍTICA (Simulador) */}
      <TabsPrimitive.Content value="analitica" className="flex flex-col xl:flex-row gap-6 animate-in fade-in duration-500">
        {/* Formularios Simulador */}
        <div className="w-full xl:w-1/3 flex flex-col gap-6">
          <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
            <h3 className="uppercase tracking-widest font-bold text-slate-400 text-xs mb-6">Motor de Simulación Inflacionaria</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">Insumo Afectado</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  value={selectedIngredient}
                  onChange={e => setSelectedIngredient(e.target.value)}
                >
                  <option value="">Selecciona un insumo matriz...</option>
                  {catalog.map(c => (
                    <option key={c.id} value={c.id}>{c.name} (${(c.cost_cents/100).toLocaleString()} / {c.unit})</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">Delta (%) Inflación/Deflación</label>
                <input 
                  type="number" 
                  step="0.1"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  value={inflationPct}
                  onChange={e => setInflationPct(parseFloat(e.target.value) || 0)}
                  placeholder="Ej: 15.5"
                />
              </div>

              <button 
                className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-widest py-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                onClick={handleSimulate}
                disabled={isSimulating || !selectedIngredient}
              >
                <DatabaseZap className="w-4 h-4" />
                {isSimulating ? "Computando Red BOM..." : "Simular Impacto"}
              </button>
            </div>
          </div>
        </div>

        {/* DataGrid Resultados */}
        <div className="w-full xl:w-2/3">
          <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm min-h-[400px]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="uppercase tracking-widest font-bold text-slate-400 text-xs">Radiografía de Recetas Dependientes</h3>
              {simulationResults.length > 0 && (
                <button 
                  onClick={handleApply}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] uppercase tracking-widest px-4 py-2 rounded-lg transition-all shadow-sm"
                >
                  Aplicar Nuevo Costo a Recetas (Mutación Atómica)
                </button>
              )}
            </div>

            {simulationResults.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm font-medium">
                Inyecta un insumo y dispara la simulación para visualizar su daño estructural.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-100 uppercase tracking-widest text-[10px] font-bold text-slate-500">
                    <tr>
                      <th className="px-6 py-4">Producto Venta</th>
                      <th className="px-6 py-4">PVP</th>
                      <th className="px-6 py-4">Costo Viejo</th>
                      <th className="px-6 py-4">Costo NUEVO</th>
                      <th className="px-6 py-4">Margen Viejo</th>
                      <th className="px-6 py-4">Margen NUEVO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {simulationResults.map(r => {
                      const isBloody = r.simulated_margin_pct < 20;
                      return (
                        <tr key={r.product_id} className={`hover:bg-slate-50 transition-colors ${isBloody ? 'bg-rose-50/50' : ''}`}>
                          <td className="px-6 py-4 font-bold text-slate-900">{r.product_name}</td>
                          <td className="px-6 py-4 tabular-nums">${(r.price / 100).toLocaleString()}</td>
                          <td className="px-6 py-4 tabular-nums text-slate-400">${(r.current_cost / 100).toLocaleString()}</td>
                          <td className="px-6 py-4 tabular-nums font-bold text-slate-900">${(r.simulated_cost / 100).toLocaleString()}</td>
                          <td className="px-6 py-4 tabular-nums font-medium text-emerald-600">{Number(r.current_margin_pct).toFixed(1)}%</td>
                          <td className="px-6 py-4 tabular-nums">
                            {isBloody ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-rose-100 text-rose-800 font-bold border border-rose-200">
                                <AlertTriangle className="w-3 h-3" /> {Number(r.simulated_margin_pct).toFixed(1)}%
                              </span>
                            ) : (
                              <span className="font-bold text-slate-900">{Number(r.simulated_margin_pct).toFixed(1)}%</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </TabsPrimitive.Content>
    </TabsPrimitive.Root>
  );
}
