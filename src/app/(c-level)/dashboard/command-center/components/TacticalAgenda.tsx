"use client";

import { useState, useTransition } from "react";
import { addAgendaItem, toggleAgendaStatus, deleteAgendaItem } from "@/actions/agenda-actions";
import { evaluateStockAutonomy } from "@/actions/procurement-agent";
import { Calendar, CheckCircle2, Circle, Clock, Plus, Trash2, StickyNote, Flag, Zap, ShoppingCart } from "lucide-react";

export type AgendaItem = {
  id: string;
  title: string;
  type: string; // "TASK" | "NOTE" | "EVENT"
  dueDate: string | null;
  isCompleted: boolean;
};

function isPOTask(title: string): boolean {
  return title.startsWith("🔴 PO Urgente:");
}

export function TacticalAgenda({ items }: { items: AgendaItem[] }) {
  const [isPending, startTransition] = useTransition();
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [agentMessage, setAgentMessage] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"TASK" | "NOTE" | "EVENT">("TASK");

  const handleAdd = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      await addAgendaItem({ title, type });
      setTitle("");
    });
  };

  const handleToggle = (id: string, current: boolean) => {
    startTransition(async () => {
      await toggleAgendaStatus(id, current);
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteAgendaItem(id);
    });
  };

  const handleEvaluateSupply = async () => {
    setIsEvaluating(true);
    setAgentMessage(null);
    try {
      const result = await evaluateStockAutonomy();
      setAgentMessage(result.message || result.error || "Evaluación completada.");
    } catch (err) {
      setAgentMessage("❌ Fallo al invocar el Agente de Compras.");
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col h-full font-sans">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-white/50 shadow-sm">
            <Calendar size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">Agenda Táctica</h2>
            <p className="text-xs text-slate-500 font-medium font-mono uppercase">Closed-Loop Workspace</p>
          </div>
        </div>
        <button
          onClick={handleEvaluateSupply}
          disabled={isEvaluating}
          className="flex items-center gap-1.5 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 px-3 py-2 rounded-lg hover:bg-amber-100 hover:shadow-sm transition-all disabled:opacity-60"
          title="Ejecutar Agente Autónomo de Compras"
        >
          {isEvaluating ? (
            <Zap size={13} className="animate-pulse" />
          ) : (
            <ShoppingCart size={13} />
          )}
          {isEvaluating ? "Evaluando..." : "Evaluar Stock"}
        </button>
      </div>

      {/* Agent Feedback Banner */}
      {agentMessage && (
        <div className={`mb-4 text-xs font-semibold px-3 py-2.5 rounded-lg border transition-all ${
          agentMessage.startsWith("✅") 
            ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
            : agentMessage.startsWith("⚡")
            ? "bg-amber-50 text-amber-700 border-amber-200"
            : "bg-red-50 text-red-600 border-red-200"
        }`}>
          {agentMessage}
        </div>
      )}

      {/* Quick Input */}
      <div className="flex gap-2 mb-5">
        <select 
          className="bg-slate-50 border border-slate-200 rounded-lg px-2 text-sm text-slate-700 outline-none focus:border-indigo-300 transition-colors font-medium shadow-inner"
          value={type}
          onChange={(e) => setType(e.target.value as any)}
        >
          <option value="TASK">Task</option>
          <option value="NOTE">Nota</option>
          <option value="EVENT">Evento</option>
        </select>
        <div className="relative flex-grow">
          <input 
            type="text" 
            placeholder="Añadir directiva operativa..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-10 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all text-slate-800 placeholder-slate-400 shadow-inner"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            disabled={isPending}
          />
          <button 
            onClick={handleAdd}
            disabled={isPending || !title.trim()}
            className="absolute right-1 top-1 bottom-1 px-3 flex items-center justify-center bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-md transition-colors disabled:opacity-50 font-bold shadow-sm"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="flex-grow overflow-y-auto pr-1 space-y-2.5 max-h-80 custom-scrollbar">
        {items.length === 0 ? (
           <div className="text-center text-sm text-slate-400 font-medium py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
             El hub de tareas está vacío.
           </div>
        ) : (
          items.map(item => {
            const isPo = isPOTask(item.title);
            return (
              <div 
                key={item.id} 
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                  item.isCompleted 
                    ? 'bg-slate-50/80 border-slate-100 opacity-60' 
                    : isPo 
                      ? 'bg-red-50/40 border-red-200 shadow-sm hover:border-red-300 ring-1 ring-red-100' 
                      : 'bg-white border-slate-200 shadow-sm hover:border-indigo-200'
                }`}
              >
                <button onClick={() => handleToggle(item.id, item.isCompleted)} className="mt-0.5 flex-shrink-0 text-slate-300 hover:text-indigo-500 transition-colors focus:outline-none">
                  {item.isCompleted 
                    ? <CheckCircle2 size={18} className="text-emerald-500" /> 
                    : <Circle size={18} className={isPo ? "text-red-300 hover:text-emerald-400" : "text-slate-300 hover:text-indigo-400"} />}
                </button>
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    {isPo && <ShoppingCart size={12} className="text-red-500 flex-shrink-0" />}
                    {!isPo && item.type === 'NOTE' && <StickyNote size={12} className="text-amber-500 flex-shrink-0" />}
                    {!isPo && item.type === 'EVENT' && <Flag size={12} className="text-indigo-500 flex-shrink-0" />}
                    <p className={`text-sm font-semibold leading-snug ${
                      item.isCompleted ? 'line-through text-slate-500' 
                      : isPo ? 'text-red-800'
                      : 'text-slate-800'
                    }`}>
                      {item.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    {isPo && !item.isCompleted && (
                      <span className="text-[9px] font-bold uppercase tracking-widest bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                        Agente AI • Aprobar PO
                      </span>
                    )}
                    {item.dueDate && (
                      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-mono text-amber-600 font-semibold bg-amber-50 shadow-sm self-start px-2 py-0.5 rounded-full w-fit">
                        <Clock size={10} className="inline mr-0.5 -mt-0.5 text-amber-500" />
                        {item.dueDate}
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={() => handleDelete(item.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1 opacity-0 hover:opacity-100 md:opacity-100 focus:outline-none focus:opacity-100">
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 10px;
        }
      `}} />
    </div>
  );
}
