import { db } from "@/db";
import { ai_audit_logs } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { Activity } from "lucide-react";

export default async function BOMHistoryLog({ productId }: { productId: string }) {
  // Filtro Seguro In-Database explotando SQLite JSON Extraction nativo O(1)
  const rawLogs = await db
    .select()
    .from(ai_audit_logs)
    .where(
      and(
        eq(ai_audit_logs.action, "BOM_RECIPE_MUTATION"),
        sql`json_extract(${ai_audit_logs.payloadRef}, '$.productId') = ${productId}`,
      ),
    )
    .orderBy(desc(ai_audit_logs.createdAt));

  if (rawLogs.length === 0) return null;

  return (
    <div className="w-full mt-8 p-8 bg-gray-950/80 border border-gray-800 rounded-3xl relative overflow-hidden backdrop-blur-md">
      <div className="absolute left-10 top-20 bottom-16 w-px bg-gradient-to-b from-[var(--color-brand-600,#7c3aed)] via-gray-800 to-transparent"></div>

      <h3 className="text-xl font-black uppercase tracking-widest text-gray-300 mb-8 flex items-center gap-4">
        <Activity className="text-[var(--color-brand-500,#8b5cf6)]" /> Event Sourcing
      </h3>

      <div className="flex flex-col gap-8 relative z-10 w-full pl-2">
        {rawLogs.map((log) => {
          let evt;
          try {
            evt = JSON.parse(log.payloadRef || "{}");
          } catch (e) {
            return null;
          }

          // Formateo ISO 8601 Limpio
          const dateObj = new Date(evt.timestamp || log.createdAt);
          const cleanDate = isNaN(dateObj.getTime())
            ? log.createdAt
            : dateObj.toLocaleString("es-AR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });

          return (
            <div key={log.id} className="flex gap-6 items-start">
              <div className="mt-1.5 w-3.5 h-3.5 rounded-full bg-gray-900 border-2 border-[var(--color-brand-500,#8b5cf6)] shrink-0 shadow-[0_0_15px_var(--color-brand-500,#8b5cf6)]"></div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] uppercase tracking-widest text-[var(--color-brand-400,#a78bfa)] font-black font-mono mb-1.5 opacity-80">
                  {cleanDate}
                </div>
                <p className="text-sm text-gray-400 font-medium leading-relaxed">
                  Usuario{" "}
                  <span className="text-gray-100 font-black px-1.5 py-0.5 bg-gray-800 rounded">
                    {log.userId || "SYSTEM"}
                  </span>{" "}
                  ejecutó colisión en
                  <span className="text-[var(--color-brand-300,#c4b5fd)] font-mono mx-1.5">
                    {evt.ingredientId}
                  </span>{" "}
                  de
                  <span className="line-through decoration-red-500 mx-1.5">{evt.oldQty}</span> a
                  <span className="text-emerald-400 text-base font-black ml-1.5 px-2 py-0.5 bg-emerald-950/30 rounded border border-emerald-900">
                    {evt.newQty}
                  </span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
