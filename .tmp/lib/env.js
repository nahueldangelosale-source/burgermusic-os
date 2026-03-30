"use strict";
// src/lib/env.ts
// Validación centralizada de variables de entorno al arranque.
// Si alguna variable crítica falta, la app aborta con un mensaje claro.
// Importar este módulo en el punto de entrada (db/index.ts o layout.tsx).
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
exports.validateEnv = validateEnv;
var zod_1 = require("zod");
var envSchema = zod_1.z.object({
    // ── Base de Datos (Turso) ──
    TURSO_DATABASE_URL: zod_1.z
        .string({ required_error: "❌ TURSO_DATABASE_URL no está definida" })
        .min(1, "❌ TURSO_DATABASE_URL está vacía"),
    TURSO_AUTH_TOKEN: zod_1.z.string().optional(), // Opcional en local (file: protocol), requerido en prod
    // ── Seguridad ──
    AUTH_SECRET: zod_1.z
        .string({ required_error: "❌ AUTH_SECRET no está definida" })
        .min(8, "❌ AUTH_SECRET debe tener al menos 8 caracteres"),
    KITCHEN_PIN: zod_1.z
        .string({ required_error: "❌ KITCHEN_PIN no está definida" })
        .min(4, "❌ KITCHEN_PIN debe tener al menos 4 caracteres"),
    // ── Google Sheets ETL (opcional hasta que se configure) ──
    GOOGLE_SHEETS_CREDENTIALS_B64: zod_1.z.string().optional(),
    GOOGLE_SHEETS_SPREADSHEET_ID: zod_1.z.string().optional(),
    // ── AI (opcional en dev) ──
    OPENAI_API_KEY: zod_1.z.string().optional(),
});
/**
 * Valida TODAS las variables de entorno al arranque.
 * Si alguna crítica falta, lanza error y aborta el proceso.
 */
function validateEnv() {
    var result = envSchema.safeParse(process.env);
    if (!result.success) {
        var errors = result.error.issues
            .map(function (i) { return "  \u2022 ".concat(i.path.join("."), ": ").concat(i.message); })
            .join("\n");
        console.error("\n╔══════════════════════════════════════════╗");
        console.error("║  FATAL: Variables de entorno inválidas   ║");
        console.error("╚══════════════════════════════════════════╝\n");
        console.error(errors);
        console.error("\n→ Revisar el archivo .env.example para referencia.\n");
        throw new Error("Environment validation failed:\n".concat(errors));
    }
    return result.data;
}
// Auto-validar al importar en entorno de servidor (no en tests)
var env;
try {
    if (process.env.NODE_ENV !== "test") {
        exports.env = env = validateEnv();
    }
    else {
        exports.env = env = process.env;
    }
}
catch (e) {
    // En el build de Next.js, algunas vars pueden no existir aún
    if (process.env.NODE_ENV === "production") {
        throw e;
    }
    console.warn("⚠️ Env validation skipped during build phase");
    exports.env = env = process.env;
}
