import { GlassCard } from "@/components/ui/AntigravityAtoms";
import { db } from "@/db";
import { ai_audit_logs } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { desc } from "drizzle-orm";
import { Cpu, Lock, Network, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { v4 as uuidv4 } from "uuid";

/**
 * Server Component Asíncrono - Carga diferida
 */
async function AIAuditLedgerContent() {
  const session = await getSession();
  if (!session) return null;

  const logs = await db
    .select()
    .from(ai_audit_logs)
    .orderBy(desc(ai_audit_logs.createdAt))
    .limit(100);

  const totalActions = logs.length;
  const rejections = logs.filter((l) => l.status.startsWith("REJECTED")).length;
  const rejectionRate = totalActions > 0 ? ((rejections / totalActions) * 100).toFixed(1) : "0";

  const handleSeed = async () => {
    "use server";
    const storeId = session.user.storeId;
    await db.insert(ai_audit_logs).values([
      {
        id: uuidv4(),
        agentName: "GEMINI_INVOICE_OCR",
        action: "EXTRACT_INVOICE_DATA",
        status: "APPROVED",
        payloadRef: '{"providerName":"Distribuidora X","totalAmount":45000}',
        zodSchemaUsed: "Factura Gastronómica",
        storeId,
      },
      {
        id: uuidv4(),
        agentName: "GEMINI_INVOICE_OCR",
        action: "EXTRACT_INVOICE_DATA",
        status: "REJECTED_BY_GUARDRAIL",
        rejectionReason: "zod.error: totalAmount is missing",
        zodSchemaUsed: "Factura Gastronómica",
        storeId,
      },
      {
        id: uuidv4(),
        agentName: "QSTASH_WORKER",
        action: "SYNC_SHEETS",
        status: "APPROVED",
        payloadRef: '{"rows":120,"parsed":true}',
        zodSchemaUsed: "SheetRowValidator",
        storeId,
      },
      {
        id: uuidv4(),
        agentName: "COST_PROPAGATOR",
        action: "BFS_PRICE_UPDATE",
        status: "REJECTED_BY_RBAC",
        rejectionReason: "KITCHEN role cannot mutate global prices",
        zodSchemaUsed: "ActionContext",
        storeId,
      },
      {
        id: uuidv4(),
        agentName: "GEMINI_INVOICE_OCR",
        action: "EXTRACT_INVOICE_DATA",
        status: "APPROVED",
        payloadRef: '{"providerName":"Lácteos Y","totalAmount":8500}',
        zodSchemaUsed: "Factura Gastronómica",
        storeId,
      },
    ]);

    revalidatePath("/dashboard/operations/ai-audit");
  };

  return (
    <div className="space-y-8 animate-in fade-in zoom-in duration-500">
      {/* Seed Actions - Movido dentro del contexto de datos */}
      {logs.length === 0 && (
        <div className="flex justify-end mb-4">
          <form action={handleSeed}>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-3 bg-brand text-white font-black uppercase text-xs tracking-widest rounded-xl hover:bg-orange-600 transition-colors shadow-black/10 shadow-lg"
            >
              <RefreshCw size={16} /> Seed AI Logs
            </button>
          </form>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="p-6 relative overflow-hidden group border-t-4 border-t-slate-800">
          <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:scale-110 transition-transform duration-500">
            <Network size={150} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
            Peticiones Interceptadas
          </p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-4xl font-black text-slate-800 tracking-tighter">{totalActions}</h2>
          </div>
          <p className="text-xs font-bold text-slate-500 mt-2">Últimos 100 registros</p>
        </GlassCard>

        <GlassCard className="p-6 relative overflow-hidden group border-t-4 border-t-red-500">
          <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:scale-110 transition-transform duration-500">
            <ShieldAlert size={150} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
            Bloqueos por Guardarraíl
          </p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-4xl font-black text-red-600 tracking-tighter">{rejections}</h2>
          </div>
          <p className="text-xs font-bold text-red-400/80 mt-2">
            Tasa de rechazo: {rejectionRate}%
          </p>
        </GlassCard>

        <GlassCard className="p-6 relative overflow-hidden group border-t-4 border-t-emerald-500">
          <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:scale-110 transition-transform duration-500">
            <ShieldCheck size={150} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
            Políticas Evaluadas
          </p>
          <div className="flex flex-col gap-1 mt-2">
            <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded inline-block w-fit">
              RBAC Strict Mode
            </span>
            <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded inline-block w-fit">
              Zod Grammar Constrained
            </span>
          </div>
        </GlassCard>
      </div>

      {/* Inmutable Ledger */}
      <GlassCard className="p-1">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50 rounded-t-2xl">
          <Lock className="text-slate-900" size={20} />
          <h3 className="text-lg font-black text-ink-900 uppercase italic tracking-tight">
            Registro de Auditoría
          </h3>
        </div>

        {logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest text-sm">
            No hay decisiones de IA registradas aún.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--bg-elevated)] uppercase text-[10px] text-slate-400 font-black tracking-widest">
                  <th className="p-4 border-b border-slate-100">Timestamp</th>
                  <th className="p-4 border-b border-slate-100">Agente</th>
                  <th className="p-4 border-b border-slate-100">Acción</th>
                  <th className="p-4 border-b border-slate-100">Estado PEP</th>
                  <th className="p-4 border-b border-slate-100 w-1/3">Justificación / Error</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="p-4 text-xs font-bold text-slate-500">
                      {new Date(log.createdAt || "").toLocaleString()}
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2 py-1 rounded uppercase tracking-wider">
                        {log.agentName}
                      </span>
                    </td>
                    <td className="p-4 text-xs font-bold text-slate-700">{log.action}</td>
                    <td className="p-4">
                      <span
                        className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${
                          log.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {log.status.replace("REJECTED_BY_", "BLOCKED: ")}
                      </span>
                    </td>
                    <td
                      className="p-4 text-xs font-medium text-slate-600 font-mono truncate max-w-xs"
                      title={log.rejectionReason || log.payloadRef || "OK"}
                    >
                      {log.rejectionReason ? (
                        <span className="text-red-600">{log.rejectionReason}</span>
                      ) : (
                        <span className="text-emerald-600 line-clamp-2">{log.payloadRef}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function AuditSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 bg-slate-100 rounded-2xl border border-slate-200" />
        ))}
      </div>
      <div className="h-96 bg-slate-100 rounded-2xl border border-slate-200" />
    </div>
  );
}

export default async function AIAuditLedgerPage() {
  // 1. Verificación sincrónica instantánea
  const session = await getSession();
  if (!session || !["OWNER_GLOBAL", "MANAGER"].includes(session.user.role)) {
    redirect("/login");
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header Módulo Inmediato (0ms RSC Response) */}
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-black text-ink-900 tracking-tighter italic uppercase flex items-center gap-2">
            <Cpu className="text-brand" size={28} />
            Ledger de Decisiones IA
          </h1>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-2 flex items-center gap-1">
            <Lock size={14} /> Agentic Gateway & Guardarraíles
          </p>
        </div>
      </header>

      {/* Boundary Suspense para consultas lentas */}
      <Suspense fallback={<AuditSkeleton />}>
        <AIAuditLedgerContent />
      </Suspense>
    </div>
  );
}
