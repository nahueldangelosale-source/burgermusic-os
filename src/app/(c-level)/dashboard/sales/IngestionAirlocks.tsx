"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ingestSalesCSV } from "@/actions/sales-sync";
import { ingestCashClosures } from "@/actions/ingest-closures";
import { ingestDynamicExcel, extractExcelHeaders } from "@/actions/excel-ingestion";
import { getMDMCatalog } from "@/actions/alias-engine";
import OrphanageTray from "@/components/sales/OrphanageTray";
import { toast } from "sonner";
import * as Papa from "papaparse";
import * as XLSX from "xlsx";
import { Upload, Landmark } from "lucide-react";

/**
 * ═══════════════════════════════════════════════════════════════
 * AIRLOCK DE INGESTA SEGREGADO — Zero-Trust ETL UI v4
 * ═══════════════════════════════════════════════════════════════
 * Regla 1: DOS componentes aislados visual y lógicamente.
 *   - Zona A: "Airlock Operativo" → ingestSalesCSV
 *   - Zona B: "Airlock Financiero" → ingestCashClosures
 * Regla 3: "use client" obligatorio. FormData puro.
 */

// ─────────────────────────────────────────────────────────
// ZONA A: Airlock Operativo (Ventas 1Q.csv) — Con Modal de Mapeo
// ─────────────────────────────────────────────────────────
export function AirlockOperativo() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [pendingCsvText, setPendingCsvText] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState({ cantidad: 0, precio: 1, nroCaja: 2, fecha: 3, descripcion: 4 });

  // DLQ State
  const [unknownItems, setUnknownItems] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<{id: string, name: string}[]>([]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    try {
      const file = e.target.files[0];
      let text = "";

      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        text = XLSX.utils.sheet_to_csv(worksheet, { FS: ";" }); // Use semicolon to match our auto-detection
      } else {
        text = await file.text();
      }

      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.meta.fields && results.meta.fields.length > 0) {
            setHeaders(results.meta.fields);

            // Auto-heurística de mapeo
            const map = { fecha: 0, nroCaja: 1, descripcion: 2, cantidad: 3, precio: 4 };
            results.meta.fields.forEach((h, i) => {
              const lower = String(h).toLowerCase();
              if (lower.includes("cant")) map.cantidad = i;
              else if (lower.includes("prec") || lower.includes("monto") || lower.includes("total")) map.precio = i;
              else if (lower.includes("caja")) map.nroCaja = i;
              else if (lower.includes("fec")) map.fecha = i;
              else if (lower.includes("desc") || lower.includes("art")) map.descripcion = i;
            });

            setMapping(map);
            setPendingCsvText(text);
            setShowModal(true);
          } else {
            toast.error("No se detectaron cabeceras en el CSV.");
          }
        }
      });
    } catch (err: any) {
      toast.error("Error al leer archivo: " + err.message);
    } finally {
      e.target.value = "";
    }
  };

  const confirmIngestion = async () => {
    setShowModal(false);
    setIsUploading(true);
    try {
      Papa.parse(pendingCsvText, {
        header: false,
        skipEmptyLines: true,
        complete: async (results) => {
          const rawData = results.data as string[][];
          if (rawData.length <= 1) {
            toast.error("El archivo está vacío.");
            setIsUploading(false);
            return;
          }

          const standardHeaders = ["FechaCaja", "NroCaja", "Descripcion", "Suma de Cantidad", " Suma de Precio"];
          const mappedRows = [];
          
          // Heurística para saber si la fila 0 es cabecera real o datos puros (el CSV puede venir sin cabeceras)
          const isHeaderRow = rawData[0] && rawData[0].some(val => {
            const lower = String(val).toLowerCase();
            return lower.includes("fec") || lower.includes("caja") || lower.includes("cant") || lower.includes("prec");
          });
          
          const startIndex = isHeaderRow ? 1 : 0;
          
          for (let i = startIndex; i < rawData.length; i++) {
            const row = rawData[i];
            mappedRows.push([
              row[mapping.fecha] || "",
              row[mapping.nroCaja] || "",
              row[mapping.descripcion] || "",
              row[mapping.cantidad] || "1",
              row[mapping.precio] || "0",
            ]);
          }

          const rebuiltCsv = Papa.unparse({ fields: standardHeaders, data: mappedRows }, { delimiter: ";" });
          const res = await ingestSalesCSV(rebuiltCsv);

          if (!res.success || res.data?.success === false) {
            toast.error("Error Ventas: " + (res.data?.error || res.error || "Fallo en ingesta"));
          } else {
            const dataPayload = (res.data ?? res) as any; // Manejar desestructuración anidada si la hubiera
            if (dataPayload.unknownItems && dataPayload.unknownItems.length > 0) {
              setUnknownItems(dataPayload.unknownItems);
              const { getMDMCatalog } = await import("@/actions/alias-engine");
              getMDMCatalog().then(setCatalog).catch(console.error);
              toast.warning(`⚠️ Hubo un Silent Drop preventivo en ${dataPayload.unknownItemsCount ?? dataPayload.unknownItems.length} tipos de filas.`);
            } else {
              setUnknownItems([]);
              toast.success(`✅ Ventas: ${dataPayload.newSalesInserted ?? 0} transacciones ingestadas. Cero anomalías MDM.`);
              router.refresh();
            }
          }
          setIsUploading(false);
        }
      });
    } catch (err: any) {
      toast.error("Error Fatal Operativo: " + err.message);
      setIsUploading(false);
    }
  };

  return (
    <>
      <div className="bg-white border-2 border-blue-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-400 transition-all group">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
            <Upload size={18} />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Airlock Operativo</h3>
            <p className="text-[10px] text-slate-400 font-bold tracking-wide">Ventas 1Q.csv • Mapeo Estructural</p>
          </div>
        </div>
        <label className={`cursor-pointer w-full block text-center px-4 py-3 text-sm font-bold rounded-xl transition-all ${isUploading ? "opacity-50 pointer-events-none bg-blue-50 text-blue-400 border border-blue-200" : "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"}`}>
          <span>{isUploading ? "Ingestando Ventas..." : "Seleccionar CSV / Excel"}</span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv, .xlsx, .xls"
            className="hidden"
            onChange={handleFileSelect}
            disabled={isUploading}
          />
        </label>
      </div>
      
      {/* SUPERFICIE DLQ MDM */}
      <OrphanageTray items={unknownItems} catalog={catalog} />

      {/* MODAL MAPEO ESTRUCTURAL */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
          <div className="bg-white max-w-2xl w-full rounded-2xl shadow-xl border border-slate-200 overflow-hidden text-left" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-50 border-b border-slate-100 p-6">
              <h3 className="text-xl font-black text-slate-800">Mapeo Estructural [Pre-Flight]</h3>
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
                    disabled={isUploading}
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
                disabled={isUploading}
                onClick={() => { setShowModal(false); setPendingCsvText(""); }}
                className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Abortar Selección
              </button>
              <button
                disabled={isUploading}
                onClick={() => confirmIngestion()}
                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-md shadow-blue-500/20"
              >
                {isUploading ? "Ejecutando ETL..." : "Confirmar e Ingestar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────
// ZONA B: Airlock Financiero SE HA MOVIDO A TESORERIA GLOBAL
// ─────────────────────────────────────────────────────────
// El componente AirlockFinanciero reside ahora aisladamente allí para evitar entropía cognitiva.

