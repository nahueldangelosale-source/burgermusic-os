"use client";

import React, { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { processMeatMedallions } from "@/actions/yield-management";
import { Loader2, AlertTriangle, FileSignature, Beef, Scale, Activity } from "lucide-react";

const MEDALLION_TARGET_WEIGHT = 110;
const SHRINKAGE_THRESHOLD_PERCENT = 8.0;

const yieldFormSchema = z.object({
  roastBeefGr: z.number().min(0, "Mínimo 0"),
  tapaAsadoGr: z.number().min(0, "Mínimo 0"),
  grasaGr: z.number().min(0, "Mínimo 0"),
  producedMedallions: z.number().min(1, "Producción mínima: 1"),
  justification: z.string().optional()
});

export type YieldFormValues = z.infer<typeof yieldFormSchema>;

export default function YieldStationPage() {
  const [isPending, startTransition] = useTransition();

  const form = useForm<YieldFormValues>({
    resolver: zodResolver(yieldFormSchema),
    defaultValues: {
      roastBeefGr: 0,
      tapaAsadoGr: 0,
      grasaGr: 0,
      producedMedallions: 0,
      justification: ""
    }
  });

  const { register, handleSubmit, control, formState: { errors } } = form;

  // Reactivity en tiempo real (Zero-Lag)
  const roastBeefGr = useWatch({ control, name: "roastBeefGr" }) || 0;
  const tapaAsadoGr = useWatch({ control, name: "tapaAsadoGr" }) || 0;
  const grasaGr = useWatch({ control, name: "grasaGr" }) || 0;
  const producedMedallions = useWatch({ control, name: "producedMedallions" }) || 0;
  const justification = useWatch({ control, name: "justification" }) || "";

  // Motor de Fricción Positiva
  const inputTotalGr = roastBeefGr + tapaAsadoGr + grasaGr;
  const outputTeoricoGr = producedMedallions * MEDALLION_TARGET_WEIGHT;
  const shrinkageGr = inputTotalGr - outputTeoricoGr;
  const shrinkagePercentage = inputTotalGr > 0 ? (shrinkageGr / inputTotalGr) * 100 : 0;
  
  const isHighShrinkage = shrinkagePercentage > SHRINKAGE_THRESHOLD_PERCENT;
  const isBlocked = isHighShrinkage && justification.trim().length < 5;

  const onSubmit = (data: YieldFormValues) => {
    if (isBlocked) {
      toast.error("Anomalía detectada. La justificación es obligatoria.");
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          roastBeefGr: Number(data.roastBeefGr),
          tapaAsadoGr: Number(data.tapaAsadoGr),
          grasaGr: Number(data.grasaGr),
          producedMedallions: Number(data.producedMedallions)
        };
        
        const res = await processMeatMedallions(payload);
        
        if (res.success) {
          toast.success(
            <div className="flex flex-col gap-1">
              <span className="font-bold">Manufactura Registrada</span>
              <span className="text-xs opacity-90">Lote: {res.batchId}</span>
              <span className="text-xs opacity-90">Merma: {res.metrics.shrinkagePercentage}%</span>
            </div>
          );
          form.reset();
        } else {
          toast.error("Error al registrar producción");
        }
      } catch (err: any) {
        toast.error(`SRE Fault: ${err.message || "Fallo de Ledger"}`);
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-12 text-slate-100 font-sans selection:bg-rose-500/30">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header Adrenaline Mode */}
        <header className="border-l-[6px] border-rose-500 pl-4 py-2 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-rose-500" />
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white uppercase">
              Yield Station
            </h1>
            <span className="text-xs font-mono tracking-widest text-rose-500 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
              C-LEVEL GATEWAY
            </span>
          </div>
          <p className="text-slate-400 font-medium">Control de Merma Activa (Tolerancia: {SHRINKAGE_THRESHOLD_PERCENT}%)</p>
        </header>

        <div className="grid md:grid-cols-12 gap-8">
          
          {/* Formulario Izquierda */}
          <div className="md:col-span-7 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl shadow-black/50">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Inputs Materia Prima */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Beef className="w-4 h-4" /> Input Materias Primas (Gramos)
                </h3>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300">Roast Beef</label>
                    <input 
                      type="number" 
                      {...register("roastBeefGr", { valueAsNumber: true })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-100 font-mono text-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300">Tapa de Asado</label>
                    <input 
                      type="number" 
                      {...register("tapaAsadoGr", { valueAsNumber: true })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-100 font-mono text-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300">Grasa Vacuna</label>
                    <input 
                      type="number" 
                      {...register("grasaGr", { valueAsNumber: true })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-100 font-mono text-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="h-px bg-slate-800 my-6" />

              {/* Input Producción */}
              <div>
                <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Scale className="w-4 h-4" /> Output Producido
                </h3>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">Medallones de Carne 110g (Unidades)</label>
                  <input 
                    type="number" 
                    {...register("producedMedallions", { valueAsNumber: true })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-4 text-emerald-400 font-mono font-bold text-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-center"
                  />
                  {errors.producedMedallions && <span className="text-rose-500 text-xs font-medium">{errors.producedMedallions.message}</span>}
                </div>
              </div>

              {/* Fricción Positiva: Campo Dinámico de Justificación */}
              {isHighShrinkage && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex gap-2 items-center text-rose-400">
                    <AlertTriangle className="w-5 h-5" />
                    <h4 className="font-bold uppercase tracking-wide text-sm">Alerta de Desvío Operativo</h4>
                  </div>
                  <p className="text-sm text-slate-300">La merma ({shrinkagePercentage.toFixed(2)}%) supera la tolerancia corporativa. Justifique la pérdida para desbloquear la inyección al Ledger.</p>
                  <textarea 
                    {...register("justification")}
                    placeholder="Ej: Falla en máquina picadora / Error humano al pesar crudo"
                    className="w-full bg-slate-950 border border-rose-500/50 rounded-lg p-3 text-sm text-rose-100 focus:ring-2 focus:ring-rose-500 outline-none min-h-[80px]"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isPending || isBlocked || inputTotalGr === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
              >
                {isPending ? <Loader2 className="animate-spin w-5 h-5" /> : <FileSignature className="w-5 h-5" />}
                {isBlocked ? "REQUIERE JUSTIFICACIÓN (C-LEVEL)" : "IMPACTAR KARDEX (ACID)"}
              </button>

            </form>
          </div>

          {/* Telemetría Derecha */}
          <div className="md:col-span-5 flex flex-col gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />
              
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Telemetría de Lote</h3>
              
              <div className="space-y-6 relative z-10 w-full">
                
                <div className="flex justify-between items-end border-b border-slate-800 pb-3">
                  <span className="text-slate-400 text-sm font-medium">Peso Bruto Crudo:</span>
                  <span className="text-2xl font-mono text-white">{inputTotalGr.toLocaleString("es-AR")} g</span>
                </div>
                
                <div className="flex justify-between items-end border-b border-slate-800 pb-3">
                  <span className="text-slate-400 text-sm font-medium">Rendimiento Teórico:</span>
                  <span className="text-2xl font-mono text-emerald-400">{outputTeoricoGr.toLocaleString("es-AR")} g</span>
                </div>

                <div className="flex justify-between items-end pb-3">
                  <span className="text-slate-400 text-sm font-medium">Deviación (Shrinkage):</span>
                  <div className="flex flex-col items-end">
                    <span className={`text-3xl font-black font-mono tracking-tight ${isHighShrinkage ? "text-rose-500" : "text-amber-500"}`}>
                      {shrinkagePercentage.toFixed(2)}%
                    </span>
                    <span className="text-slate-500 text-xs font-mono">{shrinkageGr.toLocaleString("es-AR")} g</span>
                  </div>
                </div>

              </div>
              
              {/* Barra visual de Merma */}
              <div className="mt-8 h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${isHighShrinkage ? "bg-rose-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min(Math.max(shrinkagePercentage, 0), 100)}%` }}
                />
              </div>

            </div>

            <div className="bg-slate-900/50 border border-slate-800/50 p-6 rounded-2xl">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Auditoría SRE (Zero-Trust)</h4>
              <p className="text-xs text-slate-500 leading-relaxed md:text-justify">
                 Todas las inyecciones al Kardex generan una traza doble:
                 <br/><br/>
                 1. <span className="font-mono text-indigo-400">MANUFACTURING_CONSUMPTION</span> (Materia Prima).<br/>
                 2. <span className="font-mono text-emerald-400">MANUFACTURING_PRODUCTION</span> (Terminado).<br/>
                 3. <span className="font-mono text-rose-400">MANUFACTURING_SHRINKAGE</span> (Merma superior a 0%).<br/>
                 <br/>
                 La validación de sesión es O(1) vía <span className="font-mono text-slate-300">requireManagerSession()</span>. Las mermas +8% bloquean la estación hasta justificar.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
