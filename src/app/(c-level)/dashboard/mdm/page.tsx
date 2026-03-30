"use client";

import { getRawMaterialsForSimulation, simulateCostImpact } from "@/actions/cost-simulator";
import { MermaidChart } from "@/components/mermaid-chart";
import { Calculator, GitBranch, Network } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const INITIAL_GRAPH = `
graph TD
    classDef core fill:#ffffff,stroke:#e5e7eb,color:#374151,stroke-width:1px,rx:2,ry:2,font-family:sans-serif
    A("Seleccione un insumo para iniciar propagación de costos"):::core
`;

export default function MDMDashboard() {
  // Simulator State
  const [materials, setMaterials] = useState<
    Array<{ id: string; name: string; currentCost: number }>
  >([]);
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [inflationPct, setInflationPct] = useState(15);
  const [isSimulating, setIsSimulating] = useState(false);
  const [mermaidCode, setMermaidCode] = useState(INITIAL_GRAPH);

  useEffect(() => {
    getRawMaterialsForSimulation().then((data) => setMaterials(data));
  }, []);

  const handleSimulate = async () => {
    if (!selectedMaterial) {
      toast.error("Seleccione un insumo base.");
      return;
    }
    setIsSimulating(true);
    const result = await simulateCostImpact(selectedMaterial, inflationPct);
    if (result.success && result.mermaidCode) {
      setMermaidCode(result.mermaidCode);
      toast.success("Simulación de Costos Dinámicos completada con éxito.");
    } else {
      toast.error(result.error || "Error al calcular el impacto.");
    }
    setIsSimulating(false);
  };

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 overflow-hidden w-full font-sans">
      <div className="flex-1 p-6 md:p-10 overflow-y-auto w-full h-screen">
        <header className="mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-gray-900">
            Master Data Management & Precios
          </h1>
          <p className="font-mono text-sm text-gray-500 mt-2 tracking-widest uppercase">
            Gestión de Catálogo • Costos y Recetas Dinámicas
          </p>
        </header>

        <main className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 auto-rows-max">
          {/* WIDGET 1: Simulador de Costos e Inflación */}
          <div className="col-span-1 md:col-span-12 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Controles de Simulación */}
            <div className="bg-[var(--bg-elevated)] border border-gray-200 flex flex-col justify-center rounded-2xl shadow-sm p-8">
              <h2 className="text-lg font-bold uppercase tracking-widest text-gray-900 flex items-center gap-3 mb-6">
                <Calculator size={20} className="text-blue-600" /> Simulador de Costos e Inflación
              </h2>
              <p className="text-xs text-gray-500 mb-6">
                Modela el impacto financiero en toda la cadena del menú ante las fluctuaciones de
                proveedores.
              </p>

              <div className="space-y-5">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">
                    Insumo a Simular
                  </label>
                  <select
                    value={selectedMaterial}
                    onChange={(e) => setSelectedMaterial(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm font-medium rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3"
                  >
                    <option value="">Seleccione un insumo de base...</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} (${m.currentCost.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">
                    % de Aumento Esperado
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={inflationPct}
                      onChange={(e) => setInflationPct(Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-3 text-gray-900 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-gray-500 font-bold">
                      %
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSimulate}
                  disabled={isSimulating || !selectedMaterial}
                  className="w-full bg-gray-900 hover:bg-black text-white px-6 py-3.5 rounded-xl flex justify-center items-center gap-2 font-bold disabled:opacity-50 transition-colors shadow-md mt-4"
                >
                  {isSimulating ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <GitBranch size={18} />
                  )}
                  Simular Impacto en Menú
                </button>
              </div>
            </div>

            {/* Árbol de Propagación (Mermaid) */}
            <div className="col-span-2 bg-[var(--bg-elevated)] border border-gray-200 flex flex-col relative overflow-hidden rounded-2xl shadow-sm p-8 min-h-[500px]">
              <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-3 mb-6 text-gray-900">
                <Network size={16} className="text-gray-400" /> Propagación en Cascada (BOM)
              </h2>
              <div className="flex-1 w-full flex items-center justify-center relative z-10 overflow-auto bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                {isSimulating ? (
                  <div className="flex flex-col items-center opacity-60">
                    <Network size={32} className="animate-pulse text-blue-600 mb-3" />
                    <p className="font-mono text-xs tracking-widest uppercase">
                      Calculando Ramificaciones...
                    </p>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center py-4">
                    <MermaidChart chart={mermaidCode} id="simulator-graph" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
