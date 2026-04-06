# 🚨 REPORTE DE INCIDENCIA P0: FALLA MASIVA DE INGESTA ETL (BURGERMUSIC OS)

**Prioridad:** CRÍTICA (Bloqueo de Estado Financiero C-Level)
**Módulo:** `sales-sync.ts` & `IngestionAirlocks.tsx`
**Fecha de Reporte:** 3 de Abril, 2026

---

## 1. Naturaleza de la Falla ("Estado Estéril")
A pesar de inyectar archivos CSV y XLSX (ej. `Ventas 1Q`) a través de la Interfaz Airlock, el Dashboard Global de Ventas no recibe ninguna transacción transmutada, reportando un "Estado Estéril" permanente.

Las trazas O(1) han revelado que la base de datos transaccional (`fact_sales`) permanece completamente vacía luego de presionar "Ingestar Ventas". El sistema no advierte errores graves en pantalla, actuando con un comportamiento de "Silent Drop" (Caída Silenciosa).

## 2. Capa 1 Superada: Entropía de Regionalización (Excel Shift)
La investigación inicial detectó una corrupción agresiva provocada por exportaciones en Excel. Al manipular / exportar el archivo desde ciertos sistemas operativos, Excel modificó arbitrariamente la codificación estructural:
* **Precios corrompidos:** Mutaron de patrón argentino `( $ 52.800,00 )` a patrón americano `( $ 8,600.00 )`. *El sistema dividía montos erróneamente resultando en hamburguesas de 15 centavos.*
* **Fechas transpuestas:** Mutaron de patrón `DD/MM/YYYY` (ej. 19/2/2026) a patrón `MM/DD/YY` (ej. 3/10/26 = 10 de Marzo). *El sistema colapsaba esto a la fecha actual asumiéndolas inválidas.*

✅ **ESTRATEGIA APLICADA:** Se inyectaron expresiones regulares hiper-resilientes en `sales-sync.ts` y motores predictivos de fecha (`parseDateHeuristic`) que hoy destripan y extraen fechas y dinero con total inmunidad al formato americano/argentino.

## 3. Capa 2 Actual (EL BLOQUEO): Falla de Acoplamiento de Catálogo MDM
El equipo de SRE simuló una inyección cruda (vía `scripts/pure-debug.ts`) y detectó la raíz absoluta del "Estado Estéril" de este momento.

El parche de fechas y números es exitoso, pero **el 100% de las filas están siendo eyectadas al DLQ o descartadas** por la regla estricta de `Zero-Trust` del motor de búsqueda:

```typescript
// Fragmento de sales-sync.ts
if (!matchedProduct) {
   unknownItems.push(descCleaned);
   continue; // SILENT DROP
}
```

### ¿Por qué falla el Match si los productos son reales?
El CSV contiene los siguientes descriptores:
- `"AROS DE CEBOLLA X 12 + PAPAS + BBQ"`
- `"Beatle Doble 220g "`
- `"Clasic Triple 330g"`
- `"cambio x dip cheddar"`

El ETL intenta deducir las variantes usando el NLP Motor, y si no lo logra, busca la concordancia exacta. Al parecer, la tabla física `products` o el diccionario de resolución matemática en `alias-engine.ts` carece absolutamente de estos ítems, ya sea por mayúsculas disruptivas, diferencias en la carga original, o porque el catálogo maestro de BurgerMusic sufrió un truncamiento durante el último refactor de "Seeding". Al no existir el producto en base de datos, el Pipeline asume que es "Huérfano" y se niega a ensuciar `fact_sales`.

## 4. Plan de Acción (CTO & Equipo de Desarrollo)
Para destrabar el Cuadro de Mandos C-Level en este instante, el equipo necesita ejecutar lo siguiente:

1. **Auditoría de Orfandad (DLQ Check):** El código debe exponer qué ítems exactos se están considerando `UNKNOWN`. Recomendamos que el log tire un `console.warn` de la lista de huérfanos generada al finalizar el ETL.
2. **Re-Sincronización del Semillero MDM (Seeding):** Correr el script maestro de hidratación de catálogo en Turso (`seed-production-catalog.ts` o la UI de Supply) garantizando que ítems base como "Beatle" o "Clasic" y combos de empanadas estén en la base de datos `products` con esos mismos nombres para que la regresión por string-matching de un HIT positivo (Matched).
3. **Mapeo de Alias Agresivo:** Los ítems "combos" u ofertas del tipo `"PROMO 2-- 2 x Charly doble "` sobrepasan el alcance del NLP Extractor de Medallones (ya que no es sólo un medallón extra, cambia toda la métrica de inventario y costo al ser 2 hamburguesas juntas). Se requiere añadir esta heurística explícitamente en el catálogo de combinaciones.

**Estatus Requerido:** Necesidad de cargar el Catálogo Canónico Base para validar la integración ETL. Fin del reporte.
