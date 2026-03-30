"use client";

import { Card, Metric, Text, DonutChart } from "@tremor/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { flexRender, getCoreRowModel, useReactTable, getSortedRowModel, SortingState } from "@tanstack/react-table";
import { useRef, useMemo, useState, useEffect } from "react";
import { ComposedChart, Area, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, Coins, Receipt, ArrowUpRight } from "lucide-react";

/**
 * [UX/UI] PREMIUM LIGHT COMPONENTS v4
 * ───────────────────────────────────────
 * Estándar: BurgerMusic OS v4
 * Regla: Limpieza, Aire, Alta Fidelidad.
 */

function AnimatedNumber({ value }: { value: number }) {
  const [current, setCurrent] = useState(0);
  
  useEffect(() => {
    let startTime: number;
    let animationFrame: number;
    const duration = 1200;
    
    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
    
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const currentVal = Math.floor(easeOutQuart(progress) * value);
      setCurrent(currentVal);
      if (progress < 1) {
        animationFrame = requestAnimationFrame(step);
      } else {
        setCurrent(value);
      }
    };
    
    if (value > 0) {
       animationFrame = requestAnimationFrame(step);
    } else {
       setCurrent(0);
    }
    
    return () => cancelAnimationFrame(animationFrame);
  }, [value]);

  return <>{current.toLocaleString()}</>;
}

const formatDate = (date: any, _indexOrPayload?: any) => {
  if (!date || typeof date !== 'string') return String(date || "");
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    const formatter = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'numeric' });
    const formatted = formatter.format(d);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch (e) {
    return String(date);
  }
};

// ÉPICA 1: KPIs PREMIUM (WHITE THEME)
export function VentasBrutas({ data }: { data: number }) {
  return (
    <Card className="bg-white rounded-[24px] border border-slate-100 shadow-sm h-full flex flex-col justify-center p-8 animate-in zoom-in duration-500 relative overflow-hidden group">
      <div className="flex justify-between items-start">
        <div>
          <Text className="uppercase tracking-[0.2em] font-bold text-slate-400 text-[10px] mb-2">Ventas Brutas</Text>
          <Metric className="text-3xl font-black text-slate-900 tracking-tight">$<AnimatedNumber value={data} /></Metric>
        </div>
        <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-500">
           <TrendingUp size={24} />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-indigo-500 font-bold text-[10px] uppercase tracking-widest">
         <ArrowUpRight size={14} />
         <span>Incremento en Tiempo Real</span>
      </div>
      <div className="absolute top-0 left-0 w-full h-[3px] bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Card>
  );
}

export function VentasNetas({ data }: { data: number }) {
  return (
    <Card className="bg-white rounded-[24px] border border-slate-100 shadow-sm h-full flex flex-col justify-center p-8 animate-in zoom-in duration-500 relative overflow-hidden group delay-100">
      <div className="flex justify-between items-start">
        <div>
          <Text className="uppercase tracking-[0.2em] font-bold text-slate-400 text-[10px] mb-2">Ventas Netas (Auditadas)</Text>
          <Metric className="text-3xl font-black text-slate-900 tracking-tight">$<AnimatedNumber value={data} /></Metric>
        </div>
        <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600">
           <Coins size={24} />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-emerald-600 font-bold text-[10px] uppercase tracking-widest">
         <ArrowUpRight size={14} />
         <span>Cashflow Liquidez O(1)</span>
      </div>
      <div className="absolute top-0 left-0 w-full h-[3px] bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Card>
  );
}

export function TicketPromedio({ data }: { data: number }) {
  return (
    <Card className="bg-white rounded-[24px] border border-slate-100 shadow-sm h-full flex flex-col justify-center p-8 animate-in zoom-in duration-500 relative overflow-hidden group delay-200">
      <div className="flex justify-between items-start">
        <div>
          <Text className="uppercase tracking-[0.2em] font-bold text-slate-400 text-[10px] mb-2">Ticket Promedio</Text>
          <Metric className="text-3xl font-black text-slate-900 tracking-tight">$<AnimatedNumber value={data} /></Metric>
        </div>
        <div className="bg-amber-50 p-3 rounded-2xl text-amber-500">
           <Receipt size={24} />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-amber-500 font-bold text-[10px] uppercase tracking-widest">
         <ArrowUpRight size={14} />
         <span>Optimización de Menú</span>
      </div>
      <div className="absolute top-0 left-0 w-full h-[3px] bg-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Card>
  );
}

// ÉPICA 2: EVO TEMPORAL (PREMIUM LIGHT)
export function TemporalEvolutionChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return (
      <Card className="bg-white rounded-[24px] border border-slate-100 shadow-sm h-full flex flex-col p-8 animate-in fade-in duration-700">
        <Text className="uppercase tracking-widest font-bold text-slate-400 text-xs mb-6">Evolución de Ingresos</Text>
        <div className="flex-1 flex items-center justify-center w-full min-h-[300px] bg-slate-50 border-2 border-dashed border-slate-200 rounded-[20px] text-slate-400 font-bold text-xs uppercase tracking-widest">
          Sin Tráfico Transaccional.
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-white rounded-[24px] border border-slate-100 shadow-sm h-full flex flex-col p-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Evolución de Ingresos</h3>
          <p className="text-[10px] text-slate-400 font-bold tracking-wide mt-1 uppercase">Performance Diaria Auditada</p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2"><div className="w-3 h-3 bg-indigo-500 rounded-lg" /> <span className="text-[10px] text-slate-500 font-black tracking-widest uppercase">VENTAS</span></div>
           <div className="flex items-center gap-2"><div className="w-3 h-3 bg-slate-300 rounded-lg" /> <span className="text-[10px] text-slate-500 font-black tracking-widest uppercase">ÓRDENES</span></div>
        </div>
      </div>
      <div className="flex-1 w-full min-h-[300px] h-96">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 0, left: 10, bottom: 20 }}>
            <defs>
              <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 11, fill: "#0f172a", fontWeight: "800" }} 
              dy={15}
              tickFormatter={formatDate}
            />
            <YAxis 
              yAxisId="left" 
              axisLine={false} 
              tickLine={false} 
              tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} 
              tick={{ fontSize: 11, fill: "#0f172a", fontWeight: "800" }} 
              width={50} 
            />
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: "#64748b", fontWeight: "800" }} 
              width={30} 
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', opacity: 1 }}
              itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a' }}
              labelStyle={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '900', marginBottom: '8px' }}
              labelFormatter={formatDate}
              cursor={{ stroke: '#f1f5f9', strokeWidth: 2 }}
            />
            <Bar 
              yAxisId="right" 
              dataKey="ordenes" 
              fill="#e2e8f0" 
              radius={[4, 4, 0, 0]} 
              maxBarSize={12} 
            />
            <Area 
              yAxisId="left" 
              type="monotone" 
              dataKey="ingresos" 
              stroke="#6366f1" 
              strokeWidth={4} 
              fillOpacity={1} 
              fill="url(#colorIngresos)" 
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function ChannelDonutChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return (
      <Card className="bg-white rounded-[24px] border border-slate-100 shadow-sm h-full flex flex-col p-8 animate-in slide-in-from-right duration-700">
        <Text className="uppercase tracking-[0.2em] font-black text-slate-400 text-[10px] mb-8 text-center">Canales Financieros</Text>
        <div className="flex-1 flex items-center justify-center w-full min-h-[300px] bg-slate-50 border-2 border-dashed border-slate-200 rounded-[20px] text-slate-400 font-bold text-xs uppercase tracking-widest">
          Sin Distribución.
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-white rounded-[24px] border border-slate-100 shadow-sm h-full flex flex-col p-8 animate-in slide-in-from-right duration-700">
      <Text className="uppercase tracking-[0.2em] font-black text-slate-400 text-[10px] mb-8 text-center">Distribución por Canal</Text>
      <div className="flex-1 flex justify-center items-center min-h-[300px] h-96 w-full">
        <ResponsiveContainer width="100%" height="100%" aspect={1}>
          <DonutChart
            className="h-full w-full"
            data={data}
            category="value"
            index="name"
            valueFormatter={(val) => `$${(val).toLocaleString()}`}
            colors={["indigo", "emerald", "amber", "rose", "blue"]}
            variant="donut"
            showAnimation={true}
          />
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// ÉPICA 3: VIRTUALIZED O(1) TABLE (PREMIUM LIGHT)
export function TopProductsVirtualTable({ data }: { data: any[] }) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  
  const hasData = data && data.length > 0;

  const columns = useMemo(() => [
    { accessorKey: "rank", header: "#", size: 60 },
    { 
      accessorKey: "name", 
      header: "PRODUCTO", 
      size: 240,
      cell: (info: any) => <span className="font-bold text-slate-800">{info.getValue()}</span>
    },
    { accessorKey: "category", header: "CATEGORÍA", size: 140 },
    { accessorKey: "sales", header: "VENTAS", size: 100 },
    { 
      accessorKey: "revenue", 
      header: "INGRESOS", 
      size: 150,
      cell: (info: any) => <span className="font-black text-slate-900 tabular-nums">${(info.getValue()).toLocaleString()}</span>
    },
    { 
      accessorKey: "margin", 
      header: "MARGEN", 
      size: 100,
      cell: (info: any) => <span className="font-black text-emerald-600">{info.getValue()}</span>
    },
  ], []);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 52,
    overscan: 5,
  });

  return (
    <Card className="bg-white rounded-[24px] border border-slate-100 shadow-sm h-full flex flex-col p-0 overflow-hidden animate-in slide-in-from-left duration-700">
      <div className="p-8 border-b border-slate-50 bg-slate-50/30">
        <Text className="uppercase tracking-[0.2em] font-black text-slate-400 text-[10px]">Top Rankings - Inteligencia MDM</Text>
      </div>
      <div ref={tableContainerRef} className="flex-1 overflow-auto bg-white min-h-[300px]">
        {!hasData ? (
          <div className="flex items-center justify-center min-h-[400px] text-slate-300 font-black uppercase text-[10px] tracking-[0.3em]">
             No se detectan SKUs en el periodo.
          </div>
        ) : (
        <table className="w-full text-[11px] text-left relative text-slate-600">
           <thead className="sticky top-0 bg-white z-10 border-b border-slate-100">
             {table.getHeaderGroups().map(hg => (
                <tr key={hg.id}>
                  {hg.headers.map(h => (
                    <th key={h.id} style={{ width: h.getSize() }} className="px-8 py-5 font-black uppercase tracking-[0.2em] text-[9px] text-slate-400 cursor-pointer select-none hover:text-slate-900 transition-colors" onClick={h.column.getToggleSortingHandler()}>
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
             ))}
           </thead>
           <tbody style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
             {rowVirtualizer.getVirtualItems().map(virtualRow => {
                const row = rows[virtualRow.index];
                return (
                  <tr 
                    key={row.id} 
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualRow.index}
                    className="absolute w-full border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                    style={{
                      top: 0,
                      left: 0,
                      transform: `translateY(${virtualRow.start}px)`
                    }}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} style={{ width: cell.column.getSize() }} className="px-8 py-4 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
             })}
           </tbody>
        </table>
        )}
      </div>
    </Card>
  );
}
