"use client";

import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, BarChart, Bar, Legend } from "recharts";
import { BarChart3, Clock, Wallet, ShoppingCart, Upload, Landmark, FileText } from "lucide-react";

import { ingestCashClosures } from "@/actions/ingest-closures";
import { ingestSalesCSV } from "@/actions/sales-sync";
import { toast } from "sonner";
import * as Papa from "papaparse";

interface VentasDashboardProps {
  initialProducts: any[];
  initialChannels: any[];
  initialEvolution: any[];
}

export function VentasDashboard({ initialProducts, initialChannels, initialEvolution }: VentasDashboardProps) {
  const [timeRange, setTimeRange] = useState("30");
  const [isUploadingSales, setIsUploadingSales] = useState(false);
  const [isUploadingClosures, setIsUploadingClosures] = useState(false);

  // Modal State para Zona A
  const [showModal, setShowModal] = useState(false);
  const [pendingCsvText, setPendingCsvText] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState({ cantidad: 0, precio: 1, nroCaja: 2, fecha: 3, descripcion: 4 });

  // ── ZONA A (Ventas Operativas) con Modal de Mapeo ──
  const handleSalesUploadClick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    try {
      const file = e.target.files[0];
      const text = await file.text();
      
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.meta.fields && results.meta.fields.length > 0) {
            setHeaders(results.meta.fields);
            
            // Auto-Heurística para el mapeo base
            const map = { cantidad: 0, precio: 1, nroCaja: 2, fecha: 3, descripcion: 4 };
            results.meta.fields.forEach((h, i) => {
               const lower = String(h).toLowerCase();
               if (lower.includes("cant")) map.cantidad = i;
               else if (lower.includes("prec") || lower.includes("monto") || lower.includes(" total")) map.precio = i;
               else if (lower.includes("caja")) map.nroCaja = i;
               else if (lower.includes("fec")) map.fecha = i;
               else if (lower.includes("desc") || lower.includes("art")) map.descripcion = i;
            });
            
            setMapping(map);
            setPendingCsvText(text);
            setShowModal(true); // Activa el modal estructural
          } else {
            toast.error("No se detectaron cabeceras en el CSV.");
          }
        }
      });
    } catch (err: any) {
      toast.error("Error al leer el archivo: " + err.message);
    } finally {
      e.target.value = '';
    }
  };

  const confirmSalesIngestion = async () => {
    setShowModal(false);
    setIsUploadingSales(true);
    try {
      // Reconstruir CSV con las cabeceras estándar que espera ingestSalesCSV
      Papa.parse(pendingCsvText, {
        header: false,
        skipEmptyLines: true,
        complete: async (results) => {
          const rawData = results.data as string[][];
          if (rawData.length <= 1) {
            toast.error("El archivo está vacío.");
            setIsUploadingSales(false);
            return;
          }

          // Header estándar de sales-sync.ts
          const standardHeaders = ["FechaCaja", "NroCaja", "Descripcion", "Suma de Cantidad", " Suma de Precio"];
          
          const mappedRows = [];
          for (let i = 1; i < rawData.length; i++) {
            const row = rawData[i];
            mappedRows.push([
              row[mapping.fecha] || "",
              row[mapping.nroCaja] || "",
              row[mapping.descripcion] || "",
              row[mapping.cantidad] || "1",
              row[mapping.precio] || "0",
            ]);
          }

          const rebuiltCsv = Papa.unparse({
            fields: standardHeaders,
            data: mappedRows
          }, { delimiter: ";" });

          const res = await ingestSalesCSV(rebuiltCsv);
          if (!res.success || res.data?.success === false) {
            toast.error("Error Ventas: " + (res.data?.error || res.error || "Fallo en ingesta"));
          } else {
            toast.success(`Ventas: ${res.data?.newSalesInserted} transacciones ingestadas. ${res.data?.unknownItemsCount} SKUs huérfanos higienizados.`);
          }
          setIsUploadingSales(false);
        }
      });
    } catch (err: any) {
      toast.error("Error Fatal: " + err.message);
      setIsUploadingSales(false);
    }
  };

  // ── ZONA B (Cierres Financieros) con Cero Fricción ──
  const handleClosuresUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploadingClosures(true);
    const formData = new FormData();
    formData.append("file", e.target.files[0]);
    try {
      const res = await ingestCashClosures(formData);
      if (res.error) {
        toast.error("Error Cierres: " + res.error);
      } else {
        toast.success(`Cierres: ${res.ingestedRows} filas financieras ingestadas.`);
      }
    } catch (err: any) {
      toast.error("Error Cierres: " + err.message);
    } finally {
      setIsUploadingClosures(false);
      e.target.value = '';
    }
  };

  const COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];

  const formattedChannels = initialChannels.map((c, i) => ({
    name: c.method.replace('_', ' '),
    value: c.total / 100,
    color: COLORS[i % COLORS.length]
  }));

  const formattedProducts = initialProducts.slice(0, 5).map((p) => ({
    name: p.productName || p.productId,
    value: p.totalQuantity
  }));

  const formattedEvolution = initialEvolution.map((e) => ({
    date: e.date,
    revenue: e.revenue / 100,
    net: e.net / 100
  }));

  return (
    <>
      <div className="p-8 max-w-7xl mx-auto flex flex-col gap-8 bg-slate-50 min-h-screen text-slate-800 font-sans selection:bg-blue-500/20">
        
        {/* HEADER & ISOLATED AIRLOCKS (ZONAS ESTRICTAS) */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-gray-200 gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-slate-900 flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-blue-600" />
              Ventas Vortex
            </h1>
            <p className="text-sm font-medium tracking-wide text-gray-500 mt-1 uppercase">Airlocks Segregados • Flujos O(1)</p>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            {/* ZONA A: Ventas Operativas */}
            <label className={`cursor-pointer px-4 py-2.5 text-sm font-bold rounded-xl transition-all border-2 flex items-center gap-2 ${isUploadingSales ? 'opacity-50 pointer-events-none border-blue-300 bg-blue-50' : 'border-blue-500 bg-blue-50 hover:bg-blue-100 text-blue-700'}`}>
              <Upload className="w-4 h-4" />
              <span>{isUploadingSales ? 'Ingestando Ventas...' : 'Ingestar Ventas 1Q.csv'}</span>
              <input type="file" accept=".csv" className="hidden" onChange={handleSalesUploadClick} disabled={isUploadingSales} />
            </label>

            {/* ZONA B: Cierres Financieros */}
            <label className={`cursor-pointer px-4 py-2.5 text-sm font-bold rounded-xl transition-all border-2 flex items-center gap-2 ${isUploadingClosures ? 'opacity-50 pointer-events-none border-emerald-300 bg-emerald-50' : 'border-emerald-500 bg-emerald-50 hover:bg-emerald-100 text-emerald-700'}`}>
              <Landmark className="w-4 h-4" />
              <span>{isUploadingClosures ? 'Ingestando Dinámica...' : 'Ingestar Dinámica.csv'}</span>
              <input type="file" accept=".csv, .xlsx" className="hidden" onChange={handleClosuresUpload} disabled={isUploadingClosures} />
            </label>

            <div className="w-px h-8 bg-gray-200 mx-1 hidden md:block"></div>
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
              {["30", "60", "90"].map(days => (
                <button 
                  key={days}
                  onClick={() => setTimeRange(days)}
                  className={`px-5 py-2 text-sm font-semibold rounded-md transition-colors ${timeRange === days ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-blue-500 hover:bg-slate-50'}`}
                >
                  {days} DÍAS
                </button>
              ))}
            </div>
          </div>
        </div>

      {/* ÁREA PRINCIPAL: EVOLUCIÓN TEMPORAL */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-500" /> Evolución de Ingresos
        </h2>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedEvolution} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13, fontWeight: 500}} dy={15} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13, fontWeight: 500}} tickFormatter={(val) => `$${val/1000}k`} dx={-10} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                itemStyle={{ fontWeight: 700 }}
              />
              <Area type="monotone" name="Margen Bruto" dataKey="net" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorNet)" />
              <Area type="monotone" name="Ventas Brutas" dataKey="revenue" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SPLIT INFERIOR */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* DISTRIBUCIÓN DE CANALES (PIE CHART) */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-blue-500" /> Canales Financieros
          </h2>
          <div className="h-[300px] w-full flex justify-center">
            {formattedChannels.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={formattedChannels}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {formattedChannels.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => `$${Number(value).toLocaleString()}`} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 font-medium">Sin datos de canales</div>
            )}
          </div>
        </div>

        {/* CONSUMO DE PRODUCTOS (BAR CHART HORIZONTAL) */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-500" /> Top SKUs (Demanda)
          </h2>
          <div className="h-[300px] w-full">
            {formattedProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={formattedProducts} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 12, fontWeight: 600}} width={120} />
                  <Tooltip 
                    cursor={{fill: '#f1f5f9'}}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" name="Unidades" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
                <div className="flex items-center justify-center h-full text-slate-400 font-medium">Sin datos de productos</div>
            )}
          </div>
        </div>

      </div>
      {/* Cierre del contenedor principal (p-8 max-w-7xl...) */}
      </div>
      
      {/* ── MODAL MAPEO ESTRUCTURAL (ZONA A) ── */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
           {/* Dropzone reset click propagation stop */}
           <div className="bg-white max-w-2xl w-full rounded-2xl shadow-xl border border-slate-200 overflow-hidden text-left" onClick={e => e.stopPropagation()}>
             <div className="bg-slate-50 border-b border-slate-100 p-6">
                <h3 className="text-xl font-black text-slate-800">Mapeo Estructural [Pre-Flight] (Ventas Operativas)</h3>
                <p className="text-sm text-slate-500 font-medium mt-1">Acopla las cabeceras detectadas con la estructura dimensional antes de procesar el ETL.</p>
             </div>
             
             <div className="p-6 grid grid-cols-2 gap-6">
                {Object.entries({
                  "Cantidad (Unidades)": "cantidad",
                  "Precio Neto (Cents)": "precio",
                  "Caja Registradora ID": "nroCaja",
                  "Fecha Transaccional": "fecha",
                  "Descripción / SKU": "descripcion"
                }).map(([label, key]) => (
                  <div key={key} className="flex flex-col gap-2">
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{label}</label>
                     <select 
                       className="bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 rounded-lg p-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
                       value={mapping[key as keyof typeof mapping]}
                       onChange={(e) => setMapping(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                       disabled={isUploadingSales}
                     >
                       {headers.map((h, i) => (
                         <option key={i} value={i}>Columna {i}: {h}</option>
                       ))}
                     </select>
                  </div>
                ))}
             </div>

             <div className="bg-slate-50 border-t border-slate-100 p-6 flex items-center justify-between">
                <button 
                  disabled={isUploadingSales}
                  onClick={(e) => { e.stopPropagation(); setShowModal(false); setPendingCsvText(""); }}
                  className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Abortar Selección
                </button>
                <button 
                  disabled={isUploadingSales}
                  onClick={(e) => { e.stopPropagation(); confirmSalesIngestion(); }}
                  className="px-6 py-2.5 rounded-xl font-bold text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-md shadow-blue-500/20"
                >
                  {isUploadingSales ? "Ejecutando ETL..." : "Confirmar e Ingestar (O(1))"}
                </button>
             </div>
           </div>
        </div>
      )}

    </>
  );
}
