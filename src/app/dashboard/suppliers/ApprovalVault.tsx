import { db } from "@/db";
import { purchase_orders } from "@/db/schema/supply";
import { suppliers } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { ApprovePoButton } from "./ApprovePoButton";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * APPROVAL VAULT (C-Level Operations)
 * ─────────────────────────────────────────────────────────────────────────────
 * Lista las Órdenes de Compra generadas automáticamente por el Procurement Daemon.
 * Aplica Fricción Positiva en la delegación de gasto.
 */
export async function ApprovalVault() {
  // 1. Fetch DRAFT POs cruzando con Proveedores. O(1) determinista.
  const draftPOs = await db
    .select({
      id: purchase_orders.id,
      totalAmountCents: purchase_orders.totalAmountCents,
      createdAt: purchase_orders.createdAt,
      supplierName: suppliers.name,
    })
    .from(purchase_orders)
    .leftJoin(suppliers, eq(purchase_orders.supplierId, suppliers.id))
    .where(eq(purchase_orders.status, "DRAFT"))
    .orderBy(desc(purchase_orders.createdAt));

  if (draftPOs.length === 0) {
    return (
      <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-8 text-center shadow-sm">
        <h3 className="text-slate-800 font-semibold tracking-tight">Kardex Sano</h3>
        <p className="text-slate-500 text-sm mt-2">
          El Demonio Autonómico no detectó déficits operativos bajo la métrica (BurnRate * LeadTime).
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <h3 className="text-slate-800 font-semibold tracking-tight text-lg">
          Bóveda de Gasto
          <span className="ml-3 inline-flex items-center justify-center bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">
            {draftPOs.length} DRAFTS
          </span>
        </h3>
        <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">Fricción Positiva Requerida</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {draftPOs.map((po) => (
          <div 
            key={po.id} 
            className="flex flex-col justify-between bg-slate-50 rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="space-y-1 mb-6">
              <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                {po.id.slice(0, 13)}...
              </span>
              <h4 className="font-semibold text-slate-800 text-base truncate">
                {po.supplierName || "Proveedor Desconocido"}
              </h4>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                ${(po.totalAmountCents / 100).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500">Monto Calculado por IA</p>
            </div>

            <div className="pt-4 border-t border-slate-200/60 mt-auto">
              <ApprovePoButton poId={po.id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
