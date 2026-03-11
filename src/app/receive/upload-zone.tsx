"use client";

import { useState, useRef } from "react";
import { Camera, FileText, UploadCloud, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { processInvoice, confirmInvoice } from "@/app/receive/actions";
import { GlassCard } from "@/components/ui/AntigravityAtoms";

export function UploadZone() {
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const [fileType, setFileType] = useState<string | null>(null);
    const [result, setResult] = useState<any | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleFile = async (file: File) => {
        // Reset previous results
        setResult(null);
        setIsProcessing(true);
        setFileType(file.type);

        // Create Preview
        if (file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = (e) => setPreview(e.target?.result as string);
            reader.readAsDataURL(file);
        } else {
            setPreview(null); // PDF Icon handled by UI
        }

        try {
            // Prepare FormData
            const formData = new FormData();
            formData.append("file", file);

            const response = await processInvoice(formData);

            if (response.success) {
                setResult(response.data);
            } else {
                alert("Error procesando factura: " + response.error);
            }
        } catch (error) {
            console.error(error);
            alert("Error de conexión");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="space-y-6">

            {/* UPLOAD AREA */}
            {!result && !isProcessing && (
                <div
                    className={`
                relative border-4 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer
                ${isDragging ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:border-brand-300 hover:bg-slate-50"}
            `}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                >
                    <div className="flex flex-col items-center gap-4">
                        <div className="p-4 bg-white rounded-full shadow-sm">
                            <UploadCloud size={32} className="text-brand-500" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-ink-900">Arrastra tu factura aquí</h3>
                            <p className="text-slate-400">PDF, JPG, PNG soportados</p>
                        </div>

                        <div className="flex gap-4 w-full mt-4">
                            {/* CAMERA BUTTON (Mobile Primary) */}
                            <button
                                onClick={() => cameraInputRef.current?.click()}
                                className="flex-1 flex items-center justify-center gap-2 bg-brand-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-brand-500/30 hover:bg-brand-600 transition-all active:scale-95"
                            >
                                <Camera size={24} />
                                <span>Foto</span>
                            </button>

                            {/* FILE BUTTON */}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex-1 flex items-center justify-center gap-2 bg-white border-2 border-slate-200 text-slate-600 py-4 rounded-xl font-bold hover:bg-slate-50 transition-all active:scale-95"
                            >
                                <FileText size={24} />
                                <span>Archivo</span>
                            </button>
                        </div>
                    </div>

                    {/* Hidden Inputs */}
                    <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handleFileSelect}
                    />
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,image/*"
                        className="hidden"
                        onChange={handleFileSelect}
                    />
                </div>
            )}

            {/* PROCESSING STATE */}
            {isProcessing && (
                <GlassCard className="text-center py-12">
                    <Loader2 className="animate-spin text-brand-500 mx-auto mb-4" size={48} />
                    <h3 className="text-xl font-bold text-ink-900 animate-pulse">Analizando Factura...</h3>
                    <p className="text-slate-500">Gemini está leyendo los ítems</p>
                </GlassCard>
            )}

            {/* RESULT CONFIRMATION */}
            {result && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-center gap-3 text-green-800">
                        <CheckCircle className="text-green-600" />
                        <span className="font-bold">Factura Leída con Éxito</span>
                    </div>

                    <GlassCard>
                        <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Proveedor</p>
                                <p className="text-2xl font-black text-ink-900">{result.supplier_name}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total</p>
                                <p className="text-2xl font-black text-brand-600">${result.total_amount}</p>
                            </div>
                        </div>

                        <table className="w-full text-sm text-left">
                            <thead className="text-xs font-bold text-slate-400 uppercase bg-slate-50/50">
                                <tr>
                                    <th className="p-2">Item</th>
                                    <th className="p-2 text-right">Cant.</th>
                                    <th className="p-2 text-right">Total</th>
                                    <th className="p-2 text-center">Sistema</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {result.items.map((item: any, idx: number) => (
                                    <tr key={idx} className={!item.product_sku ? "bg-red-50/50" : ""}>
                                        <td className="p-2">
                                            <p className="font-medium text-ink-900">{item.description}</p>
                                            <p className="text-xs text-slate-400">{item.unit_price} / {item.unit}</p>
                                        </td>
                                        <td className="p-2 text-right text-slate-500">
                                            {item.quantity} {item.unit}
                                        </td>
                                        <td className="p-2 text-right font-bold">${item.total_price}</td>
                                        <td className="p-2">
                                            {item.product_sku ? (
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded w-fit mx-auto">
                                                        {item.product_sku}
                                                    </span>
                                                    <div className="flex items-center justify-center gap-1 text-xs">
                                                        <span className="text-slate-500">x</span>
                                                        <input
                                                            type="number"
                                                            className="w-12 p-1 text-center border border-slate-200 rounded"
                                                            defaultValue={item.conversion_factor}
                                                            onChange={(e) => {
                                                                const newVal = parseFloat(e.target.value);
                                                                const newItems = [...result.items];
                                                                newItems[idx].conversion_factor = newVal;
                                                                setResult({ ...result, items: newItems });
                                                            }}
                                                        />
                                                        <span className="text-slate-400">{item.system_unit}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center text-xs text-red-500 font-medium">No Match</div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {result.price_alert && (
                            <div className="mt-4 p-3 bg-orange-50 text-orange-700 text-sm font-bold flex items-center gap-2 rounded-lg">
                                <AlertTriangle size={16} />
                                <span>¡Alerta de precios detectada! Algunos ítems subieron {'>'}10%.</span>
                            </div>
                        )}

                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={() => setResult(null)}
                                className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => {
                                    setIsProcessing(true);
                                    await confirmInvoice(result);
                                    setIsProcessing(false);
                                    setResult(null);
                                    alert("Ingreso Confirmado");
                                }}
                                className="flex-1 py-3 bg-brand-500 text-white font-bold rounded-xl shadow-lg shadow-brand-500/30 hover:bg-brand-600"
                            >
                                Confirmar Ingreso
                            </button>
                        </div>
                    </GlassCard>
                </div>
            )}
        </div>
    );
}
