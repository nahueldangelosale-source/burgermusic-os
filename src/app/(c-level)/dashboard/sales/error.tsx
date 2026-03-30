"use client";

import { useEffect } from "react";
import { Button } from "@tremor/react";

export default function SalesCortexError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Cortex Error Boundary Caught:", error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 bg-[oklch(0.98_0.01_250)] rounded-3xl ring-1 ring-red-500/20 shadow-[0_8px_30px_rgb(0,0,0,0.04)] m-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="flex flex-col items-center text-center relative z-10 max-w-lg">
        <span className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-6 ring-4 ring-red-50/50">
          <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </span>
        
        <h2 className="text-2xl font-black tracking-tight text-slate-900 mb-2">Anomalía en el Córtex</h2>
        <p className="text-slate-500 font-medium text-sm mb-8 leading-relaxed">
          {error.message || "Se ha detectado una fisura en el motor O(1) del Vault. El pipeline ha detenido el volcado para preservar ACID."}
        </p>
        
        <Button 
          onClick={() => reset()} 
          color="slate"
          className="rounded-full shadow-sm hover:shadow font-semibold tracking-wide"
        >
          Forzar Reactivación de Nodo
        </Button>
      </div>
    </div>
  );
}
