"use client";

import { useState } from "react";
import { Building2, AlertTriangle, CheckCircle2, ChevronRight, Phone, Mail } from "lucide-react";
import { SupplierDrillDown } from "./SupplierDrillDown";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface SkuWithMapping {
  id: string;
  skuName: string;
  isMapped: boolean;
  mappingId: string | null;
  mdmIngredientId: string | null;
  conversionFactor: number | null;
}

interface SupplierCard {
  id: string;
  name: string;
  cuit: string;
  phone: string | null;
  email: string | null;
  paymentTerms: string | null;
  totalSkus: number;
  mappedSkus: number;
  unmappedSkus: number;
}

interface MdmIngredient {
  id: string;
  name: string;
}

interface B2BDirectoryClientProps {
  suppliers: SupplierCard[];
  skusBySupplier: Record<string, SkuWithMapping[]>;
  mdmCatalog: MdmIngredient[];
}

// ─────────────────────────────────────────────────────────────────────────────
// B2B DIRECTORY CLIENT (Interactive Grid + Drill-Down)
// ─────────────────────────────────────────────────────────────────────────────
export function B2BDirectoryClient({ suppliers, skusBySupplier, mdmCatalog }: B2BDirectoryClientProps) {
  const [activeSupplier, setActiveSupplier] = useState<SupplierCard | null>(null);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {suppliers.map((s) => {
          const healthColor = s.unmappedSkus === 0
            ? "border-emerald-200 bg-emerald-50/30"
            : s.unmappedSkus > 2
              ? "border-red-200 bg-red-50/30"
              : "border-amber-200 bg-amber-50/30";

          return (
            <button
              key={s.id}
              onClick={() => setActiveSupplier(s)}
              className={`text-left flex flex-col justify-between p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-pointer group ${healthColor}`}
            >
              {/* Top Row */}
              <div className="flex items-start justify-between mb-4">
                <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                  <Building2 className="w-5 h-5 text-slate-700" />
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
              </div>

              {/* Name & CUIT */}
              <h3 className="font-bold text-slate-900 text-base truncate">{s.name}</h3>
              <p className="text-[10px] tracking-widest text-slate-400 font-bold uppercase mt-0.5">
                CUIT: {s.cuit}
              </p>

              {/* Contact Row */}
              <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
                {s.phone && (
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{s.phone}</span>
                )}
                {s.email && (
                  <span className="flex items-center gap-1 truncate"><Mail className="w-3 h-3" />{s.email}</span>
                )}
              </div>

              {/* Semáforo de Salud ACL */}
              <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {s.unmappedSkus === 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  )}
                  <span className="text-xs font-semibold text-slate-700">
                    {s.mappedSkus}/{s.totalSkus} mapeados
                  </span>
                </div>
                {s.unmappedSkus > 0 && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    {s.unmappedSkus} pendientes
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Drill-Down Slide-Over */}
      {activeSupplier && (
        <SupplierDrillDown
          supplierId={activeSupplier.id}
          supplierName={activeSupplier.name}
          skus={skusBySupplier[activeSupplier.id] || []}
          mdmCatalog={mdmCatalog}
          onClose={() => setActiveSupplier(null)}
        />
      )}
    </>
  );
}
