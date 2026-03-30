"use client";

import { DatePicker } from "@tremor/react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Calendar, BarChart3 } from "lucide-react";
import { es } from "date-fns/locale";

/**
 * [UX/UI] PREMIUM CALENDAR & PERIOD SELECTOR v4
 * ───────────────────────────────────────────
 * Estándar: BurgerMusic OS v4
 * Regla: Solidez Oclch, 0 Transparencia, Alta Precisión.
 */

export function DateSelector({ currentDate }: { availableDates: string[], currentDate: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const handleSelect = (val: string) => {
    const params = new URLSearchParams(searchParams?.toString());
    params.set("date", val);
    router.push(`${pathname}?${params.toString()}`);
  };

  const isPeriodActive = (p: string) => currentDate === p;

  return (
    <div className="flex flex-col gap-4 mt-6">
      <div className="flex items-center gap-2 ml-1">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Filtro de Inteligencia Temporal</label>
        <div className="h-px flex-1 bg-slate-100" />
      </div>
      
      <div className="flex flex-wrap items-center gap-4">
        {/* MÓDULO 1: CALENDARIO DE ALTA CALIDAD */}
        <div className="flex items-center gap-3 relative group overflow-visible">
          <DatePicker
            value={currentDate && !currentDate.endsWith('d') && currentDate !== 'all' ? new Date(currentDate) : undefined}
            onValueChange={(date) => {
              if (date) {
                const iso = date.toISOString().split('T')[0];
                handleSelect(iso);
              }
            }}
            placeholder="Seleccionar Fecha..."
            enableClear={false}
            locale={es}
            className="bg-white border-slate-300 text-slate-950 font-bold rounded-2xl shadow-md focus:ring-2 focus:ring-indigo-500 hover:border-indigo-400 transition-all h-14 w-72 ring-0 outline-none !opacity-100 placeholder:text-slate-400 border-2"
          />
          <style jsx global>{`
            /* FUERZA OPACIDAD ABSOLUTA EN POPOVER DE TREMOR/RADIX */
            [data-radix-popper-content-wrapper], 
            .tremor-DatePicker-popover,
            [role="dialog"] {
              background-color: white !important;
              opacity: 1 !important;
              border: 1px solid #e2e8f0 !important;
              box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1) !important;
              border-radius: 1rem !important;
              z-index: 9999 !important;
            }
          `}</style>
        </div>

        {/* MÓDULO 2: PRESETS DE ANÁLISIS (30-60-90) */}
        <div className="flex items-center bg-white border-2 border-slate-300 p-1 rounded-2xl shadow-md h-14 overflow-hidden">
           <button 
             onClick={() => handleSelect("30d")}
             className={`px-6 h-full text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${isPeriodActive("30d") ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}
           >
             30 Días
           </button>
           <button 
             onClick={() => handleSelect("60d")}
             className={`px-6 h-full text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${isPeriodActive("60d") ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}
           >
             60 Días
           </button>
           <button 
             onClick={() => handleSelect("90d")}
             className={`px-6 h-full text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${isPeriodActive("90d") ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}
           >
             90 Días
           </button>
           <div className="w-px h-6 bg-slate-200 mx-1" />
           <button 
             onClick={() => handleSelect("all")}
             className={`px-6 h-full text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${isPeriodActive("all") ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}
           >
             Global
           </button>
        </div>

        <div className="hidden lg:flex items-center gap-2 px-6 h-14 bg-indigo-50 border-2 border-indigo-100 rounded-2xl text-indigo-600 shadow-sm">
           <BarChart3 size={18} />
           <span className="text-[11px] font-black uppercase tracking-widest">Inferencia O(1) Lista</span>
        </div>
      </div>
    </div>
  );
}
