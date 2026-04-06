import { Suspense } from "react";
import { getSupplierLedger, getSuppliersList } from "@/actions/treasury";
import { getTreasuryDashboardData } from "@/actions/treasury-engine";
import { getChannelDistribution } from "../sales/data-fetchers";
import TreasuryClient from "./TreasuryClient";

export const dynamic = "force-dynamic";

export default async function TreasuryPage() {
  // Parallel Data Fetching O(1)
  const [ledger, suppliers, dashboardData, channelsData] = await Promise.all([
    getSupplierLedger(),
    getSuppliersList(),
    getTreasuryDashboardData(),
    getChannelDistribution()
  ]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-10 font-sans">
      <header className="mb-10">
        <h1 className="text-4xl font-black tracking-tighter text-slate-900 italic">
          COMMAND CENTER: TESORERÍA
        </h1>
        <p className="text-slate-500 font-medium mt-2 tracking-wide uppercase text-xs">
          Zero-Trust Financial Ingestion • Estándar Antigravity 2026
        </p>
      </header>

      <Suspense fallback={<div className="h-1 bg-indigo-500/20 w-full animate-pulse rounded-full" />}>
        <TreasuryClient 
          initialLedger={ledger} 
          suppliers={suppliers} 
          dashboardData={dashboardData} 
          channelsData={channelsData} 
        />
      </Suspense>
    </div>
  );
}
