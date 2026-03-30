"use client";

import React, { useTransition, useState } from "react";
import { completeKitchenChecklist } from "@/actions/operations";

export default function KitchenChecklistPane({ storeId }: { storeId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [tasks, setTasks] = useState([
    { id: "1", name: "Purga y cepillado profundo de plancha", completed: false },
    { id: "2", name: "Drenado y filtrado de aceite fritador", completed: false },
    { id: "3", name: "Etiquetado de mermas e inventario flash", completed: false }
  ]);

  const toggleTask = (taskId: string) => {
    // 1. Efecto Visual Inmediato (Optimistic UI) 
    setTasks(prev => 
      prev.map(t => t.id === taskId ? { ...t, completed: true } : t)
    );

    // 2. Transición Silenciosa (Edge Call)
    startTransition(async () => {
      // TODO: Extract storeId from context/session
      const result = await completeKitchenChecklist(storeId, taskId, "EMP_KIOSK_NIGHT_01");
      if (!result.success) {
        // Rollback on Error
        setTasks(prev => 
            prev.map(t => t.id === taskId ? { ...t, completed: false } : t)
        );
      }
    });
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 bg-zinc-100 hover:bg-white text-zinc-950 font-bold py-4 px-8 rounded-full shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-all hover:scale-105 active:scale-95"
      >
        PROCEDIMIENTOS DE CIERRE →
      </button>

      {/* Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-md transition-opacity">
          <div className="w-full max-w-lg bg-zinc-950 border-l border-zinc-800 h-full p-10 shadow-2xl flex flex-col slide-in-from-right animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-2xl font-black text-white tracking-widest uppercase">Checklist de Cumplimiento</h2>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-zinc-600 hover:text-white transition-colors"
              >
                CERRAR ✕
              </button>
            </div>

            <div className="flex-1 space-y-4">
              {tasks.map(task => (
                <label key={task.id} className="flex items-center space-x-5 p-5 border border-zinc-800/80 rounded-2xl bg-zinc-900 max-w-full cursor-pointer overflow-hidden transition-all hover:border-zinc-700">
                  <input 
                    type="checkbox" 
                    checked={task.completed}
                    onChange={() => toggleTask(task.id)}
                    disabled={task.completed || isPending}
                    className="h-6 w-6 bg-zinc-950 border-zinc-600 rounded-md focus:ring-0 checked:bg-white checked:text-zinc-900 transition-colors cursor-pointer"
                  />
                  <span className={`text-lg transition-all font-medium ${task.completed ? 'text-zinc-600 line-through' : 'text-zinc-200'}`}>
                    {task.name}
                  </span>
                </label>
              ))}
            </div>

            <div className="mt-8 border-t border-zinc-800 pt-6 text-center">
              <p className="text-xs text-zinc-600 tracking-widest font-mono uppercase">
                Auditoría Inmutable en el Borde
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
