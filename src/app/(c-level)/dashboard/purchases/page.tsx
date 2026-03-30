import { Suspense } from "react";
import { listPurchaseOrders } from "@/actions/purchase-orders";
import { getSuppliersList } from "@/actions/treasury";
import PurchasesClient from "./PurchasesClient";

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  const [orders, suppliers] = await Promise.all([
    listPurchaseOrders(),
    getSuppliersList()
  ]);

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 md:p-10 font-sans">
      <header className="mb-10">
        <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent italic uppercase">
          Command Center: Compras
        </h1>
        <p className="text-white/50 font-medium mt-2 tracking-wide uppercase text-xs">
          Gestión de Abastecimiento & Auditoría OTIF • Estándar 2026
        </p>
      </header>

      <Suspense fallback={<div className="h-1 bg-blue-500/20 w-full animate-pulse rounded-full" />}>
        <PurchasesClient initialOrders={orders.data || []} suppliers={suppliers} />
      </Suspense>

      {/* Estética de fondo */}
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/10 blur-[120px] rounded-full -z-10 pointer-events-none" />
    </div>
  );
}
