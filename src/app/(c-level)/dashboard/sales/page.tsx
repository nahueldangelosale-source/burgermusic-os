import { Suspense } from "react";
import { DateSelector } from "./DateSelector";
import { 
  VentasBrutas, 
  VentasNetas, 
  TicketPromedio, 
  TemporalEvolutionChart, 
  ChannelDonutChart, 
  TopProductsVirtualTable 
} from "./client-components";
import { 
  getTopLineMetrics, 
  getTemporalEvolution, 
  getChannelDistribution, 
  getTopProducts 
} from "./data-fetchers";
import { AirlockOperativo } from "./IngestionAirlocks";
import { db } from "@/db";
import { isNull, sql, asc } from "drizzle-orm";
import OrphanageTray from "@/components/sales/OrphanageTray";
import { sales_mapping_dlq, products } from "@/db/schema";

/**
 * [UX/UI] SALES CORTEX - PREMIUM LIGHT THEME
 * ──────────────────────────────────────────────────────────────
 * Estándar: BurgerMusic OS v4
 * Regla: Fondo Blanco (oklch), Aire, Contraste Suave.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

function TelemetryLoader() {
  return (
    <div className="h-full w-full bg-white rounded-[24px] border border-slate-100 shadow-sm flex flex-col items-center justify-center p-8">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-[3px] border-slate-100 border-t-indigo-500 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
        </div>
      </div>
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-6 animate-pulse">Sincronizando Pulso...</span>
    </div>
  );
}

export default async function SalesCortexPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const params = await searchParams;
  let resolvedDate = params?.date;
  
  const datesResult = await db.all(sql`SELECT DISTINCT date FROM fact_sales ORDER BY date DESC`);
  const availableDates = datesResult.map((r: any) => String(r.date)).filter((d: string) => d && d !== "null");

  if (!resolvedDate) {
    resolvedDate = availableDates.length > 0 ? availableDates[0] : new Date().toISOString().split("T")[0];
  }

  const metrics = await getTopLineMetrics(resolvedDate);
  const evolution = await getTemporalEvolution(resolvedDate);
  const channels = await getChannelDistribution();
  const topProductsList = await getTopProducts();

  // 1. Fuerza Bruta DLQ Extracción (Sin filtro StoreId)
  const dlqRows = await db
    .select({ raw_name: sales_mapping_dlq.raw_name })
    .from(sales_mapping_dlq)
    .where(sql`resolved = 0 OR resolved IS FALSE`);

  // 2. Coerción Termodinámica de Tipos
  const uniqueOrphans = [...new Set(dlqRows.map(r => r.raw_name))].filter(Boolean) as string[];

  // 3. Catálogo para Mapeo
  const catalog = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(isNull(products.deletedAt))
    .orderBy(asc(products.name));

  const isDataEmpty = metrics.gross === 0 && metrics.avgTicket === 0;

  return (
    <div className="bg-[oklch(0.98_0.01_250)] min-h-screen p-6 md:p-8 text-slate-900 font-sans selection:bg-indigo-500/10">
      {/* HEADER PREMIUM (ALIGNED WITH SUMINISTROS) */}
      <header className="mb-10 flex flex-col md:flex-row items-center justify-between gap-6 border-b border-slate-200 pb-8">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
             <div className="w-4 h-8 bg-indigo-500 rounded-sm inline-block shadow-sm shadow-indigo-500/20" />
             <h1 className="text-3xl font-bold tracking-tight text-slate-900 uppercase">Ventas Analytics</h1>
          </div>
          <p className="text-slate-500 font-bold text-sm mt-1 uppercase tracking-tighter">
             Inteligencia Comercial • Interfaz C-Level • {resolvedDate === "all" ? "AGGREGATE GLOBAL STATE" : `MODO: ${resolvedDate.endsWith('d') ? 'Análisis de Periodo' : 'Filtro Diario'}`}
          </p>
          <DateSelector currentDate={resolvedDate} availableDates={[]} />
        </div>
        <div className="flex flex-row gap-4 items-stretch">
          <AirlockOperativo />
        </div>
      </header>

      {/* ZERO-TRUST DETACHED AST FIX: ORPHANAGE TRAY C-LEVEL PORTAL */}
      <div className="mb-8 max-w-[1700px] mx-auto w-full">
        <OrphanageTray items={uniqueOrphans} catalog={catalog} />
      </div>

      {isDataEmpty ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] border border-red-100 rounded-[32px] bg-white shadow-sm p-16 animate-in fade-in zoom-in duration-700">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-[24px] flex items-center justify-center mb-8 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-4 tracking-tighter uppercase text-center">Estado Estéril</h2>
          <p className="text-slate-500 font-medium text-center max-w-sm text-sm">
            Estricta Directiva Zero-Trust. No hay datos transaccionales para {resolvedDate}.
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-12 gap-8 max-w-[1700px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-1000">
        {/* ÉPICA 1: KPIs LIGHT THEME */}
        <div className="col-span-12 lg:col-span-4 h-36">
          <Suspense fallback={<TelemetryLoader />}>
            <VentasBrutas data={metrics.gross} />
          </Suspense>
        </div>
        <div className="col-span-12 lg:col-span-4 h-36">
          <Suspense fallback={<TelemetryLoader />}>
            <VentasNetas data={metrics.net} />
          </Suspense>
        </div>
        <div className="col-span-12 lg:col-span-4 h-36">
          <Suspense fallback={<TelemetryLoader />}>
            <TicketPromedio data={metrics.avgTicket} />
          </Suspense>
        </div>

        {/* ÉPICA 2: EVO TEMPORAL Y CANALES */}
        <div className="col-span-12 lg:col-span-12 min-h-[400px] h-[400px]">
          <Suspense fallback={<TelemetryLoader />}>
            <TemporalEvolutionChart data={evolution} />
          </Suspense>
        </div>

        {/* ÉPICA 3: MDM RANKING */}
        <div className="col-span-12 h-[600px] mb-20">
          <Suspense fallback={<TelemetryLoader />}>
            <TopProductsVirtualTable data={topProductsList} />
          </Suspense>
        </div>
      </div>
      )}
    </div>
  );
}
