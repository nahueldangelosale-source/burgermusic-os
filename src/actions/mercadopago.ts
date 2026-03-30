"use server";

import { db } from "@/db";
import { outbox_events, payment_gateways_ledger } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { desc, eq, sum } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function getMercadoPagoLedger() {
  try {
    const session = await getSession();
    if (!session?.user || !["OWNER_GLOBAL", "MANAGER"].includes(session.user.role)) {
      return { success: false, error: "Unauthorized access to Financial Ledger." };
    }

    const transactions = await db
      .select()
      .from(payment_gateways_ledger)
      .where(eq(payment_gateways_ledger.gateway, "MERCADO_PAGO"))
      .orderBy(desc(payment_gateways_ledger.date))
      .limit(100);

    return { success: true, data: transactions };
  } catch (e: any) {
    console.error("Error fetching Mercado Pago ledger:", e);
    return { success: false, error: e.message };
  }
}

export async function seedMercadoPagoLedger() {
  try {
    const session = await getSession();
    if (!session?.user || session.user.role !== "OWNER_GLOBAL") {
      return { success: false, error: "Unauthorized." };
    }

    // Generate 15 fake records with varying fees (6% - 8%)
    const mockRows = Array.from({ length: 15 }).map((_, i) => {
      const gross = Math.floor(Math.random() * 50000) + 15000;
      const feeRate = 0.063; // 6.3% MP fee typical
      const taxRate = 0.012; // 1.2% IIBB / Retenciones

      const feeAmount = gross * feeRate;
      const taxAmount = gross * taxRate;
      const netAmount = gross - feeAmount - taxAmount;

      const date = new Date(Date.now() - i * 86400000);
      const releaseDate = new Date(date.getTime() + 7 * 86400000); // Clears in 7 days

      return {
        id: uuidv4(),
        gateway: "MERCADO_PAGO" as const,
        transactionReference: `MP-${Math.floor(Math.random() * 1000000000)}`,
        date: date.toISOString().split("T")[0],
        grossAmount: Number(gross.toFixed(2)),
        feeAmount: Number(feeAmount.toFixed(2)),
        taxAmount: Number(taxAmount.toFixed(2)),
        netAmount: Number(netAmount.toFixed(2)),
        releaseDate: releaseDate.toISOString().split("T")[0],
        status: i < 5 ? ("PENDING" as const) : ("CLEARED" as const),
        storeId: session.user.storeId,
      };
    });

    // Escribimos ambas inserciones. Note: SQLite/libsql usually auto-commits sequentially unless in a .transaction() block.
    // Drizzle batch is safer for cross-table.

    const outboxRows = mockRows.map((r) => ({
      id: uuidv4(),
      aggregateType: "MERCADO_PAGO",
      aggregateId: r.id,
      payload: JSON.stringify(r),
      status: "PENDING" as const,
      storeId: session.user.storeId,
    }));

    await db.batch([
      db.insert(payment_gateways_ledger).values(mockRows),
      db.insert(outbox_events).values(outboxRows),
    ]);

    return { success: true };
  } catch (e: any) {
    console.error("Error seeding Mercado Pago ledger:", e);
    return { success: false, error: e.message };
  }
}
