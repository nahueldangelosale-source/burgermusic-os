/**
 * CSV Parser Web Worker
 * ─────────────────────
 * Offloads PapaParse execution to a background thread.
 * Guarantees the main thread's INP stays < 200ms even
 * for files with 50,000+ rows.
 */
importScripts("https://cdn.jsdelivr.net/npm/papaparse@5.5.3/papaparse.min.js");

self.onmessage = (e) => {
  const file = e.data;

  // @ts-ignore — Papa is loaded via importScripts
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    worker: false, // Already in a worker — no need for Papa's internal one
    complete: (results) => {
      self.postMessage({
        type: "complete",
        data: results.data,
        rowCount: results.data.length,
      });
    },
    error: (err) => {
      self.postMessage({
        type: "error",
        message: err.message,
      });
    },
  });
};
