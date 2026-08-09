# Walkthrough: Music OS - Prototipos Operativos

Este documento resume los flujos funcionales de los prototipos implementados para evaluar la experiencia de usuario (UX) en los diferentes módulos del sistema.

> **Prototipos activos:** 17 archivos HTML | **Módulos cubiertos:** 10 de 18 (55%) | **Navegación:** 9 pantallas conectadas por sidebar unificado

---

## Fase 1: Core Operativo

### 1. Dashboard Ejecutivo (`dashboard_prototipo.html`)
Centro de control con KPIs financieros en tiempo real, grilla de ventas por canal (Mostrador, Delivery, Apps), alertas inteligentes priorizadas y selector multi-sucursal (Lanús / Franquicia / Todas).

### 2. Punto de Venta — POS (`pos_prototipo.html`)
- **Fichaje PIN:** Overlay de acceso con teclado numérico (Concepto A — RRHH).
- **Catálogo real Pedix:** Productos temáticos musicales con modificadores estrictos (Tamaño, Papas, Extras).
- **Split Payment:** Desglose dinámico Efectivo + MercadoPago con cálculo automático de resto.
- **Cortesías trazables:** Menú de acciones (Descuento %, Cortesía, Consumo Personal) que impacta ticket y stock.
- **Freno de Emergencia:** Botón Anular con timer de seguridad de 2s.
- **Cta. Corriente:** Método de pago B2B con límite de crédito dinámico (Concepto B — Finanzas).

### 3. Cocina — KDS (`kds_prototipo.html`)
- **Kanban de comandas** con routing automático (Parrilla vs Mostrador).
- **Checklist Atómico:** Despacho parcial ítem por ítem con barra de progreso.
- **Recall 10s:** Panel flotante para revertir despachos accidentales.
- **Badge de Lote Activo:** Vinculación de cada comanda al lote de producción en uso.

### 4. Delivery Inteligente (`delivery_prototipo.html`)
Asignación semi-automática de repartidores, timeline de estados (Asignado → En camino → Entregado), integración de pedidos desde apps externas (Rappi, PedidosYa, Uber).

### 5. Gestión de Cajas (`cajas_prototipo.html`)
- Apertura con monto inicial, cierre con conciliación automática (esperado vs. real).
- **Rendición de Cadetes:** Pestaña dedicada con match exacto de efectivo, habilitando liquidación solo si coincide.

---

## Fase 2: Abastecimiento, Stock y Producción

### 6. Inventario Gerencial (`inventario_prototipo.html`)
- **Tabs por tipo** (Productos Venta, Insumos, Elaboraciones) con Ley de Hick.
- **Acordeones por categoría** (Carnes, Panes, Quesos, Congelados, Verduras, Salsas) con datos reales de la Fuente de Verdad.
- **Recetas BOM visuales:** Barras proporcionales de composición con leyenda de color (Carne, Pan, Queso, Verdura, Salsa, Congelado).
- **Panel de Salud del Inventario:** Barras de progreso de completitud (recetas, stock mínimos, proveedores).
- **Timeline de Movimientos de Stock:** Historial cronológico con color coding direccional (verde ingresos, naranja egresos) y chips de filtro rápido.
- **Onboarding Pedagógico Inline:** 5 disparadores contextuales implementados:
  - Trigger 1: Receta incompleta (CHARLY)
  - Trigger 2: CMV Alto / Riesgo Alto (MADONNA Veggie)
  - Trigger 3: Insumo sin proveedor (Medallones)
  - Trigger 7: Fluctuación de precio (Bondiola)
  - Trigger 8: Incongruencia de unidad de medida (Bondiola)
- **Telemetría GA4:** Mock de eventos `trigger_shown` / `trigger_resolved` en consola.

### 7. Conteo de Stock (`conteo_stock_prototipo.html`)
Pantalla táctil para operarios de depósito. Inputs numéricos grandes, recorrido ítem por ítem, envío de conteo por turno. Flujo 100% independiente del Inventario Gerencial.

### 8. Producción — Operario (`produccion_prototipo.html`)
- Mobile-first, sin métricas financieras.
- Selector rápido de producto a elaborar (Carnes, Salsas, Panes).
- Auto-generación de código de lote y vencimiento.
- Validación anti "fat-finger" con límites operativos.
- Botón de impresión con cuenta regresiva de 3s (salida de emergencia).

### 9. Producción — Gerencial (`produccion_gerencial_prototipo.html`)
- Desktop-first con sidebar unificado.
- **Torre de Control de Rinde:** Eficiencia global, reaprovechamiento, mermas económicas.
- **Historial de Lotes:** Tracking de reportes de producción con insignias de desviaciones.
- **Alertas de Prioridad Alta:** Sin terminología alarmista ("Crítico" → "Prioridad Alta").

### 10. Compras y Proveedores (6 sub-flujos)
| Archivo | Función |
|---------|---------|
| `compras_inbox_prototipo.html` | Bandeja de entrada de facturas con estados (Pendiente, Validado, Rechazado) |
| `compras_validacion_prototipo.html` | Vista "lado a lado" (imagen vs. datos IA) para revisión humana |
| `compras_subir_pdf_prototipo.html` | Upload de factura PDF con extracción automática |
| `compras_nueva_factura_prototipo.html` | Creación manual de factura |
| `compras_carga_manual_prototipo.html` | Carga manual completa de compra |
| `compras_recepcion_parcial_prototipo.html` | Recepción parcial de mercadería |
| `compras_express_prototipo.html` | Compra rápida para insumos frecuentes |
| `compras_layout_prototipo.html` | Layout base del módulo de compras |

---

## Principios de Diseño Aplicados

| Principio | Implementación |
|-----------|---------------|
| **Jerarquía Tipográfica** | Montserrat (títulos, montos) + Lato (datos, metadatos) |
| **Desaturación Estratégica** | Dots neutrales por defecto, color solo para excepciones |
| **Tangibilidad Material** | Sombras sutiles + elevación en hover (`translateY(-2px)`) |
| **Microinteracciones** | Efecto Ripple/Pulso en botones de acción (`btn-action-pulse`) |
| **Onboarding Inline** | Banners slide-down contextuales, no modales, accionables |
| **Arquitectura Dual** | Operario (Mobile, táctico) vs Gerente (Desktop, estratégico) |
| **Ley de Hick** | Tabs, chips y filtros rápidos para reducir opciones |

---

> [!TIP]
> **Próximos pasos:** Cerrar las 4 brechas de conectividad inter-módulo (links profundos Dashboard→Inventario, toast post-cobro POS→Stock, badge de ingreso Compras→Timeline, widget consumo Producción→Stock) para lograr una demo 100% fluida de punta a punta.
