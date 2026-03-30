import { getExceptionMetrics } from "@/actions/bi-analytics";
import { AlertOctagon } from "lucide-react";
import ExceptionForm from "./ExceptionForm";

/**
 * Gestión por Excepción - Interbloqueo Analítico
 * ──────────────────────────────────────────────
 * Server Component estricto (Sin useEffect).
 * Renderiza un overlay Glassmorphism bloqueante si
 * la varianza de Inventario (Merma) es crítica (>3%).
 */
export default async function ExceptionManager({ storeId }: { storeId: string }) {
  // Solicitud al Motor Analítico SQL directo
  const metrics = await getExceptionMetrics(storeId);

  if (!metrics.requiresJustification) {
    return null; // Sistema operando nominalmente
  }

  // Interbloqueo por Fricción Positiva
  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-md animate-in fade-in duration-500 p-6">
      <div
        className="w-full max-w-xl bg-[var(--bg-elevated)] border-2 shadow-2xl rounded-2xl p-8 relative overflow-hidden"
        style={{ borderColor: "var(--color-critical, #ef4444)" }}
      >
        {/* Señalética de Emergencia */}
        <div
          className="absolute top-0 left-0 w-full h-2"
          style={{ backgroundColor: "var(--color-critical, #ef4444)" }}
        />

        <h2
          className="text-3xl font-black uppercase tracking-tight flex items-center gap-3 mt-2"
          style={{ color: "var(--color-critical, #ef4444)" }}
        >
          <AlertOctagon size={36} /> Bloqueo Operativo
        </h2>

        <div className="mt-6 space-y-4">
          <p className="text-gray-700 font-medium text-lg">
            Se ha detectado una{" "}
            <strong className="font-black text-gray-900">
              Varianza de Inventario Crítica (Merma)
            </strong>{" "}
            que excede la barrera de tolerancia del cero-confianza (3%).
          </p>

          {/* Data Grid */}
          <div className="grid grid-cols-3 gap-4 bg-[var(--bg-sunken)] p-4 rounded-xl border border-[var(--border-default)]">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                Teórico (Kardex)
              </span>
              <p className="text-xl font-bold text-gray-900">
                {metrics.theoreticalKardex.toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                Real (Snapshots)
              </span>
              <p className="text-xl font-bold text-gray-900">
                {metrics.actualBlindCount.toLocaleString()}
              </p>
            </div>
            <div>
              <span
                className="text-[10px] font-black uppercase tracking-widest"
                style={{ color: "var(--color-critical, #ef4444)" }}
              >
                Varianza %
              </span>
              <p className="text-xl font-black" style={{ color: "var(--color-critical, #ef4444)" }}>
                {(metrics.shrinkageVariance * 100).toFixed(2)}%
              </p>
            </div>
          </div>

          <p className="text-sm text-gray-500">
            Debes proveer una justificación auditable para liberar el acceso al Command Center. El
            descargo será resguardado inmutablemente por el ledger de inteligencia artificial.
          </p>

          {/* Client Form Component */}
          <ExceptionForm storeId={storeId} />
        </div>
      </div>
    </div>
  );
}
