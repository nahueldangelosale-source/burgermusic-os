"use client";

import { useTransition } from "react";
import { motion } from "framer-motion";
import { BarChart, Card, Title, Text, Metric } from "@tremor/react";

export function SmartOrderingAction() {
  const [isPending, startTransition] = useTransition();

  const handleApprove = () => {
    startTransition(async () => {
      // Simulación de Server Action (Mutación O(1))
      await new Promise((resolve) => setTimeout(resolve, 2000));
    });
  };

  return (
    <button
      onClick={handleApprove}
      disabled={isPending}
      className={`w-full py-4 px-6 rounded-xl font-bold uppercase tracking-widest transition-all ${
        isPending ? "bg-zinc-200 text-zinc-500 cursor-not-allowed" : "bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
      }`}
    >
      {isPending ? "Inyectando PO al Sistema..." : "[ Aprobar y Enviar PO por WhatsApp ]"}
    </button>
  );
}

export function ThreeWayMatchRow({ po, recepcion, invoice }: { po: number; recepcion: number; invoice: number }) {
  const delta = invoice - po;
  const isDestructive = delta > 0;

  return (
    <div className="grid grid-cols-3 gap-6 w-full items-center p-4 border-b border-zinc-200/50 bg-[oklch(0.98_0.01_250)]/40 backdrop-blur-md rounded-lg">
      <div className="flex flex-col">
        <span className="text-xs font-mono text-[oklch(0.45_0.02_250)] uppercase">PO Original</span>
        <span className="text-lg font-bold text-[oklch(0.15_0.02_250)]">${po.toFixed(2)}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-mono text-[oklch(0.45_0.02_250)] uppercase">Remito Físico</span>
        <span className="text-lg font-bold text-[oklch(0.15_0.02_250)] border-l-2 border-indigo-500 pl-4">${recepcion.toFixed(2)}</span>
      </div>
      <div className="flex flex-col relative">
        <span className="text-xs font-mono text-[oklch(0.45_0.02_250)] uppercase">Factura Proveedor</span>
        <div className="flex items-center gap-4">
           <span className="text-lg font-black text-[oklch(0.15_0.02_250)]">${invoice.toFixed(2)}</span>
           {isDestructive && (
             <motion.span 
               animate={{ opacity: [1, 0.5, 1] }} 
               transition={{ duration: 0.8, repeat: Infinity }}
               className="text-xs font-bold text-white bg-red-500 px-2 py-1 rounded-md shadow-sm"
             >
               +${delta.toFixed(2)} ERROR
             </motion.span>
           )}
        </div>
      </div>
    </div>
  );
}

export function YieldMasterChart({ data }: { data: any[] }) {
  return (
    <Card className="bg-[oklch(0.98_0.01_250)] ring-1 ring-zinc-200 shadow-sm rounded-2xl p-6">
      <Title className="text-[oklch(0.15_0.02_250)] font-black">Yield Master Tracker</Title>
      <Text className="text-[oklch(0.45_0.02_250)] font-mono text-xs uppercase tracking-widest mb-6">Precio Lista vs True Cost (BOM Resolutor)</Text>
      <BarChart
        className="h-72 mt-4"
        data={data}
        index="insumo"
        categories={["Precio Lista", "True Cost (BOM)"]}
        colors={["indigo", "rose"]}
        valueFormatter={(val) => `$${val.toLocaleString()}`}
        yAxisWidth={60}
      />
    </Card>
  );
}
