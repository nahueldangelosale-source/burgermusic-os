# Handoff V2.0 - Parte 4: Arquitectura de Módulos Futuros

Esta sección traza la ruta de construcción para los módulos pendientes (Prioridad Alta y Baja). Las directrices aquí documentadas dictan cómo deben comportarse estas nuevas interfaces antes de que se escriba la primera línea de código.

---

## 1. Módulo de Equipo y Recursos Humanos (RRHH)
Este será el próximo módulo a desarrollar. Se divide en tres pilares operativos que convivirán bajo la misma raíz de navegación (`/equipo`).

### 1.1 Fichaje (Clock-In / Clock-Out)
No es un simple registro de horarios, es el portal de seguridad del sistema.
*   **UX Cero Fricción:** El componente de fichaje debe ser accesible desde un dispositivo físico dedicado (Tablet en la entrada) o desde el dispositivo personal del empleado, sin necesidad de navegar por submenús.
*   **Validación Biométrica/PIN:** Un input numérico extra-grande (tipo Numpad en pantalla) para ingreso de PIN de 4 dígitos.
*   **Handoff Backend:** Al validar el PIN, el backend **debe** devolver el JWT de sesión que se anclará al Estado Global.

### 1.2 Cuentas Corrientes (Adelantos y Consumos)
El seguimiento de la deuda interna de cada empleado.
*   **Layout Financiero:** Tabla estricta con tipografía `Lato`, orden cronológico descendente (lo más nuevo arriba).
*   **Colorimetría Obligatoria:** 
    *   Saldos a favor del empleado: Neutro (`--text-main`).
    *   Deuda del empleado con el local (ej. Comida, Adelantos): Rojo (`--danger`).
*   **Interacción de Cierre:** Botón primario de "Liquidar Quincena" que abre un modal de doble confirmación. Al liquidar, el saldo vuelve a cero generando un comprobante inmutable en el backend.

### 1.3 Legajos Digitales
*   **Estructura de Tarjeta:** El perfil de cada empleado es una `.card` ancha.
*   **Visualización Rápida:** Avatar circular con la inicial del empleado a la izquierda, y su rol (Cocinero, Cajero) a la derecha. Información sensible (ej. CBU, DNI) oculta bajo un botón de visibilidad (ícono de ojo).

---

## 2. Cerebro Financiero: 3-Way Match (Prioridad Alta)
El núcleo que validará la salud económica de la franquicia.
*   **Concepto de Auditoría Cruzada:** El sistema debe cruzar tres vértices:
    1. Lo que se pidió (Orden de Compra).
    2. Lo que ingresó al depósito (Remito / Conteo Físico).
    3. Lo que se debe pagar (Factura cargada).
*   **UI de Conciliación:** 
    *   Diseño de 3 columnas (Grid).
    *   Si los tres montos/cantidades coinciden, la fila completa muta a verde (`--success`) y se auto-aprueba para pago.
    *   Si hay discrepancia (ej. Faltaron 2 kilos de carne), la fila se tiñe de rojo (`--danger`) bloqueando el pago y exigiendo intervención humana (Generación de Nota de Crédito).

---

## 3. Business Intelligence - BI (Prioridad Baja)
Tableros predictivos. Su desarrollo está pausado hasta que los módulos operativos acumulen un mínimo de 3 meses de histórico real.
*   **Visualización de Datos:** Gráficos limpios, sin fondos recargados. Las líneas de tendencia siempre deben superponer el *Consumo Real* vs *Consumo Teórico* (BOM esperado).
*   **Actionable Insights:** Los gráficos no pueden ser pasivos. Si una barra de merma excede el KPI, un clic en la barra debe filtrar y abrir instantáneamente la lista de turnos culpables de esa merma.
