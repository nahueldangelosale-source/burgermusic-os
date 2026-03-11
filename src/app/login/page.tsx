"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth"; // We will make this a Server Action wrapper or use API
import { ChefHat, Lock, ArrowRight, Delete } from "lucide-react";
import { KitchenButton } from "@/components/ui/AntigravityAtoms";

// Server Action wrapper needs to be created, or imported from a file marked "use server"
// Assuming we'll create src/app/login/actions.ts

import { handleLogin } from "./actions";

export default function LoginPage() {
    const [pin, setPin] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleNumClick = (num: string) => {
        if (pin.length < 6) {
            setPin(prev => prev + num);
            setError("");
        }
    };

    const handleDelete = () => {
        setPin(prev => prev.slice(0, -1));
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError("");

        try {
            const result = await handleLogin(pin);
            if (result.success) {
                // Redirect handled by Middleware or Client
                // But for better UX, we might get the redirect URL from server
                if (result.role === "KITCHEN") router.push("/ingest");
                else if (result.role === "RECEIVER") router.push("/receive"); // Future
                else router.push("/dashboard");
            } else {
                setError("PIN INVÁLIDO");
                setPin("");
            }
        } catch (e) {
            setError("ERROR DE SISTEMA");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-canvas-900 flex flex-col items-center justify-center p-4">

            {/* BRANDING */}
            <div className="mb-8 text-center animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="bg-brand-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-brand-900/50">
                    <ChefHat className="text-white w-10 h-10" />
                </div>
                <h1 className="text-3xl font-black text-slate-100 tracking-tight">BURGERMUSIC <span className="text-brand-500">OS</span></h1>
                <p className="text-slate-400 font-medium">Acceso Restringido</p>
            </div>

            {/* TERMINAL UI */}
            <div className="bg-canvas-800 border-2 border-canvas-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">

                {/* DISPLAY */}
                <div className="bg-canvas-950 border-2 border-canvas-900 rounded-lg h-24 mb-6 flex items-center justify-center relative overflow-hidden">
                    <div className="text-5xl font-mono tracking-[0.5em] text-white">
                        {pin.replace(/./g, "•") || <span className="text-canvas-800 tracking-normal text-sm">INGRESE PIN</span>}
                    </div>
                    {error && (
                        <div className="absolute inset-0 bg-red-900/90 flex items-center justify-center text-red-200 font-bold animate-in fade-in zoom-in duration-200">
                            {error}
                        </div>
                    )}
                </div>

                {/* NUMPAD */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <button
                            key={num}
                            onClick={() => handleNumClick(num.toString())}
                            className="h-16 bg-canvas-700 hover:bg-canvas-600 active:bg-brand-600 text-white text-2xl font-bold rounded-lg transition-colors"
                        >
                            {num}
                        </button>
                    ))}
                    <button
                        onClick={handleDelete}
                        className="h-16 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-lg flex items-center justify-center transition-colors"
                    >
                        <Delete />
                    </button>
                    <button
                        onClick={() => handleNumClick("0")}
                        className="h-16 bg-canvas-700 hover:bg-canvas-600 active:bg-brand-600 text-white text-2xl font-bold rounded-lg transition-colors"
                    >
                        0
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || pin.length === 0}
                        className="h-16 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center transition-colors"
                    >
                        {loading ? <div className="animate-spin w-6 h-6 border-2 border-white/30 border-t-white rounded-full" /> : <ArrowRight />}
                    </button>
                </div>

                <div className="text-center">
                    <p className="text-xs text-slate-500 uppercase tracking-widest">
                        System v0.2.1 • Secure Login
                    </p>
                </div>

            </div>
        </div>
    );
}
