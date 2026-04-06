"use client";

import { useTransition, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ingestDynamicExcel, extractExcelHeaders } from "@/actions/excel-ingestion";
import { toast } from "sonner";

export default function ExcelIngestionVault() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorAlert, setErrorAlert] = useState<string | null>(null);
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleData, setSampleData] = useState<any[]>([]);
  
  const [mapping, setMapping] = useState({ cantidad: 0, precio: 1, nroCaja: 2, fecha: 3, descripcion: 4 });

  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setErrorAlert(null);
    if (!file) {
      toast.error("No se detectó un archivo válido.");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        
        // 1. Sonda Extractora O(1)
        const res = await extractExcelHeaders(formData);
        if (res.success && res.headers) {
          setHeaders(res.headers);
          setSampleData(res.sampleData || []);
          
          // Auto-Heurística
          const map = { cantidad: 0, precio: 1, nroCaja: 2, fecha: 3, descripcion: 4 };
          res.headers.forEach((h: string, i: number) => {
             const lower = h.toLowerCase();
             if (lower.includes("cant")) map.cantidad = i;
             else if (lower.includes("prec") || lower.includes("monto")) map.precio = i;
             else if (lower.includes("caja")) map.nroCaja = i;
             else if (lower.includes("fec")) map.fecha = i;
             else if (lower.includes("desc") || lower.includes("art")) map.descripcion = i;
          });
          setMapping(map);
          setPendingFile(file);
          setShowModal(true);
        } else {
          setErrorAlert(res.error || "Falla al analizar cabeceras.");
        }
      } catch (err: any) {
        setErrorAlert(err.message || "Falla Zero-Trust Inicial");
      }
    });
  };

  const confirmIngestion = () => {
    if (!pendingFile) return;
    startTransition(async () => {
       try {
          const formData = new FormData();
          formData.append("file", pendingFile);
          formData.append("mapping", JSON.stringify(mapping));
          formData.append("syncKey", `EXCEL_${pendingFile.name.toUpperCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`);
          
          const res = await ingestDynamicExcel(formData);
         if (res.success && res.data?.targetDate) {
            toast.success(`Ingesta Exitosa: ${(res.data as any)?.inserted || 0} filas procesadas.`);
            setShowModal(false);
            setPendingFile(null);
            router.push(`/dashboard/sales?date=${res.data.targetDate}`);
         } else if (res.success) {
            toast.success(`Ingesta Exitosa: ${(res.data as any)?.inserted || 0} filas procesadas.`);
            setShowModal(false);
            setPendingFile(null);
            router.refresh();
         } else {
            const errMessage = res.error || (res.data as any)?.error || "Formato inválido";
            toast.error(`Fallo: ${errMessage}`);
            setErrorAlert(errMessage);
         }
       } catch (err: any) {
         setErrorAlert(err.message || "Falla Extrema de Integridad");
       }
    });
  };

  return (
    <>
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={`
          relative w-64 h-[60px] flex items-center justify-center cursor-pointer
          rounded-xl border transition-all duration-200 ease-out
          ${errorAlert ? "border-red-400 bg-red-50/50" : "border-dashed"}
          ${isDragOver && !errorAlert
            ? "border-slate-400 bg-slate-100" 
            : !errorAlert ? "border-slate-200 bg-[oklch(98%_0.01_240)] hover:border-slate-300 hover:bg-slate-50" : ""}
          ${isPending ? "opacity-50 pointer-events-none scale-95" : "opacity-100 scale-100"}
        `}
      >
      <input 
        type="file" 
        accept=".csv, .xlsx" 
        className="hidden" 
        ref={inputRef} 
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <div className="flex items-center gap-2 text-slate-500 font-medium text-sm">
        {isPending ? (
          <>
            <svg className="animate-spin h-4 w-4 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Ingestando Vault...</span>
          </>
        ) : errorAlert ? (
          <div className="flex flex-col items-center">
            <span className="text-red-600 font-bold text-xs truncate max-w-[200px]">{errorAlert}</span>
          </div>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
              <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path>
              <path d="M12 12v9"></path>
              <path d="m16 16-4-4-4 4"></path>
            </svg>
            <span>Soltar Archivo (CSV/XLSX)</span>
          </>
        )}
      </div>
    </div>

      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
           {/* Dropzone reset click propagation stop */}
           <div className="bg-white max-w-2xl w-full rounded-2xl shadow-xl border border-slate-200 overflow-hidden text-left" onClick={e => e.stopPropagation()}>
             <div className="bg-slate-50 border-b border-slate-100 p-6">
                <h3 className="text-xl font-black text-slate-800">Mapeo Estructural [Pre-Flight]</h3>
                <p className="text-sm text-slate-500 font-medium mt-1">Acopla las cabeceras detectadas con la estructura dimensional antes de detonar en Turso.</p>
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
                       disabled={isPending}
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
                  disabled={isPending}
                  onClick={(e) => { e.stopPropagation(); setShowModal(false); setPendingFile(null); }}
                  className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Abortar Ingesta
                </button>
                <button 
                  disabled={isPending}
                  onClick={(e) => { e.stopPropagation(); confirmIngestion(); }}
                  className="px-6 py-2.5 rounded-xl font-bold text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-md shadow-blue-500/20"
                >
                  {isPending ? "Procesando Batch..." : "Detonar Ingesta (O(1))"}
                </button>
             </div>
           </div>
        </div>
      )}
    </>
  );
}
