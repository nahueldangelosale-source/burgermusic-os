async function testApi() {
  const url = 'http://127.0.0.1:3000/api/webhooks/pos';
  const apiKey = 'test-sre-key-2026';
  const payload = {
    store_id: "centro",
    ticket_id: "API-DEBUG-" + Date.now(),
    timestamp: new Date().toISOString(),
    items: [
      { name: "PRD-HAMBURGUESA-TEST", qty: 1, price_cents: 50000 },
    ],
  };

  console.log("🚀 Testing API with payload:", JSON.stringify(payload, null, 2));

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    const status = res.status;
    const body = await res.json();

    console.log("📊 Response Status:", status);
    console.log("📦 Response Body:", JSON.stringify(body, null, 2));

    if (body.error) {
      console.error("❌ API Error:", body.message || body.error);
    }
  } catch (err) {
    console.error("❌ Fetch failed:", err);
  }
}

testApi();
