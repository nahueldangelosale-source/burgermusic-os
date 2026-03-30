"use client";

import { ingestCSVAction } from "@/actions/data-ingestion";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

/**
 * Positive Friction Submit Button — React 18 useFormStatus
 */
function SubmitButton({ isReady }: { isReady: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || !isReady}
      className={`
        w-full mt-6 py-4 rounded-xl font-black uppercase tracking-widest transition-all
        disabled:cursor-not-allowed flex items-center justify-center gap-3
        ${
          pending
            ? "bg-gray-200 text-gray-500 opacity-80"
            : !isReady
              ? "bg-gray-100 text-gray-400 opacity-50"
              : "bg-gray-900 text-white hover:bg-gray-800 shadow-md hover:shadow-lg"
        }
      `}
    >
      {pending ? (
        <>
          <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          Procesando Ledger...
        </>
      ) : (
        <>
          <FileSpreadsheet size={20} />
          Ejecutar Ingesta Segura
        </>
      )}
    </button>
  );
}

type ParseState = "idle" | "parsing" | "ready";

export default function FileUploader() {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvPayload, setCsvPayload] = useState<string>("[]");
  const [parseState, setParseState] = useState<ParseState>("idle");
  const [rowCount, setRowCount] = useState(0);
  const [resultProps, setResultProps] = useState<{
    success: boolean;
    fails: number;
    msg: string;
    total: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);

  /**
   * Non-blocking CSV parsing via Web Worker.
   * The main thread never touches PapaParse — INP stays < 200ms.
   */
  const processFile = useCallback((file: File) => {
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Solo archivos .CSV son permitidos.");
      return;
    }

    // Terminate any previous worker
    workerRef.current?.terminate();

    setParseState("parsing");
    setFileName(file.name);
    setResultProps(null);

    const worker = new Worker("/workers/csv-parser.worker.js");
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const { type, data, rowCount: count, message } = e.data;

      if (type === "complete") {
        setCsvPayload(JSON.stringify(data));
        setRowCount(count);
        setParseState("ready");
        toast.success(`${count.toLocaleString()} filas parseadas en background.`);
      } else if (type === "error") {
        toast.error(`Error de Worker: ${message}`);
        setParseState("idle");
        setFileName(null);
      }

      worker.terminate();
      workerRef.current = null;
    };

    worker.onerror = (err) => {
      console.error("Worker error:", err);
      toast.error("El Worker de parsing falló. Reintentá.");
      setParseState("idle");
      setFileName(null);
      worker.terminate();
      workerRef.current = null;
    };

    // Send the raw File to the worker for off-thread parsing
    worker.postMessage(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleReset = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setFileName(null);
    setCsvPayload("[]");
    setParseState("idle");
    setRowCount(0);
    setResultProps(null);
  }, []);

  const handleAction = async (formData: FormData) => {
    try {
      const res = await ingestCSVAction(formData);
      setResultProps({
        success: res.success,
        fails: res.failedRows.length,
        msg: res.message,
        total: rowCount,
      });
      if (res.success) {
        toast.success("ETL Completado. Inserción idempotente evaluada.");
        if (res.failedRows.length > 0) {
          toast.warning(`${res.failedRows.length} filas fallaron la validación estricta Zod.`);
        }
      } else {
        toast.error(res.message || "La ingesta falló.");
      }
    } catch (err: any) {
      toast.error("Database Connection Error");
    }
  };

  const isReady = parseState === "ready" && !!fileName;

  return (
    <div className="w-full max-w-2xl mx-auto font-sans">
      <form action={handleAction}>
        {/* Hidden payload store */}
        <input type="hidden" name="csvData" value={csvPayload} />

        {/* Drag & Drop Zone — Silent Luxury Elevated Neutrals */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => parseState !== "parsing" && fileInputRef.current?.click()}
          className={`
            relative overflow-hidden transition-all duration-300
            border-2 border-dashed
            flex flex-col items-center justify-center gap-4 p-12 rounded-2xl
            ${parseState === "parsing" ? "cursor-wait" : "cursor-pointer"}
            ${
              dragOver
                ? "border-blue-500 bg-blue-50/50 scale-[1.02]"
                : parseState === "ready"
                  ? "border-emerald-400 bg-[var(--bg-sunken)]"
                  : "border-[var(--border-default)] hover:border-gray-400 bg-[var(--bg-sunken)]"
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={(e) => e.target.files && processFile(e.target.files[0])}
            className="hidden"
          />

          {parseState === "parsing" ? (
            <div className="flex flex-col items-center text-center gap-3">
              <Loader2 size={48} className="text-blue-500 animate-spin" />
              <p className="text-sm font-black text-gray-900 tracking-wide uppercase">
                Parsing en Web Worker...
              </p>
              <p className="text-xs text-gray-500 font-medium">{fileName} · Hilo principal libre</p>
            </div>
          ) : parseState === "idle" ? (
            <>
              <div className="w-16 h-16 flex items-center justify-center bg-[var(--bg-elevated)] rounded-xl shadow-sm border border-[var(--border-subtle)]">
                <UploadCloud size={28} className="text-gray-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-black text-gray-900 tracking-wide uppercase">
                  Arrastrá tu planilla operativa
                </p>
                <p className="text-xs mt-2 text-gray-500 font-medium">
                  Formatos soportados: CSV (Máx 20MB)
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center text-center">
              <FileSpreadsheet size={48} className="text-emerald-500 mb-3" />
              <p className="text-lg font-black text-gray-900">{fileName}</p>
              <p className="text-sm font-bold text-emerald-600 mt-1 uppercase tracking-widest">
                {rowCount.toLocaleString()} filas · Payload Ready
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleReset();
                }}
                className="text-xs underline mt-4 text-gray-400 hover:text-red-500"
              >
                Remover Archivo
              </button>
            </div>
          )}
        </div>

        {/* Status Display Area */}
        {resultProps && (
          <div
            className={`mt-6 p-6 rounded-2xl border ${resultProps.success ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}
          >
            <div className="flex items-center gap-3 mb-2">
              {resultProps.success ? (
                <CheckCircle2 className="text-emerald-600" />
              ) : (
                <AlertTriangle className="text-red-600" />
              )}
              <h3
                className={`font-black uppercase tracking-widest text-sm ${resultProps.success ? "text-emerald-800" : "text-red-800"}`}
              >
                {resultProps.success ? "Lote Procesado (Partial Mode)" : "Fallo en Ingesta"}
              </h3>
            </div>
            <p className="text-sm font-medium text-gray-700">{resultProps.msg}</p>

            {resultProps.success && (
              <div className="mt-4 flex gap-4">
                <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 flex flex-col w-1/2">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-500">
                    Total Parseado
                  </span>
                  <span className="text-2xl font-black text-gray-900">
                    {resultProps.total.toLocaleString()}
                  </span>
                </div>
                <div className="bg-white px-4 py-2 rounded-lg border border-red-200 flex flex-col w-1/2">
                  <span className="text-xs font-black uppercase tracking-widest text-red-500">
                    Filas Corruptas
                  </span>
                  <span className="text-2xl font-black text-red-600">{resultProps.fails}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Positive Friction React 18 Button */}
        <SubmitButton isReady={isReady} />
      </form>
    </div>
  );
}
