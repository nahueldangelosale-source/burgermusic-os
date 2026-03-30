import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "./index";

async function runMigrations() {
  console.log("🔧 Iniciando Inyección Directa de Migraciones Drizzle (Bypass SQLITE_NOMEM)...");
  try {
    await migrate(db, { migrationsFolder: "drizzle" });
    console.log("✅ Migraciones inyectadas en Turso (O(1)).");
    process.exit(0);
  } catch (err) {
    console.error("❌ Fallo en Inyección:", err);
    process.exit(1);
  }
}
runMigrations();
