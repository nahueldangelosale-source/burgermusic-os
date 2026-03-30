import "dotenv/config";
import { db } from "../src/db";
import { 
  transactions, 
  inventory_kardex,
  recipe_items,
  products
} from "../src/db/schema";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

const WEBHOOK_URL = "http://localhost:3001/api/webhooks/pos";
const API_KEY = process.env.POS_WEBHOOK_KEY || "test-sre-key-2026";
const STORE_ID = "sucursal_pos_sre";
const PRODUCT_SKU = "PRD-HAMBURGUESA-TEST";
const INGREDIENT_SKU = "MAT-CARNE-TEST";

async function main() {
  console.log("=".repeat(60));
  console.log("[SRE-POS-TEST] 🧪 Iniciando Simulación de Ingesta POS");
  console.log("=".repeat(60));

  // 1. SETUP: Preparar Producto y Receta
  console.log("[SRE-POS-TEST] 🔨 Preparando Master Data (Hamburguesa -> Carne)...");
  
  await db.insert(products).values({
    id: PRODUCT_SKU,
    name: "Hamburguesa SRE",
    item_type: "MANUFACTURED",
  }).onConflictDoNothing();

  await db.insert(products).values({
    id: INGREDIENT_SKU,
    name: "Carne Vacuna (Test)",
    item_type: "MANUFACTURED",
  }).onConflictDoNothing();

  await db.delete(recipe_items).where(eq(recipe_items.productSku, PRODUCT_SKU));
  await db.insert(recipe_items).values({
    productSku: PRODUCT_SKU,
    ingredientSku: INGREDIENT_SKU,
    quantity: 150, // 150g por hamburguesa
  });

  // Limpiar Kardex previo del ingrediente
  await db.delete(inventory_kardex).where(eq(inventory_kardex.productSku, INGREDIENT_SKU));

  // 2. PRUEBA: Autorización Fallida
  console.log("[SRE-POS-TEST] 🛡️ Validando Rechazo (API Key Inválida)...");
  const failRes = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": "WRONG_KEY" },
    body: JSON.stringify({}),
  });
  const failData = await failRes.json();
  console.log(`[SRE-POS-TEST] Resultado: ${failRes.status} (Esperado 401)`, failData);
  if (failRes.status !== 401) { 
    console.error("❌ Fallo en Shield 401"); 
    process.exit(1); 
  }

  // 3. PRUEBA: Ingesta Exitosa
  const ticketId = `TICKET-${randomUUID().slice(0, 8)}`;
  console.log(`[SRE-POS-TEST] 🚀 Enviando Ticket Nuevo: ${ticketId}`);
  
  const payload = {
    store_id: STORE_ID,
    ticket_id: ticketId,
    timestamp: new Date().toISOString(),
    items: [
      { name: PRODUCT_SKU, qty: 2, price_cents: 100000 } // 2 Hamburguesas
    ]
  };

  const successRes = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json", 
      "x-api-key": API_KEY 
    },
    body: JSON.stringify(payload),
  });

  const successData = await successRes.json();
  console.log(`[SRE-POS-TEST] Status: ${successRes.status}`, JSON.stringify(successData, null, 2));

  if (successRes.status === 200) {
    // 4. VERIFICACIÓN KARDEX: 2 hamburguesas * 150g = -300g
    const [kardex] = await db
      .select({ total: sql<number>`SUM(quantity)` })
      .from(inventory_kardex)
      .where(eq(inventory_kardex.productSku, INGREDIENT_SKU));
    
    console.log(`[SRE-POS-TEST] 📉 Deducción Kardex: ${kardex.total}g (Esperado -300)`);
    if (Math.abs(Number(kardex.total) + 300) > 0.001) {
      console.error("❌ Fallo en Deducción BOM");
      process.exit(1);
    }
  } else {
    console.error("❌ Fallo en Ingesta");
    process.exit(1);
  }

  // 5. PRUEBA: Idempotencia (Re-enviar mismo ticket)
  console.log("[SRE-POS-TEST] 🛡️ Validando Idempotencia (Duplicate Ticket)...");
  const idempRes = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json", 
      "x-api-key": API_KEY 
    },
    body: JSON.stringify(payload),
  });
  const idempData = await idempRes.json();
  console.log(`[SRE-POS-TEST] Status: ${idempRes.status}`, idempData);

  if (idempData.message?.includes("IdempotencyHit")) {
    console.log("[SRE-POS-TEST] ✅ ESCUDO DE IDEMPOTENCIA FUNCIONANDO.");
  } else {
    console.error("❌ Fallo en Shield de Idempotencia");
    process.exit(1);
  }

  console.log("\n[SRE-POS-TEST] 🏁 SIMULACIÓN POS FINALIZADA CON ÉXITO.");
  console.log("=".repeat(60));
  process.exit(0);
}

main().catch(console.error);
