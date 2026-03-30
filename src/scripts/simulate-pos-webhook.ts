import { z } from "zod";

const POS_API_KEY = process.env.POS_API_KEY || "BURGER_MUSIC_SRE_KEY_2026";
const TARGET_URL = "http://localhost:3000/api/webhooks/pos";

const payload = {
  ticket_id: "TKT_DOOM_001",
  store_id: "centro",
  date: new Date().toISOString().split("T")[0],
  shift: "NOCHE",
  items: [
    { raw_name: "Mala Fama Dbl", quantity: 50, net_price_cents: 850000 },
    { raw_name: "Papas Fritas XL", quantity: 150, net_price_cents: 300000 },
  ],
};

async function runSimulator() {
  console.log(`[🚀 DOS SIMULATOR] Iniciando Test de Carga hacia ${TARGET_URL}...`);
  console.log(`[📦 PAYLOAD]`, JSON.stringify(payload, null, 2));

  try {
    const startTime = performance.now();
    const res = await fetch(TARGET_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": POS_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const endTime = performance.now();
    const latencyParams = (endTime - startTime).toFixed(2);

    if (!res.ok) {
      const err = await res.text();
      console.error(`[❌ ERROR] Falló la detonación HTTP ${res.status} (${latencyParams}ms):`, err);
      process.exit(1);
    }

    const data = await res.json();
    console.log(`[✅ SRE QUALITY] Éxito Webhook 202 Accepted. Tiempo de Respuesta API: ${latencyParams}ms`);
    console.log(`[🧠 INFO] Res:`, data);
    process.exit(0);
  } catch (error: any) {
    console.error(`[🚨 CRITICAL] Red Colapsada o URL inaccesible:`, error.message);
    process.exit(1);
  }
}

runSimulator();
