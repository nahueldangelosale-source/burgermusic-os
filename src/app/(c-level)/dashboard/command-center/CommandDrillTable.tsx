"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getSkuDrillDown } from "@/actions/ProfitabilityEngine";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface CommandDrillTableProps {
  storeId: string;
  initialSkus: any[];
}

export function CommandDrillTable({ storeId, initialSkus }: CommandDrillTableProps) {
  const [drillDownSku, setDrillDownSku] = useState<string | null>(null);
  const [drillDownData, setDrillDownData] = useState<any[]>([]);
  
  const handleDrillDown = async (sku: string) => {
    setDrillDownSku(sku);
    // Fetch directly from server action
    const details = await getSkuDrillDown(storeId, sku);
    setDrillDownData(details);
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-xs uppercase text-gray-500 tracking-wider">
              <th className="py-3 px-4 font-medium">SKU Operativo</th>
              <th className="py-3 px-4 font-medium text-right">Margen Neto Aislado</th>
              <th className="py-3 px-4 font-medium text-center">Auditoría BOM</th>
            </tr>
          </thead>
          <tbody>
            {initialSkus.map((sku, idx) => (
              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="py-3 px-4 font-medium text-slate-800">{sku.productId}</td>
                <td className="py-3 px-4 text-right text-emerald-600 font-bold tracking-tight">
                  ${((sku.absoluteMargin || 0)/100).toFixed(2)}
                </td>
                <td className="py-3 px-4 text-center">
                  <button 
                    onClick={() => handleDrillDown(sku.productId)}
                    className="text-xs font-bold bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md shadow-sm hover:bg-gray-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                  >
                    Drill-Down
                  </button>
                </td>
              </tr>
            ))}
            {initialSkus.length === 0 && (
              <tr>
                <td colSpan={3} className="py-8 text-center text-gray-400">Sin Snapshot de ventas.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Sheet open={!!drillDownSku} onOpenChange={(open: boolean) => !open && setDrillDownSku(null)}>
        <SheetContent className="bg-white border-l border-gray-200 sm:max-w-lg w-full overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <div className="w-3 h-6 bg-indigo-500 rounded-sm"></div>
              Telemetría Drill-Down O(1)
            </SheetTitle>
            <SheetDescription>
              Rentabilidad y Snapshot Inmutable para: <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1 rounded">{drillDownSku}</span>
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-8 flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2">Snapshots Recientes (Ledger)</h3>
            <div className="overflow-y-auto pr-2 flex flex-col gap-3">
              {drillDownData.map((d, i) => (
                <div key={i} className="flex flex-col gap-1 p-4 bg-[oklch(0.98_0.01_250)] border border-zinc-200/60 rounded-xl shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
                  <div className="flex justify-between items-center text-xs text-slate-400 mb-2 border-b border-zinc-100 pb-2">
                    <span className="font-medium">{format(new Date(d.date || ""), "dd MMM yyyy • HH:mm", { locale: es })}</span>
                    <span className="font-mono text-[10px] tracking-widest bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm">{d.ticket || "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-600">Revenue (Venta)</span>
                    <span className="text-sm font-black text-slate-800">${(d.price/100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-600">COGS (Motor BOM)</span>
                    <span className="text-sm font-black text-red-500">-${(d.cost/100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-200">
                    <span className="text-[13px] font-bold text-slate-900 uppercase tracking-wider">Margen Neto Generado</span>
                    <span className="text-base font-black text-emerald-600">
                      ${((d.price - d.cost)/100).toFixed(2)} 
                      <span className="text-xs ml-1 opacity-70">({(d.price > 0 ? (((d.price - d.cost)/ d.price)*100).toFixed(1) : "0")}%)</span>
                    </span>
                  </div>
                </div>
              ))}
              {drillDownData.length === 0 && <p className="text-sm text-center text-slate-400 mt-4">No hay información de Ledger para este SKU.</p>}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
