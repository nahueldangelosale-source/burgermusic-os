// src/app/ingest/page.tsx
"use client";

import { useState, useEffect } from "react";
import { parseInventoryMessage, saveInventory, verifyKitchenPin } from "./actions";
import { CheckCircle, Lock } from "lucide-react";
import { KitchenButton } from "@/components/ui/AntigravityAtoms"; // ❤️ Antigravity Atom
import { type DetectedItem } from "@/agents/translator/types";

export default function IngestPage() {
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [accessCode, setAccessCode] = useState("");

    // Check local storage for persistent session
    useEffect(() => {
        const storedAuth = localStorage.getItem("kitchen_auth");
        if (storedAuth === "true") setIsAuthorized(true);
    }, []);

    const handleLogin = async () => {
        try {
            const isValid = await verifyKitchenPin(accessCode);
            if (isValid) {
                setIsAuthorized(true);
                localStorage.setItem("kitchen_auth", "true");
            } else {
                alert("CÓDIGO INCORRECTO");
                setAccessCode("");
            }
        } catch (e) {
            alert("Error del servidor al validar el PIN");
            setAccessCode("");
        }
    };

    const [input, setInput] = useState("");
    const [result, setResult] = useState<{ items: DetectedItem[] } | null>(null);
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleAnalyze = async () => {
        setLoading(true);
        setSaved(false);
        try {
            const data = await parseInventoryMessage(input);
            setResult(data as any);
        } catch (e) {
            alert("Error al analizar: " + e);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        if (!result?.items) return;
        await saveInventory(result.items);
        setSaved(true);
        setResult(null);
        setInput("");
    };

    if (!isAuthorized) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-4">
                <div className="bg-white p-8 rounded-xl shadow-2xl max-w-sm w-full text-center">
                    <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock className="text-slate-900" size={32} />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase mb-2">Acceso Restringido</h2>
                    <p className="text-slate-500 mb-6">Esta terminal es para uso exclusivo de cocina.</p>

                    <input
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={4}
                        className="w-full text-center text-3xl font-mono tracking-[1em] border-b-4 border-slate-300 focus:border-brand-500 outline-none py-2 mb-6 text-slate-900"
                        placeholder="••••"
                        value={accessCode}
                        onChange={(e) => setAccessCode(e.target.value)}
                    />

                    <KitchenButton onClick={handleLogin}>
                        ENTRAR
                    </KitchenButton>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto p-4 sm:p-8 min-h-screen bg-canvas-50 font-sans text-ink-900">
            {/* ATOMIC HEADER: High Contrast */}
            <header className="mb-10 border-b-2 border-ink-900 pb-4 flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black tracking-tight mb-2 uppercase">Modo Cocina</h1>
                    <p className="text-xl font-medium text-ink-500">Sistema de Ingesta Directa</p>
                </div>
                <button
                    onClick={() => {
                        setIsAuthorized(false);
                        localStorage.removeItem("kitchen_auth");
                    }}
                    className="text-xs font-bold text-slate-400 hover:text-red-500 uppercase tracking-widest"
                >
                    Bloquear
                </button>
            </header>

            {/* ATOMIC INPUT: Matte Box */}
            <div className="bg-white border-2 border-ink-900 rounded-none p-6 mb-8 shadow-none">
                <label className="block text-sm font-bold uppercase tracking-wider mb-2 text-ink-500">
                    Reporte de Stock
                </label>
                <textarea
                    className="w-full p-4 border-2 border-slate-300 rounded-none mb-4 text-xl font-medium text-ink-900 focus:ring-0 focus:border-ink-900 placeholder:text-slate-300 transition-colors"
                    rows={4}
                    placeholder="Ej: Quedan 3 cajas de carne y 50 panes..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                />

                {/* Antigravity Atom Usage */}
                <KitchenButton
                    onClick={handleAnalyze}
                    disabled={loading || !input}
                >
                    {loading ? "PROCESANDO..." : "ANALIZAR REPORTE"}
                </KitchenButton>
            </div>

            {/* ATOMIC RESULT: High Readability List */}
            {result && (
                <div className="bg-white border-2 border-ink-900 p-6 mb-8 animate-in slide-in-from-bottom-2 fade-in duration-300">
                    <h2 className="font-bold text-lg mb-4 uppercase tracking-wider flex items-center gap-2">
                        <CheckCircle size={20} className="text-profit" />
                        Confirmación Visual
                    </h2>

                    <div className="space-y-0 divide-y divide-slate-200 border-t border-b border-slate-200 mb-6">
                        {result.items.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center py-4 px-2 hover:bg-slate-50">
                                <div>
                                    <div className="font-bold text-xl text-ink-900">
                                        {item.matchedSkuId || "❓ SKU_DESCONOCIDO"}
                                    </div>
                                    <div className="text-sm font-medium text-ink-500 uppercase">{item.rawInput}</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-mono font-black text-2xl text-ink-900">
                                        {item.quantity} <span className="text-base font-bold text-ink-500">{item.unit}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-green-600 rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <button
                            onClick={handleSave}
                            className="w-full h-14 text-white text-lg font-bold uppercase tracking-wide hover:bg-green-700 active:scale-[0.99] transition-all rounded-lg"
                        >
                            CONFIRMAR Y GUARDAR
                        </button>
                    </div>
                </div>
            )}

            {/* ATOMIC FEEDBACK */}
            {saved && (
                <div className="p-6 bg-green-100 border-2 border-green-800 text-green-900 text-center font-bold text-lg">
                    ✅ INVENTARIO ACTUALIZADO CON ÉXITO
                </div>
            )}
        </div>
    );
}
