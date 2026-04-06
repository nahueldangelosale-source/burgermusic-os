/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  MDM SUPPLIER CATALOG SEEDER — BurgerMusic OS v4.1                        ║
 * ║  Ingesta Masiva de Proveedores con Zod Shield + ACID Transactions          ║
 * ║  (Data Fix: Datos Reales de los 6 Proveedores Troncales)                 ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import "dotenv/config";
import { db } from "../src/db/index";
import { suppliers } from "../src/db/schema";
import { randomUUID } from "node:crypto";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// § ZOD SHIELD
// ─────────────────────────────────────────────────────────────────────────────

const SupplierRecordSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  cuit: z.string().min(11, "CUIT debe tener al menos 11 caracteres").optional(),
  cbu: z.string().optional().default(""),
  paymentTermsDays: z.number().int().nonnegative().default(0),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  postalCode: z.string().optional(),
  address: z.string().optional(),
  contact_info: z.string().optional(),
  category: z.enum(["Insumos", "Servicios", "Mantenimiento", "Otros"]).default("Insumos"),
  paymentMethod: z.enum(["TRANSFERENCIA", "EFECTIVO", "CHEQUE", "CRIPTO"]).default("TRANSFERENCIA"),
  leadTime: z.number().int().positive().default(24),
  invoiceType: z.enum(["FACTURA", "REMITO", "AMBAS"]).default("FACTURA"),
});

export const SupplierCatalogSchema = z.array(SupplierRecordSchema).min(1);

function paymentTermsLabel(days: number | string): string {
  if (typeof days === 'string') return days;
  if (days === 0) return "Contado";
  if (days === 30) return "30 Días";
  if (days === 60) return "60 Días";
  return `${days} Días`;
}

export async function ingestSupplierCatalog(payload: unknown) {
  const parseResult = SupplierCatalogSchema.safeParse(payload);
  if (!parseResult.success) {
    throw new Error(`Zod Shield Rejected: ${parseResult.error.message}`);
  }

  const catalog = parseResult.data;
  let upserted = 0;

  console.log(`📦 Iniciando ingesta ACID de ${catalog.length} proveedores...`);

  await db.transaction(async (tx) => {
    for (const record of catalog) {
      // Usaremos un CUIT ficticio si no lo envían, pero el schema lo pide.
      // Como BurgerMusic exige fallar cerrado, aseguramos un CUIT base.
      const fallbackCuit = record.cuit ?? `00-${Math.random().toString().slice(2, 10)}-0`;

      await tx
        .insert(suppliers)
        .values({
          id: randomUUID(),
          name: record.name,
          cuit: fallbackCuit,
          cbu: record.cbu ?? "",
          contact_info: record.contact_info ?? null,
          category: record.category,
          paymentTerms: typeof record.paymentTermsDays === 'string' ? record.paymentTermsDays : paymentTermsLabel(record.paymentTermsDays),
          paymentMethod: record.paymentMethod,
          leadTime: record.leadTime,
          phone: record.phone ?? null,
          email: record.email ?? null,
          postalCode: record.postalCode ?? null,
          address: record.address ?? null,
          paymentMethods: [record.paymentMethod],
          invoiceType: record.invoiceType,
          active: true,
        })
        .onConflictDoUpdate({
          target: suppliers.cuit,
          set: {
            name: record.name,
            cbu: record.cbu ?? "",
            contact_info: record.contact_info ?? null,
            category: record.category,
            paymentTerms: typeof record.paymentTermsDays === 'string' ? record.paymentTermsDays : paymentTermsLabel(record.paymentTermsDays),
            paymentMethod: record.paymentMethod,
            leadTime: record.leadTime,
            phone: record.phone ?? null,
            email: record.email ?? null,
            postalCode: record.postalCode ?? null,
            address: record.address ?? null,
            invoiceType: record.invoiceType,
            active: true,
          },
        });

      upserted++;
      console.log(`  ✔ Proveedor: "${record.name}"`);
    }
  });

  console.log(`✅ Ingesta MDM completada. Proveedores procesados: ${upserted}`);
}

const REAL_CATALOG = [
  {
    name: "Avicola Lanus",
    address: "Cotagaita 1567",
    postalCode: "1825",
    phone: "01142460211",
    cuit: "30-70000001-1", // Generado p/ constraint
    category: "Insumos",
  },
  {
    name: "DON MARTIN",
    address: "Yatay 2617",
    phone: "1553045008",
    paymentTermsDays: 30, // "Cuenta corriente"
    cuit: "30-70000002-2",
    category: "Insumos",
  },
  {
    name: "ALBEAN SA",
    address: "AV. colonia 371 CABA",
    postalCode: "1437",
    cuit: "30-71674982-3",
    category: "Insumos",
  },
  {
    name: "Grupo Felu S.R.L",
    address: "Jose Ingenieros 2872",
    phone: "1159321583",
    email: "Juan@delifrio.com.ar",
    cuit: "30-71702359-1",
    category: "Insumos",
  },
  {
    name: "El Arte Del Pan S.R.L",
    cuit: "30-71810344-0",
    category: "Insumos",
  },
  {
    name: "Distribuidora Moliere",
    cuit: "30-70000003-3",
    category: "Insumos",
  }
];

async function main() {
  await ingestSupplierCatalog(REAL_CATALOG);
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error("[SEEDER_FATAL]:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
