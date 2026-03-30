import React from "react";
import KitchenChecklistPane from "./ChecklistPane";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function KitchenKioskPage() {
  const session = await getSession();
  if (!session?.user?.storeId) redirect("/login");
  const storeId = session.user.storeId;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col p-8">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-white">ESTACIÓN DE COCINA</h1>
          <p className="text-zinc-500 text-sm uppercase tracking-widest font-mono font-bold mt-1">Cero Latencia · Cero Fricción</p>
        </div>
      </header>

      <div className="flex-1 rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-8 shadow-2xl flex items-center justify-center">
        {/* Placeholder Visor KDS (Kitchen Display System) */}
        <p className="text-zinc-600 italic tracking-widest">Sin comandas activas pendientes.</p>
      </div>

      {/* Drawer de Cumplimiento Operativo */}
      <KitchenChecklistPane storeId={storeId} />
    </div>
  );
}
