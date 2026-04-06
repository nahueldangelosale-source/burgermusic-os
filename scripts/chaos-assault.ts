import "dotenv/config";

const WEBHOOK_URL = "http://localhost:3000/api/webhooks/pos";
const API_KEY = process.env.POS_WEBHOOK_KEY;

if (!API_KEY) {
  console.error("❌ [FAIL-CLOSED] Variable de entorno POS_WEBHOOK_KEY no encontrada.");
  process.exit(1);
}

interface PosPayload {
  store_id: string;
  ticket_id: string;
  timestamp: string;
  items: Array<{ name: string; qty: number; price_cents: number }>;
}

function generatePayload(ticketId: string): PosPayload {
  return {
    store_id: "STR_CHAOS_01",
    ticket_id: ticketId,
    timestamp: new Date().toISOString(),
    items: [{ name: "Combo Triple Bacon", qty: 1, price_cents: 650000 }]
  };
}

async function assaultWebhook() {
  console.log("🔥 INICIANDO ASALTO TERM-DINÁMICO (Chaos Engineering)...");
  
  const payloads: PosPayload[] = [];
  
  // Condición de Caos (Tormenta de Reintentos)
  for (let i = 1; i <= 250; i++) payloads.push(generatePayload(`TKT_CHAOS_${String(i).padStart(3, "0")}`));
  // Duplicados
  for (let dup = 1; dup <= 5; dup++) {
    for (let i = 1; i <= 50; i++) payloads.push(generatePayload(`TKT_CHAOS_${String(i).padStart(3, "0")}`));
  }

  console.log(`🧨 Despachando ${payloads.length} peticiones en lotes (Mitigando SQLITE_BUSY 500)...`);
  const startTime = Date.now();

  const results: any[] = [];
  const BATCH_SIZE = 15; // Limitador Concurrente (Turso / SQLite Tolerance)
  
  for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
    const batch = payloads.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(payload => 
      fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify(payload)
      }).then(async res => {
        return { status: res.status, body: await res.json().catch(() => null) };
      }).catch(err => {
        return { status: 500, error: err.message };
      })
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Backoff Termodinámico (100ms jitter)
    await new Promise(r => setTimeout(r, 100)); 
  }

  const endTime = Date.now();

  let successCount = 0;
  let idempotencyHitCount = 0;
  let failureCount = 0;

  for (const result of results) {
    if (result.status === 200) {
        if (result.body && result.body.message && result.body.message.includes("IdempotencyHit")) {
            idempotencyHitCount++;
        } else {
            successCount++;
        }
    } else {
      failureCount++;
    }
  }

  console.log("\n==================================");
  console.log("📊 [CHAOS REPORT]");
  console.log(`⏱️  Duración del Asedio: ${endTime - startTime}ms`);
  console.log(`✅  Peticiones Exitosas (Nuevos): ${successCount}`);
  console.log(`🛡️  Rechazos por Idempotencia: ${idempotencyHitCount}`);
  console.log(`❌  Peticiones Fallidas (Errores/Timeouts): ${failureCount}`);
  console.log("==================================");

  if (failureCount > 0) {
    console.error("⚠️ ALERTA: Persisten fallos de ingesta bajo mitigación.");
    process.exit(1);
  }

  console.log("✅ [ZERO-ENTROPY] Asedio superado. Nodo estabilizado y Blindado contra Retry Storms.");
  process.exit(0);
}

assaultWebhook().catch(err => {
  console.error("💥 Falla crítica en el script de Chaos:", err);
  process.exit(1);
});
