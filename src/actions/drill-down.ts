"use server";

import { db } from "@/db";
import { labor_costs, products, transactions } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";

export async function getDrillDownData(kpiType: string) {
  try {
    const session = await getSession();
    if (!session?.user || !["OWNER_GLOBAL", "MANAGER"].includes(session.user.role)) {
      return { success: false, error: "Unauthorized. Requires Executive C-Level access." };
    }

    if (kpiType === "primeCost") {
      // Devuelve resumen de costos laborales y cogs recientes
      const recentLabor = await db
        .select()
        .from(labor_costs)
        .orderBy(desc(labor_costs.createdAt))
        .limit(10);
      return {
        success: true,
        title: "Desglose de Prime Cost",
        description: "Últimos registros de costo laboral vs ventas.",
        columns: ["Fecha", "Turno", "Horas", "Costo ($)"],
        data: recentLabor.map((l) => ({
          c1: l.date,
          c2: l.shift,
          c3: l.totalHours,
          c4: l.costAmount,
        })),
      };
    } else if (kpiType === "cogsVariance") {
      // Transacciones con varianza
      const recentCogs = await db
        .select({
          date: transactions.date,
          sku: transactions.productSku,
          qty: transactions.quantity,
          cost: transactions.costCentsAtTime,
          name: products.name,
        })
        .from(transactions)
        .leftJoin(products, eq(transactions.productSku, products.id))
        .where(eq(transactions.type, "SALE"))
        .orderBy(desc(transactions.date))
        .limit(10);

      return {
        success: true,
        title: "Desglose de Ventas (COGS)",
        description: "Últimos platos vendidos con costo teórico registrado.",
        columns: ["Fecha", "Plato", "Cant.", "Costo Registrado ($)"],
        data: recentCogs.map((t) => ({
          c1: t.date,
          c2: t.name || t.sku,
          c3: t.qty,
          c4: t.cost ? (t.cost / 100).toFixed(2) : "0",
        })),
      };
    } else if (kpiType === "bcgStar") {
      return {
        success: true,
        title: "Platos Estrella",
        description: "Alta popularidad y alta rentabilidad.",
        columns: ["KPI", "Estado", "-", "-"],
        data: [{ c1: "Data en vivo agregada", c2: "Optimal", c3: "-", c4: "-" }],
      };
    }

    return { success: false, error: "Tipo de KPI no soportado" };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
