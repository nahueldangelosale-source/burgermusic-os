"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { processInvoiceOCR, confirmAndCommitLedger } from "@/actions/ocr-receiver";
import { useVirtualizer } from "@tanstack/react-virtual";
import { RiScan2Line, RiHistoryLine, RiArrowRightUpLine, RiCheckDoubleLine, RiCloseLine, RiCheckboxCircleLine, RiErrorWarningLine } from "@remixicon/react";
import { toast } from "sonner";
import { PendingButton } from "@/components/ui/PendingButton";
import { motion, AnimatePresence } from "framer-motion";

// --- CLIENT MAIN ---

type ActionState = {
  success: boolean | null;
  message?: string;
  error?: string;
  invoice?: any;
};

export default function TreasuryClient({ 
  initialLedger, 
  suppliers 
}: { 
  initialLedger: any[], 
  suppliers: any[] 
}) {
  const [previewInvoice, setPreviewInvoice] = useState<any>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [ingestionMode, setIngestionMode] = useState<"OCR" | "MANUAL">("OCR");
  const [isCommitting, startCommitTransition] = useTransition();

  const [state, formAction] = useActionState<any, FormData>(
    async (prevState: any, formData: FormData) => {
      try {
        const result = await processInvoiceOCR(prevState, formData);
        if (result.success && result.data) {
          toast.success("Extracción AI completada. Inicie auditoría.");
          setPreviewInvoice(result.data.invoice);
          return { ...result, invoice: result.data.invoice };
        }
        return { success: false, error: result.error || "Falla en extracción" };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }, 
    { success: null }
  );

  const startManualIngestion = () => {
    setPreviewInvoice({
      supplier_id: "",
      invoice_number: "",
      issue_date: new Date().toISOString().split('T')[0],
      subtotal: 0,
      tax_amount: 0,
      total: 0,
      items: [{ description: "Ítem Manual", quantity: 1, unit_price: 0, total: 0 }]
    });
  };

  const handleCommit = async () => {
    if (!previewInvoice) return;
    
    startCommitTransition(async () => {
      try {
        const result = await confirmAndCommitLedger(previewInvoice);
        if (result.success && result.data) {
          toast.success(`Factura ${result.data.invoiceNumber} impactada en Ledger.`);
          setPreviewInvoice(null);
          // Recargar página o actualizar ledger localmente (aquí delegamos al revalidate de Next.js)
          window.location.reload(); 
        } else {
          toast.error(result.error || "Error al persistir en base de datos.");
        }
      } catch (e: any) {
        toast.error(e.message || "Falla crítica de commit.");
      }
    });
  };

  // Virtualización del Ledger O(1)
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: initialLedger.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      
      {/* PANEL IZQUIERDO: INGESTA / AUDITORÍA */}
      <section className="lg:col-span-5 space-y-6">
        
        {/* Error Banner System */}
        <AnimatePresence>
          {state.error && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-start gap-3 text-rose-400">
                <RiErrorWarningLine size={20} className="shrink-0" />
                <div className="text-sm">
                  <p className="font-bold uppercase tracking-[0.1em] text-xs">Error de Ingesta AI</p>
                  <p className="font-medium">{state.error}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="bg-white/5 backdrop-blur-[12px] border border-white/10 rounded-2xl p-8 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-10 bg-accent-primary/10 blur-[60px] rounded-full group-hover:bg-accent-primary/20 transition-colors duration-700" />
          
          <AnimatePresence mode="wait">
            {!previewInvoice ? (
              <motion.div
                key="ingesta-form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <div className="flex items-center justify-between mb-8 relative z-10">
                  <h2 className="text-xl font-bold flex items-center gap-3 text-white">
                    <div className="w-8 h-8 rounded-lg bg-accent-primary/20 flex items-center justify-center text-accent-primary">
                      <RiScan2Line size={18} />
                    </div>
                    Ingesta de Comprobantes
                  </h2>
                </div>

                <div className="flex items-center gap-2 mb-8 bg-white/5 p-1 rounded-xl border border-white/10 relative z-10 w-fit">
                  <button 
                    onClick={() => setIngestionMode("OCR")}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${ingestionMode === 'OCR' ? 'bg-accent-primary text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}
                  >
                    Escáner AI
                  </button>
                  <button 
                    onClick={() => setIngestionMode("MANUAL")}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${ingestionMode === 'MANUAL' ? 'bg-emerald-600 text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}
                  >
                    Carga Manual
                  </button>
                </div>

                {ingestionMode === 'OCR' ? (
                  <form 
                    action={formAction} 
                    className="space-y-6 relative z-10"
                  >
                    <div className="space-y-4">
                      <label className="block">
                        <span className="text-white/70 text-xs font-bold uppercase tracking-widest block mb-2 px-1">Proveedor Originador</span>
                        <select 
                          name="supplier_id"
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-5 text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/50 appearance-none font-medium transition-all"
                          required
                          defaultValue=""
                        >
                          <option value="" className="bg-slate-900 text-white">Seleccionar Proveedor...</option>
                          {suppliers.map((s: any) => (
                            <option key={s.id} value={s.id} className="bg-slate-900 text-white">{s.name}</option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="text-white/70 text-xs font-bold uppercase tracking-widest block mb-2 px-1">Factura Digital</span>
                        <div className="relative group/file">
                          <input 
                            type="file" 
                            name="file"
                            accept="image/*,application/pdf"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                            required
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) setSelectedFileName(file.name);
                            }}
                          />
                          <div className="bg-white/5 border-2 border-dashed border-white/10 rounded-xl py-12 px-5 flex flex-col items-center justify-center gap-3 transition-colors group-hover/file:border-accent-primary/30 group-hover/file:bg-white/[0.07]">
                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/40 group-hover/file:text-accent-primary transition-colors">
                              <RiScan2Line size={24} />
                            </div>
                            <div className="text-center">
                              <p className="text-sm text-white font-medium">Arrastre Factura o Remito</p>
                              <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">PDF / JPG / PNG</p>
                            </div>
                          </div>
                        </div>
                      </label>

                      {selectedFileName && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-accent-primary/10 border border-accent-primary/20 rounded-xl p-3 flex items-center gap-3 text-accent-primary"
                        >
                          <RiCheckboxCircleLine size={18} />
                          <span className="text-xs font-bold truncate pr-4">{selectedFileName}</span>
                        </motion.div>
                      )}
                    </div>

                    <PendingButton className="w-full" loadingText="Extrayendo Datos...">
                      Detonar Scan AI
                    </PendingButton>
                  </form>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-6 relative z-10 py-10 text-center"
                  >
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mx-auto mb-4">
                      <RiHistoryLine size={32} />
                    </div>
                    <div className="space-y-2 mb-8">
                      <h3 className="text-white font-bold tracking-tight">Carga Manual Directa</h3>
                      <p className="text-white/40 text-xs">Omita el OCR e ingrese los datos del libro mayor manualmente.</p>
                    </div>
                    <button 
                      onClick={startManualIngestion}
                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95"
                    >
                      <RiArrowRightUpLine size={20} />
                      Abrir Libro
                    </button>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="audit-form"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="relative z-10"
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-lg font-bold flex items-center gap-3 text-white">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <RiCheckboxCircleLine size={18} />
                    </div>
                    Sala de Verificación
                  </h2>
                  <button 
                    onClick={() => setPreviewInvoice(null)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white"
                  >
                    <RiCloseLine size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Factura #</label>
                      <input 
                        type="text"
                        value={previewInvoice.invoice_number}
                        onChange={(e) => setPreviewInvoice({ ...previewInvoice, invoice_number: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-white text-sm focus:ring-1 focus:ring-emerald-500/50 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Fecha Emisión</label>
                      <input 
                        type="date"
                        value={previewInvoice.issue_date}
                        onChange={(e) => setPreviewInvoice({ ...previewInvoice, issue_date: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-white text-sm focus:ring-1 focus:ring-emerald-500/50 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Subtotal</label>
                      <input 
                        type="number"
                        value={previewInvoice.subtotal}
                        onChange={(e) => setPreviewInvoice({ ...previewInvoice, subtotal: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-white text-sm outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">IVA (21%)</label>
                      <input 
                        type="number"
                        value={previewInvoice.tax_amount}
                        onChange={(e) => setPreviewInvoice({ ...previewInvoice, tax_amount: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-white text-sm outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Total</label>
                      <input 
                        type="number"
                        value={previewInvoice.total}
                        onChange={(e) => setPreviewInvoice({ ...previewInvoice, total: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white/5 border border-emerald-500/30 rounded-xl py-2 px-3 text-emerald-400 font-bold text-sm outline-none"
                      />
                    </div>
                  </div>

                  <div className="max-h-[220px] overflow-auto pr-2 custom-scrollbar space-y-2 border-t border-white/10 pt-4">
                    <div className="flex items-center justify-between mb-2">
                       <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Desglose de Ítems</p>
                       <button 
                         onClick={() => {
                           const newItems = [...(previewInvoice.items || [])];
                           newItems.push({ description: "", quantity: 1, unit_price: 0, total: 0 });
                           setPreviewInvoice({ ...previewInvoice, items: newItems });
                         }}
                         className="text-[10px] font-bold text-accent-primary uppercase tracking-widest hover:underline"
                       >
                         + Añadir Ítem
                       </button>
                    </div>
                    {(previewInvoice.items || []).map((item: any, idx: number) => (
                      <div key={idx} className="bg-white/5 p-3 rounded-lg border border-white/5 flex gap-3 items-center group/item">
                        <input 
                          type="text"
                          placeholder="Descripción..."
                          value={item.description}
                          onChange={(e) => {
                            const newItems = [...previewInvoice.items];
                            newItems[idx].description = e.target.value;
                            setPreviewInvoice({ ...previewInvoice, items: newItems });
                          }}
                          className="flex-1 bg-transparent border-none text-white text-xs outline-none"
                        />
                        <input 
                          type="number"
                          placeholder="0.00"
                          value={item.total}
                          onChange={(e) => {
                            const newItems = [...previewInvoice.items];
                            newItems[idx].total = parseFloat(e.target.value) || 0;
                            setPreviewInvoice({ ...previewInvoice, items: newItems });
                          }}
                          className="w-20 bg-transparent border-none text-right text-emerald-400 font-bold text-xs outline-none"
                        />
                        <button 
                          onClick={() => {
                            const newItems = previewInvoice.items.filter((_: any, i: number) => i !== idx);
                            setPreviewInvoice({ ...previewInvoice, items: newItems });
                          }}
                          className="opacity-0 group-hover/item:opacity-100 text-rose-500 hover:text-rose-400 transition-opacity"
                        >
                          <RiCloseLine size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 space-y-3">
                    <button 
                      onClick={handleCommit}
                      disabled={isCommitting}
                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:opacity-50 text-white rounded-xl font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95"
                    >
                      {isCommitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Commit en Turso...
                        </>
                      ) : (
                        <>
                          <RiCheckDoubleLine size={20} />
                          Confirmar & Persistir
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-center text-white/30 font-medium">ESTÁNDAR ANTIGRAVITY 2026 • ZERO-TRUST VALIDATED</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* PANEL DERECHO: LEDGER */}
      <section className="lg:col-span-7 h-full">
        <div className="bg-white/5 backdrop-blur-[12px] border border-white/10 rounded-2xl p-8 flex flex-col h-[750px] shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold flex items-center gap-3 text-white">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <RiHistoryLine size={18} />
              </div>
              Libro Mayor Certificado
            </h2>
            <div className="text-[10px] font-black bg-emerald-500/10 px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-500/10 text-emerald-400">
              Sincronizado O(1)
            </div>
          </div>

          <div 
            ref={parentRef}
            className="flex-1 overflow-auto scroll-smooth pr-2 custom-scrollbar"
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const item = initialLedger[virtualRow.index];
                return (
                  <div
                    key={item.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="pb-3 px-1"
                  >
                    <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex items-center justify-between hover:bg-white/10 transition-all duration-300 group">
                      <div className="flex gap-4 items-center">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item.type === 'INVOICE' ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                           {item.type === 'INVOICE' ? <RiArrowRightUpLine size={20} /> : <RiCheckDoubleLine size={20} />}
                        </div>
                        <div>
                          <p className="font-bold text-sm tracking-tight text-white capitalize">{String(item.supplier_name || 'N/A').toLowerCase()}</p>
                          <p className="text-[10px] text-white/50 uppercase font-bold tracking-widest mt-0.5">{item.invoice_number || 'S/N'}</p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className={`font-black tracking-tighter text-lg ${item.type === 'INVOICE' ? 'text-white' : 'text-emerald-400'}`}>
                          ${(Math.abs(item.amount_cents) / 100).toLocaleString('es-AR')}
                        </p>
                        <p className="text-[10px] text-white/40 font-bold">{item.date}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
