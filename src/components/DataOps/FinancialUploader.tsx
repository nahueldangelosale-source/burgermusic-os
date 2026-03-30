"use client";

import { processFinancialIngestionAction } from "@/actions/financial-ingestion";
import { UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";

function SubmitButton({ isProcessing }: { isProcessing: boolean }) {
  const { pending } = useFormStatus();
  const loading = pending || isProcessing;
  return (
    <button
      type="submit"
      disabled={loading}
      className={`mt-4 w-full p-4 rounded-xl font-black uppercase tracking-widest flex items-center justify-center transition-all ${loading ? "bg-gray-200 text-gray-500 cursor-not-allowed opacity-80" : "bg-gray-900 text-white hover:bg-gray-800"}`}
    >
      {loading ? "Procesando Ledger..." : "Ingerir Planilla"}
    </button>
  );
}

export default function FinancialUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<{ successCount: number; failedRows: number[] } | null>(null);
  const [isWorkerProcessing, setIsWorkerProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) setFile(e.dataTransfer.files[0]);
  };

  const handleAction = async (formData: FormData) => {
    if (!file) return;
    const sheetType = formData.get("sheetType") as string;

    setIsWorkerProcessing(true);
    setReport(null);

    return new Promise<void>((resolve) => {
      // OBLIGATORIO: Worker parser on isolated thread
      const worker = new Worker("/workers/csv-parser.worker.js");
      worker.postMessage(file);

      worker.onmessage = async (e) => {
        if (e.data.type === "complete") {
          const result = await processFinancialIngestionAction(e.data.data, sheetType);
          setReport(result);
          setIsWorkerProcessing(false);
          resolve();
        } else if (e.data.type === "error") {
          alert("Error crítico parseando CSV en hilo de background.");
          setIsWorkerProcessing(false);
          resolve();
        }
      };
    });
  };

  return (
    <div className="bg-[var(--bg-sunken)] p-6 rounded-2xl border-2 border-dashed border-gray-300">
      <form action={handleAction}>
        <div className="mb-6">
          <label className="text-xs font-black tracking-widest text-gray-500 uppercase mb-2 block">
            Tipo de Planilla
          </label>
          <select
            name="sheetType"
            className="w-full p-3 rounded-lg border border-gray-200 text-gray-900 font-bold outline-none"
          >
            <option>Ventas Diarias</option>
            <option>Costos Fijos (OPEX)</option>
            <option>Proveedores (AP)</option>
          </select>
        </div>

        <div
          className="border-2 border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center justify-center bg-white cursor-pointer hover:bg-gray-50 transition"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <UploadCloud size={40} className="text-gray-400 mb-4" />
          <p className="text-sm font-bold text-gray-600">
            {file ? file.name : "Drag & Drop o Click para seleccionar CSV"}
          </p>
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
          />
        </div>

        <SubmitButton isProcessing={isWorkerProcessing} />
      </form>

      {report && (
        <div className="mt-4 p-4 rounded-xl border border-gray-200 bg-white shadow-sm">
          <p className="text-sm font-bold text-emerald-600 uppercase tracking-widest flex items-center justify-between">
            <span>Transacciones Okey</span>
            <span className="text-lg">{report.successCount}</span>
          </p>
          {report.failedRows.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-bold text-red-500 uppercase tracking-widest">
                Brechas de Coerción Zod
              </p>
              <p className="text-xs text-red-400 mt-1">
                Filas nulas o malformadas: {report.failedRows.length}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
