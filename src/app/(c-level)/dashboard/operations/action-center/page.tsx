"use client";

import {
  ActivitySquare,
  ArrowRight,
  Bot,
  CheckCircle2,
  Database,
  MessageSquare,
  RefreshCw,
  ServerCrash,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function ActionCenterPage() {
  const [queueMetrics, setQueueMetrics] = useState({
    depth: 0,
    dlqDepth: 0,
    velocity_per_minute: 0,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchMetrics = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/metrics/queue");
      if (res.ok) {
        const data = await res.json();
        setQueueMetrics(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, []);

  const queueIsBusy = queueMetrics.depth > 0;

  return (
    <div className="p-6 md:p-10 space-y-8 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex justify-between items-end border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 text-slate-900 tracking-tight">
            <ActivitySquare className="text-blue-600" /> Action Center
          </h1>
          <p className="text-slate-500 mt-2 text-sm">
            Monitoreo y ejecución de flujos activos de Agentes Inteligentes.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-md border border-emerald-200 shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          3 Agentes Activos
        </div>
      </div>

      {/* BENTO GRID DE AGENTES */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        {/* NEW WIDGET: ASYNC BURST MONITOR */}
        <div className="md:col-span-6 glass-panel p-8 bg-[var(--bg-elevated)] flex flex-col md:flex-row justify-between items-start md:items-center relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <ActivitySquare size={120} className="text-blue-900" />
          </div>

          <div className="relative z-10 max-w-lg mb-6 md:mb-0">
            <h2 className="text-xl font-bold uppercase tracking-widest flex items-center gap-3 mb-2 text-slate-900">
              Monitor de Tráfico Asíncrono
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed mb-4">
              Protección de la Base de Datos contra picos nocturnos (Absorción de Ráfagas / Upstash
              Redis Queue). Los webhooks encolan aquí, y el Consumer procesa la carga gradualmente.
            </p>
            <div className="flex gap-2">
              <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 flex items-center rounded-md border border-slate-200">
                Worker: api/webhooks/worker (QStash)
              </span>
            </div>
          </div>

          <div className="relative z-10 flex gap-4 w-full md:w-auto">
            {/* Queue Depth Stat */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex-1 min-w-[140px]">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                En Cola (Redis)
              </p>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-3xl font-black ${queueIsBusy ? "text-amber-500" : "text-slate-900"}`}
                >
                  {queueMetrics.depth}
                </span>
                {queueIsBusy ? (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                ) : (
                  <CheckCircle2 size={16} className="text-emerald-500" />
                )}
              </div>
            </div>

            {/* Velocity Stat */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex-1 min-w-[140px]">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex justify-between items-center">
                Velocidad
                <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} />
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-blue-600">
                  {queueMetrics.velocity_per_minute}
                </span>
                <span className="text-xs font-bold text-slate-500">/ min</span>
              </div>
            </div>

            {/* DLQ Stat */}
            <div
              className={`border rounded-xl p-4 flex-1 min-w-[140px] ${queueMetrics.dlqDepth > 0 ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}`}
            >
              <p
                className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${queueMetrics.dlqDepth > 0 ? "text-red-600" : "text-slate-400"}`}
              >
                Dead Letter Queue
              </p>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-3xl font-black ${queueMetrics.dlqDepth > 0 ? "text-red-600" : "text-slate-900"}`}
                >
                  {queueMetrics.dlqDepth}
                </span>
                {queueMetrics.dlqDepth > 0 && <ServerCrash size={16} className="text-red-600" />}
              </div>
            </div>
          </div>
        </div>

        {/* CARD 1: AGENTE TRADUCTOR */}
        <Link
          href="/dashboard/ingest"
          className="md:col-span-3 group relative overflow-hidden bg-[var(--bg-elevated)] p-6 rounded-2xl border border-slate-200 hover:shadow-md transition-all hover:border-blue-400"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Bot size={120} className="text-blue-900" />
          </div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="h-12 w-12 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-center text-blue-600 mb-4 shadow-sm group-hover:scale-110 transition-transform">
              <MessageSquare size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Agente Traductor de Inventario</h3>
            <p className="text-slate-500 mt-2 max-w-md text-sm leading-relaxed">
              Intermediario LLM. Procesa notas de voz y texto para estructurar stock físico.
            </p>
          </div>
        </Link>

        {/* CARD 2: POS LINK */}
        <Link
          href="/dashboard/sales"
          className="md:col-span-3 bg-[var(--bg-elevated)] p-6 rounded-2xl border border-slate-200 hover:shadow-md transition-all hover:border-purple-400 group flex flex-col"
        >
          <div className="h-12 w-12 bg-purple-50 rounded-xl border border-purple-100 flex items-center justify-center text-purple-600 mb-4 shadow-sm group-hover:scale-110 transition-transform">
            <Database size={24} />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Inyector de POS (Ventas)</h3>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed flex-1">
            Sincronización del sistema fiscal para deducir teóricos automáticos.
          </p>
        </Link>
      </div>
    </div>
  );
}
