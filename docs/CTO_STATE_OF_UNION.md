# BurgerMusic OS — CTO State of the Union

> **Clasificación:** Documento de Gobernanza Arquitectónica (Long-Term Memory)
> **Versión:** 2.0 — Fase 2 Completada (Inteligencia Operativa)
> **Última Actualización:** 2026-04-05
> **Estándar:** Antigravity 2026

---

## 0. Propósito de Este Documento

Este archivo es **código de gobernanza**, no documentación pasiva. Cualquier agente de IA, desarrollador humano o sistema de orquestación que interactúe con este repositorio **DEBE** leer este documento antes de emitir código. Su función es triple:

1. **Anti-Drift Shield:** Prohíbe la inyección de ORMs, bases de datos o patrones que contradigan la arquitectura establecida.
2. **Contexto Ejecutivo:** Provee el estado exacto de cada módulo, sus contratos y sus deudas técnicas pendientes.
3. **Onboarding Determinista:** Elimina la "Amnesia Contextual" de los LLMs, garantizando que cualquier agente futuro opere con memoria cristalizada.

---

## 1. Stack Tecnológico — Leyes Inmutables

| Capa | Tecnología | Versión | Justificación |
|------|-----------|---------|---------------|
| **Framework** | Next.js (App Router) | 16.x | RSC nativos, Server Actions, Edge Runtime |
| **UI** | Tailwind CSS v4 + Lucide React | 4.2.x | Silent Luxury SaaS, zero CSS-in-JS |
| **ORM** | Drizzle ORM | 0.39.x | Type-safe SQL, AST nativo, zero runtime overhead |
| **Base de Datos** | Turso (libSQL/SQLite) | — | Edge-native, embedded, ACID compliance |
| **Validación** | Zod | 4.x | Coerción stricta en el Edge, fail-closed |
| **AI SDK** | Vercel AI SDK + `@ai-sdk/google` | 4.x | `generateObject()` con schema Zod, determinismo |
| **LLM** | Gemini 2.5 Flash | — | Baja latencia, temperatura 0.2 para finanzas |
| **Linter** | Biome | 1.9 | Reemplaza ESLint+Prettier |
| **Testing** | Vitest + Playwright | — | Unit + E2E |
| **Monorepo Scripts** | `tsx` | 4.x | Ejecución directa de TypeScript sin build |

> [!CAUTION]
> **PROHIBICIONES ABSOLUTAS:**
> - No se permite introducir Prisma, TypeORM, Sequelize ni ningún otro ORM.
> - No se permite introducir MongoDB, PostgreSQL externo ni Firebase Firestore como storage primario.
> - No se permite `any` sin justificación explícita en los contratos de datos.
> - No se permite lógica defensiva en JavaScript para operaciones que SQLite resuelve en O(1) (ej: deduplicación, sumas, conteos).

---

## 2. Topología del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                    BurgerMusic OS — Edge Network                │
│                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐                    │
│  │ Lanús    │   │Avellaneda│   │Pizza Music│  ← Nodos Multi-T  │
│  │ (STR_01) │   │ (STR_02) │   │ (STR_03) │                    │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘                    │
│       │              │              │                           │
│       └──────────────┴──────────────┘                           │
│                      │                                          │
│              ┌───────┴───────┐                                  │
│              │  Next.js Edge │                                  │
│              │  (App Router) │                                  │
│              └───────┬───────┘                                  │
│                      │                                          │
│         ┌────────────┼────────────┐                             │
│         │            │            │                             │
│   ┌─────┴─────┐ ┌───┴────┐ ┌────┴─────┐                       │
│   │ Webhook   │ │ Server │ │ Server   │                        │
│   │ POS API   │ │Actions │ │Components│                        │
│   │ (Zod+ACID)│ │(70 fns)│ │ (RSC)    │                        │
│   └─────┬─────┘ └───┬────┘ └────┬─────┘                        │
│         │            │            │                             │
│         └────────────┴────────────┘                             │
│                      │                                          │
│              ┌───────┴───────┐                                  │
│              │   Turso DB    │                                  │
│              │  (libSQL)     │                                  │
│              │  70 Tables    │                                  │
│              └───────────────┘                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 Módulos del Dashboard (C-Level)

| Ruta | Módulo | Estado |
|------|--------|--------|
| `/dashboard/command-center` | Command Center (Bento Grid) | ✅ Activo |
| `/dashboard/sales` | Ventas & ETL Ingestion | ✅ Activo |
| `/dashboard/supply` | Suministros & Inventario | ✅ Activo |
| `/dashboard/treasury` | Tesorería & AP/AR | ✅ Activo |
| `/dashboard/cfo` | CFO P&L Analytics | ✅ Activo |
| `/dashboard/purchases` | Órdenes de Compra | ✅ Activo |
| `/dashboard/operations` | Operaciones (Checklists) | ✅ Activo |
| `/dashboard/hr` | RRHH & Labor Costs | ✅ Activo |
| `/dashboard/cashier` | POS & Cierre de Caja | ✅ Activo |
| `/dashboard/mdm` | Master Data Management | ✅ Activo |

---

## 3. Trabajos Realizados — Estado Actual

### 3.1 Fase 1: Ingesta Financiera y Zero-Debt

- **TSV Asimilado:** ~$239.622.300 ARS ingestados al ledger `fact_sales` vía ETL (CSV/Excel → Zod → Turso).
- **DLQ Purgada:** La Dead Letter Queue (`sales_mapping_dlq`) fue llevada a Zero-Entropy. Registros huérfanos resueltos vía el `AliasEngine` (NLP semántico con Gemini).
- **Alias Engine:** Sistema de mapeo `sku_aliases` que traduce nombres crudos del POS (`"COMBO X2 DOBLE C/BACON"`) a SKUs canónicos del catálogo MDM.

### 3.2 Fase 2: Inteligencia Operativa (Command Center)

- **Bento Grid Refactoring:** El Command Center fue migrado de estética "hacker/terminal" a **Silent Luxury SaaS** (Tailwind v4: `bg-slate-50`, `bg-white rounded-2xl shadow-sm border border-slate-200`).
- **KPIs Deep-Linked:** Las tarjetas top-level son `<Link>` navegables (`/dashboard/sales`, `/dashboard/supply`).
- **Motor Escalar BOM:** Query Drizzle O(1) que calcula el consumo real de medallones de carne aplicando multiplicadores escalares por variante (`TRIPLE×3`, `DOBLE×2`) directamente en SQL.
- **Tactical Agenda:** Tabla `agenda_items` en Turso con Server Actions CRUD (`addAgendaItem`, `toggleAgendaStatus`, `deleteAgendaItem`) y `revalidatePath` para rehidratación RSC.
- **Notification Hub:** Async Server Component que extrae alertas reales desde 3 fuentes concurrentes vía `Promise.all`:
  - `zombie_shift_audits` → Auditorías pendientes (🔴 CRITICAL)
  - `products` donde `costCents = 0` → SKUs sin BOM (🟡 WARNING)
  - `sales_mapping_dlq` → Anomalías no resueltas (🔵 INFO)
- **AI Decoupling:** El widget de Gemini fue desacoplado a un Client Component con "Fricción Positiva" (invocación bajo demanda, dropdown minimalista en header).
- **Multi-Tenant Nodes:** Panel "Salud de Red" que lista nodos operativos (Lanús, Avellaneda, Pizza Music). Actualmente mocks; preparado para `store_health_checks` table.
- **Schema Migration:** `drizzle-kit push` fue reemplazado por `scripts/force-migrate.ts`, un migrador determinista que parchea el SQL con `IF NOT EXISTS` para evadir Schema Drift.

---

## 4. Contratos Arquitectónicos Inmutables

### 4.1 Ley de Zod (Validación en el Edge)

Todo payload que ingrese al sistema desde fuentes externas (POS, CSV, OCR, API) **DEBE** ser validado con un schema Zod antes de tocar la base de datos.

**Ubicación canónica de schemas:** `src/lib/inventory.ts`

```typescript
// Contrato del Webhook POS (referencia física)
export const POSPayloadSchema = z.object({
  store_id: z.string().min(1),
  ticket_id: z.string().min(1),
  timestamp: z.string().datetime(),
  items: z.array(z.object({
    name: z.string().min(1),
    qty: z.number().int().positive(),
    price_cents: z.number().int().nonnegative()
  })).min(1),
});
```

> [!IMPORTANT]
> **Ley:** `safeParse()` siempre. `parse()` solo en scripts de CLI. Nunca en rutas HTTP.

### 4.2 Ley de Idempotencia (Anti-Race Condition)

La deduplicación de transacciones **NO** se realiza con un patrón `SELECT → IF NOT EXISTS → INSERT` en JavaScript. Esto crea una ventana de race condition bajo concurrencia.

**Patrón correcto (delegación a SQLite/Turso):**

```typescript
// src/app/api/webhooks/pos/route.ts (referencia física)
const ticketHash = crypto.createHash('sha256')
  .update(`${store_id}_${ticket_id}`)
  .digest('hex');

await tx.insert(fact_sales)
  .values(salesPayload)
  .onConflictDoNothing({ target: fact_sales.ticket_hash });
```

La columna `fact_sales.ticket_hash` tiene un `UNIQUE INDEX`. El motor C de SQLite resuelve la colisión en `O(1)` sin involucrar al Event Loop de Node.js.

> [!WARNING]
> **Validado por Chaos Engineering:** El script `scripts/chaos-assault.ts` bombardeó el webhook con 500 peticiones concurrentes (250 únicas + 250 duplicados). El patrón `.onConflictDoNothing()` neutralizó el 100% de los duplicados.

### 4.3 Ley de Complejidad Computacional

Toda operación de agregación financiera **DEBE** ser delegada a SQLite vía Drizzle `sql` template literals, nunca resuelta en memoria de Node.js.

```typescript
// ✅ CORRECTO: O(1) delegado a Turso
db.select({
  revenue: sql<number>`SUM(${fact_sales.net_price_cents})`
}).from(fact_sales);

// ❌ PROHIBIDO: O(N) en Node.js
const sales = await db.select().from(fact_sales);
const revenue = sales.reduce((acc, s) => acc + s.net_price_cents, 0);
```

### 4.4 Ley del Schema Drizzle (camelCase)

Las propiedades TypeScript de Drizzle usan **camelCase**. Las columnas SQL subyacentes usan **snake_case**. Drizzle resuelve el mapping automáticamente.

```typescript
// TypeScript: fact_sales.netPriceCents  (NO: net_price_cents)
// TypeScript: fact_sales.productSku     (NO: product_sku)
// TypeScript: fact_sales.createdAt      (NO: created_at)
```

> [!CAUTION]
> Referenciar propiedades en snake_case en queries Drizzle resuelve a `undefined`, lo que decapita el AST SQL y produce errores `SQLITE_ERROR: near "=": syntax error`. Este bug fue corregido en la Fase 1 (ver: Drizzle AST Reconstruction).

---

## 5. Estructura del Schema (70 Tablas)

### 5.1 Schemas Principales (`src/db/schema.ts`)

| Tabla | Propósito | Columnas Clave |
|-------|-----------|----------------|
| `fact_sales` | Data Warehouse de ventas | `ticket_hash` (UNIQUE, idempotencia), `net_price_cents`, `historical_cost_cents` |
| `products` | Catálogo MDM (Sellables + Ingredients) | `costCents`, `isSaleable`, `deletedAt` (soft-delete) |
| `transactions` | Ledger Kardex (±qty) | `type` (SALE/RECEIPT/ADJUSTMENT), `referenceId` |
| `transaction_items` | Explosión BOM por ticket | `frozenUnitPriceCents` (price inmutability) |
| `inventory_kardex` | Movimientos de stock | `quantity` (±), `productSku` |
| `recipe_items` | BOM (Bill of Materials) | `productSku` → `ingredientSku`, `quantity` |
| `sku_aliases` | Mapeo NLP de nombres POS | `raw_sku` (UNIQUE) → `product_id` |
| `sales_mapping_dlq` | Dead Letter Queue (Orfandad) | `resolved` (boolean), `raw_name` |
| `agenda_items` | Agenda Táctica del C-Level | `type` (TASK/NOTE/EVENT), `isCompleted` |
| `suppliers` | MDM de Proveedores | `cuit` (UNIQUE), `paymentTerms` |

### 5.2 Schemas Distribuidos (`src/db/schema/*.ts`)

| Archivo | Dominio | Tablas Clave |
|---------|---------|-------------|
| `bom.ts` | Bill of Materials | `bill_of_materials`, `raw_materials`, `sellable_products` |
| `supply.ts` | Supply Chain | `inventory_items`, `purchase_orders`, `goods_receipts`, `supplier_claims`, `stock_movements` |
| `treasury.ts` | Tesorería | `cash_register_closures`, `expense_line_items`, `petty_cash_fund`, `treasury_accounts`, `supplier_current_accounts` |
| `finance.ts` | Gobernanza Financiera | `zombie_shift_audits` (PENDING/RESOLVED) |
| `traceability.ts` | Trazabilidad Lote | `inventory_batches`, `prep_logs`, `unmapped_pos_transactions` |
| `uom.ts` | Unidades de Medida | `uom_conversions` |

---

## 6. Flujos Críticos (Event-Driven)

### 6.1 Ingesta POS (Webhook → Ledger)

```
POS Caja Registradora
        │
        ▼
POST /api/webhooks/pos
        │
        ├─ 1. Zero-Trust: Validate x-api-key
        ├─ 2. Zod: POSPayloadSchema.safeParse()
        ├─ 3. SHA-256 Hash: ticket_hash = hash(store_id + ticket_id)
        ├─ 4. ACID Transaction:
        │     ├─ INSERT fact_sales ON CONFLICT DO NOTHING
        │     ├─ INSERT transactions (Header)
        │     └─ TransactionExplosionEngine.explode()
        │           ├─ Resolve BOM (recipe_items)
        │           ├─ INSERT transaction_items (frozen prices)
        │           └─ INSERT inventory_kardex (-qty deduction)
        │
        └─ 5. Fail-path: MissingRecipeException
              ├─ INSERT sales_mapping_dlq (DLQ)
              └─ Fire-and-Forget: Slack Alert (SLACK_ALERT_WEBHOOK)
```

### 6.2 Alertas del Sistema (Notification Hub)

```
Turso DB (3 fuentes concurrentes via Promise.all)
        │
        ├─ zombie_shift_audits WHERE status='PENDING'    → 🔴 CRITICAL
        ├─ products WHERE costCents=0 AND isSaleable=1   → 🟡 WARNING
        └─ sales_mapping_dlq WHERE resolved=false        → 🔵 INFO
        │
        ▼
NotificationHub (Async Server Component)
        │
        ├─ Si hay alertas: Renderiza feed vertical (max-h-80)
        └─ Si vacío: ZERO-ENTROPY state (✅ All systems operational)
```

### 6.3 Zombie Shift Interceptor

El `zombie_shift_audits` registra turnos donde el `reported_margin_percent` cayó por debajo del umbral de seguridad. El estado `PENDING` bloquea operaciones sensibles vía `AuditLockdownModal.tsx` hasta que un Manager provea `manager_justification` y lo resuelva a `RESOLVED`.

---

## 7. Server Actions — Inventario de Funciones (70 Archivos)

**Ubicación:** `src/actions/`

| Categoría | Archivos | Responsabilidad |
|-----------|---------|----------------|
| **Ingesta** | `excel-ingestion.ts`, `csv-import.ts`, `data-ingestion.ts`, `bulk-sales-ingestion.ts`, `financial-ingestion.ts` | ETL de datos financieros |
| **AI/NLP** | `ai-telemetry.ts`, `alias-agent.ts`, `alias-engine.ts`, `gemini-ocr.ts`, `ocr-ingestion.ts` | Procesamiento semántico |
| **BOM** | `bom-actions.ts`, `bom-mutations.ts`, `bom-processor.ts`, `bom-simulator.ts`, `depletion-engine.ts` | Recetas y explosión |
| **Finanzas** | `PnLEngine.ts`, `ProfitabilityEngine.ts`, `treasury-engine.ts`, `tax-actions.ts` | P&L y tesorería |
| **Supply** | `ProcurementEngine.ts`, `ReceivingEngine.ts`, `purchase-orders.ts`, `procurement-actions.ts` | Compras y recepción |
| **Command Center** | `agenda-actions.ts`, `command-center.ts` | Agenda Táctica y telemetría |
| **Resolución** | `resolve-anomaly.ts`, `resolve-exception.ts`, `resolve-interlock.ts` | Closed-loop corrections |

---

## 8. Motor BOM (TransactionExplosionEngine)

**Ubicación:** `src/services/explosion-engine.ts`

El `TransactionExplosionEngine` es el corazón metabólico del sistema. Cada venta POS dispara una "explosión" que:

1. **Congela** el precio unitario en `transaction_items.frozenUnitPriceCents`.
2. **Resuelve** la receta via `recipe_items` (BOM lookup).
3. **Deduce** del inventario via `inventory_kardex` (movimiento negativo).
4. **Falla cerrado:** Si no encuentra receta, lanza `MissingRecipeException` → DLQ → Slack Alert.

### 8.1 Motor Escalar de Variantes (Command Center)

Para el Command Center, el cálculo de "Burn Rate de Insumos Núcleo" aplica multiplicadores escalares directamente en SQL:

```sql
SUM(
  CASE
    WHEN products.name LIKE '%TRIPLE%' THEN fact_sales.quantity * 3
    WHEN products.name LIKE '%DOBLE%'  THEN fact_sales.quantity * 2
    ELSE fact_sales.quantity * 1
  END
)
```

Correlación termodinámica derivada: **Fetas de Queso = Medallones × 2** (asunción base del ecosistema).

---

## 9. Design System — Silent Luxury SaaS

### 9.1 Tokens Obligatorios (Tailwind v4)

| Elemento | Clase |
|----------|-------|
| Fondo general | `bg-slate-50` |
| Card | `bg-white rounded-2xl shadow-sm border border-slate-200` |
| Card hover | `hover:shadow-md hover:border-indigo-200 transition-all duration-200` |
| Título | `text-slate-800 font-bold tracking-tight` |
| Dato crudo | `text-slate-900 font-extrabold` |
| Subtítulo | `text-slate-500 text-xs font-bold uppercase tracking-wider` |
| Acento primario | `text-indigo-600`, `bg-indigo-50` |
| Acento éxito | `text-emerald-600`, `bg-emerald-50` |
| Acento peligro | `text-red-600`, `bg-red-50` |
| Acento advertencia | `text-amber-600`, `bg-amber-50` |

### 9.2 Patrón de Componentes

| Tipo | Directiva | Ejemplo |
|------|-----------|---------|
| **Server Component** | Fetching O(1), `Promise.all`, sin estado | `NotificationHub`, `CommandCenterPage` |
| **Client Component** | Estado local, interacción, `"use client"` | `TacticalAgenda`, `AITelemetryWidget`, `DrillDownCard` |

> [!IMPORTANT]
> Los Server Components **NUNCA** deben importar hooks (`useState`, `useEffect`). Los Client Components **NUNCA** deben ejecutar queries directas a la DB; deben invocar Server Actions.

---

## 10. Variables de Entorno Requeridas

```env
TURSO_DATABASE_URL=file:local.db          # Producción: libsql://xxx.turso.io
TURSO_AUTH_TOKEN=                          # Token Turso (prod only)
POS_WEBHOOK_KEY=                           # API Key para webhook POS
GOOGLE_GENERATIVE_AI_API_KEY=              # Gemini API Key
SLACK_ALERT_WEBHOOK=                       # Webhook Slack para DLQ alerts (opcional)
```

---

## 11. Scripts de Operación

| Script | Comando | Propósito |
|--------|---------|-----------|
| `force-migrate.ts` | `npx tsx scripts/force-migrate.ts` | Migración determinista (bypass drizzle-kit push) |
| `chaos-assault.ts` | `npx tsx scripts/chaos-assault.ts` | Chaos Engineering (500 req, retry storm) |
| `force-csv-ingest.ts` | `npx tsx scripts/force-csv-ingest.ts` | Ingesta offline de CSVs |
| `nuke-dlq.ts` | `npx tsx scripts/nuke-dlq.ts` | Purga del DLQ |
| `audit-ledger.ts` | `npx tsx scripts/audit-ledger.ts` | Auditoría del fact_sales |
| `forge-unique-index.ts` | `npx tsx scripts/forge-unique-index.ts` | Creación de índices faltantes |

---

## 12. Deudas Técnicas Documentadas

| ID | Área | Deuda | Prioridad |
|----|------|-------|-----------|
| DT-001 | Command Center | AP Debt, Stock Crítico y 86'd Items son **mocks**. Requieren queries reales a `accounts_payable`, `inventory_items` y `products` | P1 |
| DT-002 | Multi-Tenant | Nodos de red (Lanús, Avellaneda, Pizza Music) son **mocks**. Requieren tabla `store_health_checks` y heartbeat real | P2 |
| DT-003 | Webhook POS | `productSku` recibe `item.name` raw en lugar del SKU canónico. Debería pasar por el `AliasEngine` first | P1 |
| DT-004 | Motor Escalar | La correlación `Queso = Medallones × 2` es una asunción fija. Debe derivarse del BOM real (`recipe_items`) | P2 |
| DT-005 | Chaos Eng | El 100% de las peticiones del chaos-assault fallaron inicialmente por saturación SQLITE_BUSY. Se mitigó con batching (15 req/lote), pero el webhook carece de retry con backoff nativo | P2 |

---

## 13. Roadmap — Fase 3: Autonomic Procurement

### 13.1 Autonomic Procurement Agent

Un agente autónomo que analiza el `Burn Rate Escalar` de insumos núcleo, cruza contra el `inventory_kardex` actual y genera automáticamente **Órdenes de Compra** (`purchase_orders` + `purchase_order_items`) para proveedores con menor `lead_time`.

### 13.2 Real-Time Multi-Tenant Health

Implementar `store_health_checks` table con heartbeats periódicos desde cada nodo. El Command Center mostrará semáforos reales en lugar de mocks.

### 13.3 Closed-Loop Alerting

Conectar el `NotificationHub` con Server Actions que permitan al Manager resolver alertas directamente desde el Command Center (ej: "Resolver" un Zombie Audit, "Re-ordenar" un insumo crítico) sin cambiar de ruta.

### 13.4 Financial Reconciliation Automation

Automatizar la conciliación entre `gateway_settlements` (MercadoPago) y `fact_sales` para detectar discrepancias de liquidación en O(1).

---

## 14. Reglas para Agentes Futuros

1. **Lee este documento completo** antes de emitir código.
2. **Nunca introduzcas dependencias** que no estén en `package.json` sin aprobación explícita.
3. **Toda query a Turso** debe usar Drizzle ORM con `sql` template literals para agregaciones.
4. **Todo payload externo** debe validarse con Zod (`safeParse`).
5. **Toda mutación** debe ejecutar `revalidatePath()` para rehidratar los RSC.
6. **El schema usa camelCase** en TypeScript. Referencia propiedades exactas del schema exportado.
7. **Fail-Closed siempre:** Si algo falla, renderiza un bloque de error visible. Nunca un blank screen.
8. **No alucines rutas ni tablas.** Si no estás seguro de que existen, verifica antes contra `src/db/schema.ts`.
9. **La estética es Silent Luxury.** `bg-slate-50`, cards blancas, acentos índigo. Cero dark mode, cero neón.
10. **Los centavos son la unidad canónica.** Todos los montos se almacenan en `_cents` (integer). La conversión a pesos se hace en la capa de presentación dividiendo por 100.

---

*Este documento es auto-suficiente. Si estás leyendo esto, ya tienes todo el contexto que necesitas para operar sobre BurgerMusic OS sin introducir entropía.*
