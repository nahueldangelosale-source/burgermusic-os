// src/lib/env.ts
// Validación centralizada de variables de entorno al arranque.
// Si alguna variable crítica falta, la app aborta con un mensaje claro.
// Importar este módulo en el punto de entrada (db/index.ts o layout.tsx).

import { z } from "zod";

const envSchema = z.object({
  // ── Base de Datos (Turso) ──
  TURSO_DATABASE_URL: z
    .string({ required_error: "❌ TURSO_DATABASE_URL no está definida" })
    .min(1, "❌ TURSO_DATABASE_URL está vacía"),

  TURSO_AUTH_TOKEN: z.string().optional(), // Opcional en local (file: protocol), requerido en prod

  // ── Seguridad ──
  AUTH_SECRET: z
    .string({ required_error: "❌ AUTH_SECRET no está definida" })
    .min(8, "❌ AUTH_SECRET debe tener al menos 8 caracteres"),

  KITCHEN_PIN: z
    .string({ required_error: "❌ KITCHEN_PIN no está definida" })
    .min(4, "❌ KITCHEN_PIN debe tener al menos 4 caracteres"),

  // ── Google Sheets ETL (opcional hasta que se configure) ──
  GOOGLE_SHEETS_CREDENTIALS_B64: z.string().optional(),
  GOOGLE_SHEETS_SPREADSHEET_ID: z.string().optional(),

  // ── AI (opcional en dev) ──
  OPENAI_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Valida TODAS las variables de entorno al arranque.
 * Si alguna crítica falta, lanza error y aborta el proceso.
 */
export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");

    console.error("\n╔══════════════════════════════════════════╗");
    console.error("║  FATAL: Variables de entorno inválidas   ║");
    console.error("╚══════════════════════════════════════════╝\n");
    console.error(errors);
    console.error("\n→ Revisar el archivo .env.example para referencia.\n");

    throw new Error(`Environment validation failed:\n${errors}`);
  }

  return result.data;
}

// Auto-validar al importar en entorno de servidor (no en tests)
let env: Env;

try {
  if (process.env.NODE_ENV !== "test") {
    env = validateEnv();
  } else {
    env = process.env as unknown as Env;
  }
} catch (e) {
  // En el build de Next.js, algunas vars pueden no existir aún
  if (process.env.NODE_ENV === "production") {
    throw e;
  }
  console.warn("⚠️ Env validation skipped during build phase");
  env = process.env as unknown as Env;
}

export { env };
