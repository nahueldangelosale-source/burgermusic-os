import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { POSPayloadSchema } from "@/lib/inventory";
import { TransactionExplosionEngine } from "@/services/explosion-engine";

export const runtime = "nodejs";

/**
 * Real-Time POS Webhook (Edge Ingestion)
 * ──────────────────────────────────────
 * Enterprise-grade ingestion loop for On-Premise POS.
 * Enforces Zero-Trust, Idempotency, and ACID conversion.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. SEGURIDAD ZERO-TRUST (API Key Layer)
    const apiKey = req.headers.get("x-api-key");
    const tenantApiKey = process.env.POS_WEBHOOK_KEY;

    if (!apiKey || apiKey !== tenantApiKey) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing x-api-key" }, 
        { status: 401 }
      );
    }

    // 2. CONTRATO DE DATOS (Zod Validation)
    const body = await req.json();
    const result = POSPayloadSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid Payload", details: result.error.format() }, 
        { status: 400 }
      );
    }

    const { store_id, ticket_id, timestamp, items } = result.data;

    // 3. MOTOR DE IDEMPOTENCIA (Check for double-spend)
    const existing = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(
        eq(transactions.referenceId, ticket_id),
        eq(transactions.storeId, store_id)
      ))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ 
        success: true, 
        message: "IdempotencyHit: Ticket already processed.",
        transactionId: existing[0].id 
      });
    }

    // 4. TRANSACCIÓN ATÓMICA (BOM Engine & Kardex)
    // El modelo actual exige que 'transactions' sea a nivel de ítem o use un 'Header' con SKU.
    return await db.transaction(async (tx) => {
      console.log(`[SRE-POS-WEBHOOK] 📝 Creando Header Transaction para: ${ticket_id}`);
      // 4a. Registrar Ticket Principal (Header-Stub en la tabla de Ledger)
      const [headerTx] = await tx.insert(transactions).values({
        storeId: store_id,
        referenceId: ticket_id,
        type: "SALE",
        productSku: items[0].name, 
        quantity: 0, 
        date: timestamp,
        notes: `POS Ticket Header: ${ticket_id}`,
      }).returning({ id: transactions.id });

      if (!headerTx) throw new Error("Fallo al crear header de transacción (Ledger)");
      console.log(`[SRE-POS-WEBHOOK] ✅ Header Creado ID: ${headerTx.id}. Iniciando Explosión...`);

      // 4b. Disparar Motor de Explosión BOM (Ingesta de transaction_items y deducción Kardex)
      const explosionPayload = items.map(item => ({
        sku: item.name, 
        quantity: item.qty,
        unitPriceCents: item.price_cents
      }));

      await TransactionExplosionEngine.explode(
        headerTx.id,
        store_id,
        explosionPayload,
        tx // Pasamos el contexto de transacción para evitar SQLITE_BUSY
      );

      return NextResponse.json({ 
        success: true, 
        transactionId: headerTx.id,
        itemsProcessed: items.length
      });
    });

  } catch (error: any) {
    console.error("[SRE-POS-WEBHOOK] ❌ Error Crítico:", {
      message: error.message,
      stack: error.stack,
      cause: error.cause
    });
    return NextResponse.json(
      { 
        error: "Internal Server Error", 
        message: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined 
      }, 
      { status: 500 }
    );
  }
}
