import { db } from "@/db";
import {
  products,
  transactions,
  transaction_items,
  inventory_kardex,
  recipe_items,
  sales_mapping_dlq,
} from "@/db/schema";
import { sql, eq, and, inArray, isNull } from "drizzle-orm";
// Usamos el global crypto.randomUUID() para compatibilidad con Edge Runtime

export class MissingRecipeException extends Error {
  constructor(sku: string) {
    super(`Zero-Trust Violation: Missing Recipe for physical item [${sku}]`);
    this.name = "MissingRecipeException";
  }
}

/**
 * TransactionExplosionEngine (Antigravity 2026 Standard)
 * ──────────────────────────────────────────────────────
 * Atomic engine for Bill of Materials (BOM) resolution.
 * Enforces Zero-Trust by requiring recipes for all non-service items.
 */
export class TransactionExplosionEngine {
  /**
   * Processes a sale ticket with atomic explosion of its items.
   */
  static async explode(
    transactionId: number,
    storeId: string,
    payloadItems: { sku: string; quantity: number; unitPriceCents: number }[],
    tx?: any // Optional transaction object for propagation
  ) {
    const execute = async (managedTx: any) => {
      for (const saleItem of payloadItems) {
          // 1. FASE DE CONGELACIÓN (Price Inmutability)
          const [product] = await managedTx
            .select({ item_type: products.item_type })
            .from(products)
            .where(and(eq(products.id, saleItem.sku), isNull(products.deletedAt)))
            .limit(1);

          if (!product) throw new Error(`Product ${saleItem.sku} not found in catalog.`);

          await managedTx.insert(transaction_items).values({
            id: crypto.randomUUID(),
            transactionId: transactionId,
            productSku: saleItem.sku,
            quantity: saleItem.quantity,
            frozenUnitPriceCents: saleItem.unitPriceCents,
          });

          // 2. FASE DE ENRUTAMIENTO (Service vs Physical)
          if (product.item_type === "SERVICE") {
            continue; // Services do not affect inventory
          }

          // 3. FASE DE EXPLOSIÓN SQL (BOM Resolution)
          // Aggregated recursive lookup directly in Turso DB
          const explosionQuery = sql`
            SELECT 
              ${recipe_items.ingredientSku} as sku,
              (${recipe_items.quantity} * ${saleItem.quantity}) as total_qty
            FROM ${recipe_items}
            WHERE ${recipe_items.productSku} = ${saleItem.sku}
              AND ${recipe_items.deletedAt} IS NULL
          `;

          const resolvedIngredients = (await managedTx.all(explosionQuery)) as { sku: string; total_qty: number }[];

          // 4. DEFENSA ZERO-TRUST (FricCIÓN Positiva)
          if (resolvedIngredients.length === 0) {
            throw new MissingRecipeException(saleItem.sku);
          }

          // 5. FASE DE DEDUCCIÓN (Atomic Kardex Update)
          // We use a mass-insert pattern for the Kardex Ledger
          const kardexEntries = resolvedIngredients.map((ing: { sku: string; total_qty: number }) => ({
            id: crypto.randomUUID(),
            storeId: storeId,
            productSku: ing.sku,
            quantity: -Math.abs(ing.total_qty), // Deducción siempre negativa
            referenceId: `TICKET-${transactionId}`,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          }));

          // SQL Batch Update
          await managedTx.insert(inventory_kardex).values(kardexEntries as any);
        }

        return { success: true };
    };

    try {
      if (tx) {
        return await execute(tx);
      } else {
        return await db.transaction(async (newTx) => await execute(newTx));
      }
    } catch (error: any) {
      const dbInstance = tx || db;
      if (error instanceof MissingRecipeException || error.message?.includes("MissingRecipe")) {
        // Redirection to Dead-Letter Queue (DLQ)
        await dbInstance.insert(sales_mapping_dlq).values(
          payloadItems.map((item) => ({
            id: crypto.randomUUID(),
            storeId: storeId,
            raw_name: item.sku,
            quantity: item.quantity,
            price: item.unitPriceCents,
            resolved: false,
          }))
        );

        // Paso 4: Circuito Cerrado de Alertas (DLQ) - Fire and Forget
        if (process.env.SLACK_ALERT_WEBHOOK) {
          fetch(process.env.SLACK_ALERT_WEBHOOK, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: "🚨 [SRE] Fallo de Ingesta POS - Receta No Encontrada",
              ticket: transactionId,
              sku: error.message.match(/\[(.*?)\]/)?.[1] || "Unknown",
            }),
          }).catch(err => console.error("Failed to send Slack alert:", err));
        }
      }
      throw error; // Re-throw for higher level handling
    }
  }
}
