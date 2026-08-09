# Cierre de Brechas Estratégicas (Conceptos A, B y C)

El objetivo de este plan es implementar las tres propuestas estratégicas diseñadas para cubrir los baches operativos identificados al cierre de la Fase 1, garantizando escalabilidad y minimizando la fricción operativa.

## User Review Required

> [!IMPORTANT]
> Reviso tu aprobación sobre este plan táctico antes de intervenir los prototipos existentes. Esto modificará la experiencia de acceso al POS y el layout superior del Dashboard.

## Proposed Changes

### 1. Concepto A: Portal Numérico de Fichaje (RRHH)
Integraremos el control de acceso y fichaje de personal directamente en la entrada del Punto de Venta (POS).

#### [MODIFY] [pos_prototipo.html](file:///C:/Users/nahue/.gemini/antigravity/brain/6b80ff63-c4f2-470b-a96e-3ceabad9effc/pos_prototipo.html)
- Se añadirá una pantalla superpuesta (Overlay/Lock Screen) de inicio.
- Contendrá un teclado numérico táctil de alta densidad (estilo iOS/HIG).
- El empleado ingresará su PIN de 4 dígitos. Al ingresar, el sistema registrará su horario de entrada (fichaje subyacente) y destrabará el uso del POS a su nombre.

### 2. Concepto B: Módulo de Cuentas Corrientes (Finanzas)
Añadiremos el flujo B2B para capturar ventas corporativas/vecinas sin fricción.

#### [MODIFY] [pos_prototipo.html](file:///C:/Users/nahue/.gemini/antigravity/brain/6b80ff63-c4f2-470b-a96e-3ceabad9effc/pos_prototipo.html)
- Dentro del panel derecho (Comanda/Ticket), en la sección de métodos de pago, se agregará el botón de pago "Cta. Corriente".
- Al seleccionarlo, se desplegará una lista de empresas validadas y mostrará dinámicamente el "Saldo de Crédito Disponible" (Límite dinámico).
- Prevención de errores: Se bloqueará la venta si la cuenta corriente excede el límite configurado.

### 3. Concepto C: Arquitectura Multi-Sucursal (Escalabilidad)
Prepararemos el núcleo visual para soportar franquicias y múltiples puntos de venta físicos.

#### [MODIFY] [dashboard_prototipo.html](file:///C:/Users/nahue/.gemini/antigravity/brain/6b80ff63-c4f2-470b-a96e-3ceabad9effc/dashboard_prototipo.html)
- En la barra superior (Top Bar), se reemplazará el título estático por un "Selector de Contexto".
- Un menú desplegable estilizado que permitirá cambiar instantáneamente la vista global de datos entre "Local Lanús", "Franquicia X" o "Vista Consolidada (Todas)".

## Verification Plan

### Manual Verification
- Renderizar y verificar visualmente `pos_prototipo.html` asegurando que el teclado numérico cubra la pantalla inicialmente.
- Simular una venta en el POS utilizando "Cuenta Corriente".
- Verificar el selector multi-sucursal en `dashboard_prototipo.html` asegurando que la jerarquía visual de la navegación principal no se rompa.
