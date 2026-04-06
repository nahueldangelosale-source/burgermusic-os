import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const db = drizzle(client);

async function purgeDLQ() {
  console.log("🛠️ Limpiando basura legacy del DLQ...");
  await db.run(sql`DELETE FROM sales_mapping_dlq`);
  console.log("✅ DLQ Purgado. Interface destrabada.");
  process.exit(0);
}

purgeDLQ().catch(console.error);
