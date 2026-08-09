# Reintegrar Escenarios Complejos al POS

El objetivo de este plan es agregar a la interfaz del Punto de Venta (POS) los flujos avanzados ("Edge Cases") que ya tienen lógica desarrollada pero no tienen botones visibles, asegurando que la experiencia siga siendo rápida y sin fricción.

## User Review Required

> [!NOTE]
> Voy a incorporar estos flujos mediante una sección de **"Acciones Especiales"** y **paneles desplegables** para no ensuciar la interfaz principal de cobro rápido. Quiero asegurarme de que la ubicación que propongo sea cómoda para el cajero.

## Proposed Changes

### 1. Panel de Pagos Ampliado (`pos_prototipo.html`)
Se agregarán botones adicionales para los métodos de pago especiales dentro de la sección de `payment-methods`.
- **Nuevo Botón:** "Cta Corriente" (para fiados empresariales/talleres).
- **Nuevo Botón:** "Consumo Personal" (para empleados, con popup de porcentaje de descuento).

### 2. Paneles Dinámicos de Validación
Se inyectarán los paneles ocultos que el JS necesita para validar pagos cuando se eligen opciones complejas.
- **Panel Cta Corriente (`ctaPanel`)**: Aparece solo al tocar "Cta Corriente". Contiene un selector de cliente (`techcorp`, `taller`) y un mensaje de estado que muestra si el límite de crédito aprueba o rechaza la transacción.
- **Panel Pago Dividido (`splitPaymentPanel`)**: Aparece al elegir "Efectivo". Permite ingresar con cuánto paga el cliente en efectivo y, si no alcanza, ofrece cobrar el resto con MercadoPago.

### 3. Menú de Descuentos / Cortesías
Se agregará un menú desplegable de "Acciones Especiales" en el pie del ticket (antes del botón de cobrar).
- **Descuentos Trazables**: Botones para "Cortesía: Queja (100%)" y "Cortesía: Demora (10%)".
- **Comportamiento**: Al tocarlos, inyectarán en la comanda un ítem negativo (resta el monto) con el nombre exacto de la cortesía, para que quede trazabilidad en los reportes de finanzas y el cajero no tenga que hacer cuentas a mano.

## Verification Plan

### Manual Verification
1. Abrir `pos_prototipo.html`.
2. Probar el flujo **Consumo Personal**: Tocar el botón, ingresar el porcentaje de descuento y ver el total tachado con el nuevo precio abajo.
3. Probar **Descuentos Trazables**: Desplegar "Acciones Especiales", elegir "Queja 100%" y ver cómo se agrega el ítem negativo a la comanda que anula el total.
4. Probar **Cuenta Corriente**: Seleccionar "Cta Corriente", elegir un cliente (ej. Taller) e intentar cobrar una suma que supere el límite ($5.000) para ver el rechazo visual y el bloqueo del botón de cobro.
