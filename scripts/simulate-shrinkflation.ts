import "dotenv/config";
import { db } from "../src/db";
import { products, suppliers, inventory_items } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { executeInvoiceTransaction } from "../src/actions/invoice-actions";
import { randomUUID } from "node:crypto";

async function simulateShrinkflation() {
  console.log("🔥 [SHRINKFLATION TEST] Iniciando auditoría forense usando Función Pura...");

  // 1. Obtener un Proveedor aleatorio
  const [supplier] = await db.select().from(suppliers).limit(1);
  if (!supplier) throw new Error("No hay proveedores en la BD");

  // 2. Mockear un Inventory Item y Product alineados para el Test
  const mockId = "0cda9c47-36e4-4ab2-b2a6-ee8f02909a34"; // Mock UUID for test

  // Intentamos obtener uno existente o creamos
  const [existingInvent] = await db.select().from(inventory_items).limit(1);
  const [existingProd] = await db.select().from(products).limit(1);

  if (!existingInvent || !existingProd) {
     throw new Error("Base de datos sin registros iniciales de catálogo.");
  }

  // Garantizamos que el producto y el inventory tengan mismo ID de enlace 
  // (La heuristica asume products.id = item.inventory_item_id as seen in test)
  await db.update(products).set({ weight_grams: 100 }).where(eq(products.id, existingInvent.id));
  
  // Por si el ID no existe en products, hacemos un insert rápido o fallback
  // Wait, the action does: products.id = item.inventory_item_id
  const [testProduct] = await db.select().from(products).where(eq(products.id, existingInvent.id));
  
  if (!testProduct) {
     // Insert a dummy one
     await db.insert(products).values({
         id: existingInvent.id,
         name: existingInvent.name,
         weight_grams: 100,
         unit: "GRAMOS",
         item_type: "MANUFACTURED"
     });
  } else if (!testProduct.weight_grams) {
     await db.update(products).set({ weight_grams: 100 }).where(eq(products.id, existingInvent.id));
  }

  const pesoNominalFisico = 100;

  // Merma inflada > 3.5%
  // Nominal: 100g.  Facturado: 96g.  Merma real = (100-96)/100 = 0.04 = 4% > 3.5%
  const pesoFacturadoAcaQuantity = pesoNominalFisico * 0.96;
  const precioPagado = existingInvent.cost_per_unit_cents || 100;

  console.log(`📦 Item Base: ${existingInvent.name}`);
  console.log(`⚖️  Masa Nominal (Catálogo): ${pesoNominalFisico} g`);
  console.log(`⚖️  Masa Facturada (Simulada): ${pesoFacturadoAcaQuantity} g (Merma del 4%)`);

  try {
    const result = await executeInvoiceTransaction({
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      invoice_number: `SHRINK-TEST-${randomUUID()}`,
      items: [
        {
          inventory_item_id: existingInvent.id,
          quantity: pesoFacturadoAcaQuantity, 
          unit_price_cents: precioPagado, 
        }
      ]
    }, "SRE-MOCK-ID", existingInvent.store_id, "Mocked Agent"); // Pure Function Bypass
    
    console.log("RESULTADO:", result);
    if (!result.success && result.error && result.error.includes("REQUIRES_HUMAN_AUDIT")) {
         console.log("✅ [FAIL-CLOSED] El centinela bloqueó la reduflación exitosamente retornando Graceful Error:", result.error);
    } else {
         console.error("❌ [FAIL-OPEN] La transacción NO fue frenada por el centinela correctly.");
         process.exit(1);
    }
  } catch (error: any) {
    console.log("💥 Error Capturado:", error.message);
    if (error.message.includes("REQUIRES_HUMAN_AUDIT")) {
      console.log("✅ [FAIL-CLOSED] El centinela bloqueó la reduflación exitosamente (vía Exception).");
    } else {
      console.error(`❌ [ERROR-MISMATCH] La transacción falló pero no por REQUIRES_HUMAN_AUDIT. Detalle: ${error.message}`);
      process.exit(1);
    }
  }
  
  process.exit(0);
}

simulateShrinkflation().catch(err => {
  console.error("Error crítico en la simulación:", err);
  process.exit(1);
});
