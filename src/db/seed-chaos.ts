// src/db/seed-chaos.ts

import { db } from "./index"; 
import { employees, checklists, legal_documents, opex_ledger, fact_sales } from "./schema";
import { faker } from "@faker-js/faker";
import { v4 as uuidv4 } from "uuid";
import { sql } from "drizzle-orm";

/**
 * 🌪 Chaos Engineering: Oráculo Financiero & Operacional
 * Motor de Virtualización O(1) de Datos Sintéticos.
 */
async function seedChaos() {
  console.log("=========================================");
  console.log("🚀 INICIANDO INYECCIÓN DE CAOS (EDGE-FIRST)");
  console.log("=========================================");

  try {
    // 1. Limpieza de Tablas (Operación Riesgosa asumiendo DEV/Staging)
    console.log("🧹 Purgando Entidades Base...");
    await db.delete(checklists);
    await db.delete(employees);
    await db.delete(legal_documents);
    // Para simplificar la inyección de Caos, borramos todo el OPEX de tipo 'TAX'.
    // Importante: SQLite via Drizzle no soporta DELETE directo si hay dependencias complejas sin CASCADE,
    // pero fact_sales y opex_ledger aquí deberían limpiarse bien.
    await db.run(sql`DELETE FROM opex_ledger WHERE type = 'TAX'`); // Raw delete for granular control
    await db.delete(fact_sales);

    // 2. Inyección de Empleados (500)
    console.log("👥 Inyectando 500 Empleados...");
    const employeeData = Array.from({ length: 500 }).map(() => ({
      id: uuidv4(),
      store_id: "centro",
      name: faker.person.fullName(),
      role: faker.helpers.arrayElement(["CAJERO", "COCINERO", "ENCARGADO", "AUDITOR_RRHH"]),
      hourly_rate: faker.number.int({ min: 150000, max: 400000 }), // en centavos
      active: faker.datatype.boolean({ probability: 0.9 }), // 90% activos
    }));

    // Inyección fragmentada por batches para SQLite Limit
    for (let i = 0; i < employeeData.length; i += 50) {
      await db.insert(employees).values(employeeData.slice(i, i + 50));
    }

    // 3. Documentos Legales y Regulación (15 en Total, 5 Detonados)
    console.log("📜 Forjando 15 Documentos Legales (Fire Radar Tests)...");
    const legalDocs = Array.from({ length: 15 }).map((_, i) => {
      const isExpired = i < 5;
      const targetDate = isExpired ? faker.date.past({ years: 1 }) : faker.date.future({ years: 1 });
      return {
        id: uuidv4(),
        store_id: "centro",
        document_type: faker.helpers.arrayElement(["HABILITACION_MUNICIPAL", "BROMATOLOGIA", "SEGURO_ART"]),
        expiration_date: targetDate.toISOString().split("T")[0],
        alert_triggered: isExpired,
      };
    });
    await db.insert(legal_documents).values(legalDocs);

    // 4. Inyección Táctica Fiscal OPEX
    console.log("💸 Instanciando Vehículos Fiscales (Cálculo Porcentual)...");
    const today = new Date().toISOString().split("T")[0];
    const taxes = [
      { id: uuidv4(), store_id: "centro", type: "TAX" as const, calculation_type: "PERCENTAGE" as const, percentage_rate: 21, description: "IVA Tasa General 21%", total_amount: 0, daily_accrual_amount: 0, start_date: today },
      { id: uuidv4(), store_id: "centro", type: "TAX" as const, calculation_type: "PERCENTAGE" as const, percentage_rate: 3.5, description: "IIBB ARBA General", total_amount: 0, daily_accrual_amount: 0, start_date: today },
      { id: uuidv4(), store_id: "centro", type: "TAX" as const, calculation_type: "PERCENTAGE" as const, percentage_rate: 1.2, description: "DReI Tasa Municipal", total_amount: 0, daily_accrual_amount: 0, start_date: today },
    ];
    await db.insert(opex_ledger).values(taxes);

    // 5. Inyección de Tickets Transaccionales (5000 en 30 Días)
    console.log("🛍️ Generando Big Data: 5.000 Facturas Radiales (Ventas)...");
    const salesData = Array.from({ length: 5000 }).map(() => ({
      id: uuidv4(),
      storeId: "centro",
      date: faker.date.recent({ days: 30 }).toISOString().split("T")[0],
      shift: faker.helpers.arrayElement(["MAÑANA", "TARDE", "NOCHE"]),
      raw_name: faker.commerce.productName(), // Nombres de producto random
      productSku: `SKU_${faker.string.alphanumeric(6).toUpperCase()}`,
      quantity: faker.number.int({ min: 1, max: 8 }),
      net_price_cents: faker.number.int({ min: 350000, max: 2500000 }), // Venta Promedio 3.5k a 25.0k
    }));

    let salesCursor = 0;
    while (salesCursor < salesData.length) {
      const chunk = salesData.slice(salesCursor, salesCursor + 50);
      await db.insert(fact_sales).values(chunk);
      salesCursor += 50;
    }

    console.log("=========================================");
    console.log("✅ [EXIT CODE: 0] Córtex Financiero Saturado Exitosamente.");
    console.log("=========================================");
    process.exit(0);

  } catch (error) {
    console.error("❌ ERROR CATÁSTROFICO DURANTE EL CAOS:", error);
    process.exit(1);
  }
}

// Runtime Execute
seedChaos();
