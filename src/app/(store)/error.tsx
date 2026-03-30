"use client";
import { useEffect } from "react";

export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Store Pánico:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
      <div className="text-red-500 text-6xl mb-4">⚠️</div>
      <h2 className="text-2xl font-bold tracking-tight mb-4 text-white">FATAL STORE EXCEPTION</h2>
      <p className="text-slate-400 max-w-lg mb-8 text-sm break-words border border-red-900/40 p-4 bg-black rounded-lg">
        {error.message || "Fallo crítico en operaciones."}
      </p>
      <button
        onClick={() => reset()}
        className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition"
      >
        REINICIAR VISTA
      </button>
    </div>
  );
}
