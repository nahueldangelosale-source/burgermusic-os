"use client";

import { useActionState, useState } from "react";
import { draftInventorySnapshot } from "@/actions/inventory-reconciliation";
import { PendingButton } from "@/components/ui/PendingButton";
import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Material {
  id: string;
  name: string;
  purchaseUnit: string;
}

interface InventoryKitchenClientProps {
  groupedMaterials: Record<string, Material[]>;
  storeId: string;
  reportedBy: string;
}

export function InventoryKitchenClient({ 
  groupedMaterials, 
  storeId, 
  reportedBy 
}: InventoryKitchenClientProps) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [activeCategory, setActiveCategory] = useState(Object.keys(groupedMaterials)[0]);

  // React 19 useActionState
  const [state, formAction] = useActionState(
    async (prevState: any, formData: FormData) => {
      const items = Object.entries(counts)
        .filter(([_, count]) => count > 0)
        .map(([id, count]) => ({ rawMaterialId: id, count }));

      if (items.length === 0) return { error: "No has contado ningún insumo." };

      const res = await draftInventorySnapshot({
        storeId,
        reportedBy,
        items,
      });

      if (res.success && 'snapshotId' in res) {
        setCounts({}); // Reset counts after success
        return { success: true, snapshotId: res.snapshotId };
      }
      return { error: 'error' in res ? res.error : "Unknown error" };
    },
    null
  );

  const updateCount = (id: string, delta: number) => {
    setCounts(prev => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta)
    }));
  };

  return (
    <div className="flex flex-col gap-10">
      <nav className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
        {Object.keys(groupedMaterials).map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "px-8 py-4 rounded-2xl font-black uppercase tracking-widest transition-all whitespace-nowrap",
              activeCategory === cat 
                ? "bg-accent-primary text-white shadow-[0_0_30px_rgba(59,130,246,0.5)]" 
                : "bg-slate-900/50 text-slate-500 border border-white/5 hover:bg-slate-800"
            )}
          >
            {cat}
          </button>
        ))}
      </nav>

      <form action={formAction} className="flex flex-col gap-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <BentoGrid className="md:grid-cols-12">
              {groupedMaterials[activeCategory]?.map((item, idx) => (
                <BentoGridItem 
                  key={item.id}
                  className={cn(
                    "bg-slate-900/40 border border-white/5 rounded-[2rem] p-8",
                    "md:col-span-6 lg:col-span-4"
                  )}
                >
                  <div className="flex flex-col gap-6">
                    <header>
                      <h3 className="text-2xl font-bold tracking-tight text-white mb-1 uppercase">
                        {item.name}
                      </h3>
                      <p className="text-slate-500 text-sm font-bold tracking-widest uppercase">
                        Unidad: {item.purchaseUnit}
                      </p>
                    </header>

                    <div className="flex items-center justify-between bg-black/40 rounded-3xl p-3 border border-white/5">
                      <button
                        type="button"
                        onClick={() => updateCount(item.id, -1)}
                        className="h-16 w-16 flex items-center justify-center rounded-2xl bg-slate-800 text-slate-300 text-3xl font-bold active:scale-90 active:bg-rose-500/20 active:text-rose-400 transition-all"
                      >
                        −
                      </button>
                      
                      <div className="flex flex-col items-center">
                        <span className="text-5xl font-black font-mono text-white leading-none">
                          {counts[item.id] || 0}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => updateCount(item.id, 1)}
                        className="h-16 w-16 flex items-center justify-center rounded-2xl bg-slate-800 text-slate-300 text-3xl font-bold active:scale-90 active:bg-emerald-500/20 active:text-emerald-400 transition-all"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </BentoGridItem>
              ))}
            </BentoGrid>
          </motion.div>
        </AnimatePresence>

        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/90 to-transparent backdrop-blur-sm flex justify-center z-50">
          <div className="max-w-screen-xl w-full flex items-center justify-between bg-slate-900/80 p-4 rounded-[2.5rem] border border-white/10 shadow-2xl">
            <div className="pl-6 hidden md:block">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Resumen de Cierre</p>
              <p className="text-xl font-black text-white">
                {Object.values(counts).filter(c => c > 0).length} Items Contados
              </p>
            </div>
            
            <PendingButton 
              className="w-full md:w-auto min-w-[300px] h-16 rounded-[2rem] text-xl"
              loadingText="SELLANDO DRAFT..."
            >
              CERRAR INVENTARIO
            </PendingButton>
          </div>
        </div>

        <AnimatePresence>
          {state?.success && (
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: -100, opacity: 1 }}
              className="fixed bottom-0 left-1/2 -translate-x-1/2 z-[60] bg-emerald-500 text-white px-8 py-4 rounded-full font-bold shadow-emerald-500/40 shadow-2xl"
            >
              ✅ Snapshot DRAFT Guardado: {state.snapshotId}
            </motion.div>
          )}
          {state?.error && (
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: -100, opacity: 1 }}
              className="fixed bottom-0 left-1/2 -translate-x-1/2 z-[60] bg-rose-500 text-white px-8 py-4 rounded-full font-bold shadow-rose-500/40 shadow-2xl"
            >
              ❌ Error: {state.error}
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
}
