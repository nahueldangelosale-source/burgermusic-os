"use client";

import { useTransition, useState } from "react";
import { updatePurchaseOrderStatus } from "@/actions/purchase-orders";
import { 
  RiShoppingBag3Line, 
  RiShip2Line, 
  RiCheckboxCircleLine, 
  RiCloseCircleLine,
  RiTimeLine,
  RiArrowRightLine,
  RiAddLine,
  RiDatabase2Line
} from "@remixicon/react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function PurchasesClient({ 
  initialOrders, 
  suppliers 
}: { 
  initialOrders: any[], 
  suppliers: any[] 
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [isPending, startTransition] = useTransition();

  const handleStatusUpdate = (poId: string, newStatus: "DRAFT_AI" | "APPROVED" | "SENT" | "FULFILLED") => {
    // 1. Optimistic UI update
    const previousOrders = [...orders];
    setOrders(current => 
      current.map(o => o.id === poId ? { ...o, status: newStatus } : o)
    );

    // 2. Transición Progresiva de Estado
    startTransition(async () => {
      try {
        const result = await updatePurchaseOrderStatus({ poId, status: newStatus });
        if (!result.success) {
          setOrders(previousOrders);
          toast.error("Falla en sincronización de estado.");
        } else {
          toast.success(`Orden ${poId} -> ${newStatus}`);
        }
      } catch (e) {
        setOrders(previousOrders);
        toast.error("Error crítico de red.");
      }
    });
  };

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'DRAFT_AI': return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      case 'APPROVED': return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      case 'SENT': return 'bg-accent-primary/10 text-accent-primary border-accent-primary/20';
      case 'FULFILLED': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      default: return 'bg-white/5 text-white/40 border-white/10';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-auto">
      
      {/* 1. BENTO: CREACIÓN (Main Strategy) */}
      <div className="md:col-span-8 bg-accent-primary rounded-3xl p-10 flex flex-col justify-between shadow-2xl relative overflow-hidden group min-h-[300px]">
        <div className="absolute top-0 right-0 p-32 bg-white/20 blur-[100px] rounded-full group-hover:scale-125 transition-transform duration-1000" />
        <div className="relative z-10">
          <h3 className="text-4xl font-black italic tracking-tighter uppercase mb-4 text-white leading-none">
            Gatillar Ciclo de <br />Abastecimiento
          </h3>
          <p className="text-white/80 text-lg font-medium max-w-[400px]">
            Inyecta nuevas órdenes de compra certificadas por el motor BOM O(1).
          </p>
        </div>
        <button className="relative z-10 bg-white text-accent-primary w-fit px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-xl active:scale-95 flex items-center gap-3">
          <RiAddLine size={22} />
          Nueva OC Estratégica
        </button>
      </div>

      {/* 2. BENTO: MÉTRICA SENT */}
      <div className="md:col-span-4 bg-white/5 backdrop-blur-[12px] border border-white/10 rounded-3xl p-8 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 bg-accent-primary/5 blur-[40px] rounded-full" />
        <RiTimeLine className="text-accent-primary/60 mb-4" size={40} />
        <div>
          <h3 className="text-xs font-bold text-white/40 uppercase tracking-[0.2em] mb-1">Órdenes en Tránsito</h3>
          <p className="text-6xl font-black tracking-tighter text-white">
            {orders.filter(o => o.status === 'SENT').length}
          </p>
        </div>
      </div>

      {/* 3. BENTO: MÉTRICA TOTAL EMERALD */}
      <div className="md:col-span-4 bg-white/5 backdrop-blur-[12px] border border-white/10 rounded-3xl p-8 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 bg-emerald-500/5 blur-[40px] rounded-full" />
        <RiCheckboxCircleLine className="text-emerald-400/60 mb-4" size={40} />
        <div>
          <h3 className="text-xs font-bold text-white/40 uppercase tracking-[0.2em] mb-1">Recibidas (Month)</h3>
          <p className="text-6xl font-black tracking-tighter text-white">
            {orders.filter(o => o.status === 'FULFILLED').length}
          </p>
        </div>
      </div>

      {/* 4. BENTO: PIPELINE PRINCIPAL (Full width/Height) */}
      <div className="md:col-span-8 bg-white/5 backdrop-blur-[12px] border border-white/10 rounded-2xl p-8 flex flex-col min-h-[600px] shadow-2xl">
        <div className="flex items-center justify-between mb-8">
           <h2 className="text-xl font-bold flex items-center gap-3 text-white">
             <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center text-accent-primary text-2xl font-black border border-accent-primary/10 shadow-lg">
               <RiDatabase2Line size={24} />
             </div>
             Pipeline de Compras Certificado
           </h2>
           <div className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-white/40 border border-white/5">
             Optimistic UI
           </div>
        </div>

        <div className="flex-1 overflow-auto pr-2 custom-scrollbar space-y-4">
          <AnimatePresence mode="popLayout">
            {orders.map((order: any) => (
              <motion.div
                layout
                key={order.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white/[0.03] border border-white/5 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-white/[0.07] transition-all duration-300 relative group"
              >
                <div className="flex items-center gap-6">
                  <div className="hidden md:flex w-14 h-14 rounded-xl bg-white/5 items-center justify-center text-white/20 group-hover:text-accent-primary group-hover:scale-105 transition-all duration-500">
                    <RiShoppingBag3Line size={28} />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg tracking-tight mb-1 text-white">{order.id}</h4>
                    <div className="flex items-center gap-4">
                       <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-widest ${getStatusStyle(order.status)}`}>
                         {order.status}
                       </span>
                       <span className="text-[11px] text-white/40 font-bold flex items-center gap-1 uppercase tracking-wider">
                         <RiTimeLine size={12} /> {order.created_at}
                       </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col md:items-end gap-1">
                  <p className="text-2xl font-black tracking-tighter text-white">
                    ${(Number(order.total_estimated_cents || 0) / 100).toLocaleString('es-AR')}
                  </p>
                  <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Costo Proyectado</p>
                </div>

                <div className="flex gap-2">
                  <AnimatePresence>
                    {order.status === 'SENT' && (
                      <button 
                        onClick={() => handleStatusUpdate(order.id, 'FULFILLED')}
                        disabled={isPending}
                        className="px-6 py-3 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 font-bold text-xs uppercase tracking-widest border border-emerald-500/20 transition-all active:scale-95 disabled:opacity-30 flex items-center gap-2"
                      >
                        <RiShip2Line size={16} />
                        Recibir
                      </button>
                    )}
                    {(order.status === 'DRAFT_AI' || order.status === 'APPROVED') && (
                      <button 
                        onClick={() => handleStatusUpdate(order.id, 'SENT')}
                        disabled={isPending}
                        className="px-6 py-3 rounded-xl bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20 font-bold text-xs uppercase tracking-widest border border-accent-primary/20 transition-all active:scale-95 disabled:opacity-30 flex items-center gap-2"
                      >
                        <RiArrowRightLine size={16} />
                        Enviar
                      </button>
                    )}
                    {['SENT', 'DRAFT_AI', 'APPROVED'].includes(order.status) && (
                      <button 
                        onClick={() => handleStatusUpdate(order.id, 'DRAFT_AI')}
                        disabled={isPending}
                        className="p-3 rounded-xl bg-white/5 text-white/20 hover:text-rose-400 hover:bg-rose-500/10 border border-white/5 hover:border-rose-500/20 transition-all group/cancel"
                      >
                        <RiCloseCircleLine size={20} className="group-hover/cancel:rotate-90 transition-transform duration-500" />
                      </button>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

    </div>
  );
}
