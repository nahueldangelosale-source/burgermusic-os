/**
 * Librería Core de Sincronía Offline-First (Trinchera Node)
 * Controla el vaciado O(1) de IndexedDB hacia la base Turso una vez reactivado el internet.
 */
export async function getOfflineDB() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    // Uso nativo isomórfico sin dependencias pesadas
    const request = indexedDB.open("BurgerMusic_OfflineDB", 1);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("offline-queue")) {
        db.createObjectStore("offline-queue", { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function syncOfflineData() {
  if (typeof window === "undefined") return;
  if (!navigator.onLine) return; // Guardrail preventivo

  const db = await getOfflineDB();
  const tx = db.transaction("offline-queue", "readwrite");
  const store = tx.objectStore("offline-queue");
  const getAllRequest = store.getAll();

  getAllRequest.onsuccess = async () => {
    const records = getAllRequest.result;
    if (records.length === 0) return;

    console.log(`📡 SRE: Drenando Cola IDB Offline (${records.length} transacciones resguardadas)`);

    // Sincronía Secuencial Infranqueable (Evitando Race Conditions HTTP)
    for (const record of records) {
      try {
        const response = await fetch(record.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(record.payload),
        });

        if (response.ok) {
          // Purga O(1) del registro ya asimilado por Edge
          const deleteTx = db.transaction("offline-queue", "readwrite");
          deleteTx.objectStore("offline-queue").delete(record.id);
        }
      } catch (err) {
        console.error(`❌ SRE Core: Retry HTTP fallido en ID-Mutación ${record.id}`, err);
        // Break temprano preserva el FIFO estricto de Trinchera
        break;
      }
    }
  };
}

// Inicializador de Sincronía Pasiva Front-End
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    syncOfflineData().catch(console.error);
  });
}
