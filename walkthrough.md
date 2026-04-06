# SRE P0 — Disaster Recovery & Schema Sync

## Forensic Audit Results

### Regla 1: Schema Sync (Drizzle ORM Drift)

**Finding:** The Drizzle schema files are **already correct** at V3.2. All three reported missing entities exist:

| Entity | Location | Status |
|---|---|---|
| `cash_register_closures` table | [treasury.ts](file:///d:/Musica%20Descargada/BurgerMusic/src/db/schema/treasury.ts#L87-L96) | ✅ Declared |
| `completed_at` column on `fact_sales` | [schema.ts](file:///d:/Musica%20Descargada/BurgerMusic/src/db/schema.ts#L622) | ✅ Declared |
| `maximum_capacity` column on `inventory_items` | [supply.ts](file:///d:/Musica%20Descargada/BurgerMusic/src/db/schema/supply.ts#L16) | ✅ Declared |

> [!IMPORTANT]
> The SQLITE_ERRORs confirm that the **physical Turso database** is behind the code. You must push the Drizzle schema to the remote DB.

---

### Regla 2: Frontend Exorcism

#### ChannelDonutChart — Width/Height -1 (FIXED)

**Root cause:** Tremor's `DonutChart` was nested inside Recharts' `<ResponsiveContainer>`. These are from different libraries — Tremor's DonutChart is NOT a valid Recharts child and doesn't receive the dimensions from ResponsiveContainer, resulting in `width(-1) height(-1)`.

**Fix applied in** [client-components.tsx](file:///d:/Musica%20Descargada/BurgerMusic/src/app/%28c-level%29/dashboard/sales/client-components.tsx):
- Removed `DonutChart` import from `@tremor/react`
- Added `PieChart, Pie, Cell, Legend` imports from `recharts`
- Replaced the entire `ChannelDonutChart` body with a native Recharts `PieChart` + `Pie` + `Cell` implementation

#### File Upload Validation — NO BLOCKING FOUND

**Finding:** There is **no** `file.name.endsWith('.xlsx')` or blocking `alert()` in either:
- `VentasDashboard.tsx` — accepts `.csv, .xlsx` with no validation gate
- `ExcelIngestionVault.tsx` — accepts `.csv, .xlsx` and passes directly to the backend Zod pipeline

Both components are **already clean**. The reported `.xlsx` validation block has been eliminated in a prior DR cycle.

---

### Regla 3: Seed Script (Thermodynamics Resurrection)

Updated [seed-dr.ts](file:///d:/Musica%20Descargada/BurgerMusic/src/scripts/seed-dr.ts) V3.2:
- **7 inventory items** (Pan, Carne, Cheddar, Lechuga, Tomate, Bacon, Papas Congeladas)
- **4 products** (Clásica, Doble Cheddar, Veggie, Bacon Deluxe)
- All items initialized with `current_stock` AND `maximum_capacity` > 0
- Fully transactional (`db.transaction`), idempotent (`onConflictDoNothing`)

---

## Verification

```
npx tsc --noEmit → Exit Code 0 ✅
```

---

## 🚨 AIRLOCK COMMANDS — Execute in your local terminal

### Step 1: Push Drizzle schema to Turso (creates missing tables/columns)

```bash
npx drizzle-kit push
```

This single command will:
- CREATE TABLE `cash_register_closures` if missing
- ADD COLUMN `completed_at` to `fact_sales` if missing
- ADD COLUMN `maximum_capacity` to `inventory_items` if missing
- Sync ALL other schema drift between code and physical DB

If you need a dry-run first:
```bash
npx drizzle-kit push --dry-run
```

### Step 2: Seed the base catalog

```bash
npx tsx src/scripts/seed-dr.ts
```

### Step 3 (Optional): Generate migration files for version control

```bash
npx drizzle-kit generate
```

This creates SQL migration files in `./drizzle/` for auditing what changed.
