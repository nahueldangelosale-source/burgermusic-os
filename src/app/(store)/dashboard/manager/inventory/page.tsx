import { Suspense } from "react";
import { VirtualizedInventoryGrid, KitchenLogsTimeline } from "./inventory-client";

// Generación de 10,000 filas O(1) para probar virtualización (Evita Crash de Event Loop)
const dummyInventoryData = Array.from({ length: 10000 }).map((_, i) => {
  const stockInicial = 5000 + Math.random() * 1000;
  const consumoBom = 4000 + Math.random() * 500;
  const conteoCiego = consumoBom - (Math.random() * 200 - 50); // Introduciendo varianza aleatoria
  const varianza = ((conteoCiego - consumoBom) / consumoBom) * 100;
  
  return {
    id: `PRD-${i}`,
    insumo: `Insumo Gastronómico ${i}`,
    stockInicial: Math.round(stockInicial),
    consumoBom: Math.round(consumoBom),
    conteoCiego: Math.round(conteoCiego),
    varianza: Number(varianza.toFixed(2)),
  };
});

const dummyLogs = [
  { time: "14:32:05", event: "Merma registrada: 250g Carne (Caída)" },
  { time: "16:15:22", event: "Ajuste de inventario: Mermas Patatas (Quemadas)" },
];

export default function InventoryManagerPage() {
  return (
    <div className="min-h-screen bg-[oklch(0.95_0.02_250)] p-6 font-sans">
      <header className="mb-8">
        <h1 className="text-3xl font-black tracking-tighter text-[oklch(0.15_0.02_250)]">
          INVENTORY VIRTUALIZATION ENGINE
        </h1>
        <p className="text-[oklch(0.45_0.02_250)] font-mono text-xs tracking-widest uppercase mt-2">
          Zero-Lag 10k Rows DataGrid
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="col-span-1 lg:col-span-9 bg-[oklch(0.98_0.01_250)] p-6 rounded-3xl ring-1 ring-zinc-200 shadow-sm">
           <h2 className="font-mono uppercase tracking-widest text-[oklch(0.45_0.02_250)] mb-6 font-bold">Varianza Diaria (AvT)</h2>
           <Suspense fallback={<div className="h-[500px] animate-pulse bg-zinc-200/50 rounded-xl" />}>
             <VirtualizedInventoryGrid data={dummyInventoryData} />
           </Suspense>
        </div>

        <div className="col-span-1 lg:col-span-3 bg-[oklch(0.98_0.01_250)] p-6 rounded-3xl ring-1 ring-zinc-200 shadow-sm">
           <h2 className="font-mono uppercase tracking-widest text-[oklch(0.45_0.02_250)] mb-6 font-bold">Kitchen Logs</h2>
           <KitchenLogsTimeline logs={dummyLogs} />
        </div>
      </div>
    </div>
  );
}
