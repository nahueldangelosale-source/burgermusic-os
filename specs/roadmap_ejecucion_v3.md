# 🚀 Master Execution Plan: BurgerMusic OS v3.1 (Phases 1, 2 & 3)

## 1. Directivas de Operación del Agente
- **Rol:** Actúa como un Ingeniero Agéntico Senior y Arquitecto de Sistemas.
- **Modo de Ejecución:** Estrictamente "Review-driven development". 
- **Restricción de Seguridad (Anti-Slopsquatting):** Tienes prohibido inventar o instalar dependencias de terceros (NPM) que no estén explícitamente autorizadas en este documento o en el `package.json` actual, para evitar vulnerabilidades de la cadena de suministro [6].
- **Salida Esperada:** Antes de escribir código, debes generar un "Implementation Plan" detallado y un "Task List" paso a paso [4, 5]. Espera mi aprobación (`/approve`) antes de modificar los archivos.

## 2. Fase 1: Refactorización Core y Base de Datos (Prioridad P0)
**Estrategia:** Resolución de deuda técnica y adaptación a la nueva unidad de negocios (Pizzería).

*   **1.1. Idempotencia Atómica (Race Condition Fix):**
    *   **Archivo:** `schema.ts`.
    *   **Acción:** Elimina la validación manual con `SELECT`. En su lugar, añade una restricción `UNIQUE(reference_id, store_id)` en la tabla de transacciones. Debemos delegar el control de duplicados al motor SQLite (Turso DB).
*   **1.2. Soporte para Fracciones (Pizzería):**
    *   **Archivo:** `schema.ts` (tabla `products` / `inventory`).
    *   **Acción:** Asegúrate de que las cantidades (`quantity`) soporte tipos fraccionarios (`REAL` o `DECIMAL`) y añade un ENUM para unidades de medida (ej. `UNIDAD`, `GRAMOS`, `LITROS`).
*   **1.3. Nuevo Motor de Recetas (BOM):**
    *   **Archivo:** `src/lib/recipe-parser.ts`.
    *   **Acción:** Elimina el matching difuso estático (`BURGER_CATALOG`). El motor debe consultar dinámicamente la tabla `recipes` en la base de datos para deducir ingredientes fraccionarios (ej. 300g de masa, 150g de mozzarella).
*   **1.4. Resolución N+1 (Bulk Insert):**
    *   **Archivo:** `stock-engine.ts` y Webhook POS.
    *   **Acción:** Elimina el bucle `for` que ejecuta transacciones individuales. Calcula las agregaciones en memoria y ejecuta un único `tx.insert(transactions).values([...])`.

## 3. Fase 2: Contrato API Webhook y Seguridad Zero-Trust (Prioridad P1)
**Estrategia:** Asegurar el endpoint de recepción de ventas mediante arquitectura Push y aislamiento Multi-Tenant.

*   **2.1. Aislamiento por Sucursal (RBAC):**
    *   **Acción:** Asegura que la API de Webhook valide que el payload entrante pertenezca exclusivamente a la sucursal emisora. Genera lógica para emitir y validar `x-api-key` distintas por cada `store_id`.
*   **2.2. Rate Limiting (Protección DoS):**
    *   **Acción:** Implementa limitación de tasa (Rate Limiting) en el endpoint `/api/webhooks/pos`. 
    *   *Nota de dependencias:* Puedes utilizar `@upstash/ratelimit` u otra librería estándar probada. Pide autorización antes de instalarla.
*   **2.3. Validación Estricta con Zod:**
    *   **Acción:** Mantén la validación del payload transaccional usando Zod para aislar datos corruptos antes de que toquen la base de datos.

## 4. Fase 3: Módulo de Alertas Activas (Prioridad P2)
**Estrategia:** Notificaciones en tiempo real para la Gerencia (C-Level).

*   **3.1. Integración de Notificaciones:**
    *   **Acción:** Diseña el andamiaje (`scaffolding`) para un servicio de notificaciones que envíe alertas vía Twilio o la API de WhatsApp Business.
*   **3.2. Disparadores de Alerta (Triggers):**
    *   **Acción:** Configura la lógica para que el sistema emita alertas automáticamente bajo dos condiciones:
        1.  El conteo de inventario (declarado vs. teórico) supera un 5% de varianza.
        2.  Un ingrediente crítico (ej. pan de hamburguesa, masa de pizza) cae por debajo del umbral de "Días de Inventario Disponible".

## 5. Instrucción Final para el Agente
Por favor, analiza este documento. Genera el **Implementation Plan** con la arquitectura propuesta y el **Task Plan** detallado. Detente y espera mis comentarios.
