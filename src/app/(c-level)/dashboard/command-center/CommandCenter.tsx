"use client";

import React, { useState, useEffect } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Calendar } from "lucide-react";
import Link from 'next/link';
import { getShiftReconciliation } from "@/actions/ReconciliationEngine";
import { getDraftPOs, approvePredictivePO } from "@/actions/ProcurementEngine";
import { getPendingClaims, sendClaim, processPendingClaims } from "@/actions/ClaimAgent";

interface CommandCenterProps {
  topSkus: any[];
  kpis: {
    revenues: number;
    costs: number;
    grossMargin: number;
  };
  fireRadarAlerts: any[];
  storeLeaderboard: any[];
}

export function CommandCenter({ topSkus, kpis, fireRadarAlerts, storeLeaderboard }: CommandCenterProps) {
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const [reconciliation, setReconciliation] = useState<any>(null);
  const [draftPOs, setDraftPOs] = useState<any[]>([]);
  const [disputedClaims, setDisputedClaims] = useState<any[]>([]);
  const [isApproving, setIsApproving] = useState(false);
  const [isSendingClaim, setIsSendingClaim] = useState(false);

  useEffect(() => {
    const fetchCriticalData = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const resRecon = await getShiftReconciliation("centro", today, "UNICO");
        setReconciliation(resRecon);

        const pos = await getDraftPOs("centro");
        setDraftPOs(pos);

        // Disparador del Motor Outbox Duradero
        await processPendingClaims();
        const claims = await getPendingClaims();
        setDisputedClaims(claims);
      } catch (e) {
        console.error(e);
      }
    };
    fetchCriticalData();
  }, []);

  const handleApprovePO = async (poId: string) => {
    setIsApproving(true);
    try {
      await approvePredictivePO(poId);
      // Actualizar local
      setDraftPOs(prev => prev.filter(p => p.id !== poId));
      alert("Orden de Compra Aprobada Exitosamente.");
    } catch (e: any) {
      alert("Fallo al aprobar PO: " + e.message);
    } finally {
      setIsApproving(false);
    }
  };

  const handleSendClaim = async (claimId: string) => {
    setIsSendingClaim(true);
    try {
      await sendClaim(claimId);
      setDisputedClaims(prev => prev.filter(c => c.id !== claimId));
    } catch (e: any) {
      alert("Fallo al enviar reclamo: " + e.message);
    } finally {
      setIsSendingClaim(false);
    }
  };

  // Regla 3: Zero-State Handling (Manejo del Vacío)
  const isDataEmpty = !kpis.revenues || kpis.revenues === 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* ZONA 2: Drill-Down Accordion (8 cols) */}
      <div className="col-span-1 lg:col-span-8 flex flex-col gap-6">

        {/* ALERTA DE DISPUTAS DE PROVEEDORES (SANGRADO DE CAPITAL) */}
        {disputedClaims.length > 0 && (
          <div className="bg-red-600 rounded-3xl overflow-hidden ring-1 ring-red-700 shadow-[0_8px_30px_rgb(220,38,38,0.3)] p-6 mb-2 border-l-4 border-red-800 transition-all duration-500">
            <Accordion className="w-full">
              <AccordionItem className="border-none px-0 bg-transparent">
                <AccordionTrigger 
                  isOpen={openAccordion === 'claims'}
                  onToggle={() => setOpenAccordion(openAccordion === 'claims' ? null : 'claims')}
                  className="hover:no-underline py-0 text-white"
                >
                  <span className="font-bold tracking-tighter text-xl flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-white animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]"></span>
                    🚨 DISPUTAS DE PROVEEDORES (Sangrado de Capital)
                  </span>
                </AccordionTrigger>
                <AccordionContent isOpen={openAccordion === 'claims'} className="pt-4 mt-4 bg-transparent border-t border-red-500">
                  <div className="flex flex-col gap-4">
                    {disputedClaims.map((claim) => (
                      <div key={claim.id} className="p-5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 flex flex-col gap-4">
                        <div>
                          <p className="text-white font-bold text-lg">Entrega menor de mercadería en la OC {claim.po_id}</p>
                          <p className="text-red-200 text-sm">{new Date(claim.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="bg-black/30 p-4 rounded-xl text-white font-mono text-sm border border-black/20">
                          <p className="font-bold text-red-300 mb-2">DETALLE DEL FALTANTE:</p>
                          <pre className="whitespace-pre-wrap font-sans text-xs">{claim.missing_details}</pre>
                        </div>
                        <div className="bg-white text-red-950 p-5 rounded-xl text-sm border border-red-200 shadow-inner">
                          <p className="font-bold mb-2 flex items-center gap-2 text-red-800">
                            🤖 Borrador de Reclamo Automático (Gemini 2.0 Flash)
                          </p>
                          <div className="whitespace-pre-wrap leading-relaxed">{claim.ai_claim_draft}</div>
                        </div>
                        <button
                          onClick={() => handleSendClaim(claim.id)}
                          disabled={isSendingClaim}
                          className="mt-2 w-full py-4 bg-red-900 hover:bg-red-950 text-white rounded-xl font-black uppercase tracking-widest transition-colors shadow-sm disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                          {isSendingClaim ? "Procesando..." : "Enviar Reclamo y Archivar"}
                        </button>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}

        {/* ALERTA DE CONCILIACIÓN - ADRENALINE MODE / SILENT LUXURY */}
        {reconciliation?.anomaly_detected && (
          <div className="bg-white rounded-3xl overflow-hidden ring-1 ring-red-300 shadow-[0_8px_30px_rgb(239,68,68,0.15)] p-6 mb-2 border-l-4 border-red-500 transition-all duration-500">
            <Accordion className="w-full">
              <AccordionItem className="border-none px-0 bg-transparent">
                <AccordionTrigger 
                  isOpen={openAccordion === 'recon'}
                  onToggle={() => setOpenAccordion(openAccordion === 'recon' ? null : 'recon')}
                  className="hover:no-underline py-0"
                >
                  <span className="text-red-600 font-bold tracking-tighter text-xl flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
                    Alertas de Conciliación (Tolerancia Excedida)
                  </span>
                </AccordionTrigger>
                <AccordionContent isOpen={openAccordion === 'recon'} className="pt-4 mt-4 bg-transparent border-t border-red-100">
                  <div className="p-5 bg-red-50/80 rounded-2xl border border-red-200 flex flex-col gap-3">
                    <p className="text-red-950 font-semibold tracking-tight">Brecha detectada cruzando ingresos teóricos (POS) vs Cierre Físico.</p>
                    <div className="flex justify-between items-center text-sm font-bold text-red-700 bg-red-100/50 p-3 rounded-xl mt-1">
                      <span>Faltante/Sobrante en Caja:</span>
                      <span className="text-2xl font-black">${(reconciliation.delta_cents / 100).toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}

        {/* ALERTA DE ABASTECIMIENTO AUTÓNOMO (PREDICTIVE PO) */}
        {draftPOs.length > 0 && (
          <div className="bg-white rounded-3xl overflow-hidden ring-1 ring-blue-300 shadow-[0_8px_30px_rgb(59,130,246,0.15)] p-6 mb-2 border-l-4 border-blue-500 transition-all duration-500">
            <Accordion className="w-full">
              <AccordionItem className="border-none px-0 bg-transparent">
                <AccordionTrigger 
                  isOpen={openAccordion === 'procurement'}
                  onToggle={() => setOpenAccordion(openAccordion === 'procurement' ? null : 'procurement')}
                  className="hover:no-underline py-0"
                >
                  <span className="text-blue-600 font-bold tracking-tighter text-xl flex items-center gap-2">
                    ⚡ Abastecimiento Autónomo (Acción Requerida)
                  </span>
                </AccordionTrigger>
                <AccordionContent isOpen={openAccordion === 'procurement'} className="pt-4 mt-4 bg-transparent border-t border-blue-100">
                  <div className="flex flex-col gap-4">
                    {draftPOs.map((po) => (
                      <div key={po.id} className="p-5 bg-blue-50/80 rounded-2xl border border-blue-200 flex flex-col gap-4 relative overflow-hidden">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-blue-950 font-bold text-lg">{po.supplier_id || "Proveedor Principal"}</p>
                            <p className="text-blue-700/80 text-sm font-medium uppercase tracking-wider">Monto Estimado</p>
                          </div>
                          <span className="text-2xl font-black text-blue-700">
                            ${(po.total_estimated_cents / 100).toLocaleString('en-US', {minimumFractionDigits: 2})}
                          </span>
                        </div>
                        
                        <div className="text-sm font-medium text-blue-900/80 bg-blue-100/50 p-3 rounded-xl border border-blue-200/50">
                          Insumos marcados por debajo del umbral mínimo de seguridad. Múltiples SKUs involucrados.
                        </div>

                        <button
                          onClick={() => handleApprovePO(po.id)}
                          disabled={isApproving}
                          className="mt-2 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold tracking-wide transition-colors shadow-sm disabled:opacity-50"
                        >
                          {isApproving ? "Procesando..." : "Aprobar Orden (Firmar)"}
                        </button>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}

        <div className="bg-[oklch(0.98_0.01_250)] rounded-3xl overflow-hidden ring-1 ring-zinc-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 flex-1 transition-all duration-300">
          <h2 className="font-mono uppercase tracking-widest text-[oklch(0.45_0.02_250)] mb-6 font-bold">
            Telemetría Drill-Down (Rentabilidad Opex)
          </h2>
          
          {isDataEmpty ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-zinc-200 rounded-xl bg-white/50 p-8">
              <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4M12 4v16"></path></svg>
              </div>
              <h3 className="text-zinc-800 font-bold tracking-tighter">A la espera de inyección KDS/OCR</h3>
              <p className="text-zinc-500 text-sm mt-1">El ingreso bruto (Revenue) se encuentra en cero.</p>
            </div>
          ) : (
            <Accordion className="w-full space-y-4">
              {topSkus.map((sku, index) => {
                const marginAmount = sku.absoluteMargin || 0;
                const costBOM = sku.absoluteCost || 0;
                const price = marginAmount + costBOM;
                const marginPct = price > 0 ? (marginAmount / price) * 100 : 0;
                const isOpen = openAccordion === sku.productId;

                return (
                  <AccordionItem key={sku.productId || index} className="border border-zinc-200 rounded-xl px-4 bg-white shadow-sm overflow-hidden">
                    <AccordionTrigger 
                      isOpen={isOpen}
                      onToggle={() => setOpenAccordion(isOpen ? null : sku.productId)}
                      className="hover:no-underline py-4"
                    >
                      <div className="flex flex-1 items-center justify-between pr-4">
                        <span className="font-bold text-slate-800 text-sm">{sku.productId.replace(/_/g, ' ')}</span>
                        <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-2 py-1 rounded">
                          {sku.totalQuantity || sku._sum?.quantity || 1} Unidades
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent isOpen={isOpen} className="bg-slate-50 -mx-4 px-4 pb-4 border-t border-zinc-100 pt-4">
                      <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-500 font-medium">Costo BOM Directo</span>
                          <span className="font-bold text-slate-800">${(costBOM/100).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-500 font-medium">Margen Absoluto</span>
                          <span className="font-bold text-emerald-600">${(marginAmount/100).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm border-t border-zinc-200 pt-3">
                          <span className="text-slate-900 font-bold tracking-tight">Rentabilidad Porcentual</span>
                          <span className={`font-black ${marginPct > 50 ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {marginPct.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>

        <div className="bg-[oklch(0.98_0.01_250)] rounded-3xl overflow-hidden ring-1 ring-zinc-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] p-8 flex-1 transition-all duration-300 group">
           <div className="flex justify-between items-start mb-3">
            <h2 className="font-mono uppercase tracking-widest text-[oklch(0.45_0.02_250)] font-bold transition-colors">Previsión Estratégica (Mapeo de Demanda)</h2>
            <Calendar className="text-zinc-300" />
          </div>
          <p className="text-sm text-[oklch(0.45_0.02_250)] mb-10 leading-relaxed font-medium">Marcador para feriados, eventos especiales o adversidades operativas.</p>
          <div className="h-40 border-2 border-dashed border-zinc-200 rounded-xl flex items-center justify-center text-zinc-400">
             Calendario Estratégico (Demand Forecasting Baseline) próximamente...
          </div>
        </div>
      </div>

      {/* ZONA 3: Radar de Fuego (4 cols) */}
      <div className="col-span-1 lg:col-span-4 flex flex-col">
        <div className="bg-[oklch(0.98_0.01_250)] rounded-3xl overflow-hidden ring-1 ring-red-500/20 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_15px_40px_rgba(239,68,68,0.15)] p-8 flex-1 border-t-4 border-t-red-500 transition-all duration-300 relative">
          <h2 className="font-mono uppercase tracking-widest text-red-600 mb-3 font-bold flex items-center gap-3 relative z-10">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] shadow-[0_0_15px_rgba(239,68,68,0.8)]"></span>
            Alert Sentinel
          </h2>
          <p className="text-sm text-[oklch(0.45_0.02_250)] mb-8 font-medium relative z-10">Agregación Asíncrona (Promise.all)</p>

          <div className="space-y-4 relative z-10">
            {fireRadarAlerts.map((alert) => (
              <Link key={String(alert.id)} href={alert.link} className="block group/alert">
                <div className={`p-5 rounded-2xl border transition-all duration-300 transform group-hover/alert:translate-x-1 group-hover/alert:shadow-md ${
                  alert.severity === 'critical' ? 'bg-red-50/70 border-red-200/80 hover:bg-red-100/80 hover:border-red-300' : 
                  alert.severity === 'high' ? 'bg-amber-50/70 border-amber-200/80 hover:bg-amber-100/80 hover:border-amber-300' : 
                  'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/80 hover:border-slate-300'
                }`}>
                  <div className="flex justify-between items-center mb-3">
                    <span className={`text-[11px] font-black uppercase tracking-widest ${
                      alert.severity === 'critical' ? 'text-red-700' : 
                      alert.severity === 'high' ? 'text-amber-700' : 'text-slate-700'
                    }`}>
                      {String(alert.type)}
                    </span>
                    <span className="text-zinc-400 group-hover/alert:text-[oklch(0.15_0.02_250)] transition-transform group-hover/alert:translate-x-1 font-bold">→</span>
                  </div>
                  <p className={`text-[13px] tracking-tight font-semibold leading-relaxed ${
                    alert.severity === 'critical' ? 'text-red-950' : 
                    alert.severity === 'high' ? 'text-amber-950' : 'text-slate-900'
                  }`}>
                    {alert.message}
                  </p>
                </div>
              </Link>
            ))}
          </div>
          
          <div className="absolute top-0 right-0 w-48 h-48 bg-red-500/5 rounded-full blur-3xl pointer-events-none"></div>
        </div>
      </div>
    </div>
  );
}
