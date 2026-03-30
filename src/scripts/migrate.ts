import * as fs from "fs";
import * as path from "path";
import { sql } from "drizzle-orm";
import { db } from "../db";

async function executeRawMigrations() {
  console.log("🚨 INICIANDO DISASTER RECOVERY: FORCED SQL MIGRATION A TURSO 🚨");
  try {
    const sqlPath = path.join(process.cwd(), "drizzle", "0000_safe_giant_girl.sql");
    const sqlText = fs.readFileSync(sqlPath, "utf-8");

    // Split by statements. SQLite / Drizzle generate separates by semicolons and newlines.
    const statements = sqlText.split("--> statement-breakpoint").filter((s) => s.trim().length > 0);

    let counter = 0;
    for (const stmt of statements) {
      try {
        if (stmt.trim()) {
          await db.run(sql.raw(stmt.trim()));
          counter++;
        }
      } catch (e: any) {
        // Ignore "table X already exists" and "index already exists"
        if (!e.message.includes("already exists")) {
          console.log(`⚠️ Ignored Warning: ${e.message}`);
        }
      }
    }

    console.log(
      `✅ DISASTER RECOVERY TOTAL: ${counter} sentencias SQL inyectadas en Turso con éxito.`,
    );
    process.exit(0);
  } catch (e) {
    console.error("Fallo crítico en Disaster Recovery:", e);
    process.exit(1);
  }
}

executeRawMigrations();
