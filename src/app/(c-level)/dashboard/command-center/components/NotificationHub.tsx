import { db } from "@/db";
import { zombie_shift_audits } from "@/db/schema/finance";
import { products, sales_mapping_dlq } from "@/db/schema";
import { eq, sql, and, or, isNull } from "drizzle-orm";
import { Bell, AlertCircle, AlertTriangle, Info, Clock, CheckCircle2, ShieldCheck } from "lucide-react";

type AlertEntry = {
  id: string;
  type: "CRITICAL" | "WARNING" | "INFO";
  title: string;
  time: string;
  urgent: boolean;
};

async function getSystemAlerts(): Promise<AlertEntry[]> {
  const alerts: AlertEntry[] = [];

  try {
    const [pendingZombies, zeroCostProducts, dlqAnomalies] = await Promise.all([
      // 1. Zombie Shift Audits PENDIENTES (🔴 CRÍTICO)
      db.select({
        id: zombie_shift_audits.id,
        targetDate: zombie_shift_audits.target_date,
        marginPercent: zombie_shift_audits.reported_margin_percent,
        createdAt: zombie_shift_audits.created_at,
      })
      .from(zombie_shift_audits)
      .where(eq(zombie_shift_audits.status, "PENDING"))
      .limit(5),

      // 2. Productos con Costo 0 / NULL (🟡 ADVERTENCIA BOM)
      db.select({
        id: products.id,
        name: products.name,
        costCents: products.costCents,
      })
      .from(products)
      .where(
        and(
          eq(products.isSaleable, true),
          isNull(products.deletedAt),
          or(eq(products.costCents, 0), isNull(products.costCents))
        )
      )
      .limit(5),

      // 3. DLQ Anomalías No Resueltas (🔵 INFO)
      db.select({
        total: sql<number>`COUNT(*)`,
      })
      .from(sales_mapping_dlq)
      .where(eq(sales_mapping_dlq.resolved, false)),
    ]);

    // Mapeo de Zombie Audits
    for (const z of pendingZombies) {
      alerts.push({
        id: `zombie-${z.id}`,
        type: "CRITICAL",
        title: `Auditoría Zombie pendiente: Margen ${(z.marginPercent / 100).toFixed(1)}% el ${z.targetDate}`,
        time: z.createdAt || "Reciente",
        urgent: true,
      });
    }

    // Mapeo de Productos sin Costo
    for (const p of zeroCostProducts) {
      alerts.push({
        id: `bom-${p.id}`,
        type: "WARNING",
        title: `SKU "${p.name}" sin costo BOM asignado ($0). Margen inválido.`,
        time: "Persistente",
        urgent: true,
      });
    }

    // Mapeo de DLQ
    const dlqCount = dlqAnomalies[0]?.total || 0;
    if (dlqCount > 0) {
      alerts.push({
        id: "dlq-summary",
        type: "INFO",
        title: `${dlqCount} registro(s) sin mapear en la Bandeja de Orfandad (DLQ).`,
        time: "Acumulado",
        urgent: false,
      });
    }
  } catch (err) {
    console.error("[NOTIFICATION_HUB_ERROR]", err);
    alerts.push({
      id: "system-error",
      type: "CRITICAL",
      title: "Error al consultar las métricas del sistema. Verificar conexión Turso.",
      time: "Ahora",
      urgent: true,
    });
  }

  return alerts;
}

export async function NotificationHub() {
  const alerts = await getSystemAlerts();

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col h-full font-sans">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-white/50 shadow-sm">
            <Bell size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">Notification Hub</h2>
            <p className="text-xs text-slate-500 font-medium font-mono uppercase">Sentinel Alerts O(1)</p>
          </div>
        </div>
        {alerts.length > 0 && (
          <span className="text-xs font-bold bg-red-50 border border-red-100 text-red-600 px-2.5 py-1 rounded-full">
            {alerts.length}
          </span>
        )}
      </div>

      {/* ESTADO ZERO-ENTROPY */}
      {alerts.length === 0 ? (
        <div className="flex-grow flex flex-col items-center justify-center p-8 bg-emerald-50/50 rounded-xl border border-dashed border-emerald-300">
          <div className="bg-white p-3 rounded-full shadow-sm max-w-fit mx-auto mb-4 border border-emerald-100">
            <ShieldCheck size={28} className="text-emerald-500" />
          </div>
          <p className="font-bold text-emerald-800 tracking-tight text-center">ZERO-ENTROPY</p>
          <p className="text-emerald-600 text-sm text-center mt-1.5 max-w-xs mx-auto leading-snug">
            Todos los sistemas operativos. P&L auditado y BOM reconciliado.
          </p>
        </div>
      ) : (
        <div className="flex-grow overflow-y-auto pr-2 space-y-3 max-h-80 custom-scrollbar">
          {alerts.map(alert => (
            <div key={alert.id} className="group flex gap-3 p-3 bg-white hover:bg-slate-50 rounded-xl transition-colors border border-slate-100 hover:border-slate-200 shadow-sm">
              <div className="flex-shrink-0 mt-0.5">
                {alert.type === 'CRITICAL' && <div className="p-1.5 bg-red-50 text-red-500 rounded-lg"><AlertCircle size={16} /></div>}
                {alert.type === 'WARNING' && <div className="p-1.5 bg-amber-50 text-amber-500 rounded-lg"><AlertTriangle size={16} /></div>}
                {alert.type === 'INFO' && <div className="p-1.5 bg-indigo-50 text-indigo-500 rounded-lg"><Info size={16} /></div>}
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-semibold leading-snug mb-1.5 ${alert.urgent ? 'text-slate-800' : 'text-slate-600'}`}>
                  {alert.title}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <Clock size={10} className="text-slate-300" />
                  {alert.time}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 10px;
        }
      `}} />
    </div>
  );
}
