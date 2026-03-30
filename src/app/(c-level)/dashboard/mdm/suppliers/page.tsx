"use client";

import { createSupplier, getSuppliers } from "@/actions/mdm-suppliers";
import ArbitrageTabClient from "@/components/Suppliers/ArbitrageTabClient";
import { Building2, CheckCircle2, Loader2, Plus, Search, TrendingDown, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function SuppliersMDB() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"directorio" | "arbitraje">("directorio");

  // Form State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category: "Insumos" as "Insumos" | "Servicios" | "Mantenimiento" | "Otros",
    leadTime: 24,
    paymentTerms: "Contado",
    contact_info: "",
    cuit: "",
    cbu: "",
    phone: "",
    address: "",
    paymentMethods: ["TRANSFERENCIA"],
    invoiceType: "FACTURA" as "FACTURA" | "REMITO" | "AMBAS",
  });

  const loadSuppliers = async () => {
    setLoading(true);
    const res = await getSuppliers();
    if (res.success) setSuppliers(res.data || []);
    else toast.error("Error al cargar proveedores");
    setLoading(false);
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const res = await createSupplier(formData);
    setIsSubmitting(false);

    if (res.success) {
      toast.success("Proveedor agregado exitosamente");
      setIsModalOpen(false);
      setFormData({
        name: "",
        category: "Insumos",
        leadTime: 24,
        paymentTerms: "Contado",
        contact_info: "",
        cuit: "",
        cbu: "",
        phone: "",
        address: "",
        paymentMethods: ["TRANSFERENCIA"],
        invoiceType: "FACTURA",
      });
      loadSuppliers();
    } else {
      toast.error(res.error || "Falló la validación del proveedor");
    }
  };

  return (
    <div className="p-6 md:p-10 min-h-screen bg-[var(--bg-elevated)] animate-in fade-in duration-500 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-end border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3 text-gray-900">
              <Building2 className="text-blue-600" size={32} /> Directorio de Proveedores
            </h1>
            <p className="text-gray-500 mt-2 text-sm tracking-wide">
              Gestión centralizada de socios de la cadena de suministro y parámetros de compras.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-gray-900 hover:bg-gray-800 text-white font-bold uppercase tracking-widest text-xs px-5 py-3 rounded-xl flex items-center gap-2 transition-all shadow-sm"
          >
            <Plus size={16} /> Nuevo Proveedor
          </button>
        </div>

        {/* TABS */}
        <div className="flex border-b border-gray-200 gap-6">
          <button
            onClick={() => setActiveTab("directorio")}
            className={`pb-3 text-sm font-black tracking-widest uppercase transition-colors relative ${activeTab === "directorio" ? "text-blue-600" : "text-gray-400 hover:text-gray-600"}`}
          >
            Directorio
            {activeTab === "directorio" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab("arbitraje")}
            className={`pb-3 text-sm font-black tracking-widest uppercase transition-colors relative flex items-center gap-2 ${activeTab === "arbitraje" ? "text-amber-500" : "text-gray-400 hover:text-gray-600"}`}
          >
            <TrendingDown size={14} /> Arbitraje Inteligente
            {activeTab === "arbitraje" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500"></div>
            )}
          </button>
        </div>

        {activeTab === "directorio" ? (
          <>
            {/* Toolbar */}
            <div className="flex gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="Buscar proveedor..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900"
                />
              </div>
            </div>

            {/* Data Table */}
            <div className="bg-[var(--bg-elevated)] border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[400px]">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-black tracking-widest text-gray-500 uppercase">
                      Proveedor
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-black tracking-widest text-gray-500 uppercase">
                      Categoría
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-black tracking-widest text-gray-500 uppercase">
                      Tiempos de entrega Promedio
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-black tracking-widest text-gray-500 uppercase">
                      Términos de Pago
                    </th>
                    <th className="px-6 py-4 text-right text-[10px] font-black tracking-widest text-gray-500 uppercase">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-[var(--bg-elevated)] divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                        <Loader2 className="animate-spin mx-auto mb-2 text-blue-500" size={24} />
                        Cargando directorio...
                      </td>
                    </tr>
                  ) : suppliers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-sm font-bold tracking-widest text-gray-400 uppercase"
                      >
                        No hay proveedores registrados.
                      </td>
                    </tr>
                  ) : (
                    suppliers.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-gray-900">{s.name}</div>
                          <div className="text-[10px] font-mono font-medium text-gray-500 mt-1 tracking-wider uppercase">
                            {s.cuit ? `CUIT: ${s.cuit}` : "SIN CUIT"}{" "}
                            {s.phone ? ` • TEL: ${s.phone}` : ""}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                            {s.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-600">
                          {s.leadTime} hrs
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {s.paymentTerms}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold tracking-widest uppercase ${s.active ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}
                          >
                            {s.active ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <ArbitrageTabClient />
        )}
      </div>

      {/* MODAL / SHEET NUEVO PROVEEDOR */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 font-sans">
          <div
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsModalOpen(false)}
          />

          <div className="relative w-full max-w-xl max-h-[90vh] bg-[var(--bg-elevated)] shadow-2xl flex flex-col animate-in zoom-in-95 duration-300 rounded-3xl border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-[var(--bg-elevated)] z-10">
              <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                Nuevo Proveedor
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
              <form id="supplierForm" onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold tracking-widest text-gray-500 uppercase">
                    Razón Social o Nombre Público *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 placeholder:text-gray-400"
                    placeholder="Ej: Maxiconsumo S.A."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold tracking-widest text-gray-500 uppercase">
                      CUIT / RUT
                    </label>
                    <input
                      type="text"
                      value={formData.cuit}
                      onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                      className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900"
                      placeholder="20-12345678-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold tracking-widest text-gray-500 uppercase">
                      CBU / ALIAS
                    </label>
                    <input
                      type="text"
                      value={formData.cbu}
                      onChange={(e) => setFormData({ ...formData, cbu: e.target.value })}
                      className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900"
                      placeholder="22 dígitos o alias"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold tracking-widest text-gray-500 uppercase">
                      Teléfono
                    </label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900"
                      placeholder="+54 9 11..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold tracking-widest text-gray-500 uppercase">
                      Dirección Física
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900"
                      placeholder="Av. Córdoba 1234"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold tracking-widest text-gray-500 uppercase">
                    Categoría Primaria *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900"
                  >
                    <option value="Insumos">Insumos (Food & Beverage)</option>
                    <option value="Servicios">Servicios Generales</option>
                    <option value="Mantenimiento">Mantenimiento y Equipos</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold tracking-widest text-gray-500 uppercase">
                    Tiempos de entrega Promedio (Horas) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.leadTime}
                    onChange={(e) => setFormData({ ...formData, leadTime: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold tracking-widest text-gray-500 uppercase">
                    Modalidades de Pago (Múltiple) *
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {["EFECTIVO", "TRANSFERENCIA", "CHEQUE", "CRIPTO"].map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => {
                          const m = formData.paymentMethods;
                          setFormData({
                            ...formData,
                            paymentMethods: m.includes(method)
                              ? m.filter((x) => x !== method)
                              : [...m, method],
                          });
                        }}
                        className={`px-3 py-2 text-[10px] font-black tracking-widest uppercase rounded-lg border transition-colors ${formData.paymentMethods.includes(method) ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"}`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                  {formData.paymentMethods.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">
                      Debes seleccionar al menos un método.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold tracking-widest text-gray-500 uppercase">
                      Términos Comerciales *
                    </label>
                    <select
                      value={formData.paymentTerms}
                      onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                      className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900"
                    >
                      <option value="Contado">Pago Inmediato (Contado)</option>
                      <option value="Pago Diferido">Pago Diferido (30D+)</option>
                      <option value="Cuenta Corriente">Cuenta Corriente Múltiple</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold tracking-widest text-gray-500 uppercase">
                      Documentación Recibida *
                    </label>
                    <select
                      value={formData.invoiceType}
                      onChange={(e) =>
                        setFormData({ ...formData, invoiceType: e.target.value as any })
                      }
                      className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900"
                    >
                      <option value="FACTURA">Solo Factura (AP)</option>
                      <option value="REMITO">Solo Remito Comercial</option>
                      <option value="AMBAS">Ambas (Fact.+Remito)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold tracking-widest text-gray-500 uppercase">
                    Datos de Contacto (Opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.contact_info}
                    onChange={(e) => setFormData({ ...formData, contact_info: e.target.value })}
                    className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 placeholder:text-gray-400"
                    placeholder="Email, Teléfono, Vendedor..."
                  />
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-gray-100 bg-[var(--bg-elevated)]">
              <button
                form="supplierForm"
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold uppercase tracking-widest text-sm px-6 py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <CheckCircle2 size={20} />
                )}
                {isSubmitting ? "Registrando..." : "Guardar Proveedor"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
