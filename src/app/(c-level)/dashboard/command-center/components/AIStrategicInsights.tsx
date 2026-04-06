import { generateStrategicInsights } from "@/actions/ai-telemetry";

export async function AIStrategicInsights() {
  const response = await generateStrategicInsights();

  if (!response.success || !response.data) {
    return (
      <div className="border border-red-500/50 bg-red-950/20 p-6 backdrop-blur-md rounded-md">
        <p className="text-red-400 font-mono text-sm">❌ [SRE] Falla en la telemetría de Gemini 2.5 Flash o latencia excedida.</p>
      </div>
    );
  }

  const { top_time_slot, most_profitable_combo, upsell_strategy } = response.data;

  return (
    <div className="border border-emerald-500/30 bg-black/50 p-6 backdrop-blur-md rounded-md font-mono">
      <h2 className="text-xl font-bold text-emerald-400 mb-6 flex items-center gap-2">
        <span>🧠</span> [AI ENGINE] DIRECTIVAS ESTRATÉGICAS
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-emerald-300/80">
        <div className="bg-black/40 p-4 rounded border border-emerald-900/50">
          <p className="text-xs text-zinc-500 mb-1">🔥 VENTANA DE MÁXIMA TRACCIÓN</p>
          <p className="font-semibold text-white text-lg leading-tight">{top_time_slot}</p>
        </div>
        
        <div className="bg-black/40 p-4 rounded border border-emerald-900/50">
          <p className="text-xs text-zinc-500 mb-1">💰 ACTIVO ESTRELLA (BOM)</p>
          <p className="font-semibold text-white text-lg leading-tight">{most_profitable_combo}</p>
        </div>
        
        <div className="bg-black/40 p-4 rounded border border-emerald-900/50">
          <p className="text-xs text-zinc-500 mb-1">🚀 TÁCTICA DE UPSELL</p>
          <p className="font-semibold text-white text-sm leading-tight">{upsell_strategy}</p>
        </div>
      </div>
    </div>
  );
}
