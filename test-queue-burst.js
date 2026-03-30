const run = async () => {
  // Dynamic import inside an async function works for node-fetch v3 (ESM)
  const { default: fetch } = await import("node-fetch");

  const payloads = Array.from({ length: 50 }).map((_, i) => ({
    store_id: "centro",
    ticket_id: `BURST-TEST-${Date.now()}-${i}`,
    items: [{ name: "Doble Queso Burger", qty: 2 }],
  }));

  console.log("Fichando 50 payloads masivos simultaneos hacia Turso Edge...");
  const promises = payloads.map((p) =>
    fetch("http://localhost:3000/api/webhooks/pos", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "burger123" },
      body: JSON.stringify(p),
    }),
  );

  await Promise.all(promises);
  console.log("Ráfaga Inyectada en Redis.");
};

run();
