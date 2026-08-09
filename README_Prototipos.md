# Burger Music OS — Índice de Prototipos Frontend (Alta Fidelidad)

> **Propósito:** Este documento sirve como punto de entrada y mapa de navegación para que el equipo de ingenieros y gerencia pueda validar e interactuar con cada una de las 27 pantallas de Alta Fidelidad construidas.
> 
> Todos los archivos se encuentran en la carpeta `/HTML_Prototipos/` y están diseñados con HTML/CSS/JS nativo (sin dependencias externas), listos para ser conectados a un backend o pasados a componentes React/Vue/Angular según se defina la arquitectura.

---

## 1. Core Operativo (Punto de Venta y Despacho)
El corazón del local. Pantallas diseñadas para velocidad extrema y atención al cliente.

* **[Dashboard Ejecutivo (Torre de Control)](./HTML_Prototipos/dashboard_prototipo.html)** — Vista principal gerencial con grilla financiera, alertas y *Yield Card*.
* **[Punto de Venta (POS)](./HTML_Prototipos/pos_prototipo.html)** — Toma de pedidos, modificadores estrictos y Split Pay.
* **[Cocina KDS (Kitchen Display System)](./HTML_Prototipos/kds_prototipo.html)** — Ruteo por estación, Kanban y Checklist Atómico.
* **[Gestión de Cajas (Apertura y Cierre)](./HTML_Prototipos/cajas_prototipo.html)** — Fichaje obligatorio (PIN/QR) y control de fondo inicial.
* **[Delivery (Integraciones)](./HTML_Prototipos/delivery_prototipo.html)** — Consolidación API (PedidosYa, Rappi) y asignación de flota.

## 2. Abastecimiento e Inventario
La conexión invisible entre lo que se vende (Catálogo) y lo que se gasta (Stock).

* **[Producción (Mobile-First)](./HTML_Prototipos/produccion_prototipo.html)** — Registro de mermas, rinde de lote (Yield) y "Lote Rápido".
* **[Control de Stock (Inventario)](./HTML_Prototipos/conteo_stock_prototipo.html)** — Conteo rápido estandarizado (Smart Units), lista de Recetas (BOM) y Audit Trail (Historial de movimientos).

## 3. Compras (Inbox y Procesamiento)
Flujos diseñados con defensa en profundidad para evitar contaminación del stock y desvíos financieros.

* **[Bandeja de Entrada (Inbox)](./HTML_Prototipos/compras_inbox_prototipo.html)** — Recepción de comprobantes con estados (Pendiente, Validado).
* **[Upload PDF para IA](./HTML_Prototipos/compras_subir_pdf_prototipo.html)** (Nota: El diseño del Layout está modularizado aquí y en validación).
* **[Layout IA / Validación (Lado a Lado)](./HTML_Prototipos/compras_layout_prototipo.html)** — Auditoría visual donde la gerente aprueba los datos extraídos contra el PDF original.
* **[Carga Manual Defensiva (Wizard)](./HTML_Prototipos/compras_carga_manual_prototipo.html)** — Wizard de 3 pasos con "Constructor Flashcards" y Familias de Medida.
* **[Listado Órdenes de Compra](./HTML_Prototipos/compras_ordenes_prototipo.html)** — Grilla estilo Apple HIG para órdenes emitidas.
* **[Nueva Orden de Compra Unificada](./HTML_Prototipos/compras_nueva_orden_prototipo.html)** — Grilla modular instantánea con asistencia de stock actual.
* **[Recepciones](./HTML_Prototipos/compras_recepciones_prototipo.html)** — Pantalla para recibir físicamente la mercadería en el depósito.
* **[Cuenta Corriente Proveedor (Vista 360)](./HTML_Prototipos/compras_proveedor_cuenta_prototipo.html)** — Cronología completa de deudas, pagos y facturas de un proveedor particular, con modal central de liquidación de pago.

## 4. Finanzas y Cuentas por Pagar
Trazabilidad económica de la empresa (3-Way Match).

* **[Dashboard Financiero](./HTML_Prototipos/finanzas_dashboard_prototipo.html)** — KPIs y consolidación económica.
* **[Cuentas por Pagar (Panel Central)](./HTML_Prototipos/finanzas_cuentas_pagar_prototipo.html)** — Consolidado de deudas pendientes divididas por proveedor con estados visuales (Vencido, Al Día).
* **[Libro de Movimientos](./HTML_Prototipos/finanzas_movimientos_prototipo.html)** — Registro histórico y caja general corporativa.
* **[Categorías Financieras Semánticas](./HTML_Prototipos/finanzas_categorias_prototipo.html)** — Gestión de tags (Sueldos, Alquileres, Impuestos) con asignación de avatares (iconos+colores) para escaneo rápido.

## 5. Ventas (Auditoría)
Ingresos y validación de las cajas diarias.

* **[Dashboard Operativo de Ventas](./HTML_Prototipos/ventas_dashboard_prototipo.html)** — Analíticas y rendimiento (Ticket Promedio).
* **[Sincronización 1-Clic Apps](./HTML_Prototipos/ventas_sincronizacion_prototipo.html)** — Vista de matching de tickets vs ingresos de apps.
* **[Auditoría Cierre Z](./HTML_Prototipos/ventas_cierre_z_prototipo.html)** — Arqueos consolidados diarios de todas las terminales.
* **[Historial Tickets](./HTML_Prototipos/ventas_historial_prototipo.html)** — Visor detallado ticket por ticket.

## 6. Módulo Caja (Movimientos Menores)
Carga rápida de gastos o ingresos in-situ (Plata física).

* **[Gastos Fijos](./HTML_Prototipos/caja_gastos_fijos_prototipo.html)** — Pagos recurrentes.
* **[Gastos Eventuales](./HTML_Prototipos/caja_gastos_eventuales_prototipo.html)** — Movimientos no planeados, caja chica.
* **[Ingresos Extra](./HTML_Prototipos/caja_ingresos_extra_prototipo.html)** — Inyecciones de capital.

---
**Total: 27 Prototipos de Alta Fidelidad.**
*(Referencia oficial de negocio: `roadmap_auditoria.md` y `estrategia_diseno.md` en carpeta `.gemini/antigravity/brain`).*
