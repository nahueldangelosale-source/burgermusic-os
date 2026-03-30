import { createClient } from "@libsql/client";
import "dotenv/config";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
  try {
    console.log("Starting thermonuclear purge...");
    await client.execute("DELETE FROM transactions");
    await client.execute("DELETE FROM outbox_events");
    await client.execute("DELETE FROM ai_audit_logs");

    try {
      await client.execute("DELETE FROM opex_ledger");
    } catch (e) {
      /* ignore */
    }
    try {
      await client.execute("DELETE FROM accounts_payable");
    } catch (e) {
      /* ignore */
    }

    console.log("Purge Complete: Ledger inmaculado ($0).");
    process.exit(0);
  } catch (err) {
    console.error("Purge Error", err);
    process.exit(1);
  }
}

run();
