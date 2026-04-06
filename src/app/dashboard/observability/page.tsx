import { getFinOpsMetrics30Days } from "@/db/queries/finops-queries";
import { AlertCircle, BrainCircuit, Users, TrendingUp, Zap } from "lucide-react";

export const metadata = {
  title: "FinOps Radar | BurgerMusic OS",
};

export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * FINOPS OBSERVABILITY RADAR (C-Level Dashboard)
 * ─────────────────────────────────────────────────────────────────────────────
 * RSC (React Server Component) para latencia cero.
 * Bóveda matemática para auditar el ROI del pool Agéntico vs Costo OPEX (Tokens).
 */
export default async function FinOpsObservabilityPage() {
  const metrics = await getFinOpsMetrics30Days();

  // Constantes de estilo "Silent Luxury"
  const cardStyle = "bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between overflow-hidden relative";

  return (
    <div className="min-h-screen bg-slate-50 p-8 space-y-8 pb-20">
      
      {/* Header Block */}
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 shadow-inner">
            <BrainCircuit className="w-6 h-6 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            C-Level FinOps Radar
          </h1>
        </div>
        <p className="text-sm font-medium tracking-wide text-slate-500 uppercase flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Métricas de Adquisición Cognitiva (Últimos 30 Días)
        </p>
      </div>

      {/* Burn Rate Warning Banner (Trigger Matemático) */}
      {metrics.burnRateWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-4">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-amber-900">Fiebre de Tokens Detectada</h4>
            <p className="text-xs font-medium text-amber-700 mt-1">
              El ecosistema consumió más de $50 USD en el volumen actual. Se sugiere auditar el GCD (Grammar Constrained Decoding) y minimizar el prompt de la Ingesta Visual para conservar márgenes.
            </p>
          </div>
        </div>
      )}

      {/* Bento Grid layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Costo API (Token Burn) */}
        <div className={cardStyle}>
          <div className="flex justify-between items-start mb-6">
            <span className="text-xs font-bold tracking-widest text-slate-500 uppercase">Costo IA (OPEX)</span>
            <div className="bg-rose-100/50 p-2 rounded-lg">
              <span className="font-mono text-xs font-bold text-rose-600">API</span>
            </div>
          </div>
          <div>
            <span className="text-4xl font-extrabold tracking-tight text-slate-900">
              ${metrics.apiCostUsd.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-3">
            Tokens In: {metrics.totalInputTokens.toLocaleString()} | Out: {metrics.totalOutputTokens.toLocaleString()}
          </p>
        </div>

        {/* KPI 2: Valor Estratégico Total (Ahorro Humano) */}
        <div className={cardStyle}>
          <div className="flex justify-between items-start mb-6">
            <span className="text-xs font-bold tracking-widest text-slate-500 uppercase">Ahorro Laboral</span>
            <div className="bg-emerald-100/50 p-2 rounded-lg">
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div>
            <span className="text-4xl font-extrabold tracking-tight text-slate-900">
              ${metrics.humanLaborCostSavedUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-3">
            {metrics.humanHoursSaved.toFixed(1)} horas humanas ahorradas.
          </p>
        </div>

        {/* KPI 3: Multiplicador ROI */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between col-span-1 md:col-span-2 lg:col-span-2 relative overflow-hidden">
          {/* Aesthetic background glow */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/20 blur-[80px] rounded-full pointer-events-none"></div>
          
          <div className="flex justify-between items-start mb-6 relative z-10">
            <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">Múltiplo ROI (TSV / API Cost)</span>
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-baseline gap-2">
              <span className="text-6xl font-extrabold tracking-tighter text-white">
                {metrics.roiMultiplier.toFixed(1)}x
              </span>
              <span className="text-sm font-medium text-emerald-400">Retorno Neto</span>
            </div>
          </div>

          {/* Pure HTML Progress Bar for zero bloat */}
          <div className="mt-8 space-y-2 relative z-10">
            <div className="flex justify-between text-xs font-medium text-slate-400">
              <span>Eficiencia del Algoritmo</span>
              <span>Óptimo &gt; 50x</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-2 rounded-full ${metrics.roiMultiplier > 50 ? 'bg-emerald-400' : 'bg-amber-400'}`} 
                style={{ width: `${Math.min((metrics.roiMultiplier / 100) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

      </div>

      {/* Operaciones Agénticas Consolidadas */}
      <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase mt-12 mb-4">Métricas Operativas</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Volumen Documental */}
        <div className="bg-white border text-center border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col justify-center items-center">
          <span className="text-5xl font-extrabold text-slate-900">{metrics.actionsProcessed.invoices}</span>
          <span className="text-xs font-bold tracking-widest text-slate-500 uppercase mt-2">Facturas Ingeridas (VLM)</span>
        </div>

        {/* Volumen Adquisición */}
        <div className="bg-white border text-center border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col justify-center items-center">
          <span className="text-5xl font-extrabold text-slate-900">{metrics.actionsProcessed.purchaseOrders}</span>
          <span className="text-xs font-bold tracking-widest text-slate-500 uppercase mt-2">POs Generadas (Daemon)</span>
        </div>
      </div>
      
    </div>
  );
}
