// @ts-nocheck
"use client";

import { KitchenButton, SmartInput } from "@/components/ui/AntigravityAtoms";
import { Calculator, Info, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
// import { submitCashClosure } from "../ops-actions";
const submitCashClosure = async () => { console.log("Mocked submitCashClosure"); };

export default function CashierForm() {
  const [loading, setLoading] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      date: formData.get("date") as string,
      shift: formData.get("shift") as any,
      zClose: Number(formData.get("zClose")),
      salesCounter: Number(formData.get("salesCounter")),
      salesMpQr: Number(formData.get("salesMpQr")),
      salesDelivery: Number(formData.get("salesDelivery")),
      totalCash: Number(formData.get("totalCash")),
      totalMp: Number(formData.get("totalMp")),
      totalDelivery: Number(formData.get("totalDelivery")),
      laborCost: Number(formData.get("laborCost")),
      observations: formData.get("observations") as string,
    };

    try {
      const result = await submitCashClosure(data);
      const variance = result.variance;

      toast.success(`Cierre registrado. Varianza: $${variance.toFixed(0)}`, {
        description:
          variance === 0
            ? "¡Caja Perfecta!"
            : variance > 0
              ? "Sobrante Detectado"
              : "Faltante Detectado",
        duration: 5000,
      });
      (e.target as HTMLFormElement).reset();
    } catch (error: any) {
      toast.error(error.message || "Error al registrar cierre");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {/* 1. DATOS DE CONTEXTO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Fecha del Turno
          </label>
          <SmartInput name="date" type="date" defaultValue={today} required />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Turno
          </label>
          <select
            name="shift"
            required
            className="w-full px-4 py-3 bg-[var(--bg-elevated)] rounded-lg shadow-sm border-0 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-600 appearance-none"
          >
            <option value="MAÑANA">Mañana</option>
            <option value="TARDE">Tarde</option>
            <option value="NOCHE" selected>
              Noche
            </option>
            <option value="FULL">Día Completo</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* 2. VENTAS SISTEMA (Lo que dice el ticket) */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <Calculator size={16} className="text-indigo-400" />
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-900 italic">
              Ventas Sistema (Bruto)
            </h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400">
                Total Z (Control Fiscal)
              </label>
              <SmartInput name="zClose" type="number" placeholder="0" required />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400">
                Ventas Mostrador (Efectivo)
              </label>
              <SmartInput name="salesCounter" type="number" placeholder="0" required />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400">
                Ventas MP (QR/Link)
              </label>
              <SmartInput name="salesMpQr" type="number" placeholder="0" required />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400">
                Ventas Delivery App
              </label>
              <SmartInput name="salesDelivery" type="number" placeholder="0" required />
            </div>
          </div>
        </div>

        {/* 3. DINERO REAL (Lo que hay en la heladera/billetera) */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <Banknote size={16} className="text-emerald-400" />
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-900 italic">
              Existencias Reales
            </h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400">
                Efectivo Físico
              </label>
              <SmartInput
                name="totalCash"
                type="number"
                placeholder="0"
                className="ring-emerald-100 focus:ring-emerald-500"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400">
                MP Recibido Real
              </label>
              <SmartInput
                name="totalMp"
                type="number"
                placeholder="0"
                className="ring-emerald-100 focus:ring-emerald-500"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400">
                Cupones Delivery
              </label>
              <SmartInput
                name="totalDelivery"
                type="number"
                placeholder="0"
                className="ring-emerald-100 focus:ring-emerald-500"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400">
                Costo Personal (Labor)
              </label>
              <SmartInput name="laborCost" type="number" placeholder="0" />
            </div>
          </div>
        </div>
      </div>

      {/* 4. OBSERVACIONES */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Info size={14} className="text-slate-400" />
          <label className="text-[10px] font-black uppercase text-slate-400">Observaciones</label>
        </div>
        <textarea
          name="observations"
          rows={3}
          placeholder="Ej: Faltó Nahuel, se compró lavandina $1200, lluvia fuerte bajó ventas..."
          className="w-full px-4 py-3 bg-[var(--bg-elevated)] rounded-lg shadow-sm border-0 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-600 transition-all text-sm font-medium"
        ></textarea>
      </div>

      <div className="pt-6 border-t border-slate-100">
        <KitchenButton
          type="submit"
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 size={24} className="animate-spin" />
              Sincronizando Tesorería...
            </div>
          ) : (
            "Cerrar Caja y Sincronizar"
          )}
        </KitchenButton>
      </div>
    </form>
  );
}

import { Banknote } from "lucide-react";

