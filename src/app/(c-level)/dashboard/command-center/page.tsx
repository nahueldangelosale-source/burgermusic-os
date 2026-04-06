import { db } from "@/db";
import { fact_sales, agenda_items, products } from "@/db/schema";
import { sql, desc, eq } from "drizzle-orm";
import { AITelemetryWidget } from "./components/AITelemetryWidget";
import { DrillDownCard } from "./components/DrillDownCard";
import { TacticalAgenda } from "./components/TacticalAgenda";
import { NotificationHub } from "./components/NotificationHub";
import Link from "next/link";
import { 
  CircleDollarSign, 
  TrendingUp, 
  ActivitySquare, 
  CreditCard, 
  PackageMinus, 
  Skull,
  ArrowRight,
  Server,
  Beef,
  Flame
} from "lucide-react";

export const dynamic = "force-dynamic";

async function getTacticalTelemetry() {
  const [salesResult] = await Promise.all([
    db.select({
      last30DaysRevenueCents: sql<number>`SUM(CASE WHEN ${fact_sales.createdAt} >= datetime('now', '-30 days') THEN ${fact_sales.net_price_cents} ELSE 0 END)`,
      last30DaysCostCents: sql<number>`SUM(CASE WHEN ${fact_sales.createdAt} >= datetime('now', '-30 days') THEN ${fact_sales.historical_cost_cents} ELSE 0 END)`,
    }).from(fact_sales)
  ]);

  const row = salesResult[0];
  const revenueVal = (row?.last30DaysRevenueCents || 0) / 100;
  
  const costCalculated = (row?.last30DaysCostCents || 0) / 100;
  let grossMargin = 0;
  
  if (revenueVal > 0) {
    const finalCost = costCalculated > 0 ? costCalculated : (revenueVal * 0.35); 
    grossMargin = ((revenueVal - finalCost) / revenueVal) * 100;
  }

  return {
    revenue30d: revenueVal,
    grossMargin: grossMargin
  };
}

// MOTOR ESCALAR BOM: BURN RATE
async function getScalarBomTelemetry() {
  const result = await db.select({
    medallionUnits: sql<number>`SUM(
      CASE 
        WHEN ${products.name} LIKE '%TRIPLE%' THEN ${fact_sales.quantity} * 3
        WHEN ${products.name} LIKE '%DOBLE%' THEN ${fact_sales.quantity} * 2
        WHEN ${products.name} LIKE '%COMBO%' OR ${products.name} LIKE '%BURGER%' THEN ${fact_sales.quantity} * 1
        ELSE 0 
      END
    )`
  })
  .from(fact_sales)
  .leftJoin(products, eq(fact_sales.productSku, products.id))
  .where(sql`${fact_sales.createdAt} >= datetime('now', '-30 days')`);

  const meds = result[0]?.medallionUnits || 0;
  
  return { 
    medallions: meds, 
    cheese: meds * 2 // Ley termodinámica base BurgerMusic (2 fetas por medallón)
  };
}

export default async function CommandCenterPage() {
  const [telemetry, scalarBom, agendaList] = await Promise.all([
    getTacticalTelemetry(),
    getScalarBomTelemetry(),
    db.select().from(agenda_items).orderBy(desc(agenda_items.createdAt)).limit(30)
  ]);

  // Nodos Estratégicos (Multi-Tenant)
  const networkNodes = [
    { name: "BurgerMusic Lanús", status: "ONLINE" },
    { name: "BurgerMusic Avellaneda", status: "ONLINE" },
    { name: "Pizza Music Lanús", status: "ONLINE" }
  ];

  // MOCKS TIPADOS DUROS - Alertas
  type ApDebtType = { supplier: string; debtArs: number; dueDays: number; status: "OVERDUE" | "PENDING" };
  const mockApDebt: ApDebtType[] = [
    { supplier: "Pan Bimbo Litoral", debtArs: 250000, dueDays: -2, status: "OVERDUE" },
    { supplier: "Carnes La Pampa SA", debtArs: 1540000, dueDays: 5, status: "PENDING" },
  ];

  type CriticalStockType = { sku: string; stock: number; unit: string; burnRate: string };
  const mockCriticalStock: CriticalStockType[] = [
    { sku: "CHEDDAR-01", stock: 2.5, unit: "KG", burnRate: "1.2/día" },
    { sku: "PAN-PAPAS", stock: 12, unit: "UN", burnRate: "4/hora" },
  ];

  type FallenMenuType = { itemName: string; timeDown: string; reason: string };
  const mock86dItems: FallenMenuType[] = [
    { itemName: "Combo Triple Bacon", timeDown: "4h 12m", reason: "Sin Panceta Ahumada" }
  ];

  return (
    <main className="min-h-screen bg-slate-50 p-6 lg:p-10 font-sans text-slate-900 pb-20">
      
      {/* HEADER LUXURY */}
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-slate-200/80 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">
            Command Center
          </h1>
          <p className="text-slate-500 text-sm mt-1.5 font-medium">C-Level Telemetry Grid • Inteligencia Operativa Activa</p>
        </div>
        <div className="flex gap-3">
           <AITelemetryWidget />
           <div className="bg-white border border-slate-200 px-4 py-2.5 flex items-center gap-3 rounded-xl shadow-sm text-sm font-semibold text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            LIVE LINK
          </div>
        </div>
      </header>

      {/* BENTO GRID SUPERIOR: 3 KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        
        {/* KPI 1: Ventas */}
        <Link href="/dashboard/sales" className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 transition-all duration-200 hover:shadow-md hover:border-indigo-200 cursor-pointer block group relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <CircleDollarSign size={80} />
          </div>
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl relative z-10">
              <CircleDollarSign size={24} />
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors relative z-10">
              <ArrowRight size={18} />
            </div>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 relative z-10">Flujo de Caja (30D)</p>
          <p className="text-4xl font-extrabold text-slate-800 tracking-tight relative z-10">${telemetry.revenue30d.toLocaleString('es-AR')}</p>
        </Link>
        
        {/* KPI 2: Margen */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <TrendingUp size={80} />
          </div>
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp size={24} />
            </div>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 relative z-10">Rest Margin (Est)</p>
          <div className="flex items-end gap-3 relative z-10">
            <p className="text-4xl font-extrabold text-slate-800 tracking-tight">{telemetry.grossMargin.toFixed(1)}%</p>
            <div className={`text-xs font-bold px-2 py-1 rounded-md mb-1.5 ${telemetry.grossMargin >= 45 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {telemetry.grossMargin >= 45 ? 'SANO' : 'RIESGO'}
            </div>
          </div>
        </div>
        
        {/* KPI 3: Status Multi-Tenant Nodos */}
        <div className="bg-slate-900 rounded-2xl shadow-md border border-slate-800 p-6 text-white relative">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 bg-white/10 text-white rounded-xl backdrop-blur-sm">
              <Server size={20} />
            </div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-2">Salud de Red (Nodes)</p>
          </div>
          
          <div className="space-y-3 mt-4">
            {networkNodes.map((node, i) => (
              <div key={i} className="flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/5 hover:bg-white/10 transition-colors">
                <span className="text-sm font-medium text-slate-200">{node.name}</span>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]"></span>
                  <span className="text-[10px] font-bold text-emerald-400 tracking-widest">{node.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MIDDLE GRID: CONSOLIDATION & SCALAR BOM */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        
        {/* Columna 1: Alertas Críticas (Consolidadas) */}
        <div className="xl:col-span-1 flex flex-col gap-4">
          <h3 className="font-bold text-slate-800 tracking-tight uppercase text-xs text-slate-500 mb-2">Monitor de Amenazas</h3>
          
          <DrillDownCard 
            title="AP Debt (Vencimiento)" icon={<CreditCard size={18} />} iconColorClass="bg-amber-50 text-amber-600"
            summaryText={<span className="text-amber-600 font-semibold text-xs">{mockApDebt.filter(d => d.dueDays < 0).length} Vencidos</span>}
          >
             <div className="space-y-3">
              {mockApDebt.map((debt, idx) => (
                <div key={idx} className="flex justify-between items-start border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                  <div>
                    <p className="text-slate-800 font-medium text-xs">{debt.supplier}</p>
                    <p className={`text-[10px] mt-0.5 font-bold ${debt.dueDays < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                      {debt.dueDays < 0 ? `Vencido (${Math.abs(debt.dueDays)} d)` : `Vence: ${debt.dueDays} d`}
                    </p>
                  </div>
                  <p className="text-xs font-bold text-slate-800">${debt.debtArs.toLocaleString('es-AR')}</p>
                </div>
              ))}
            </div>
          </DrillDownCard>

          <DrillDownCard 
            title="Stock Crítico" icon={<PackageMinus size={18} />} iconColorClass="bg-red-50 text-red-600"
            summaryText={<span className="text-red-600 font-semibold text-xs">{mockCriticalStock.length} Quiebres</span>} linkUrl="/dashboard/supply"
          >
            <div className="space-y-3">
              {mockCriticalStock.map((stock, idx) => (
                <div key={idx} className="flex justify-between items-center border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                   <div>
                    <p className="text-slate-800 font-medium text-xs">{stock.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{stock.stock} {stock.unit}</p>
                  </div>
                </div>
              ))}
            </div>
          </DrillDownCard>

           <DrillDownCard 
            title="86'd Items Menu" icon={<Skull size={18} />} iconColorClass="bg-purple-50 text-purple-600"
            summaryText={<span className="text-purple-600 font-semibold text-xs">{mock86dItems.length} Caídos</span>} linkUrl="/dashboard/supply"
           >
             <div className="space-y-3">
              {mock86dItems.map((item, idx) => (
                <div key={idx} className="flex flex-col border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                  <div className="flex justify-between items-center">
                    <p className="text-slate-800 font-semibold text-xs line-through decoration-red-400">{item.itemName}</p>
                    <p className="text-[9px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-full">{item.timeDown}</p>
                  </div>
                </div>
              ))}
            </div>
           </DrillDownCard>
        </div>

        {/* Columna 2 y 3: Motor Escalar Burn Rate */}
        <div className="xl:col-span-2 flex flex-col">
          <h3 className="font-bold text-slate-800 tracking-tight uppercase text-xs text-slate-500 mb-2">Motor Escalar BOM (Consumo O(1) Nucleos 30D)</h3>
          
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-center h-full gap-8 relative overflow-hidden">
            <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none">
               <Flame size={250} />
            </div>

            {/* Insumo 1 */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><Beef size={20} /></div>
                <h4 className="text-lg font-bold text-slate-800 tracking-tight">Medallones de Carne Acumulados</h4>
              </div>
              <div className="flex items-end gap-4 ml-12">
                 <p className="text-5xl font-black text-slate-900 tracking-tighter">
                   {scalarBom.medallions.toLocaleString('es-AR')} <span className="text-lg text-slate-400 font-bold ml-1 tracking-normal">UM</span>
                 </p>
                 <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2 py-1 rounded-md mb-2">ALTA ROTACIÓN</span>
              </div>
              <p className="ml-12 mt-2 text-xs text-slate-500 font-medium">Extraído vía Motor Escalar Drizzle (Suma agregada de Single/Doble/Triple).</p>
            </div>

            <div className="h-px w-full bg-slate-100"></div>

            {/* Insumo 2 */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-50 text-amber-500 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg></div>
                <h4 className="text-lg font-bold text-slate-800 tracking-tight">Fetas de Queso (Base)</h4>
              </div>
              <div className="flex items-end gap-4 ml-12">
                 <p className="text-5xl font-black text-slate-900 tracking-tighter">
                   {scalarBom.cheese.toLocaleString('es-AR')} <span className="text-lg text-slate-400 font-bold ml-1 tracking-normal">UM</span>
                 </p>
                 <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded-md mb-2">THERMO-CORRELATED</span>
              </div>
              <p className="ml-12 mt-2 text-xs text-slate-500 font-medium">Asunción termodinámica del ecosistema (2 FETAS per Medallón).</p>
            </div>

          </div>
        </div>

      </div>

      {/* WORKSPACE ACTIVO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-[450px]">
          <NotificationHub />
        </div>
        <div className="h-[450px]">
          <TacticalAgenda items={agendaList} />
        </div>
      </div>

    </main>
  );
}
