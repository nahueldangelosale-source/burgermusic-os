import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./src/db";
import { products } from "./src/db/schema";
import { CostPropagatorService } from "./src/lib/intelligence/cost-propagator";

async function run() {
  const service = new CostPropagatorService();
  await service.buildKnowledgeGraph();

  // Get [BOM] Medallón Carne 110g
  const materials = await db
    .select({ id: products.id, costCents: products.costCents })
    .from(products)
    .where(eq(products.name, "[BOM] Medallón Carne 110g"))
    .limit(1);
  if (materials.length === 0) {
    console.log("Material not found");
    return;
  }
  const mat = materials[0];

  // increase 20%
  const newCost = Math.round(mat.costCents! * 1.2);
  const impactLog = await service.simulateInflationImpact(mat.id, newCost);

  console.log("Impact Log:", impactLog);

  const impactedNodesIds = impactLog.map((log: { nodeId: string }) => log.nodeId);
  const mermaidCode = service.generateMermaidGraphFlow(impactedNodesIds);

  console.log("Mermaid Code:\n", mermaidCode);
}
run().catch(console.error);
