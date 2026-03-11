import { expect, test, vi } from "vitest";

test("Lanza error crítico si AUTH_SECRET no está definido en las variables de entorno", async () => {
    // Guardamos el entorno original
    const originalEnv = process.env;
    
    // Limpiamos la caché de modulos y la variable de entorno
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.AUTH_SECRET;

    // Importar dinámicamente debe fallar y lanzar la excepción
    await expect(async () => {
        await import("./session");
    }).rejects.toThrow("AUTH_SECRET is not defined in environment variables");
    
    // Restaurar entorno
    process.env = originalEnv;
});
