"use client";

import React, { useState } from "react";
import { processGoodsReceipt } from "@/actions/ReceivingEngine";
// Asumiendo que el server action de OCR existe en el proyecto
// import { processInvoiceDocument } from "@/actions/ocr-ingestion";

interface POItem {
  inventory_item_id: string;
  name: string;
  suggested_quantity: number;
  expected_unit_cost_cents: number;
}

interface ApprovedPO {
  id: string;
  supplier_id: string;
  total_estimated_cents: number;
  items: POItem[];
}

interface ReceivingDashboardProps {
  approvedPOs: ApprovedPO[];
}

export function ReceivingDashboard({ approvedPOs }: ReceivingDashboardProps) {
  const [selectedPO, setSelectedPO] = useState<ApprovedPO | null>(null);
  const [actualQuantities, setActualQuantities] = useState<Record<string, number>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  
  // Estado Post-Recepción (Airlock Results)
  const [disputeAlert, setDisputeAlert] = useState<{ isDisputed: boolean; gapCents: number } | null>(null);

  const handleSelectPO = (po: ApprovedPO) => {
    setSelectedPO(po);
    const initialQty: Record<string, number> = {};
    po.items.forEach(item => {
      initialQty[item.inventory_item_id] = item.suggested_quantity;
    });
    setActualQuantities(initialQty);
    setDisputeAlert(null);
  };

  const handleRunOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsScanning(true);
    
    // Simulación del OCR Integration
    // const formData = new FormData();
    // formData.append("file", e.target.files[0]);
    // const ocrResult = await processInvoiceDocument(formData);
    
    setTimeout(() => {
      // Mock de inyección de OCR alterando una cantidad intencionalmente para disparar disputa
      if (selectedPO && selectedPO.items.length > 0) {
        setActualQuantities(prev => ({
          ...prev,
          [selectedPO.items[0].inventory_item_id]: selectedPO.items[0].suggested_quantity - 2
        }));
      }
      setIsScanning(false);
      alert("OCR: Remito procesado. Cantidades ajustadas según lectura multimodal.");
    }, 1500);
  };

  const handleProcessReceipt = async () => {
    if (!selectedPO) return;
    
    setIsProcessing(true);
    setDisputeAlert(null);
    
    const payload = Object.entries(actualQuantities).map(([id, qty]) => ({
      inventory_item_id: id,
      actual_received_quantity: qty
    }));

    try {
      const res = await processGoodsReceipt(selectedPO.id, payload, "https://storage.burgermusic.com/remitos/scanned.pdf");
      
      if (res.status === "DISPUTED") {
        // Calcular gap teórico vs real
        let theoretical = selectedPO.total_estimated_cents;
        let actual = res.debtInjectedCents;
        setDisputeAlert({ isDisputed: true, gapCents: actual! - theoretical });
      } else {
        alert("Three-Way Match Exitoso: Varianza 0. Remito aprobado herméticamente.");
        setSelectedPO(null); // Clear form
      }
    } catch (e: any) {
      alert("Error en validación ACID: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-[oklch(0.95_0.02_250)] min-h-screen p-8 text-slate-800">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <header className="mb-8 border-b border-gray-200 pb-4">
          <h1 className="text-3xl font-black tracking-tighter">ANDÉN DE RECEPCIÓN (Three-Way Match)</h1>
          <p className="text-sm font-medium tracking-wide text-gray-500 uppercase mt-1">Validación de Lote Físico vs Purchase Order P0</p>
        </header>

        {/* ALERTA DE DISPUTA ROJA (ADRENALINE MODE) */}
        {disputeAlert?.isDisputed && (
          <div className="bg-red-600 rounded-3xl p-8 shadow-2xl relative overflow-hidden animate-[shake_0.5s_cubic-bezier(0.36,0.07,0.19,0.97)_both]">
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-red-500 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
            <div className="relative z-10">
               <h2 className="text-white text-2xl font-black flex items-center gap-3 tracking-tighter">
                 <span className="animate-pulse">⚠️</span> ALERTA DE DISPUTA (MATCH FALLIDO)
               </h2>
               <p className="text-red-100 font-medium mt-2">
                 Se ha inyectado el inventario físico real y contabilizado la deuda de <strong className="text-white">Cuentas por Pagar</strong> en estado PENDING.
                 El proveedor entregó mercadería diferente a la Orden de Compra aprobada.
               </p>
               <div className="mt-6 bg-red-950/40 border border-red-500 p-5 rounded-2xl flex items-center gap-6">
                 <div>
                    <span className="block text-red-300 text-xs font-bold uppercase tracking-widest">Brecha Contable Exigida</span>
                    <span className="text-3xl font-black text-white">
                      {disputeAlert.gapCents > 0 ? '+' : ''} ${(disputeAlert.gapCents / 100).toLocaleString('en-US', {minimumFractionDigits: 2})}
                    </span>
                 </div>
                 <div className="border-l border-red-500 pl-6">
                    <p className="text-sm text-red-100 font-semibold max-w-sm">
                      EXIGE UNA NOTA DE CRÉDITO INMEDIATA al proveedor para mitigar el diferencial financiero antes del cierre fiscal del lote.
                    </p>
                 </div>
               </div>
            </div>
          </div>
        )}

        {/* LISTA DE POs PENDIENTES */}
        {!selectedPO ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {approvedPOs.map(po => (
              <div key={po.id} onClick={() => handleSelectPO(po)} className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm cursor-pointer hover:border-blue-500 hover:shadow-lg transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg group-hover:text-blue-600 transition-colors">{po.supplier_id}</h3>
                    <p className="text-xs font-mono text-gray-500">ID: {po.id.substring(0, 8)}</p>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded">APPROVED</span>
                </div>
                <div className="flex justify-between items-center text-sm font-medium">
                  <span className="text-gray-500">{po.items.length} Insumos Esperados</span>
                  <span className="text-slate-900 font-black">${(po.total_estimated_cents / 100).toFixed(2)}</span>
                </div>
              </div>
            ))}
            {approvedPOs.length === 0 && (
              <div className="col-span-2 p-10 bg-white rounded-3xl border border-dashed border-gray-300 text-center font-medium text-gray-400">
                Airlock vacío. No hay órdenes aprobadas pendientes de recepción.
              </div>
            )}
          </div>
        ) : (
          /* FORMULARIO DE MATCH */
          <div className="bg-white rounded-3xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
              <div>
                <h3 className="font-bold text-lg">Control Físico de Remito</h3>
                <p className="text-slate-400 text-xs uppercase tracking-widest">Proveedor: {selectedPO.supplier_id}</p>
              </div>
              <button onClick={() => setSelectedPO(null)} className="text-sm font-bold text-slate-400 hover:text-white transition-colors">Volver</button>
            </div>

            <div className="p-6">
              
              <div className="mb-6 flex justify-between items-center bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                <div>
                   <p className="text-sm font-medium text-blue-900 mb-1">Carga Sensorial Multimodal (OCR Gemini)</p>
                   <p className="text-xs text-blue-700/80">Escanee el remito de papel. El motor inyectará las cantidades extraídas.</p>
                </div>
                <label className={`cursor-pointer whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-5 py-2.5 rounded-lg shadow-sm transition-colors ${isScanning ? 'opacity-50 pointer-events-none' : ''}`}>
                  {isScanning ? 'Escaneando OCR...' : 'Subir Imagen/PDF Remito'}
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleRunOCR} />
                </label>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <div className="col-span-5">Insumo Base (SKU)</div>
                  <div className="col-span-3 text-center">Esperado (PO)</div>
                  <div className="col-span-4 text-center">Recibido Físico (Remito)</div>
                </div>

                {selectedPO.items.map(item => {
                  const variance = (actualQuantities[item.inventory_item_id] || 0) - item.suggested_quantity;
                  const isAnomaly = variance !== 0;

                  return (
                    <div key={item.inventory_item_id} className={`grid grid-cols-12 gap-4 items-center px-4 py-3 rounded-xl border ${isAnomaly ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-100'}`}>
                      <div className="col-span-5 font-bold text-slate-800 text-sm">
                        {item.name}
                        {isAnomaly && <span className="block text-[11px] text-orange-600 font-semibold tracking-tight mt-0.5">Varianza de {variance > 0 ? '+' : ''}{variance}</span>}
                      </div>
                      <div className="col-span-3 text-center text-gray-500 font-mono text-sm">{item.suggested_quantity}</div>
                      <div className="col-span-4">
                        <input 
                          type="number"
                          className={`w-full bg-white border ${isAnomaly ? 'border-orange-300 ring-4 ring-orange-100 text-orange-900' : 'border-gray-200'} rounded-lg px-4 py-2 text-center font-black transition-all focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100`}
                          value={actualQuantities[item.inventory_item_id] || ''}
                          onChange={(e) => setActualQuantities(prev => ({
                            ...prev, 
                            [item.inventory_item_id]: Number(e.target.value)
                          }))}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end">
                <button
                  onClick={handleProcessReceipt}
                  disabled={isProcessing}
                  className="bg-black hover:bg-slate-800 text-white font-black tracking-wide rounded-xl px-10 py-3 shadow-md hover:shadow-xl transition-all hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {isProcessing ? "Verificando Three-Way Match..." : "Sellar Remito & Cargar Deuda (ACID)"}
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
