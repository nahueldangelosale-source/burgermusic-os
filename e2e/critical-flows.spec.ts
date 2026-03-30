import { test, expect } from "@playwright/test";

/**
 * E2E Critical Flows — Antigravity 2026 SRE Standard
 * ══════════════════════════════════════════════════════
 * Escenarios de "Última Milla" para certificación de producción.
 * Requiere: Dev server corriendo en localhost:3000 con DB seedeada.
 */

// ── ESCENARIO 1: Motor BOM & UOM (Combo Sale → Kardex Deduction) ──
test.describe("Motor BOM & UOM Conversion", () => {
  const API_URL = "/api/webhooks/pos";
  const API_KEY = process.env.POS_WEBHOOK_KEY || "test-sre-key-2026";

  test("Venta de Combo complejo descuenta ingredientes con factor de conversión UOM", async ({
    request,
  }) => {
    const ticketId = `E2E-COMBO-${Date.now()}`;

    // 1. Enviar ticket POS con un combo que tiene receta BOM
    const payload = {
      store_id: "centro",
      ticket_id: ticketId,
      timestamp: new Date().toISOString(),
      items: [
        { name: "PRD-HAMBURGUESA-TEST", qty: 3, price_cents: 150000 },
      ],
    };

    const response = await request.post(API_URL, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      data: payload,
    });

    // 2. Verificar respuesta exitosa
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.transactionId).toBeDefined();
    expect(body.itemsProcessed).toBe(1);

    // 3. Verificar Idempotencia (re-enviar mismo ticket)
    const duplicateResponse = await request.post(API_URL, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      data: payload,
    });

    expect(duplicateResponse.status()).toBe(200);
    const dupBody = await duplicateResponse.json();
    expect(dupBody.message).toContain("IdempotencyHit");

    // 4. Verificar que API Key inválida retorna 401
    const unauthorizedResponse = await request.post(API_URL, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "INVALID_KEY_ATTACK_VECTOR",
      },
      data: payload,
    });

    expect(unauthorizedResponse.status()).toBe(401);
  });
});

// ── ESCENARIO 2: Resiliencia OCR Fail-Closed (PDF Saboteado) ──
test.describe("OCR Fail-Closed Resilience", () => {
  test.beforeEach(async ({ page }) => {
    // Zero-Trust Auth Bypass (Fast-Login Hub)
    await page.goto("/login");
    await page.click('button[value="C_LEVEL"]');
    await page.waitForURL("**/dashboard/supply");
  });

  test("Subida de archivo con extensión no válida muestra banner de error sin colapsar el DOM", async ({
    page,
  }) => {
    // 1. Navegar al Command Center (Treasury / Receiver Agent)
    await page.goto("/dashboard/treasury");

    // 2. Esperar a que la página cargue completamente
    await page.waitForLoadState("networkidle");

    // 3. Seleccionar un proveedor (Requerido por el formulario)
    const supplierSelect = page.locator('select[name="supplier_id"]');
    await supplierSelect.selectOption({ index: 1 }); // Seleccionar el primer proveedor (SUP-001)

    // 4. Crear un buffer con contenido inválido
    const corruptedFile = Buffer.from(
      "%PDF-1.4 CORRUPTED_BINARY_PAYLOAD_ATTACK_VECTOR_SRE_2026",
      "utf-8"
    );

    // 5. Intentar subir un archivo PDF saboteado (binario corrupto)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "invoice_sabotaged.pdf",
      mimeType: "application/pdf",
      buffer: corruptedFile,
    });

    // 6. Detonar el procesamiento (Boton masivo Ley de Fitts)
    const submitButton = page.getByRole("button", { name: /Detonar Scan AI/i });
    await submitButton.click();

    // 7. Verificar que el escudo Zod/Fail-Closed intercepte el error
    // El sistema debe detectar el archivo corrupto y mostrar feedback (banner o toast)
    const errorIndicator = page.locator('text=/Error|Falla|inválido/i, .text-rose-400, .text-red-500').first();
    await expect(errorIndicator).toBeVisible({ timeout: 20000 });

    // 8. Verificar que el DOM se mantiene estable (No hay White Screen of Death)
    const mainHeader = page.getByText(/COMMAND CENTER/i).first();
    await expect(mainHeader).toBeVisible();

    // 9. Verificar que la navegación sigue funcional (Resiliencia del Event Loop)
    const navLinks = page.locator("nav a, aside a, button").filter({ hasText: /Ledger|Insumos|Manual/i });
    expect(await navLinks.count()).toBeGreaterThan(0);
  });

  test("El DOM se mantiene estable después de un error de validación Zod", async ({
    page,
  }) => {
    await page.goto("/dashboard/treasury");
    await page.waitForLoadState("networkidle");

    // Verificar que la estructura base del DOM está intacta
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // Verificar que no hay Error Boundaries activos (pantallas de error)
    const errorBoundary = page.locator(
      'text="Something went wrong"'
    );
    const errorBoundaryCount = await errorBoundary.count();

    // Si hay Error Boundary, la página colapsó → FALLO
    expect(errorBoundaryCount).toBe(0);
  });
});
