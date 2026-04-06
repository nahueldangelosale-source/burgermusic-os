"use client";

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║    KARDEX TELEMETRY — Burn Rate Observability Component                    ║
 * ║    BurgerMusic OS v4.2 — Silent Luxury SaaS Aesthetic                     ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Renders a real-time telemetry grid for the Top 5 Critical Ingredients:
 *   - Medallón 110g, Pan Clásico, Cheddar Feta, Papas Fritas, Panceta Ahumada
 *
 * Each card shows: Current Balance, Burn Rate (90d), Autonomy Days, and a
 * visual severity indicator (GREEN → AMBER → RED).
 */

import { useState, useEffect, useTransition } from "react";
import {
  Activity,
  Flame,
  Shield,
  AlertTriangle,
  TrendingDown,
  RefreshCw,
  Beef,
  Wheat,
  Milk,
  Snowflake,
  Drumstick,
} from "lucide-react";
import type { IngredientTelemetry } from "@/actions/analytics-actions";

// ─────────────────────────────────────────────────────────────────────────────
// § TYPING & HELPERS
// ─────────────────────────────────────────────────────────────────────────────

type SeverityLevel = "NOMINAL" | "WARNING" | "CRITICAL";

function getSeverity(autonomyDays: number): SeverityLevel {
  if (autonomyDays <= 3) return "CRITICAL";
  if (autonomyDays <= 7) return "WARNING";
  return "NOMINAL";
}

function getSeverityStyles(severity: SeverityLevel) {
  switch (severity) {
    case "CRITICAL":
      return {
        border: "border-rose-200 dark:border-rose-500/30",
        bg: "bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/20 dark:to-slate-900",
        badge: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400",
        glow: "shadow-rose-100/50 dark:shadow-rose-500/10",
        indicator: "bg-rose-500",
        text: "text-rose-600 dark:text-rose-400",
      };
    case "WARNING":
      return {
        border: "border-amber-200 dark:border-amber-500/30",
        bg: "bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-slate-900",
        badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
        glow: "shadow-amber-100/50 dark:shadow-amber-500/10",
        indicator: "bg-amber-500",
        text: "text-amber-600 dark:text-amber-400",
      };
    default:
      return {
        border: "border-emerald-200 dark:border-emerald-500/30",
        bg: "bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/20 dark:to-slate-900",
        badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
        glow: "shadow-emerald-100/50 dark:shadow-emerald-500/10",
        indicator: "bg-emerald-500",
        text: "text-emerald-600 dark:text-emerald-400",
      };
  }
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  CARNES: <Beef className="w-4 h-4" />,
  PANES: <Wheat className="w-4 h-4" />,
  LÁCTEOS: <Milk className="w-4 h-4" />,
  CONGELADOS: <Snowflake className="w-4 h-4" />,
  FIAMBRES: <Drumstick className="w-4 h-4" />,
};

// ─────────────────────────────────────────────────────────────────────────────
// § COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function KardexTelemetry() {
  const [telemetry, setTelemetry] = useState<IngredientTelemetry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchTelemetry = async () => {
    setIsLoading(true);
    try {
      const { getBulkBurnRates } = await import("@/actions/analytics-actions");
      const data = await getBulkBurnRates();
      setTelemetry(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("[KardexTelemetry] Fetch failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, []);

  const criticalCount = telemetry.filter(
    (t) => getSeverity(t.autonomyDays) === "CRITICAL"
  ).length;
  const warningCount = telemetry.filter(
    (t) => getSeverity(t.autonomyDays) === "WARNING"
  ).length;

  return (
    <div className="space-y-6">
      {/* Header Strip */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-800">
              Kardex Telemetry
            </h2>
            <p className="text-[11px] text-slate-400 font-medium tracking-wide">
              BURN RATE · AUTONOMÍA · BALANCE EN TIEMPO REAL
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Badges */}
          {criticalCount > 0 && (
            <span className="flex items-center gap-1.5 bg-rose-50 text-rose-600 text-[10px] font-black px-3 py-1.5 rounded-full border border-rose-100 animate-pulse">
              <AlertTriangle className="w-3 h-3" />
              {criticalCount} CRÍTICO{criticalCount > 1 ? "S" : ""}
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center gap-1.5 bg-amber-50 text-amber-600 text-[10px] font-black px-3 py-1.5 rounded-full border border-amber-100">
              <Shield className="w-3 h-3" />
              {warningCount} ALERTA{warningCount > 1 ? "S" : ""}
            </span>
          )}
          {criticalCount === 0 && warningCount === 0 && telemetry.length > 0 && (
            <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 text-[10px] font-black px-3 py-1.5 rounded-full border border-emerald-100">
              <Shield className="w-3 h-3" />
              NOMINAL
            </span>
          )}

          <button
            onClick={() => startTransition(fetchTelemetry)}
            disabled={isPending || isLoading}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm"
            title="Refrescar telemetría"
          >
            <RefreshCw
              className={`w-4 h-4 text-slate-500 ${
                isPending || isLoading ? "animate-spin" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && telemetry.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-[220px] rounded-2xl bg-slate-100 animate-pulse border border-slate-200"
            />
          ))}
        </div>
      )}

      {/* Telemetry Grid */}
      {telemetry.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {telemetry.map((item) => {
            const severity = getSeverity(item.autonomyDays);
            const styles = getSeverityStyles(severity);

            return (
              <div
                key={item.id}
                className={`
                  relative overflow-hidden rounded-2xl border p-5 transition-all duration-300
                  hover:scale-[1.02] hover:shadow-xl cursor-default
                  ${styles.border} ${styles.bg} ${styles.glow} shadow-lg
                `}
              >
                {/* Severity Dot (top-right) */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${styles.indicator} ${
                      severity === "CRITICAL" ? "animate-ping" : ""
                    }`}
                  />
                  <span
                    className={`w-2 h-2 rounded-full ${styles.indicator}`}
                  />
                </div>

                {/* Category Icon + Name */}
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center ${styles.badge}`}
                  >
                    {CATEGORY_ICONS[item.category] || (
                      <Flame className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 leading-tight">
                      {item.name}
                    </h3>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      {item.category}
                    </span>
                  </div>
                </div>

                {/* Autonomy (Hero Metric) */}
                <div className="mb-4">
                  <div
                    className={`text-3xl font-black tabular-nums tracking-tight ${styles.text}`}
                  >
                    {item.autonomyDays >= 999 ? "∞" : item.autonomyDays}
                    <span className="text-sm font-bold ml-1 opacity-60">
                      días
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Autonomía
                  </span>
                </div>

                {/* Metrics Row */}
                <div className="space-y-2.5 pt-3 border-t border-slate-200/60">
                  {/* Burn Rate 90d */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Flame className="w-3 h-3 text-orange-400" />
                      Burn 90d
                    </span>
                    <span className="text-xs font-black text-slate-700 tabular-nums">
                      {item.burnRate.burnRate90d.toFixed(1)}
                      <span className="text-slate-400 font-medium">/día</span>
                    </span>
                  </div>

                  {/* Current Balance */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <TrendingDown className="w-3 h-3 text-indigo-400" />
                      Balance
                    </span>
                    <span
                      className={`text-xs font-black tabular-nums ${
                        item.currentBalance < 0
                          ? "text-rose-600"
                          : "text-slate-700"
                      }`}
                    >
                      {item.currentBalance.toLocaleString("es-AR")}
                    </span>
                  </div>

                  {/* Total Consumed 90d */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Total 90d
                    </span>
                    <span className="text-xs font-bold text-slate-500 tabular-nums">
                      {item.totalConsumed90d.toLocaleString("es-AR")}
                    </span>
                  </div>
                </div>

                {/* Burn Bar (visual) */}
                <div className="mt-3 h-1.5 w-full bg-slate-200/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${styles.indicator}`}
                    style={{
                      width: `${Math.min(
                        Math.max(
                          100 - (item.autonomyDays / 30) * 100,
                          5
                        ),
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      {lastUpdated && (
        <div className="flex items-center justify-end gap-2 text-[10px] text-slate-400 font-medium">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
          Última sincronización:{" "}
          {lastUpdated.toLocaleTimeString("es-AR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </div>
      )}
    </div>
  );
}
