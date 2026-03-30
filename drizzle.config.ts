import * as dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

// 👇 ESTO ES CLAVE: Cargar explícitamente .env.local antes de definir la config
dotenv.config();

if (!process.env.TURSO_DATABASE_URL) {
  throw new Error("❌ TURSO_DATABASE_URL no está definida en .env.local");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL as string,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
