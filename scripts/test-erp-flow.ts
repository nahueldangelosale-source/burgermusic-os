import "dotenv/config";
import { db } from "../src/db";
import {
  products,
  recipe_items,
  transaction_items,
  inventory_kardex,
  sales_mapping_dlq,
  transactions,
} from "../src/db/schema";
import { TransactionExplosionEngine } from "../src/services/explosion-engine";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

async function runSREAudit() {
  console.log("\n[SRE] === INICIANDO PRUEBA DE FUEGO: BOM EXPLOSION ENGINE ===\n");

  const storeId = "centro";
  
  // --- PREPARACIÓN DE DATOS (Materia Prima) ---
  const ingredients = [
    { id: "SRE_CARNE", name: "Carne SRE", item_type: "MANUFACTURED" as const },
    { id: "SRE_PAN", name: "Pan SRE", item_type: "MANUFACTURED" as const },
    { id: "SRE_CHEDDAR", name: "Cheddar SRE", item_type: "MANUFACTURED" as const },
    { id: "SRE_PAPAS", name: "Papas SRE", item_type: "MANUFACTURED" as const },
  ];

  for (const ing of ingredients) {
    await db.insert(products).values({ 
      id: ing.id, 
      name: ing.name, 
      item_type: ing.item_type, 
      unit: "UNIDAD", 
      costCents: 100, 
      isSaleable: false 
    }).onConflictDoUpdate({ 
      target: products.id, 
      set: { item_type: ing.item_type } 
    });
  }

  // --- PREPARACIÓN DE COMBO ---
  const comboId = "SRE_COMBO_MALA_FAMA";
  await db.insert(products).values({
    id: comboId,
    name: "Promo Mala Fama SRE",
    item_type: "COMBO",
    unit: "UNIDAD",
    costCents: 1000,
    isSaleable: true,
  }).onConflictDoUpdate({ target: products.id, set: { item_type: "COMBO" } });

  // RECETA DEL COMBO (4 Ingredientes)
  await db.delete(recipe_items).where(eq(recipe_items.productSku, comboId));
  await db.insert(recipe_items).values([
    { productSku: comboId, ingredientSku: "SRE_CARNE", quantity: 2 },
    { productSku: comboId, ingredientSku: "SRE_PAN", quantity: 1 },
    { productSku: comboId, ingredientSku: "SRE_CHEDDAR", quantity: 4 },
    { productSku: comboId, ingredientSku: "SRE_PAPAS", quantity: 0.3 },
  ]);

  // --- PREPARACIÓN DE SERVICIO ---
  const serviceId = "SRE_ENVIO";
  await db.insert(products).values({
    id: serviceId,
    name: "Envío a Domicilio SRE",
    item_type: "SERVICE",
    unit: "UNIDAD",
    costCents: 0,
    isSaleable: true,
  }).onConflictDoUpdate({ target: products.id, set: { item_type: "SERVICE" } });

  // --- PRODUCTO MALFORMADO (Sin Receta) ---
  const brokenId = "SRE_BROKEN_PRODUCT";
  await db.insert(products).values({
    id: brokenId,
    name: "Producto Sin Receta SRE",
    item_type: "MANUFACTURED",
    unit: "UNIDAD",
    costCents: 500,
    isSaleable: true,
  }).onConflictDoUpdate({ target: products.id, set: { item_type: "MANUFACTURED" } });
  await db.delete(recipe_items).where(eq(recipe_items.productSku, brokenId));


  // --- EJECUCIÓN DEL PAYLOAD EXTREMO ---
  const ticketId = Math.floor(Date.now() / 1000);
  // Creamos una transacción "Header" usando uno de los productos (Legacy support for schema)
  await db.insert(transactions).values({
    id: ticketId,
    storeId,
    type: "SALE",
    date: new Date().toISOString(),
    productSku: comboId,
    quantity: 1,
  });

  const payload = [
    { sku: comboId, quantity: 1, unitPriceCents: 4500 }, // El Combo
    { sku: serviceId, quantity: 1, unitPriceCents: 500 }, // El Servicio
  ];

  console.log("[SRE] Impactando ExplosionEngine con Ticket:", ticketId);
  
  // Capturamos estado inicial de Kardex
  const getKardex = async () => await db.select().from(inventory_kardex).where(eq(inventory_kardex.storeId, storeId));
  const initialKardex = await getKardex();

  try {
    // 1. Ejecución Exitosa (Combo + Servicio)
    await TransactionExplosionEngine.explode(ticketId, storeId, payload);
    
    // VALIDACIÓN 1: INMUTABILIDAD
    const frozen = await db.select().from(transaction_items).where(eq(transaction_items.transactionId, ticketId));
    const passInmutability = frozen.length === 2 && frozen.some(f => f.frozenUnitPriceCents === 4500);
    console.log(`[SRE] Inmutabilidad: ${passInmutability ? "PASS" : "FAIL"} (Precios congelados asentados)`);

    // VALIDACIÓN 2: ENRUTAMIENTO DE SERVICIO
    // El servicio no debería generar entradas en el Kardex para su propio SKU
    const serviceInKardex = await db.select().from(inventory_kardex).where(eq(inventory_kardex.productSku, serviceId));
    console.log(`[SRE] Enrutamiento de Servicio: ${serviceInKardex.length === 0 ? "PASS" : "FAIL"} (El envío no descontó inventario)`);

    // VALIDACIÓN 3: DEDUCCIÓN ATÓMICA
    const finalKardex = await getKardex();
    // Debería haber 4 nuevas entradas negativas (carne, pan, cheddar, papas) vinculadas al ticket
    const comboDeductions = finalKardex.filter(k => 
      k.quantity < 0 && 
      k.referenceId === `TICKET-${ticketId}` &&
      ["SRE_CARNE", "SRE_PAN", "SRE_CHEDDAR", "SRE_PAPAS"].includes(k.productSku)
    );
    console.log(`[SRE] Deducción Atómica: ${comboDeductions.length === 4 ? "PASS" : "FAIL"} (El combo descontó los 4 ingredientes exactos)`);


    // --- PRUEBA DE FUEGO: EL ITEM ROTO ---
    console.log("\n[SRE] Probando Circuit Breaker con ítem malformado...");
    const brokenPayload = [{ sku: brokenId, quantity: 1, unitPriceCents: 999 }];
    
    // Crear header para el segundo ticket
    const secondTicketId = ticketId + 1;
    await db.insert(transactions).values({
      id: secondTicketId,
      storeId,
      type: "SALE",
      date: new Date().toISOString(),
      productSku: brokenId,
      quantity: 1,
    });

    try {
      await TransactionExplosionEngine.explode(secondTicketId, storeId, brokenPayload);
      console.log("[SRE] Fricción Positiva: FAIL (No lanzó excepción)");
    } catch (e: any) {
      // Verificar si cayó a la DLQ
      const dlq = await db.select().from(sales_mapping_dlq).where(eq(sales_mapping_dlq.raw_name, brokenId));
      const passFriction = dlq.length > 0;
      console.log(`[SRE] Fricción Positiva: ${passFriction ? "PASS" : "FAIL"} (El ítem sin receta detonó el rollback y cayó a la DLQ)`);
    }

  } catch (err: any) {
    console.error("[SRE] FATAL ERROR during audit:", err.message);
  }

  console.log("\n[SRE] === AUDITORIA FINALIZADA ===\n");
  process.exit(0);
}

runSREAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
