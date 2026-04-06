import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { fact_sales, transactions } from "@/db/schema";
import { POSPayloadSchema } from "@/lib/inventory";
import { TransactionExplosionEngine } from "@/services/explosion-engine";
import crypto from "crypto";

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

    // Generamos un hash único determinista para el ticket (Idempotency Key Extrema)
    const ticketHash = crypto.createHash('sha256').update(`${store_id}_${ticket_id}`).digest('hex');

    // 3. TRANSACCIÓN ATÓMICA CON IDEMPOTENCIA EN O(1)
    // El motor usa ON CONFLICT DO NOTHING en fact_sales para anular duplicados sin race-conds.
    return await db.transaction(async (tx) => {
      
      const salesPayload = items.map(item => ({
        id: crypto.randomUUID(),
        storeId: store_id,
        date: timestamp,
        shift: "UNICO",
        raw_name: item.name,
        productSku: item.name, 
        quantity: item.qty,
        net_price_cents: item.price_cents,
        ticket_number: ticket_id,
        ticket_hash: `${ticketHash}_${item.name}`, // Hash único por ítem en el ticket
        status: "COMPLETED" as const
      }));

      // Inserción en el Data Warehouse de Ventas (Zero-Trust Idempotency)
      const res = await tx.insert(fact_sales)
        .values(salesPayload)
        .onConflictDoNothing({ target: fact_sales.ticket_hash }) // <<< NEUTRALIZA DUPLICADOS A NIVEL DB
        .returning({ id: fact_sales.id });

      // Si no retornó registros insertados, ya existían en la DB.
      if (res.length === 0) {
         return NextResponse.json({ 
           success: true, 
           message: "IdempotencyHit: Ticket already processed.",
           status: "ignored_duplicate"
         }, { status: 200 }); // Status explícito
      }

      // 4. MOTOR DE EXPLOSIÓN (Consecuencias Metabólicas)
      // Delegamos al BOM Engine para degradar Kardex según Theorical Yield
      const explosionPayload = items.map((item: any) => ({
        sku: item.name, 
        quantity: item.qty,
        unitPriceCents: item.price_cents
      }));

      // Log: Omitimos por latencia, pero creamos un Master Header en legacy transactions si lo exige la API
      const [headerTx] = await tx.insert(transactions).values({
        storeId: store_id,
        referenceId: ticket_id,
        type: "SALE",
        productSku: items[0].name, 
        quantity: 0, 
        date: timestamp,
        notes: `POS Ticket Header: ${ticket_id}`,
      }).returning({ id: transactions.id });

      await TransactionExplosionEngine.explode(
        headerTx.id,
        store_id,
        explosionPayload,
        tx 
      );

      return NextResponse.json({ 
        success: true, 
        transactionId: headerTx.id,
        itemsProcessed: items.length
      }, { status: 200 });
    });

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    
    if (errorMsg.includes("SQLITE_BUSY")) {
      console.warn("⚠️ [THERMODYNAMIC-LIMIT] Contención SQLITE detectada. Sugerir batching.");
    }
    
    return NextResponse.json(
      { 
        error: "Internal Server Error", 
        message: errorMsg
      }, 
      { status: 500 }
    );
  }
}
