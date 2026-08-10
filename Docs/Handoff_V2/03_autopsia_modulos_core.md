# Handoff V2.0 - Parte 3: Autopsia de Módulos Prototipados (El Core)

Esta sección desglosa las reglas de interacción y lógica funcional de los 8 módulos actualmente prototipados. Los desarrolladores deben replicar estas mecánicas de comportamiento exactamente como se describen.

---

## 1. Dashboard Ejecutivo (`dashboard_prototipo.html`)
El cerebro analítico de la operación.
*   **Layout:** Cuadrícula (CSS Grid) estricta.
*   **Yield Cards (Medidores de Rinde):** Las tarjetas de eficiencia (ej. "Rendimiento de Carne") utilizan una barra de progreso que **debe** mutar de color matemáticamente.
    *   `> 95%`: Verde (`--success`).
    *   `90% - 94%`: Ámbar (`--warning`).
    *   `< 90%`: Rojo (`--danger`).
*   **Panel Lateral (Slide-over) de Alertas:** Los clics en las notificaciones del header no deben redirigir a otra página, sino deslizar un panel desde la derecha (`right: 0`) oscureciendo el dashboard (`backdrop-filter`) para que el gerente resuelva bloqueos (ej. Facturas trabadas) sin perder el contexto global.

## 2. Punto de Venta - POS (`pos_prototipo.html`)
Diseñado para velocidad extrema en la caja.
*   **Interacción Magnética:** Las tarjetas del catálogo de hamburguesas tienen bordes definidos (`2px solid #94A3B8`). Al pasar el ratón (Hover) o al tocar en tablet, escalan (`scale(1.02)`) con una sombra prominente (`--shadow-lg`). Esta respuesta física confirma la zona táctil.
*   **Smart Defaults:** Al hacer clic en un producto, se inyecta instantáneamente con cantidad `1` a la comanda lateral. No hay modales intermedios de "Seleccione cantidad" a menos que sea un producto configurable.
*   **Modales Estrictos:** Flujos como "Dividir Pago" o "Fiar a Empleado" bloquean la pantalla con un Modal Central (`z-index: 1000`). Está prohibido el uso de los *prompts* nativos del navegador.

## 3. Kitchen Display System - KDS (`kds_prototipo.html`)
Entorno de alta presión y monitores táctiles.
*   **Layout Kanban:** Estructura 100% horizontal sin Sidebar lateral.
*   **Interacción Atómica:** 
    1. Un toque en un ingrediente (ej. "Sin Cebolla") lo tacha (`text-decoration: line-through; opacity: 0.5`).
    2. Un toque en el botón inferior "Marchar" cambia la tarjeta a Ámbar.
    3. Un toque en "Despachar" cambia la tarjeta a Verde por 2 segundos antes de eliminarla del DOM (animación `fade-out`).

## 4. Auditoría de Depósito (`auditoria_deposito_prototipo.html`)
Inventario manual ejecutado en teléfonos móviles (Mobile-First).
*   **Acordeones Colapsados (Progressive Disclosure):** Para evitar "scroll infinito" en listas de 40+ ítems, las categorías (Carnes, Panes, etc.) inician cerradas. Al tocar, expanden su contenido empujando el resto hacia abajo.
*   **Validación Semáforo:** Cada fila de ítem posee un indicador circular (`<i class="ri-checkbox-blank-circle-line"></i>`). Al recibir *input* numérico, muta automáticamente a un check verde (`ri-checkbox-circle-fill`).
*   **Botón Defensivo:** El CTA "Guardar Conteo" se mantiene en estado deshabilitado (`:disabled`) y opaco hasta que el JavaScript local detecta que el contador principal (ej. `38/38` ítems) está completo.

## 5. Control de Producción y Mermas (`produccion_prototipo.html`)
*   **Container Transform:** Al presionar el botón de "Basurero" en un lote, la fila no abre un modal, sino que **se expande in situ** revelando un sub-formulario para justificar la merma.
*   **Colorimetría Obligatoria:** 
    *   La merma catalogada como "Descarte" (Basura) inyecta color Rojo al contenedor.
    *   La merma "Reutilizable" (ej. Recortes de carne) inyecta color Ámbar.

## 6. Validación de Compras (`compras_layout_prototipo.html`)
Auditoría cruzada humana vs IA.
*   **Diseño Side-by-Side (Lado a Lado):** La pantalla se divide en `50vw / 50vw`. A la izquierda el PDF inyectado en un `<iframe>` nativo (factura real). A la derecha, el formulario transaccional. Esto es innegociable para evitar que el usuario deba cambiar de pestaña de Windows.
*   **Cálculo en Tiempo Real:** El input de "Total" no es digitable directamente. Es el resultado de `Subtotal + Impuestos`. El usuario carga el subtotal, y el sistema calcula la diferencia. Si la factura de la izquierda marca $1000 y la UI suma $990, el botón primario no se habilita.
