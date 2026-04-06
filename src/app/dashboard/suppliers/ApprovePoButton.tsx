"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approvePurchaseOrder } from "@/actions/po-approval";
import { CheckCircle, Loader2 } from "lucide-react";

export function ApprovePoButton({ poId }: { poId: string }) {
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleApprove = async () => {
    setIsApproving(true);
    setError(null);
    try {
      const res = await approvePurchaseOrder(poId);
      if (!res.success) {
        setError(res.message);
      } else {
        router.refresh(); // Hydrate the Vault to hide the approved PO
      }
    } catch (e: any) {
      setError("Error crítico de comunicación.");
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleApprove}
        disabled={isApproving}
        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-70 transition-colors"
      >
        {isApproving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Aprobando...
          </>
        ) : (
          <>
            <CheckCircle className="w-4 h-4" />
            Aprobar Orden
          </>
        )}
      </button>
      {error && <span className="text-xs text-red-500 font-medium">{error}</span>}
    </div>
  );
}
