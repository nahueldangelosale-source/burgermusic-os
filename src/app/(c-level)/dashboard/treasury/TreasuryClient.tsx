"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import * as Tabs from "@radix-ui/react-tabs";
import * as Dialog from "@radix-ui/react-dialog";
import { ingestSupplierInvoice, createSupplier } from "@/actions/treasury-actions";
import { seedTreasuryTopology } from "@/actions/treasury-engine";
import { processInvoiceDocument } from "@/actions/ocr-ingestion";
import {
  FileUp, ReceiptText, ShieldAlert, BadgeCheck, Loader2, Calendar,
  LayoutDashboard, Plus, X, RefreshCw, AlertTriangle, Wallet, Building2,
  TrendingUp, PieChart as PieChartIcon, ExternalLink, Activity
} from "lucide-react";
import { IngestInvoiceSchema, type IngestInvoicePayload, CreateSupplierSchema } from "@/actions/treasury-schemas";
import type { TreasuryChartData, TreasuryAlert } from "@/actions/treasury-engine";
import { AirlockFinanciero } from "./Airlock";
import { ChannelDonutChart } from "../sales/client-components";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from "recharts";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type LedgerItem = {
  id: string;
  supplier_id: string;
  supplier_name: string;
  type: string;
  invoice_number: string | null;
  amount_cents: number;
  balance_cents: number;
  due_date: string;
  line_items?: {
    name: string;
    quantity: number;
    unit_price_cents: number;
    total_cents: number;
  }[];
};

type Supplier = { id: string; name: string };

type Props = {
  initialLedger: LedgerItem[];
  suppliers: Supplier[];
  dashboardData: TreasuryChartData;
  channelsData?: any;
};

const PIE_COLORS = ["#6366f1", "#f43f5e", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899"];
const fmt = (c: number) => `$${(Math.abs(c) / 100).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;

// ─────────────────────────────────────────────────────────────
// Alert Banner Component
// ─────────────────────────────────────────────────────────────

function AlertBanner({ alerts }: { alerts: TreasuryAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 mb-6">
      {alerts.map((alert, i) => {
        const borderColor = alert.type === "CRITICAL" ? "border-red-400 bg-red-50" : alert.type === "WARNING" ? "border-amber-400 bg-amber-50" : "border-blue-400 bg-blue-50";
        const iconColor = alert.type === "CRITICAL" ? "text-red-500" : alert.type === "WARNING" ? "text-amber-500" : "text-blue-500";
        const textColor = alert.type === "CRITICAL" ? "text-red-700" : alert.type === "WARNING" ? "text-amber-700" : "text-blue-700";
        return (
          <div key={`${alert.code}-${i}`} className={`flex items-center gap-3 p-3 rounded-xl border-l-4 ${borderColor} animate-in fade-in`}>
            <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${iconColor}`} />
            <p className={`text-sm font-semibold ${textColor}`}>{alert.message}</p>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export default function TreasuryClient({ initialLedger, suppliers, dashboardData, channelsData }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedExpense, setSelectedExpense] = useState<LedgerItem | null>(null);
  const [suppliersList, setSuppliersList] = useState<Supplier[]>(suppliers);
  const [ledger, setLedger] = useState<LedgerItem[]>(initialLedger);
  const [activeTab, setActiveTab] = useState("radar");
  const [ingestTab, setIngestTab] = useState<"ai-scanner" | "manual">("ai-scanner");
  const [seedingTopology, setSeedingTopology] = useState(false);

  useEffect(() => { setLedger(initialLedger); }, [initialLedger]);
  useEffect(() => { setSuppliersList(suppliers); }, [suppliers]);

  const [redAlert, setRedAlert] = useState<{ extracted: Partial<IngestInvoicePayload>; error: string } | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);

  const ingestForm = useForm({
    resolver: zodResolver(IngestInvoiceSchema),
    defaultValues: {
      expense_type: "VARIABLE",
      net_amount_cents: 0,
      tax_amount_cents: 0,
      withholdings_cents: 0,
      gross_amount_cents: 0,
      line_items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: ingestForm.control, name: "line_items" });
  const supplierForm = useForm({ resolver: zodResolver(CreateSupplierSchema) });

  // ── KPI Computations ────────────────────────────────────────
  const { totalDebt, dueIn7Days, overdueDebt } = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const in7Days = new Date(); in7Days.setDate(in7Days.getDate() + 7); in7Days.setHours(0, 0, 0, 0);
    let tDebt = 0, in7 = 0, overdue = 0;

    for (const item of ledger) {
      if (item.balance_cents === 0) continue;
      const debtValue = Math.abs(item.balance_cents);
      tDebt += debtValue;

      const dateStr = (item.due_date || "").includes("T") ? item.due_date.split("T")[0] : item.due_date;
      if (!dateStr) continue;
      const [year, month, day] = dateStr.split("-");
      const itemDate = new Date(Number(year), Number(month) - 1, Number(day)); itemDate.setHours(0, 0, 0, 0);

      if (itemDate < now) overdue += debtValue;
      else if (itemDate <= in7Days) in7 += debtValue;
    }
    return { totalDebt: tDebt, dueIn7Days: in7, overdueDebt: overdue };
  }, [ledger]);

  const calendarItems = useMemo(() => {
    const map = new Map<string, LedgerItem[]>();
    for (const item of ledger) {
      if (item.balance_cents === 0) continue;
      const raw = item.due_date || "";
      const dateStr = raw.includes("T") ? raw.split("T")[0] : raw.split(" ")[0];
      if (!dateStr || dateStr.includes("1970")) continue;
      if (!map.has(dateStr)) map.set(dateStr, []);
      map.get(dateStr)!.push(item);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [ledger]);

  // ── Handlers ────────────────────────────────────────────────
  const onManualSubmit = async (data: Record<string, unknown>) => {
    const payload = { ...data, due_date: (data.due_date as string) || new Date().toISOString().split("T")[0] };
    setManualLoading(true); setRedAlert(null); setGeneralError(null);
    try {
      const res = await ingestSupplierInvoice(payload as unknown as IngestInvoicePayload);
      if (res.success) { startTransition(() => router.refresh()); ingestForm.reset(); }
      else setGeneralError("Transacción rechazada por el servidor.");
    } catch (err: unknown) {
      setGeneralError(err instanceof Error ? err.message : "Error interno del servidor");
    } finally { setManualLoading(false); }
  };

  const onSupplierSubmit = async (data: Record<string, unknown>) => {
    setIsCreatingSupplier(true); setGeneralError(null);
    try {
      const res = await createSupplier(data as { name: string; cuit: string });
      if (res.success && res.supplier) {
        setSuppliersList(prev => [...prev, res.supplier!]);
        ingestForm.setValue("supplier_id", res.supplier.id);
        setShowSupplierModal(false); supplierForm.reset();
      } else setGeneralError(res.error || "Fallo al crear proveedor.");
    } catch (err: unknown) {
      setGeneralError(err instanceof Error ? err.message : "Error de conexión.");
    } finally { setIsCreatingSupplier(false); }
  };

  const onFileDrop = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const fd = new FormData(); fd.append("file", file);
    setAiLoading(true); setRedAlert(null); setGeneralError(null);
    try {
      const res = await processInvoiceDocument(fd);
      if (res.success) { startTransition(() => router.refresh()); }
      else if (res.requires_human_review && res.extracted_data) {
        setRedAlert({ extracted: res.extracted_data as Partial<IngestInvoicePayload>, error: res.error as string });
        Object.keys(res.extracted_data).forEach((k) => {
          const key = k as keyof IngestInvoicePayload;
          if (res.extracted_data[key] !== undefined) {
            if (key === "due_date" && typeof res.extracted_data[key] === "string") {
              ingestForm.setValue(key, (res.extracted_data[key] as string).split("T")[0] as unknown as Date);
            } else {
              ingestForm.setValue(key, res.extracted_data[key] as never);
            }
          }
        });
        setIngestTab("manual");
      } else setGeneralError(res.error || "Error de validación multimodal.");
    } catch (err: unknown) {
      setGeneralError(err instanceof Error ? err.message : "Error de conexión AI.");
    } finally { setAiLoading(false); }
  };

  const handleSeedTopology = async () => {
    setSeedingTopology(true);
    try {
      await seedTreasuryTopology();
      startTransition(() => router.refresh());
    } catch (err: unknown) {
      setGeneralError(err instanceof Error ? err.message : "Error al inicializar topología.");
    } finally { setSeedingTopology(false); }
  };

  const watchedLineItems = ingestForm.watch("line_items");
  const hasLineItems = Array.isArray(watchedLineItems) && watchedLineItems.length > 0;

  useEffect(() => {
    if (!watchedLineItems || watchedLineItems.length === 0) return;
    const sum = watchedLineItems.reduce((acc: number, item) => {
      const val = typeof item?.total_cents === "number" ? item.total_cents : parseInt(String(item?.total_cents || 0), 10);
      return acc + (Number.isFinite(val) ? val : 0);
    }, 0);
    ingestForm.setValue("net_amount_cents", Math.round(sum), { shouldValidate: true, shouldDirty: true });
  }, [watchedLineItems, ingestForm]);

  const net = ingestForm.watch("net_amount_cents") || 0;
  const tax = ingestForm.watch("tax_amount_cents") || 0;
  const wh = ingestForm.watch("withholdings_cents") || 0;
  const gross = ingestForm.watch("gross_amount_cents") || 0;
  const isMathValid = net + tax + wh === gross && gross > 0;

  // ──────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* ALERT SENTINEL */}
      <AlertBanner alerts={dashboardData.alerts} />

      {generalError && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3 animate-in fade-in">
          <ShieldAlert className="text-red-500 w-5 h-5 flex-shrink-0" />
          <p className="text-red-700 text-sm font-semibold">{generalError}</p>
          <button onClick={() => setGeneralError(null)} className="ml-auto text-red-400 hover:text-red-600 transition-colors"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ────── RECHARTS DASHBOARD ────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar Chart: Deuda */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-500" /> Deuda Vencida vs A Vencer
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dashboardData.debtBars}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} />
              <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} tickFormatter={(v) => `$${(v / 100).toFixed(0)}`} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }} />
              <Bar dataKey="overdue" fill="#ef4444" radius={[4, 4, 0, 0]} name="Vencida" />
              <Bar dataKey="upcoming" fill="#d1d5db" radius={[4, 4, 0, 0]} name="A Vencer" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Area Chart: Flujo de Caja */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" /> Flujo de Caja (30 Días)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={dashboardData.cashFlowArea}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} tickFormatter={(d: string) => d.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={(v) => `$${v}`} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }} />
              <Area type="monotone" dataKey="net" stroke="#6366f1" fill="#eef2ff" strokeWidth={2} name="Neto Acumulado" />
              <Area type="monotone" dataKey="inflow" stroke="#10b981" fill="#d1fae5" strokeWidth={1} name="Ingreso Diario" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart: OPEX Distribution */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-violet-500" /> Distribución de Gastos
          </h3>
          {dashboardData.opexPie.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-10">Sin datos de gastos registrados.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={dashboardData.opexPie} cx="50%" cy="50%" innerRadius={40} outerRadius={75} dataKey="value" nameKey="name" paddingAngle={2}>
                  {dashboardData.opexPie.map((_, i) => (
                    <Cell key={`cell-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ────── LIQUIDITY TOPOLOGY KPIs ────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Deuda Total</p>
          <p className="text-xl font-bold font-mono text-gray-900">{fmt(totalDebt)}</p>
        </div>
        <div className="bg-white border-2 border-amber-400 p-4 rounded-xl shadow-sm">
          <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">Vence en 7d</p>
          <p className="text-xl font-bold font-mono text-amber-600">{fmt(dueIn7Days)}</p>
        </div>
        <div className="bg-white border-2 border-red-400 p-4 rounded-xl shadow-sm">
          <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">Vencida</p>
          <p className="text-xl font-bold font-mono text-red-600">{fmt(overdueDebt)}</p>
        </div>
        <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm flex items-center gap-3">
          <Wallet className="w-5 h-5 text-emerald-500" />
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Caja Chica</p>
            <p className="text-lg font-bold font-mono text-gray-900">
              {dashboardData.pettyCash ? fmt(dashboardData.pettyCash.balance_cents) : "—"}
            </p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cuentas</p>
            <Building2 className="w-4 h-4 text-indigo-400" />
          </div>
          {dashboardData.treasuryAccounts.length === 0 ? (
            <button onClick={handleSeedTopology} disabled={seedingTopology} className="text-xs text-indigo-600 font-semibold hover:underline">
              {seedingTopology ? "Inicializando..." : "Inicializar Topología"}
            </button>
          ) : (
            <p className="text-sm font-mono text-gray-700">{dashboardData.treasuryAccounts.length} activas</p>
          )}
        </div>
      </div>

      {/* ────── TABS ────── */}
      <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex flex-col w-full relative">
        {isPending && (
          <div className="absolute top-0 left-0 w-full h-1 z-50 overflow-hidden rounded bg-gray-200">
            <div className="h-full bg-indigo-500 animate-[pulse_1s_ease-in-out_infinite] w-1/3" />
          </div>
        )}

        <Tabs.List className="flex border-b border-gray-200 mb-6 bg-white sticky top-0 z-10">
          {[
            { value: "radar", label: "Radar AP", icon: <LayoutDashboard className="w-4 h-4" /> },
            { value: "ingesta", label: "Ingesta Híbrida", icon: <FileUp className="w-4 h-4" /> },
            { value: "cierres_csv", label: "CIERRES DE CAJA (CSV)", icon: <Activity className="w-4 h-4" /> },
            { value: "calendario", label: "Calendario AP", icon: <Calendar className="w-4 h-4" /> },
            { value: "recurrentes", label: "Pasivos Recurrentes", icon: <RefreshCw className="w-4 h-4" /> },
          ].map((tab) => (
            <Tabs.Trigger key={tab.value} value={tab.value}
              className="px-5 py-3.5 text-xs font-bold text-gray-400 transition-colors uppercase tracking-widest hover:text-gray-900 data-[state=active]:text-indigo-600 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 flex items-center gap-2"
            >
              {tab.icon} {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {/* TAB: RADAR */}
        <Tabs.Content value="radar" className="animate-in fade-in duration-300 outline-none">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col min-h-[400px] shadow-sm">
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <ReceiptText className="w-4 h-4 text-indigo-500" /> AP Radar Limit-Book
              </h2>
            </div>
            <div className="p-3 flex-1 overflow-y-auto max-h-[600px] space-y-2">
              {ledger.length === 0 ? (
                <p className="text-gray-400 text-sm text-center mt-10">Sin deudas pendientes registradas.</p>
              ) : (
                ledger.map((item) => {
                  const raw = item.due_date || "";
                  const isInvalidDate = !raw || raw.includes("1970");
                  const dateStr = raw.includes("T") ? raw.split("T")[0] : raw;
                  const [y, m, d] = (dateStr || "2024-01-01").split("-");
                  const itemDate = new Date(Number(y), Number(m) - 1, Number(d)); itemDate.setHours(0, 0, 0, 0);
                  const now = new Date(); now.setHours(0, 0, 0, 0);
                  const in7 = new Date(); in7.setDate(in7.getDate() + 7); in7.setHours(0, 0, 0, 0);
                  const daysOverdue = Math.floor((now.getTime() - itemDate.getTime()) / 86400000);

                  let badge: React.ReactNode;
                  if (item.balance_cents === 0) badge = <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold tracking-wider text-[10px]">PAID</span>;
                  else if (isInvalidDate) badge = <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-500 font-bold tracking-wider text-[10px]">PENDING</span>;
                  else if (daysOverdue > 0) badge = <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 font-bold tracking-wider text-[10px]">Vencida hace {daysOverdue}d</span>;
                  else if (itemDate <= in7) badge = <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-bold tracking-wider text-[10px]">PRÓXIMA</span>;
                  else badge = <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-500 font-bold tracking-wider text-[10px]">PENDING</span>;

                  return (
                    <div key={item.id} onClick={() => setSelectedExpense(item)}
                      className="p-4 rounded-xl border border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer flex flex-col gap-2 group"
                    >
                      <div className="flex justify-between items-start">
                        <div className="font-bold text-gray-800 text-sm group-hover:text-indigo-600 transition-colors">
                          {item.supplier_name}
                        </div>
                        <div className="font-mono text-base font-bold text-gray-900 tracking-tight">{fmt(item.balance_cents)}</div>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <div className="text-gray-400 font-mono text-xs">
                          Vence: {isInvalidDate ? "Sin fecha" : itemDate.toLocaleDateString("es-AR")}
                        </div>
                        {badge}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Tabs.Content>

        {/* TAB: CIERRES DE CAJA (CSV) */}
        <Tabs.Content value="cierres_csv" className="animate-in fade-in duration-300 outline-none">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden min-h-[400px] shadow-sm p-6 space-y-6">
            <div className="border-b border-gray-100 pb-4 mb-4">
              <h2 className="text-xl font-bold tracking-tight text-gray-900 uppercase">
                Arquitectura de Ingesta Zero-Fricción
              </h2>
              <p className="text-sm font-medium text-gray-500 mt-1">Confinamiento de Riesgos en Entropía Estática</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <div className="flex flex-col gap-4">
                <AirlockFinanciero />
              </div>
              <div className="min-h-[300px] bg-slate-50 border border-slate-100 rounded-2xl p-4">
                {channelsData ? <ChannelDonutChart data={channelsData} /> : <p className="text-center text-slate-400 mt-20 font-bold text-sm">Cargando Radar de Canales...</p>}
              </div>
            </div>
          </div>
        </Tabs.Content>

        {/* TAB: INGESTA HÍBRIDA */}
        <Tabs.Content value="ingesta" className="animate-in fade-in duration-300 outline-none flex flex-col gap-6">
          {redAlert && (
            <div className="bg-red-50 border border-red-200 p-5 rounded-xl text-red-700 flex flex-col sm:flex-row gap-4 items-start">
              <div className="p-2 bg-red-100 rounded-full flex-shrink-0"><ShieldAlert className="w-5 h-5 text-red-500" /></div>
              <div className="flex-1">
                <div className="flex justify-between items-start w-full">
                  <h3 className="font-bold text-red-600 mb-1 tracking-tight">AI MATH HALLUCINATION DETECTED</h3>
                  <button onClick={() => setRedAlert(null)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                </div>
                <p className="text-sm opacity-90 mb-2">{redAlert.error}</p>
                <p className="text-xs font-mono bg-red-100 p-2 rounded border border-red-200">
                  Neto ({redAlert.extracted.net_amount_cents || 0}) + IVA ({redAlert.extracted.tax_amount_cents || 0}) + Wh ({redAlert.extracted.withholdings_cents || 0}) ≠ Bruto ({redAlert.extracted.gross_amount_cents || 0})
                </p>
              </div>
            </div>
          )}

          <div className={`bg-white border transition-colors duration-300 rounded-xl overflow-hidden flex flex-col shadow-sm ${redAlert ? "border-red-300" : "border-gray-200"}`}>
            <div className="flex border-b border-gray-100">
              <button onClick={() => setIngestTab("ai-scanner")}
                className={`flex-1 p-3.5 text-xs font-bold transition-colors flex items-center justify-center gap-2 ${ingestTab === "ai-scanner" ? "bg-gray-50 text-indigo-600 border-b-2 border-indigo-500" : "text-gray-400 hover:bg-gray-50"}`}
              >
                <FileUp className="w-4 h-4" /> Escáner AI OCR
              </button>
              <button onClick={() => setIngestTab("manual")}
                className={`flex-1 p-3.5 text-xs font-bold transition-colors flex items-center justify-center gap-2 ${ingestTab === "manual" ? "bg-gray-50 text-indigo-600 border-b-2 border-indigo-500" : "text-gray-400 hover:bg-gray-50"}`}
              >
                <ReceiptText className="w-4 h-4" /> Formulario Manual
              </button>
            </div>

            <div className="p-6">
              {ingestTab === "ai-scanner" && (
                <div className="flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-gray-300 bg-gray-50 rounded-xl relative hover:border-indigo-400 transition-colors group">
                  {aiLoading ? (
                    <div className="flex flex-col items-center gap-3 text-indigo-500">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <span className="animate-pulse font-mono text-xs tracking-widest uppercase">Razonamiento Matemático...</span>
                    </div>
                  ) : (
                    <>
                      <div className="p-4 bg-gray-100 rounded-full mb-4 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors"><FileUp className="w-8 h-8" /></div>
                      <p className="font-bold text-gray-600">Inyección Multimodal de Factura</p>
                      <p className="text-xs text-gray-400 mt-2 font-mono">Drop PDF/PNG/JPG here</p>
                      <input type="file" accept="image/*,application/pdf" onChange={onFileDrop}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isPending} />
                    </>
                  )}
                </div>
              )}

              {ingestTab === "manual" && (
                <div className="flex flex-col gap-6 relative">
                  {showSupplierModal && (
                    <div className="absolute inset-0 bg-white z-20 flex flex-col p-6 rounded-lg border border-gray-200 shadow-xl animate-in fade-in zoom-in-95">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-gray-800 tracking-tight">Crear Proveedor</h3>
                        <button onClick={() => setShowSupplierModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                      </div>
                      <form onSubmit={supplierForm.handleSubmit(onSupplierSubmit)} className="flex flex-col gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Nombre / Razón Social</label>
                          <input type="text" {...supplierForm.register("name")} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-gray-800 outline-none" autoFocus />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">CUIT / NIF</label>
                          <input type="text" {...supplierForm.register("cuit")} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-gray-800 outline-none" />
                        </div>
                        <button type="submit" disabled={isCreatingSupplier || isPending} className="mt-4 p-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg flex justify-center items-center gap-2 transition-colors">
                          {isCreatingSupplier ? <Loader2 className="w-5 h-5 animate-spin" /> : "Inyectar Proveedor"}
                        </button>
                      </form>
                    </div>
                  )}

                  <form onSubmit={ingestForm.handleSubmit(onManualSubmit, (errors) => {
                    const firstError = Object.values(errors)[0];
                    setGeneralError(firstError?.message?.toString() || "Validación Zod falló.");
                  })} className="flex flex-col gap-5">
                    <div className="grid grid-cols-2 gap-4 items-start">
                      <div className="flex flex-col">
                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Proveedor</label>
                        <div className="flex gap-2">
                          <select {...ingestForm.register("supplier_id")} className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 outline-none text-gray-700 transition-all">
                            <option value="">Seleccione Proveedor</option>
                            {suppliersList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                          <button type="button" onClick={() => setShowSupplierModal(true)} className="p-2.5 bg-gray-100 text-indigo-500 hover:text-indigo-400 border border-gray-200 rounded-lg flex items-center justify-center font-bold text-sm transition-colors">
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Categoría Gasto</label>
                        <select {...ingestForm.register("expense_type")} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 text-gray-700 outline-none transition-all">
                          <option value="FIXED">FIJO</option><option value="VARIABLE">VARIABLE</option><option value="EXTRAORDINARY">EXTRAORDINARIO</option><option value="PAYROLL">NÓMINA</option><option value="TAXES">IMPUESTOS</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Vencimiento</label>
                        <input type="date" {...ingestForm.register("due_date")} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 text-gray-700 outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Factura / Remito</label>
                        <input type="text" {...ingestForm.register("reference_id")} placeholder="#0000" className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 text-gray-700 outline-none" />
                      </div>
                    </div>

                    {/* Line Items */}
                    <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl flex flex-col gap-3">
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Detalle de Partidas</label>
                        <button type="button" onClick={() => append({ name: "", quantity: 1, unit_price_cents: 0, total_cents: 0 })} className="text-xs font-bold text-indigo-600 border border-indigo-200 hover:bg-indigo-50 px-3 py-1.5 rounded transition-colors flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Agregar Ítem
                        </button>
                      </div>
                      {fields.length === 0 ? (
                        <div className="text-center py-4 bg-white rounded border border-dashed border-gray-300 text-gray-400 text-xs font-mono">Sin partidas detalladas</div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className="grid grid-cols-[1fr_80px_100px_100px_40px] gap-2 items-center text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1 px-1">
                            <span>Concepto</span><span className="text-center">Cant.</span><span className="text-right">Unitario</span><span className="text-right">Total</span><span></span>
                          </div>
                          {fields.map((field, index) => (
                            <div key={field.id} className="grid grid-cols-[1fr_80px_100px_100px_40px] gap-2 items-center bg-white p-2 rounded border border-gray-200 focus-within:border-indigo-400 transition-colors">
                              <input type="text" {...ingestForm.register(`line_items.${index}.name`)} placeholder="Ej. Lomo x10kg" className="bg-transparent border-none text-sm text-gray-800 focus:outline-none rounded px-1 w-full" />
                              <input type="number" step="0.01" {...ingestForm.register(`line_items.${index}.quantity`, { valueAsNumber: true })} className="w-full bg-gray-50 border border-gray-200 text-sm text-center font-mono text-gray-700 focus:outline-none focus:border-indigo-500 rounded p-1.5" />
                              <input type="number" step="0.01"
                                value={(ingestForm.watch(`line_items.${index}.unit_price_cents`) || 0) / 100}
                                onChange={(e) => {
                                  const price = parseFloat(e.target.value || "0");
                                  const qty = ingestForm.watch(`line_items.${index}.quantity`) || 0;
                                  ingestForm.setValue(`line_items.${index}.unit_price_cents`, Math.round(price * 100));
                                  ingestForm.setValue(`line_items.${index}.total_cents`, Math.round(price * qty * 100));
                                }}
                                className="w-full bg-gray-50 border border-gray-200 text-sm text-right font-mono text-gray-700 focus:outline-none focus:border-indigo-500 rounded p-1.5" placeholder="$" />
                              <div className="w-full bg-gray-50 border border-gray-200 text-sm font-mono text-right text-indigo-600 p-1.5 rounded select-none truncate">
                                ${((ingestForm.watch(`line_items.${index}.total_cents`) || 0) / 100).toFixed(2)}
                              </div>
                              <button type="button" onClick={() => remove(index)} className="text-red-400 hover:text-red-500 p-1.5 rounded flex items-center justify-center transition-colors bg-red-50 hover:bg-red-100">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Financial Metadata */}
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 mt-2">
                      <h3 className="text-xs font-bold text-gray-500 mb-4 uppercase tracking-widest">Metadatos Financieros (Céntimos)</h3>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Neto</label>
                          <input type="number" {...ingestForm.register("net_amount_cents", { valueAsNumber: true })} readOnly={hasLineItems} className={`w-full bg-white border border-gray-200 rounded p-2 text-sm font-mono text-gray-700 ${hasLineItems ? "opacity-70 cursor-not-allowed" : ""}`} />
                          {hasLineItems && <span className="text-[10px] text-gray-400 mt-1 block">Calculado desde partidas</span>}
                        </div>
                        <div><label className="block text-xs text-gray-500 mb-1">IVA</label><input type="number" {...ingestForm.register("tax_amount_cents", { valueAsNumber: true })} className="w-full bg-white border border-gray-200 rounded p-2 text-sm font-mono text-gray-700" /></div>
                        <div><label className="block text-xs text-gray-500 mb-1">Retenciones</label><input type="number" {...ingestForm.register("withholdings_cents", { valueAsNumber: true })} className="w-full bg-white border border-gray-200 rounded p-2 text-sm font-mono text-gray-700" /></div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1 font-semibold">Bruto Resultante</label>
                          <input type="number" {...ingestForm.register("gross_amount_cents", { valueAsNumber: true })} className={`w-full bg-white border-2 rounded p-2 text-sm font-mono font-bold transition-colors ${!isMathValid ? "border-red-400 text-red-500" : "border-emerald-400 text-emerald-600"}`} />
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
                        <div className="text-xs font-mono font-bold text-gray-700">
                          Test Aritmético: <span className={net + tax + wh !== gross ? "text-red-500" : "text-emerald-500"}>{net + tax + wh}</span>
                        </div>
                        {!isMathValid ? (
                          <span className="text-xs text-red-500 font-bold flex items-center gap-1 uppercase tracking-wider"><ShieldAlert className="w-3 h-3" /> Fricción Activada</span>
                        ) : (
                          <span className="text-xs text-emerald-500 font-bold flex items-center gap-1 uppercase tracking-wider"><BadgeCheck className="w-4 h-4" /> Paridad Perfecta</span>
                        )}
                      </div>
                    </div>

                    <button type="submit" disabled={!isMathValid || manualLoading || isPending}
                      className="w-full mt-2 p-3.5 rounded-lg font-bold tracking-widest uppercase text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-300 bg-indigo-600 hover:bg-indigo-500 shadow-md disabled:shadow-none flex items-center justify-center gap-2">
                      {manualLoading || isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Consolidar Deuda"}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </Tabs.Content>

        {/* TAB: CALENDARIO */}
        <Tabs.Content value="calendario" className="animate-in fade-in duration-300 outline-none">
          <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm overflow-x-auto">
            {calendarItems.length === 0 ? (
              <p className="text-gray-400 text-sm text-center">El calendario financiero se encuentra despejado.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {calendarItems.map(([dateKey, items]) => {
                  const groupDate = new Date(dateKey + "T00:00:00");
                  const now = new Date(); now.setHours(0, 0, 0, 0);
                  const in7 = new Date(); in7.setDate(in7.getDate() + 7); in7.setHours(0, 0, 0, 0);
                  const isOverdue = groupDate < now;
                  const isWarning = !isOverdue && groupDate <= in7;
                  const borderColor = isOverdue ? "border-red-400" : isWarning ? "border-amber-400" : "border-gray-200";
                  const headerBg = isOverdue ? "bg-red-500 text-white" : isWarning ? "bg-amber-400 text-gray-900" : "bg-gray-100 text-gray-700";

                  return (
                    <div key={dateKey} className={`flex flex-col border-2 rounded-xl overflow-hidden bg-white h-full ${borderColor}`}>
                      <div className={`p-3 font-bold flex justify-between tracking-tight text-sm ${headerBg}`}>
                        <span>{groupDate.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" })}</span>
                        {isOverdue && <ShieldAlert className="w-4 h-4" />}
                      </div>
                      <div className="flex flex-col gap-2 p-3 overflow-y-auto max-h-[250px]">
                        {items.map(item => (
                          <div key={item.id} onClick={() => setSelectedExpense(item)}
                            className="bg-gray-50 border border-gray-200 rounded-lg flex flex-col p-2 space-y-1 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-all">
                            <span className="text-xs font-bold text-gray-700 uppercase truncate">{item.supplier_name}</span>
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-mono text-gray-400">{item.type}</span>
                              <span className="text-sm font-mono font-bold text-indigo-600">{fmt(item.balance_cents)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Tabs.Content>

        {/* TAB: PASIVOS RECURRENTES */}
        <Tabs.Content value="recurrentes" className="animate-in fade-in duration-300 outline-none">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { title: "Impuestos", items: [{ label: "IVA", type: "TAXES" as const }, { label: "Ingresos Brutos", type: "TAXES" as const }, { label: "Autónomos", type: "TAXES" as const }, { label: "Honorarios Contador", type: "VARIABLE" as const }] },
              { title: "Gastos Fijos", items: [{ label: "Internet", type: "FIXED" as const }, { label: "Luz", type: "FIXED" as const }, { label: "Gas", type: "FIXED" as const }, { label: "Agua", type: "FIXED" as const }, { label: "Alquiler", type: "FIXED" as const }, { label: "Plataforma Loveat", type: "FIXED" as const }] },
            ].map((section) => (
              <div key={section.title} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-xs font-bold text-gray-600 uppercase tracking-widest">{section.title}</h3>
                </div>
                <div className="p-4 flex flex-col gap-2">
                  {section.items.map((item) => (
                    <div key={item.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-indigo-300 transition-colors group">
                      <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">{item.label}</span>
                      <button type="button" onClick={() => {
                        ingestForm.setValue("expense_type", item.type);
                        ingestForm.setValue("reference_id", item.label);
                        setIngestTab("manual"); setActiveTab("ingesta");
                      }} className="text-xs font-bold text-indigo-600 border border-indigo-200 hover:bg-indigo-50 px-3 py-1.5 rounded transition-colors flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Cargar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Tabs.Content>
      </Tabs.Root>

      {/* ────── SLIDE-OVER DRILL DOWN ────── */}
      <Dialog.Root open={selectedExpense !== null} onOpenChange={(open) => !open && setSelectedExpense(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 animate-in fade-in" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white border border-gray-200 text-gray-900 shadow-2xl z-50 flex flex-col animate-in fade-in zoom-in-95 duration-300 overflow-y-auto rounded-2xl max-h-[90vh]">
            {selectedExpense && (
              <>
                <div className="flex justify-between items-start border-b border-gray-200 p-6 sticky top-0 bg-white z-10">
                  <div>
                    <Dialog.Title className="text-xl font-bold tracking-tight text-gray-900">
                      <Link href="/dashboard/supply?tab=proveedores" className="hover:text-indigo-600 hover:underline transition-colors">{selectedExpense.supplier_name}</Link>
                    </Dialog.Title>
                    <Dialog.Description className="text-sm font-mono text-gray-500 mt-1">
                      Categoría: <span className="text-indigo-600 font-semibold">{selectedExpense.type}</span> | Vence: {(() => {
                        const rawDate = selectedExpense.due_date || "";
                        if (!rawDate || rawDate.includes("1970")) return "Sin fecha";
                        const r = rawDate.includes("T") ? rawDate.split("T")[0] : rawDate;
                        const [yr, mo, dy] = r.split("-");
                        const dt = new Date(Number(yr), Number(mo) - 1, Number(dy));
                        return isNaN(dt.getTime()) ? "Sin fecha" : dt.toLocaleDateString("es-AR");
                      })()}
                    </Dialog.Description>
                  </div>
                  <button onClick={() => setSelectedExpense(null)} className="text-gray-400 hover:text-gray-600 transition-colors bg-gray-100 p-2 rounded-full">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 flex flex-col gap-6 flex-1">
                  {/* Financial Summary */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col justify-center">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Neto</p>
                      <p className="text-base font-mono font-bold text-gray-800">${((selectedExpense.amount_cents * 0.79) / 100).toFixed(2)}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col justify-center">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">IVA</p>
                      <p className="text-base font-mono font-bold text-gray-800">${((selectedExpense.amount_cents * 0.21) / 100).toFixed(2)}</p>
                    </div>
                    <div className="bg-indigo-50 p-4 rounded-xl border-2 border-indigo-200 flex flex-col justify-center">
                      <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest mb-1">Total Bruto</p>
                      <p className="text-lg font-mono font-bold text-indigo-600">{fmt(selectedExpense.amount_cents)}</p>
                    </div>
                  </div>

                  {/* Saldo Pendiente */}
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Saldo Pendiente</span>
                    <span className={`text-xl font-mono font-bold ${selectedExpense.balance_cents > 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {fmt(selectedExpense.balance_cents)}
                    </span>
                  </div>

                  {/* Line Items Drill-Down */}
                  <div className="flex flex-col gap-2">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Motor de Partidas</h4>
                    {!selectedExpense.line_items || selectedExpense.line_items.length === 0 ? (
                      <p className="text-gray-400 text-sm italic py-6 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">No hay detalle de partidas</p>
                    ) : (
                      <div className="flex flex-col gap-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
                        <div className="grid grid-cols-[1fr_60px_80px_90px] gap-2 px-2 pb-2 border-b border-gray-200 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                          <span>Concepto</span><span className="text-center">Cant.</span><span className="text-right">Unitario</span><span className="text-right">Subtotal</span>
                        </div>
                        {selectedExpense.line_items.map((li, i) => (
                          <div key={i} className="grid grid-cols-[1fr_60px_80px_90px] gap-2 items-center bg-white p-2.5 rounded border border-gray-200 hover:border-indigo-300 transition-colors">
                            <span className="text-sm truncate text-gray-700" title={li.name}>{li.name}</span>
                            <span className="text-sm font-mono text-center text-gray-500">{li.quantity}</span>
                            <span className="text-sm font-mono text-right text-gray-500">${(li.unit_price_cents / 100).toFixed(2)}</span>
                            <span className="text-sm font-mono text-right font-bold text-indigo-600">${(li.total_cents / 100).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Invoice Number */}
                  {selectedExpense.invoice_number && (
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-center gap-3">
                      <ExternalLink className="w-4 h-4 text-indigo-500" />
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Referencia Documental</p>
                        <p className="text-sm font-mono text-gray-700">{selectedExpense.invoice_number}</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
