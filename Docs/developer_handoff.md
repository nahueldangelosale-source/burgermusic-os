# 🔌 Developer Handoff: Guía de Integración Backend

Este documento es el puente entre el diseño UX/UI (Prototipos estáticos) y el entorno de Staging / Base de Datos actual de Burger Music. Su objetivo es indicarle al equipo de desarrollo **dónde "cortar los cables sueltos" (datos mockeados) y enchufar las APIs reales**.

---

## 1. Documentación Core (Lo que el equipo DEBE leer)
Antes de tocar el código, el equipo de IT debe tener abiertas estas 3 pestañas:
1. 🎨 **[estrategia_diseno.md](file:///C:/Users/nahue/.gemini/antigravity/brain/6b80ff63-c4f2-470b-a96e-3ceabad9effc/estrategia_diseno.md):** Reglas estrictas de CSS, clases (`.card`, `.btn-primary`) y comportamiento de modales. **Prohibido usar Bootstrap/Tailwind**.
2. 🧠 **[roadmap_auditoria.md](file:///C:/Users/nahue/.gemini/antigravity/brain/6b80ff63-c4f2-470b-a96e-3ceabad9effc/roadmap_auditoria.md):** Contiene la lógica de negocio. Explica *por qué* un modal se comporta de cierta manera (Ej: Validación de Cta Corriente).
3. 🗄️ **[fuente_de_verdad_completa.md](file:///C:/Users/nahue/.gemini/antigravity/brain/6b80ff63-c4f2-470b-a96e-3ceabad9effc/fuente_de_verdad_completa.md):** El diccionario de datos. Aquí están mapeados todos los insumos, unidades de medida, categorías y el BOM real extraído de Pedix.

---

## 2. Puntos de Inyección por Módulo (Data Binding)

Los archivos `.html` actuales funcionan con Javascript vainilla y objetos "hardcodeados". Aquí se detalla cómo reemplazarlos por su arquitectura real (React/Vue/Angular o plantillas de servidor).

### A. Módulo POS (`pos_prototipo.html`)
*   **El Catálogo:**
    *   **Dónde está:** Línea `995`, variable `const catalog = { ... }`.
    *   **Qué hacer:** Reemplazar por un `GET /api/pos/catalog`. El payload esperado debe venir agrupado por categorías para renderizar rápido el menú lateral.
*   **Checkout y KDS:**
    *   **Dónde está:** Línea `1346`, función `checkout()`. Actualmente guarda en `localStorage` (`'kds_orders'`).
    *   **Qué hacer:** Capturar el objeto `orderData`, mutarlo al esquema de la DB y hacer un `POST /api/orders`. El JSON debe incluir el array de `items` con sus `mods` (exclusiones/agregados) para que el KDS sepa qué imprimir.
*   **Pagos Edge-Cases:**
    *   **Dónde está:** Función `validateCheckout()`. Los límites de cuenta corriente (50.000 y 5000) están hardcodeados en el `if/else`.
    *   **Qué hacer:** Al seleccionar un cliente en el `<select id="ctaClient">`, disparar un `GET /api/clients/{id}/credit-limit` y actualizar el DOM dinámicamente.

### B. Módulo Inventario y BOM (`inventario_prototipo.html`)
*   **Conteo de Stock (Lectura):**
    *   **Dónde está:** Función `renderStockTab()`. Usa `insumosBBDD`.
    *   **Qué hacer:** Enchufar al `GET /api/inventory/current`. Es vital respetar las unidades de medida (Gramos, Litros, Unidades) extraídas de `fuente_de_verdad_completa.md`.
*   **Modal 2-en-1 (Escritura):**
    *   **Dónde está:** El modal con `<div class="tabs">` (Insumo / Producto Venta).
    *   **Qué hacer:** Al hacer submit, verificar la pestaña activa. Si es Insumo, disparar `POST /api/inventory/items`. Si es Producto, disparar `POST /api/catalog/products`. El Frontend ya se encarga de mostrar/ocultar los campos irrelevantes.

### C. Módulo Compras (`compras_inbox_prototipo.html` y Wizard)
*   **Inbox de Validaciones:**
    *   **Dónde está:** `renderInbox()`, usa array `facturas`.
    *   **Qué hacer:** Conectar a la tabla temporal de validaciones IA (`GET /api/invoices/pending`).
*   **Carga Manual (Wizard):**
    *   **Dónde está:** `compras_carga_manual_prototipo.html`.
    *   **Qué hacer:** Este formulario tiene validaciones cruzadas críticas (Ej: Si es de categoría "Carnes", fuerza la unidad a "Kilos"). Estas reglas están en el JS del frontend como "defensa en profundidad". El backend **DEBE** replicar estas validaciones al recibir el `POST` para evitar corrupción de datos (Concepto de Doble Capa).

---

## 3. Manejo de Estado (Global State)
Actualmente, los prototipos simulan ser Single Page Applications (SPAs) pero cambian de archivo `.html`.
Para la implementación en Staging:
*   **Autenticación:** El Fichaje (PIN) de `cajas_prototipo.html` debe generar un token de sesión (JWT) que viaje en el header de todas las llamadas a la API.
*   **Sucursal Contextual:** En la Sidebar unificada hay un `<select class="branch-select">` (Lanús / Avellaneda). El valor de este select debe guardarse en el Gestor de Estado (Redux, Zustand, Context) y enviarse como parámetro (`?branch_id=...`) en todas las consultas para filtrar el catálogo, stock y finanzas.
