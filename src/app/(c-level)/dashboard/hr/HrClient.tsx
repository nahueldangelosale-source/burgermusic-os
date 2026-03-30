"use client";

import React from "react";
import { Card, Metric, Text, Flex, BadgeDelta, Title, BarList } from "@tremor/react";

interface Employee {
  id: string;
  name: string;
  role: string;
  hourly_rate: number;
}

export default function HrClient({ payload, metrics }: { payload: Employee[], metrics: any }) {
  // Procesamiento visual O(1) de KPIs
  const kpis = [
    { title: "Headcount Activo", metric: metrics.totalActivos, delta: "Nómina Confirmada", deltaType: "unchanged" as const },
    { title: "Tarifa Hora Promedio", metric: `$ ${(metrics.costoHoraPromedio / 100).toFixed(2)}`, delta: "Mercado Base", deltaType: "moderateDecrease" as const },
    { title: "Runrate Laboral Mensual", metric: `$ ${(metrics.proyeccionMensual / 100).toLocaleString()}`, delta: "Estimado Estático", deltaType: "moderateIncrease" as const },
  ];

  // Distribución de roles para el BarList
  const roleDistribution = payload.reduce((acc: any, emp) => {
    acc[emp.role] = (acc[emp.role] || 0) + 1;
    return acc;
  }, {});

  const barData = Object.entries(roleDistribution).map(([name, value]) => ({
    name, value: value as number, color: 'emerald'
  })).sort((a, b) => b.value - a.value);

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {kpis.map((kpi) => (
          <div key={kpi.title} className="group relative bg-[oklch(0.98_0.01_250)] p-8 rounded-3xl ring-1 ring-zinc-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] flex flex-col border-t-4 border-t-emerald-600 hover:-translate-y-1.5 transition-all duration-300">
             <Flex alignItems="start" className="mb-3">
               <span className="font-mono text-[11px] tracking-widest text-slate-500 font-bold uppercase">{kpi.title}</span>
               <BadgeDelta deltaType={kpi.deltaType} size="xs" className="rounded-full shadow-sm">{kpi.delta}</BadgeDelta>
             </Flex>
             <div className="mt-1 truncate">
               <Metric className="text-[oklch(0.15_0.02_250)] tracking-tighter text-4xl font-black group-hover:text-emerald-950 transition-colors">{kpi.metric}</Metric>
             </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Distribución Visual */}
        <div className="col-span-1 lg:col-span-4 flex flex-col">
          <div className="bg-[oklch(0.98_0.01_250)] rounded-3xl ring-1 ring-zinc-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 flex-1 border-t-4 border-t-slate-800">
             <Title className="font-mono uppercase tracking-widest text-[oklch(0.45_0.02_250)] mb-3 font-bold">Matriz de Roles</Title>
             <Text className="mb-6 font-medium text-sm text-[oklch(0.45_0.02_250)]">Asignación jerárquica del personal activo.</Text>
             <BarList data={barData} className="w-full font-semibold text-[oklch(0.15_0.02_250)]" />
          </div>
        </div>

        {/* Tabla de Nómina (Simulada/Listada) */}
        <div className="col-span-1 lg:col-span-8 flex flex-col">
          <div className="bg-[oklch(0.98_0.01_250)] rounded-3xl ring-1 ring-zinc-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 flex-1 overflow-hidden">
             <Title className="font-mono uppercase tracking-widest text-[oklch(0.45_0.02_250)] mb-6 font-bold">Nómina Transaccional Inmutada</Title>
             <div className="max-h-[400px] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-zinc-200">
               <table className="w-full text-left text-sm whitespace-nowrap">
                 <thead className="uppercase tracking-wider border-b border-zinc-200 text-xs font-bold text-zinc-500 sticky top-0 bg-[oklch(0.98_0.01_250)] z-10">
                   <tr>
                     <th className="pb-3 pt-2">ID Operador</th>
                     <th className="pb-3 pt-2">Nombre (Alias)</th>
                     <th className="pb-3 pt-2">Clasificación</th>
                     <th className="pb-3 pt-2">Tarifa (Hora)</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-zinc-100">
                   {payload.slice(0, 100).map((emp) => ( // Mostramos solo 100 max por render dom
                     <tr key={emp.id} className="hover:bg-zinc-50/50 transition-colors">
                       <td className="py-3 font-mono text-zinc-400 text-xs">{emp.id.split('-')[0]}</td>
                       <td className="py-3 font-semibold text-zinc-800">{emp.name}</td>
                       <td className="py-3">
                         <span className="bg-emerald-100/50 text-emerald-800 px-2 py-1 rounded-md text-[10px] uppercase font-black tracking-widest">
                           {emp.role}
                         </span>
                       </td>
                       <td className="py-3 font-mono text-zinc-600 font-bold">$ {(emp.hourly_rate / 100).toFixed(2)}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
             <p className="text-xs text-zinc-400 mt-4 text-right font-mono uppercase tracking-widest">
               Mostrando 100 registros virtualizados / {payload.length} totales
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
