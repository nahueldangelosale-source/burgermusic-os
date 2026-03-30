const CACHE_NAME = "burgermusic-v3-cache";
const QUEUE_STORE_NAME = "offline-queue";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Interceptor Fetch Estratégico (Edge Node simulado)
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Guardrail: Proteger las mutaciones críticas de la trinchera (Kitchen y Recepción B2B)
  if (
    event.request.method === "POST" &&
    (url.pathname.startsWith("/api/kitchen") || url.pathname.startsWith("/api/receive"))
  ) {
    event.respondWith(
      fetch(event.request.clone()).catch(async (error) => {
        console.warn(
          "🔥 Red fallida (Caída de Suministro WiFi). Refugiando payload en IndexedDB...",
          error,
        );

        // Clonar y deserializar payload Zod
        const clonedRequest = event.request.clone();
        const payload = await clonedRequest.json();

        // Aislar asincrónicamente el payload a la base nativa IDB
        await saveToIDB(url.pathname, payload);

        // Optimistic UI Return 202
        return new Response(
          JSON.stringify({
            success: true,
            offlineDeferred: true,
            message: "Alerta SRE: Red local colapsada. Transacción enclaustrada en Offline-Queue.",
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 202,
          },
        );
      }),
    );
  }
});

// Nativo IndexedDB puramente para el Service Worker
function saveToIDB(endpoint, payload) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("BurgerMusic_OfflineDB", 1);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE_NAME)) {
        db.createObjectStore(QUEUE_STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };

    request.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction(QUEUE_STORE_NAME, "readwrite");
      const store = tx.objectStore(QUEUE_STORE_NAME);
      store.add({
        endpoint,
        payload,
        timestamp: new Date().toISOString(),
      });
      tx.oncomplete = resolve;
      tx.onerror = reject;
    };

    request.onerror = reject;
  });
}
