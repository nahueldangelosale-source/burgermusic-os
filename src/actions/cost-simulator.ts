"use server";

import { db } from "@/db";
import { products } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { CostPropagatorService } from "@/lib/intelligence/cost-propagator";
import { logger } from "@/lib/logger";
import { eq } from "drizzle-orm";

export async function getRawMaterialsForSimulation() {
  try {
    const session = await getSession();
    if (!session?.user || !["OWNER_GLOBAL", "MANAGER"].includes(session.user.role)) {
      return []; // Fails closed for unauthorized
    }

    const materials = await db
      .select({
        id: products.id,
        name: products.name,
        costCents: products.costCents,
      })
      .from(products)
      .where(eq(products.isSaleable, false));

    return materials.map((m) => ({
      id: m.id,
      name: m.name,
      currentCost: (m.costCents || 0) / 100,
    }));
  } catch (e: any) {
    logger.error("Error fetching raw materials", { component: "CostSimulator", error: e.message });
    return [];
  }
}

export async function simulateCostImpact(productId: string, percentageIncrease: number) {
  try {
    const session = await getSession();
    if (!session?.user || !["OWNER_GLOBAL", "MANAGER"].includes(session.user.role)) {
      return { success: false, error: "Unauthorized access. Zero-Trust Gateway block." };
    }

    const service = new CostPropagatorService();
    await service.buildKnowledgeGraph();

    // Get the current node to figure out base cost
    const materials = await db
      .select({ costCents: products.costCents })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (materials.length === 0) throw new Error("Producto no encontrado");

    const baseCostCents = materials[0].costCents || 0;
    const newCostCents = Math.round(baseCostCents * (1 + percentageIncrease / 100));

    const impactLog = await service.simulateInflationImpact(productId, newCostCents);

    // Extract impacted final products (items where margin dropped)
    const impactedNodesIds = impactLog.map((log) => log.nodeId);
    const mermaidCode = service.generateMermaidGraphFlow(impactedNodesIds);

    return {
      success: true,
      impactLog,
      mermaidCode,
      newCost: newCostCents / 100,
    };
  } catch (e: any) {
    logger.error("Simulation error", { component: "CostSimulator", error: e.message });
    return { success: false, error: e.message };
  }
}
