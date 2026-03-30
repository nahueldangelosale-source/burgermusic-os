import { Suspense } from "react";
import { getMasterCatalog, getSellableProducts } from "@/actions/bom-simulator";
import { getProductsPerformance } from "@/actions/products";
import { getSuppliers } from "@/actions/suppliers";
import { SupplyClient } from "./SupplyClient";
import { PanicButton } from "@/components/ops/PanicButton";

export const dynamic = "force-dynamic";

export default async function SupplyPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  // Pre-fetch deduplicated catalog for the BOM Simulator (US 3.2 Supply)
  const params = await searchParams;
  const catalog = await getMasterCatalog();
  const productsCatalog = await getSellableProducts();
  
  // Phase 78: Proveedores
  const suppliersRes = await getSuppliers();
  const suppliersData = (suppliersRes.success && Array.isArray(suppliersRes.data)) ? suppliersRes.data : [];
  
  const perfRes = await getProductsPerformance();
  const perfData = (perfRes.success && Array.isArray(perfRes.data)) ? perfRes.data : [];
  
  return (
    <div className="min-h-screen bg-[oklch(0.98_0.01_250)] text-slate-900 font-sans p-6 md:p-8">
      <header className="mb-8 border-b border-slate-200 pb-6 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 text-slate-900 tracking-tight">
            <span className="w-4 h-8 bg-indigo-500 rounded-sm inline-block shadow-sm shadow-indigo-500/20"></span>
            Suministros & Inteligencia de Costos
          </h1>
          <p className="text-slate-500 mt-2 text-sm font-medium">BOM Simulator • Escaneo de Márgenes O(1) • Proveedores</p>
        </div>
        <PanicButton />
      </header>

      <Suspense fallback={<div className="h-[600px] w-full bg-white rounded-[24px] border border-slate-100 shadow-sm animate-pulse" />}>
        <SupplyClient 
          catalog={catalog as any[]} 
          productsCatalog={productsCatalog as any[]} 
          suppliersCatalog={suppliersData as any[]}
          performanceData={perfData as any[]}
          defaultTab={params?.tab || "insumos"} 
        />
      </Suspense>
    </div>
  );
}
