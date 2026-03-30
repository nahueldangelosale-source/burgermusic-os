import { getFinancialInterlock } from "@/actions/bi-analytics";
import { AlertOctagon } from "lucide-react";
import InterlockForm from "./InterlockForm";

/**
 * HOC de Fricción Positiva (Interbloqueo Operativo)
 * Anula la Interfaz subyacente e impone Gestión por Excepción.
 */
export default async function InterlockShield({
  storeId,
  children,
}: { storeId: string; children: React.ReactNode }) {
  const interlock = await getFinancialInterlock(storeId);

  if (!interlock.requiresInterlock) {
    return <>{children}</>;
  }

  return (
    <div className="relative w-full h-full min-h-screen">
      {/* Ley de Fitts Denegada: Bloqueo Subyacente */}
      <div className="pointer-events-none opacity-10 filter blur-[8px] transition-all duration-700">
        {children}
      </div>

      {/* Overlay Estricto Zero-Trust */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-950/80 backdrop-blur-xl">
        <div
          className="w-full max-w-3xl bg-gray-900 border-2 shadow-2xl rounded-2xl p-10 flex flex-col items-center text-center"
          style={{ borderColor: "var(--color-critical, #ef4444)", borderTopWidth: "6px" }}
        >
          <AlertOctagon
            size={64}
            style={{ color: "var(--color-critical, #ef4444)" }}
            className="mb-6 animate-pulse"
          />

          <h2
            className="text-4xl font-black uppercase tracking-widest"
            style={{ color: "var(--color-critical, #ef4444)" }}
          >
            Cierre Operativo Preventivo
          </h2>

          <div className="mt-8 bg-black/50 p-6 rounded-xl border border-red-900/50 w-full">
            <p className="text-xl font-medium text-red-200">{interlock.reason}</p>
          </div>

          <p className="mt-8 text-sm text-gray-400 max-w-lg">
            Debido a las políticas estrictas del BI v2.1, esta varianza requiere una justificación
            humana registrada inmutablemente. Ingresa al menos 50 caracteres para desbloquear el
            módulo.
          </p>

          <div className="w-full mt-8">
            <InterlockForm storeId={storeId} />
          </div>
        </div>
      </div>
    </div>
  );
}
