"use client";

import { useTransition, useState, useEffect } from "react";
import { updateTicketStatus } from "@/actions/kds-actions";
import { CheckCircle2, RotateCcw, Clock, AlertTriangle, ChefHat } from "lucide-react";

export interface KdsTicket {
  id: string;
  ticketNumber: string | null;
  productSku: string | null;
  quantity: number;
  status: string | null;
  depleted: boolean | null;
  completedAt: string | null;
}

interface KitchenClientProps {
  initialTickets: KdsTicket[];
}

export function KitchenClient({ initialTickets }: KitchenClientProps) {
  const [isPending, startTransition] = useTransition();
  const [tickets, setTickets] = useState<KdsTicket[]>(initialTickets);

  // Sync client state with props (if using polling or revalidatePath refresh)
  useEffect(() => {
    setTickets(initialTickets);
  }, [initialTickets]);

  const handleUpdateStatus = (id: string, newStatus: "PREPARING" | "COMPLETED") => {
    // Optimistic UI update
    setTickets((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              status: newStatus,
              completedAt: newStatus === "COMPLETED" ? new Date().toISOString() : null,
            }
          : t
      )
    );

    startTransition(async () => {
      try {
        await updateTicketStatus(id, newStatus);
      } catch (e: any) {
        console.error(e.message);
        // Fallback optimista: Reload to reality on error
        window.location.reload();
      }
    });
  };

  const preparingTickets = tickets.filter((t) => t.status === "PREPARING" || t.status === "PENDING" || !t.status);
  const completedTickets = tickets.filter((t) => t.status === "COMPLETED");

  const [showRecentCompleted, setShowRecentCompleted] = useState(true);

  return (
    <div className="flex flex-col gap-6 p-6 h-full max-h-screen">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <ChefHat className="h-8 w-8 text-blue-600" />
          KDS Kanban (Zero-Trust)
        </h1>
        <p className="text-sm text-slate-500">Gestor de pedidos con Horizonte de Sucesos (Airlock Temporal)</p>
      </div>

      {/* ZONA ACTIVA: PREPARING */}
      <div className="flex-1 overflow-auto bg-slate-50 p-4 rounded-xl border border-slate-200">
        <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-500" />
          En Preparación ({preparingTickets.length})
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {preparingTickets.map((ticket) => (
            <div key={ticket.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <span className="font-mono font-bold text-slate-700">{ticket.ticketNumber || "N/A"}</span>
                <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded font-medium">PREPARING</span>
              </div>
              <div className="text-lg font-bold text-slate-900">
                {ticket.quantity}x {ticket.productSku}
              </div>
              
              <button
                disabled={isPending}
                onClick={() => handleUpdateStatus(ticket.id, "COMPLETED")}
                className="mt-2 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-5 h-5" />
                Marcar Completado
              </button>
            </div>
          ))}
          {preparingTickets.length === 0 && (
            <div className="col-span-full h-32 flex items-center justify-center text-slate-400 border-2 border-dashed rounded-lg">
              No hay pedidos pendientes en cola.
            </div>
          )}
        </div>
      </div>

      {/* ZONA DE AIRLOCK: COMPLETADOS RECIENTES */}
      <div className="bg-emerald-50/50 rounded-xl border border-emerald-100 mt-2 flex flex-col max-h-[40vh]">
        <div 
          className="p-4 cursor-pointer flex justify-between items-center"
          onClick={() => setShowRecentCompleted(!showRecentCompleted)}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <h2 className="text-lg font-semibold text-emerald-800">
              Completados Recientes (Airlock Temporal)
            </h2>
            <span className="bg-emerald-200 text-emerald-800 text-xs px-2 py-0.5 rounded-full font-bold ml-2">
              {completedTickets.length}
            </span>
          </div>
          <button className="text-emerald-700 text-sm hover:underline">
            {showRecentCompleted ? "Ocultar" : "Mostrar"}
          </button>
        </div>

        {showRecentCompleted && (
          <div className="p-4 border-t border-emerald-100 overflow-y-auto">
            <div className="flex flex-col gap-3">
              {completedTickets.map((ticket) => {
                const isImmutable = ticket.depleted;
                
                return (
                  <div 
                    key={ticket.id} 
                    className={`flex items-center justify-between p-3 rounded-lg border bg-white shadow-sm ${
                      isImmutable ? "opacity-75 border-slate-200" : "border-emerald-200"
                    }`}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-slate-600">
                          {ticket.ticketNumber || ticket.id.substring(0,8)}
                        </span>
                        {isImmutable && (
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded flex items-center gap-1 border border-slate-200">
                            <AlertTriangle className="w-3 h-3" />
                            INMUTABLE (MERMADO)
                          </span>
                        )}
                      </div>
                      <span className="text-slate-800 font-medium">
                        {ticket.quantity}x {ticket.productSku}
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-xs text-slate-400 font-mono text-right flex flex-col">
                        <span>Airlock TS:</span>
                        <span>{ticket.completedAt ? new Date(ticket.completedAt).toLocaleTimeString() : "--:--:--"}</span>
                      </div>
                      
                      <button
                        disabled={isPending || isImmutable || false} // isImmutable force disable
                        onClick={() => handleUpdateStatus(ticket.id, "PREPARING")}
                        title={isImmutable ? "El registro ha cruzado el Event Horizon (Mermado). Acción inmutable." : "Deshacer ticket completado por error"}
                        className="px-4 py-2 bg-white text-slate-600 hover:text-red-600 hover:bg-neutral-50 border border-slate-200 rounded-md font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Deshacer
                      </button>
                    </div>
                  </div>
                );
              })}
              {completedTickets.length === 0 && (
                <div className="text-center text-slate-400 text-sm py-4">
                  No hay tickets en búfer temporal.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
