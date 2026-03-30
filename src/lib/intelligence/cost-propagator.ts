import { db } from "@/db";
import { products, recipe_items } from "@/db/schema";
import { logger } from "@/lib/logger";
import { eq } from "drizzle-orm";

/**
 * Nodos del Grafo de Conocimiento (Knowledge Graph)
 * Representa insumos crudos (Hojas) y productos finales (Raíces).
 */
export interface GraphNode {
  id: string;
  name: string;
  type: "RAW_MATERIAL" | "SUB_RECIPE" | "FINAL_PRODUCT";
  currentCostCents: number;
  sellingPriceCents: number;
  actualMarginPercentage: number;
  // Aristas (Edges) dirigidas hacia los PADRES (qué productos consumen a este nodo)
  usedInEdges: GraphEdge[];
  // Aristas (Edges) dirigidas hacia los HIJOS (qué insumos consume este nodo)
  composedOfEdges: GraphEdge[];
}

/**
 * Aristas del Grafo (Edges)
 * Representa la relación BOM (Bill of Materials) o Receta.
 */
export interface GraphEdge {
  parentId: string; // El plato o sub-receta (Ej: Hamburguesa)
  childId: string; // El ingrediente (Ej: Pan)
  quantityNeeded: number; // Multiplicador de costo
}

export class CostPropagatorService {
  private nodes: Map<string, GraphNode> = new Map();

  /**
   * 1. Hidratación del Grafo
   * Carga todos los productos y recetas desde Turso a una estructura de adyacencia en memoria.
   * Ideal para grafos de < 100,000 nodos, permitiendo propagación en milisegundos sin latencia SQL.
   */
  async buildKnowledgeGraph() {
    // Obtenemos Nodos
    const allProducts = await db.select().from(products);
    // Obtenemos Aristas
    const allRecipes = await db.select().from(recipe_items);

    // Inicializar Nodos
    for (const p of allProducts) {
      this.nodes.set(p.id, {
        id: p.id,
        name: p.name,
        type: p.isSaleable ? "FINAL_PRODUCT" : "RAW_MATERIAL", // Se ajustará si tiene dependencias
        currentCostCents: p.costCents || 0,
        sellingPriceCents: p.sellingPrice || 0,
        actualMarginPercentage: p.sellingPrice
          ? ((p.sellingPrice - (p.costCents || 0)) / p.sellingPrice) * 100
          : 0,
        usedInEdges: [],
        composedOfEdges: [],
      });
    }

    // Conectar Aristas (Edges)
    for (const r of allRecipes) {
      if (!r.productSku || !r.ingredientSku) continue;

      const parent = this.nodes.get(r.productSku);
      const child = this.nodes.get(r.ingredientSku);

      if (parent && child) {
        const edge: GraphEdge = {
          parentId: r.productSku,
          childId: r.ingredientSku,
          quantityNeeded: r.quantity,
        };
        parent.composedOfEdges.push(edge);
        child.usedInEdges.push(edge);

        // Si un insumo ("RAW_MATERIAL") tiene dependencias, entonces es una sub-receta
        if (parent.type === "RAW_MATERIAL" && parent.composedOfEdges.length > 0) {
          parent.type = "SUB_RECIPE";
        }
      }
    }
  }

  /**
   * 2. Motor de Propagación Dinámica
   * Simula un impacto de inflación en un nodo (Ej: aumento del proveedor)
   * y recorre el grafo hacia arriba repercutiendo el costo en las recetas asociadas
   * para calcular los nuevos márgenes (EBITDA).
   * [OTel/Performance]: Se utiliza setImmediate() de Node para evitar bloquear el Event Loop bajo carga.
   */
  async simulateInflationImpact(rootNodeId: string, newCostCents: number) {
    const rootNode = this.nodes.get(rootNodeId);
    if (!rootNode) throw new Error("Graph Node not found");

    const impactLog: Array<{
      nodeId: string;
      name: string;
      oldMargin: number;
      newMargin: number;
      newCost: number;
    }> = [];

    // DFS / BFS Traversal Queue for Cost Propagation
    const traversalQueue = [rootNodeId];
    rootNode.currentCostCents = newCostCents;

    const startTime = Date.now();
    logger.info(`Starting simulation BFS for rootNode: ${rootNodeId}`, {
      component: "CostPropagator",
      rootNodeId,
    });

    let iterations = 0;

    while (traversalQueue.length > 0) {
      iterations++;
      // Event Loop Resiliency: Yield control to Libuv every 25 nodes to allow concurrent IO
      if (iterations % 25 === 0) {
        await new Promise((resolve) => setImmediate(resolve));
      }

      const currentId = traversalQueue.shift()!;
      const current = this.nodes.get(currentId)!;

      // Recalcular el costo SI este nodo está compuesto por otros (no es materia prima base)
      if (current.composedOfEdges.length > 0) {
        let recalculateCost = 0;
        for (const edge of current.composedOfEdges) {
          const child = this.nodes.get(edge.childId)!;
          recalculateCost += child.currentCostCents * edge.quantityNeeded;
        }

        const oldMargin = current.actualMarginPercentage;
        current.currentCostCents = recalculateCost;

        // Recalcular Margen
        if (current.sellingPriceCents > 0) {
          current.actualMarginPercentage =
            ((current.sellingPriceCents - recalculateCost) / current.sellingPriceCents) * 100;

          impactLog.push({
            nodeId: current.id,
            name: current.name,
            oldMargin,
            newMargin: current.actualMarginPercentage,
            newCost: recalculateCost,
          });
        }
      } else if (currentId === rootNodeId) {
        // Es el insumo base impactado
        impactLog.push({
          nodeId: current.id,
          name: current.name,
          oldMargin: current.actualMarginPercentage,
          newMargin: 0, // No aplica margen al insumo base general
          newCost: newCostCents,
        });
      }

      // Propagar a los padres (productos que usan este nodo)
      for (const parentEdge of current.usedInEdges) {
        if (!traversalQueue.includes(parentEdge.parentId)) {
          traversalQueue.push(parentEdge.parentId);
        }
      }
    }

    logger.info(`BFS finished.`, {
      component: "CostPropagator",
      durationMs: Date.now() - startTime,
      traversedNodes: iterations,
    });
    return impactLog;
  }

  /**
   * Utilidad para generar la visualización Mermaid.js para el Command Center
   */
  generateMermaidGraphFlow(impactedNodes: string[]): string {
    // Implementación de generación de diagrama Isometric 3D / Flowchart de Mermaid - Tema Clean White / Swiss Modernism
    let mermaidStr = "graph TD\n";
    mermaidStr += "    %% Estilos Swiss Modernism\n";
    mermaidStr +=
      "    classDef default fill:#ffffff,stroke:#e5e7eb,stroke-width:1px,color:#1f2937,rx:2,ry:2,font-family:sans-serif;\n";
    mermaidStr +=
      "    classDef impacted fill:#fef2f2,stroke:#f87171,stroke-width:2px,color:#991b1b,rx:2,ry:2,font-family:sans-serif,font-weight:bold;\n";
    mermaidStr +=
      "    classDef critical fill:#dc2626,stroke:#991b1b,stroke-width:2px,color:#ffffff,rx:2,ry:2,font-family:sans-serif,font-weight:bold;\n";

    for (const nodeId of impactedNodes) {
      const node = this.nodes.get(nodeId);
      if (!node) continue;

      let styleClass = ":::impacted";
      if (node.type === "FINAL_PRODUCT" && node.actualMarginPercentage < 30) {
        styleClass = ":::critical"; // Margen inferior al 30% se marca rojo vivo
      } else if (node.type === "RAW_MATERIAL") {
        styleClass = ":::impacted";
      }

      const safeNodeId = `node_${node.id.replace(/-/g, "_")}`;
      mermaidStr += `    ${safeNodeId}["${node.name}<br>Costo Teórico: $${(node.currentCostCents / 100).toFixed(2)}<br>Rentabilidad: ${node.actualMarginPercentage.toFixed(1)}%"]${styleClass}\n`;

      for (const edge of node.composedOfEdges) {
        const child = this.nodes.get(edge.childId);
        if (child && impactedNodes.includes(child.id)) {
          const safeChildId = `node_${child.id.replace(/-/g, "_")}`;
          mermaidStr += `    ${safeChildId} -- "${edge.quantityNeeded}" --> ${safeNodeId}\n`;
        }
      }
    }
    return mermaidStr;
  }
}
