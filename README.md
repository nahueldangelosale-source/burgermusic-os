# 🍔 BurgerMusic OS

Sistema de trazabilidad de mercadería para hamburgueserías. Reemplaza la gestión manual vía Excel y WhatsApp con un motor transaccional auditable.

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                    │
│  Dashboard │ Recepción │ Cocina │ Oráculo │ Finanzas   │
└────────────────────────┬────────────────────────────────┘
                         │ Server Actions + RSC
┌────────────────────────▼────────────────────────────────┐
│                   Backend (Next.js API)                  │
│  stock-engine.ts │ auditor.ts │ forecasting.ts │ ETL    │
└────────────────────────┬────────────────────────────────┘
                         │ Drizzle ORM
┌────────────────────────▼────────────────────────────────┐
│               Base de Datos (Turso / libSQL)            │
│  products │ transactions (Ledger) │ daily_cash_closures │
│  recipes  │ sync_state (per-tab)  │ inventory_snapshots │
└─────────────────────────────────────────────────────────┘
                         │ ETL (googleapis)
┌────────────────────────▼────────────────────────────────┐
│         Google Sheets (Cierres de Caja por Mes)         │
└─────────────────────────────────────────────────────────┘
```

| Capa | Tecnología |
|:---|:---|
| Framework | Next.js 16 (App Router, Server Actions) |
| Base de Datos | Turso (SQLite distribuido) via libSQL |
| ORM | Drizzle ORM |
| UI | React 19, Tailwind CSS 3, Recharts, Lucide Icons |
| AI | Vercel AI SDK + Google Gemini (OCR facturas, parseo WhatsApp) |
| ETL | Google Sheets API v4 (googleapis) |
| Tests | Vitest |
| Linter | Biome |
| CI/CD | GitHub Actions |

## Módulos del Sistema

| Módulo | Ruta | Función |
|:---|:---|:---|
| **Dashboard** | `/dashboard` | KPIs, auditoría de stock, varianzas |
| **Finanzas** | `/dashboard` (tab) | Flujo de caja, distribución de pagos, alertas de varianza |
| **Recepción** | `/receive` | OCR de facturas de proveedores → `RECEIPT` |
| **Cocina** | `/ingest` | Conteo físico vía WhatsApp → `COUNT` |
| **El Oráculo** | `/dashboard/ordering` | Forecasting de compras (ADC × días) |
| **Ventas** | `/sales` | Carga CSV/Excel → `SALE` |
| **Sync Financiero** | `POST /api/sync/sales` | ETL de cierres de caja desde Google Sheets |
| **Menú** | `/dashboard/menu` | Gestión de productos y recetas (BOM) |

## Setup Local

### Prerequisitos
- Node.js 20+
- npm
- Cuenta Turso (o SQLite local)

### Instalación

```bash
# 1. Clonar e instalar
git clone <repo-url>
cd BurgerMusic
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales (ver sección abajo)

# 3. Empujar esquema a la base de datos
npm run db:push

# 4. Sembrar datos iniciales (productos, recetas)
npm run db:seed

# 5. Migrar datos al patrón Ledger (si hay datos previos)
npm run db:migrate-ledger

# 6. Levantar servidor de desarrollo
npm run dev
```

## Variables de Entorno

| Variable | Requerida | Descripción |
|:---|:---|:---|
| `TURSO_DATABASE_URL` | ✅ Sí | URL de la base de datos Turso (`libsql://...`) |
| `TURSO_AUTH_TOKEN` | ⚠️ Prod | Token de autenticación Turso (no requerido en local con file:) |
| `AUTH_SECRET` | ✅ Sí | Secret para JWT (mínimo 8 caracteres) |
| `KITCHEN_PIN` | ✅ Sí | PIN de acceso a la ruta de cocina (`/ingest`) |
| `OPENAI_API_KEY` | ⚠️ Opcional | API key para funciones de AI (OCR, parseo) |
| `GOOGLE_SHEETS_CREDENTIALS_B64` | ⚠️ Opcional | Service Account JSON de GCP codificado en Base64 |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | ⚠️ Opcional | ID del Google Sheet del Manager |

### Setup de Google Sheets (ETL)

```bash
# 1. Crear Service Account en GCP Console
# 2. Habilitar Google Sheets API
# 3. Descargar JSON key
# 4. Codificar en base64 (una línea continua, sin \r\n):
#    Linux/Mac:
cat service-account.json | base64 -w 0
#    Windows (PowerShell):
[Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))
# 5. Pegar en GOOGLE_SHEETS_CREDENTIALS_B64
# 6. Compartir el Google Sheet con el email del Service Account
```

## Comandos Útiles

```bash
# ─── Desarrollo ───
npm run dev              # Servidor de desarrollo (http://localhost:3000)
npm run build            # Build de producción
npm run start            # Servidor de producción

# ─── Calidad ───
npm test                 # Correr tests (16 tests, 3 suites)
npm run test:watch       # Tests en modo watch
npm run lint             # Linter (Biome)
npm run format           # Auto-format (Biome)

# ─── Base de Datos ───
npm run db:push          # Sincronizar esquema con Turso
npm run db:seed          # Sembrar datos iniciales
npm run db:migrate-ledger # Migrar datos al patrón Kardex/Ledger
```

## Motor Transaccional (Kardex / Ledger)

El core del sistema es un patrón de **Libro Mayor inmutable**. Cada movimiento de inventario es un registro en la tabla `transactions`:

| Tipo | Signo | Descripción |
|:---|:---|:---|
| `RECEIPT` | ✅ +qty | Entrada por factura de proveedor |
| `SALE` | ❌ -qty | Salida por venta |
| `WASTE` | ❌ -qty | Desperdicio (vencido, quemado) |
| `ADJUSTMENT` | ±qty | Corrección manual |
| `COUNT` | ±qty | Delta por conteo físico |

**Stock actual = `SUM(quantity) WHERE product_sku = X`**

Todas las escrituras pasan por `recordTransaction()` en `src/core/stock-engine.ts`. Nunca se inserta directamente en la tabla.

## CI/CD

El pipeline de GitHub Actions (`.github/workflows/ci.yml`) ejecuta en cada push/PR a `main`:

1. **Type Check** — `tsc --noEmit`
2. **Lint** — `biome check .`
3. **Tests** — `vitest run` (16 tests)

Si cualquier paso falla, el pipeline se rompe (Fail-Fast).

## ETL Financiero (Cierres de Caja)

El ETL lee cierres de caja desde Google Sheets (una pestaña por mes: ENERO, FEBRERO, MARZO...) y los carga en la tabla `daily_cash_closures`.

**Características:**
- Lectura multi-pestaña automática
- Idempotencia por pestaña (High-Water Mark en `sync_state`)
- Parseo de moneda argentina (`$150.000,50`)
- Campos: fecha, caja Z, turno, ventas mostrador/MP/delivery, totales, varianza
- **REGLA**: Estos datos son financieros. NO alimentan el stock-engine.

## Licencia

Propietario. Todos los derechos reservados.
