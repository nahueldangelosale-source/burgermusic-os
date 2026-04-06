"use client";

import React, { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Loader2, CheckCircle, XCircle } from "lucide-react";
import { scanInvoiceDocument, type OcrScanResult } from "@/actions/ocr-agent";
import { ItemMappingModal } from "./ItemMappingModal";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * VLM INVOICE DROPZONE & ORCHESTRATOR
 * ─────────────────────────────────────────────────────────────────────────────
 * Estética "Silent Luxury SaaS": UI limpia, estados Zero-Trust.
 * Delegación total del procesamiento pesado al Edge/Server (VLM Agent).
 */

export function InvoiceDropzone() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isHovering, setIsHovering] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "SUCCESS" | "ERROR" } | null>(null);

  // States for Positive Friction (Zero-Trust Mapping)
  const [mappingQueue, setMappingQueue] = useState<Array<{ rawItemName: string; quantityGrams: number; unitPriceCents: number }>>([]);
  const [supplierData, setSupplierData] = useState<{ id: string; name: string } | null>(null);

  const triggerToast = (message: string, type: "SUCCESS" | "ERROR") => {
    setToast({ message, type });
    if (type === "SUCCESS") setTimeout(() => setToast(null), 5000);
  };

  const processFile = async (file: File) => {
    if (!file) return;
    setIsScanning(true);
    setToast(null);

    try {
      // Optimización: El App Router permite serializar Buffer (Node polyfill/Uint8Array)
      const arrayBuffer = await file.arrayBuffer();
      const bufferPayload = Buffer.from(arrayBuffer);

      const result: OcrScanResult = await scanInvoiceDocument(bufferPayload);

      if (result.status === "AUTO_PROCESSED") {
        triggerToast("Factura Ingerida. WAC actualizado dinámicamente.", "SUCCESS");
        router.refresh();
      } else if (result.status === "PENDING_MAPPING") {
        // Interlock: Fricción Positiva
        setSupplierData({ id: result.supplierId, name: result.supplierName });
        setMappingQueue(result.dirtyItems);
      } else if (result.status === "FAILURE") {
        // Fail-Closed
        triggerToast(result.error || "Error catastrófico en la decodificación GCD.", "ERROR");
      }
    } catch (error: any) {
      triggerToast(error.message || "Error al conectar con el OCR Agent.", "ERROR");
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Drag & Drop Handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsHovering(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processFile(e.dataTransfer.files[0]);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  // Manejo de la cola de Homologación
  const currentDirtyItem = mappingQueue.length > 0 ? mappingQueue[0] : null;

  const handleSaveMapping = async (mapping: { internalIngredientId: string; conversionFactor: number }) => {
    // Aquí el agente ya tiene el mapeo, lo guardaría en la BD/App via Server Action.
    // Simulo la limpieza de la cola una vez guardado:
    setMappingQueue((prev) => prev.slice(1));
    
    // Si era el último ítem, se podría reintentar procesar la factura entera 
    // o asumir que la UI lo manejará en el siguiente pipeline. 
    if (mappingQueue.length <= 1) {
       triggerToast("Mapeo completado exitosamente. Se puede reintentar la ingesta.", "SUCCESS");
       router.refresh();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Zona de Drop */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isScanning && fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl transition-all cursor-pointer overflow-hidden ${
          isHovering
            ? "border-slate-400 bg-slate-100"
            : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-50/80"
        } ${isScanning ? "opacity-70 cursor-not-allowed pointer-events-none" : ""}`}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="application/pdf,image/png,image/jpeg"
          onChange={handleFileChange}
        />

        {isScanning ? (
          <div className="flex flex-col items-center text-slate-600">
            <Loader2 className="w-10 h-10 mb-4 animate-spin text-slate-800" />
            <h3 className="text-sm font-medium tracking-tight">Decodificando VLM...</h3>
            <p className="text-xs text-slate-400 mt-1">Instrumentando telemetría FinOps</p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-slate-500">
            <div className="p-3 mb-4 rounded-full bg-white shadow-sm border border-slate-100">
              <UploadCloud className="w-8 h-8 text-slate-700" />
            </div>
            <h3 className="text-sm font-semibold tracking-tight text-slate-800">
              Inyección Multimodal de Factura
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 font-medium uppercase tracking-widest">
              Drop PDF/PNG/JPG here
            </p>
          </div>
        )}
      </div>

      {/* Zero-Trust Feedback Toasts */}
      {toast && (
        <div
          className={`flex items-center gap-3 p-4 border rounded-lg shadow-sm animate-in fade-in slide-in-from-top-2 ${
            toast.type === "SUCCESS"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {toast.type === "SUCCESS" ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <p className="text-sm font-medium truncate">{toast.message}</p>
        </div>
      )}

      {/* Positive Friction Interlock Modal */}
      {currentDirtyItem && supplierData && (
        <ItemMappingModal
          isOpen={true}
          rawItemName={currentDirtyItem.rawItemName}
          supplierId={supplierData.id}
          supplierName={supplierData.name}
          availableIngredients={[]} // El componente modal en un entorno real traería esto vía Server Component / SWC
          onClose={() => setMappingQueue([])}
          onSaveMapping={handleSaveMapping}
        />
      )}
    </div>
  );
}
