# 🍔 BurgerMusic OS — State of the System Manifesto
**Version:** `3.2` | **Status:** `GO-LIVE (Exit Code 0)`  
**Architecture:** Hexagonal / Zero-Trust / Autonomous Loop
**Target DB:** Turso (SQLite Edge)

> [!CAUTION]
> **CRITICAL DIRECTIVE FOR FUTURE AI AGENTS**  
> Cualquier LLM, AI Agent, o desarrollador humano que modifique este repositorio **DEBE acatar innegociablemente las leyes inmutables** detalladas en este manifiesto. Desviarse de la coerción a enteros, mutar la capa de telemetría, o destruir el blindaje de idempotencia resultará en un **Fail-Closed automático** y la corrupción sistemática del Kardex financiero. No se aceptan Pull Requests que quiebren el paradigma Zero-Trust.

---

## 1. Módulo Ontológico: La Ley de Hierro Matemática

### 1.1 Coerción Termodinámica de Enteros
Queda estrictamente prohibida la utilización de coma flotante (`float`, `real`, `decimal`) en métricas volumétricas atómicas y financieras base de toda la red.
- Todo circuito dinerario se representa en **Centavos Fijos (`_cents`)** utilizando el tipo `INTEGER` en Turso DB. Ejemplo: `$45.50` se procesa innegociablemente como `4550`.
- Todo inventario atómico base (Kardex) o factor de conversión de Anti-Corruption Layer (ACL) rige sobre la métrica absoluta universal: **Gramos (`quantityGrams`)**.
- Esta regla erradica la deuda estructural de pérdida de precisión por manipulación en la memoria del runtime (V8 / Edge).

---

## 2. Módulo Transaccional: Resiliencia SRE y DDD

### 2.1 Escudo de Idempotencia O(1)
El Webhook POS (Punto de Venta) recibe cargas masivas en entornos hostiles con eventual pérdida de paquetes. Se implementa inmutabilidad idempotente delegada en el driver C nativo:
- Todos los queries de inserción financiera hacia `fact_sales` dictaminan `.onConflictDoNothing({ target: fact_sales.ticket_hash })`.
- El controlador del Webhook envuelve el dominio en bloques estancos `try/catch`, absorbiendo duplicados retornando HTTP 200 `ignored_duplicate` e impidiendo apagones en cascada (HTTP 500) en el Edge Network.

### 2.2 Heurística Física de Reduflación (Shrinkflation)
El sistema rechaza la especulación inflacionaria del precio transitorio. Mide anomalías estrictamente físicas contrastando remitos facturados contra el Master Data Management (MDM).
- **Triggger Matemático:** `((peso_nominal_gramos - peso_facturado_gramos) / peso_nominal_gramos) > 0.035`
- Una variación superior al 3.5% arroja una interrupción determinista devolviendo Exception: `REQUIRES_HUMAN_AUDIT` (Fail-Closed).

---

## 3. Módulo Agéntico: Orquestación del "Closed-Loop"

El ecosistema opera sin transcripción manual bajo tres fases inmutables:
1. **Ingestión VLM (Vision Language Model) a O(1):** Las facturas PDF/Imágenes se procesan a través de `gemini-2.5-pro` utilizando **Grammar Constrained Decoding (GCD)** blindado en Zod. Modificar este parseo estricto permite Inyecciones Prompt.
2. **Fricción Positiva (Zero-Trust UI):** Todo insumo crudo extraído que no mapea mediante la Capa Anticorrupción con el MDM resulta en un estado `PENDING_MAPPING`. La UI no reactiva retiene la factura en la **Bóveda de Homologación** forzando al Capital Humano a dictar el `conversionFactor` a gramos.
3. **El Demonio y la Bóveda de Compras (Procurement Daemon):** 
   - A las 03:00 UTC (Cron Zero-Trust), el Agente verifica el `(BurnRateDiario * LeadTimeDias) + SafetyStockGrams` determinando umbrales deficitarios.
   - Genera los borradores (`status = DRAFT`) en la tabla `purchase_orders`. 
   - **Línea de Bloqueo:** El demonio Carece de Autenticidad para inyectar gastos directos (`APPROVED`). El humano debe liberar el Lock de SQLite presionando el botón en la Approval Vault UI.

---

## 4. Módulo FinOps: Observabilidad y Rentabilidad (ROI)

El ecosistema agéntico está hipervisado para prever la **Fiebre del Consumo de Tokens**.

### 4.1 Telemetría Semántica
- Todos los Server Actions implementan la especificación nativa de OpenTelemetry y emiten trazas FinOps estandarizadas inyectando `gen_ai.usage.input_tokens` y `gen_ai.request.model`.
- Estas ejecuciones se sincronizan en el proxy ledger OTel para prevenir el Client-Side Bloat.

### 4.2 Tablero de Control de Capital (C-Level Radar)
- Calcula en tiempo real el costo exacto del llamado API de Gemini (OPEX).
- Cruza la métrica con el **Total Strategic Value (TSV)**, calculado en `3 minutos labor` y `5 minutos labor` reemplazados por Operación VLM y Emisión PO, respectivamente.
- Suena una alerta termodinámica innegociable cuando el `apiCostUsd` atenta contra los márgenes de negocio preestablecidos o baja la eficiencia iterativa del `roiMultiplier`.
