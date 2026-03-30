/**
 * SRE Simulation Script: Inventory Watchdog
 * 
 * Inyecta un déficit artificial en inventory_kardex y dispara
 * la lógica del Watchdog Cron para validar la generación de DRAFT POs.
 * 
 * Uso: npx tsx scripts/test-watchdog.ts
 */

import "dotenv/config";
import { db } from "../src/db";
import { inventory_kardex, products, purchase_orders, po_items, ai_audit_logs } from "../src/db/schema";
import { sql, eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const STORE_ID = "sucursal_central";
const TEST_PREFIX = "TEST-WATCHDOG";

async function main() {
  console.log("=".repeat(60));
  console.log("[SRE-WATCHDOG] 🧪 Iniciando Simulación de Déficit Artificial");
  console.log("=".repeat(60));

  // 1. Buscar un producto con safetyStock > 0 y supplier_id definido
  const candidates = await db
    .select({
      id: products.id,
      name: products.name,
      safetyStock: products.safetyStock,
      supplierId: products.supplierId,
      costCents: products.costCents,
    })
    .from(products)
    .where(sql`${products.safetyStock} > 0 AND ${products.supplierId} IS NOT NULL`)
    .limit(3);

  if (candidates.length === 0) {
    console.error("[SRE-WATCHDOG] ❌ No hay productos con safetyStock > 0 y supplier_id. Abortando.");
    console.log("[SRE-WATCHDOG] 💡 Tip: Asegúrate de que al menos un producto tenga safety_stock y supplier_id configurados.");
    process.exit(1);
  }

  const target = candidates[0];
  const deficitQty = Math.max(0, (target.safetyStock ?? 0) - 1); // Forzar stock = 1 (debajo del umbral)

  console.log(`[SRE-WATCHDOG] 🎯 Producto objetivo: ${target.name} (${target.id})`);
  console.log(`[SRE-WATCHDOG]    Safety Stock: ${target.safetyStock}`);
  console.log(`[SRE-WATCHDOG]    Supplier: ${target.supplierId}`);
  console.log(`[SRE-WATCHDOG]    Inyectando stock artificial: 1 unidad (déficit de ${deficitQty})`);

  // 2. Limpiar entradas de test previas
  await db.delete(inventory_kardex).where(
    sql`${inventory_kardex.referenceId} LIKE ${`${TEST_PREFIX}%`}`
  );

  // 3. Inyectar stock artificial en el kardex (1 unidad, debajo del safety stock)
  const kardexId = `${TEST_PREFIX}-${randomUUID().slice(0, 8)}`;
  await db.insert(inventory_kardex).values({
    id: kardexId,
    storeId: STORE_ID,
    productSku: target.id,
    quantity: 1, // Debajo del safetyStock
    referenceId: `${TEST_PREFIX}-DEFICIT`,
  });

  console.log(`[SRE-WATCHDOG] ✅ Kardex inyectado: ${kardexId}`);

  // 4. Disparar el endpoint del Watchdog
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = `${baseUrl}/api/cron/inventory`;

  console.log(`[SRE-WATCHDOG] 🚀 Disparando Watchdog: ${url}`);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "x-vercel-cron": "1", // Bypass auth para testing local
      },
    });

    const body = await res.json();
    console.log("\n[SRE-WATCHDOG] 📋 Respuesta del Watchdog:");
    console.log(JSON.stringify(body, null, 2));

    // 5. Verificar resultados
    if (body.status === "executed" && body.draftsCreated > 0) {
      console.log("\n[SRE-WATCHDOG] ✅ PASS — DRAFT PO generada exitosamente");
      
      // Verificar en la DB
      const draftPOs = await db
        .select()
        .from(purchase_orders)
        .where(sql`${purchase_orders.status} = 'DRAFT' AND ${purchase_orders.order_date} = ${new Date().toISOString().split("T")[0]}`)
        .limit(5);

      console.log(`[SRE-WATCHDOG] 📊 POs DRAFT encontradas hoy: ${draftPOs.length}`);

      // Verificar audit log
      const auditLogs = await db
        .select()
        .from(ai_audit_logs)
        .where(sql`${ai_audit_logs.agentName} = 'INVENTORY_WATCHDOG_CRON'`)
        .limit(5);

      console.log(`[SRE-WATCHDOG] 🔍 Audit Logs del Watchdog: ${auditLogs.length}`);
    } else if (body.status === "nominal") {
      console.log("\n[SRE-WATCHDOG] ⚠️ WARN — No se detectaron déficits. Verifica el kardex inyectado.");
    } else {
      console.log("\n[SRE-WATCHDOG] ❌ FAIL — El Watchdog no generó DRAFTs.");
    }
  } catch (fetchError: any) {
    console.error(`[SRE-WATCHDOG] ❌ Error al conectar: ${fetchError.message}`);
    console.log("[SRE-WATCHDOG] 💡 Tip: Asegúrate de que `npm run dev` esté corriendo.");
  }

  // 6. Cleanup
  console.log("\n[SRE-WATCHDOG] 🧹 Limpiando datos de test...");
  await db.delete(inventory_kardex).where(
    sql`${inventory_kardex.referenceId} LIKE ${`${TEST_PREFIX}%`}`
  );

  console.log("[SRE-WATCHDOG] ✅ Simulación finalizada.");
  console.log("=".repeat(60));
}

main().catch(console.error);
