import {
  getB2BDirectory,
  getSupplierSkusWithMappings,
  getMdmIngredientsCatalog,
} from "@/actions/analytics-actions";
import { B2BDirectoryClient } from "./B2BDirectoryClient";
import { ApprovalVault } from "./ApprovalVault";
import { Building2, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Supplier Hub | BurgerMusic OS",
  description: "Directorio B2B, ACL Mapping & Bóveda de Aprobación",
};

export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SUPPLY HUB (Server Component — Zero Latency)
 * ─────────────────────────────────────────────────────────────────────────────
 * Orquesta el Directorio B2B, el ACL Mapper y la Bóveda de POs.
 * Toda consulta ocurre en el servidor: el cliente recibe HTML hidratado.
 */
export default async function SupplyHubPage() {
  // 1. Fetch determinista de proveedores con métricas de mapeo
  const suppliers = await getB2BDirectory();

  // 2. Fetch de SKUs con sus mappings para cada proveedor (pre-load para drill-down instantáneo)
  const skusBySupplier: Record<string, Awaited<ReturnType<typeof getSupplierSkusWithMappings>>> = {};
  for (const s of suppliers) {
    skusBySupplier[s.id] = await getSupplierSkusWithMappings(s.id);
  }

  // 3. Catálogo MDM para el selector del ACL Mapper
  const mdmCatalog = await getMdmIngredientsCatalog();

  return (
    <div className="min-h-screen bg-slate-50 p-8 space-y-10 pb-20">

      {/* ─── SECCIÓN 1: DIRECTORIO B2B ─── */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
            <Building2 className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Directorio B2B</h2>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">
              {suppliers.length} proveedores activos &middot; Capa Anticorrupción (ACL)
            </p>
          </div>
        </div>

        {suppliers.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm">
            <h3 className="text-slate-700 font-semibold">Sin proveedores registrados</h3>
            <p className="text-sm text-slate-500 mt-2">
              Ejecute <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">npx tsx src/db/seed-suppliers.ts</code> para hidratar el directorio.
            </p>
          </div>
        ) : (
          <B2BDirectoryClient
            suppliers={suppliers}
            skusBySupplier={skusBySupplier}
            mdmCatalog={mdmCatalog}
          />
        )}
      </section>

      {/* ─── SECCIÓN 2: BÓVEDA DE APROBACIÓN ─── */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Bóveda de Gasto</h2>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">
              POs generadas por el Daemon Autonómico &middot; Fricción Positiva
            </p>
          </div>
        </div>
        <ApprovalVault />
      </section>
    </div>
  );
}
