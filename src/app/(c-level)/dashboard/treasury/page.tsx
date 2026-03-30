import { Suspense } from "react";
import { getSupplierLedger, getSuppliersList } from "@/actions/treasury";
import TreasuryClient from "./TreasuryClient";

export const dynamic = "force-dynamic";

export default async function TreasuryPage() {
  // Parallel Data Fetching O(1)
  const [ledger, suppliers] = await Promise.all([
    getSupplierLedger(),
    getSuppliersList()
  ]);

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 md:p-10 font-sans selection:bg-blue-500/30">
      <header className="mb-10">
        <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent italic">
          COMMAND CENTER: TESORERÍA
        </h1>
        <p className="text-white/50 font-medium mt-2 tracking-wide uppercase text-xs">
          Zero-Trust Financial Ingestion • Estándar Antigravity 2026
        </p>
      </header>

      <Suspense fallback={<div className="h-1 bg-blue-500/20 w-full animate-pulse rounded-full" />}>
        <TreasuryClient initialLedger={ledger} suppliers={suppliers} />
      </Suspense>
      
      {/* Estética de fondo: Orbe de luz */}
      <div className="fixed top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full -z-10 pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-purple-600/5 blur-[100px] rounded-full -z-10 pointer-events-none" />
    </div>
  );
}
