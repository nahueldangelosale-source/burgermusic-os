/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║    SEED: B2B DIRECTORY — Proveedores + SKUs Crudos                        ║
 * ║    BurgerMusic OS v4.2 — Ingesta Determinista                             ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Ejecución: npx tsx src/db/seed-suppliers.ts
 */

import { db } from "./index";
import { suppliers } from "./schema";
import { supplier_skus } from "./schema/supply";
import crypto from "node:crypto";

const uuid = () => crypto.randomUUID();

async function seedSuppliers() {
  console.log("🌱 [SEED] Iniciando ingesta de Directorio B2B...");

  // ─────────────────────────────────────────────────────────────────────────
  // 1. PROVEEDORES
  // ─────────────────────────────────────────────────────────────────────────
  const suppliersData = [
    {
      id: uuid(),
      name: "Avicola Lanus",
      address: "Cotagaita 1567",
      postalCode: "1825",
      phone: "01142460211",
      email: null,
      cuit: "00-00000001-0",
      paymentTerms: "Contado",
      cbu: "",
      _skus: ["Grasa Vacuna", "Roast Beef en caja", "Tapa de Asado"],
    },
    {
      id: uuid(),
      name: "DON MARTIN",
      address: null,
      postalCode: null,
      phone: "1553045008",
      email: null,
      cuit: "00-00000002-0",
      paymentTerms: "Cta Cte",
      cbu: "",
      _skus: [
        "Coca 1.75L x8",
        "Sprite 1.75L x8",
        "Levite Pomelo/Manzana 1.5L x6",
        "Latas 354cc x6",
        "Agua 500cc x12",
        "Paso de los Toros 1.5L x6",
      ],
    },
    {
      id: uuid(),
      name: "ALBEAN SA",
      address: "Av. colonia 371",
      postalCode: "1437",
      phone: null,
      email: null,
      cuit: "30-71674982-3",
      paymentTerms: "Contado",
      cbu: "",
      _skus: ["Manteca Milkaut 5000g", "Queso Provoleta Horma Santa Rosa"],
    },
    {
      id: uuid(),
      name: "Grupo Felu S.R.L",
      address: "Jose Ingenieros 2872",
      postalCode: null,
      phone: "1159321583",
      email: "Juan@delifrio.com.ar",
      cuit: "30-71702359-1",
      paymentTerms: "Contado",
      cbu: "",
      _skus: [
        "Salsa Extra Crunch 15KG",
        "Queso Fetas Cheddar Milk 192x4",
        "Queso Cheddar Pouch 3.5Kgx2",
      ],
    },
    {
      id: uuid(),
      name: "El Arte Del Pan S.R.L",
      address: null,
      postalCode: null,
      phone: null,
      email: null,
      cuit: "30-71810344-0",
      paymentTerms: "Contado",
      cbu: "",
      _skus: ["Pan de Hamburguesa Queso x 15 unidades"],
    },
  ] as const;

  for (const s of suppliersData) {
    // Upsert proveedor (idempotente por CUIT)
    await db
      .insert(suppliers)
      .values({
        id: s.id,
        name: s.name,
        address: s.address ?? undefined,
        postalCode: s.postalCode ?? undefined,
        phone: s.phone ?? undefined,
        email: s.email ?? undefined,
        cuit: s.cuit,
        paymentTerms: s.paymentTerms,
        cbu: s.cbu,
      })
      .onConflictDoNothing();

    console.log(`  ✅ Proveedor: ${s.name} (${s.cuit})`);

    // Inyectar SKUs crudos del proveedor
    for (const skuName of s._skus) {
      await db
        .insert(supplier_skus)
        .values({
          id: uuid(),
          supplierId: s.id,
          skuName,
        })
        .onConflictDoNothing();
      console.log(`     📦 SKU: ${skuName}`);
    }
  }

  console.log("\n🟢 [SEED] Directorio B2B ingresado exitosamente. Exit Code 0.");
  process.exit(0);
}

seedSuppliers().catch((err) => {
  console.error("🔴 [SEED_FATAL]", err);
  process.exit(1);
});
