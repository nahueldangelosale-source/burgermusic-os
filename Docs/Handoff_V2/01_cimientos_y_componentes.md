# Handoff V2.0 - Parte 1: Cimientos y Componentes Base (Core UI)

Esta sección define el ecosistema visual de Music OS. Todo desarrollo frontend (sea en React, Vue, o nativo) debe calcar con exactitud matemática las variables, espaciados y comportamientos anatómicos aquí definidos para garantizar el cumplimiento del principio de **Velocidad Precisa** y **Cero Carga Cognitiva**.

---

## 1. Topología del Espacio y Variables CSS Nativas

No se utilizarán frameworks como Tailwind ni Bootstrap para espaciados o colores. Las clases utilitarias corrompen la legibilidad del DOM en una aplicación altamente transaccional. En su lugar, se obliga el uso de un diccionario de variables CSS globales inyectado en el `:root`.

### 1.1 Paleta Semántica de Colores
Los colores no son estéticos, son señales de tráfico para el cerebro del usuario:
*   `--bg-body: #F8FAFC;` (Gris Pizarra clarísimo): Fondo innegociable de toda la app. Suaviza el rebote de la luz en pantallas encendidas 12 horas seguidas (evita el blanco clínico de hospitales).
*   `--bg-surface: #FFFFFF;` (Blanco puro): Exclusivo para tarjetas (`.card`), modales y contenedores que requieren concentración.
*   `--primary-color: #EA580C;` (Naranja): Solo para el CTA (Call To Action) más importante de la vista activa (Ej. Botón "Guardar").
*   `--text-main: #0F172A;` (Casi negro): Legibilidad de ultra-contraste para datos sensibles.
*   `--text-muted: #64748B;` (Gris): Para textos secundarios, fechas, y placeholders que no deben competir por atención.
*   `--border-light: #E2E8F0;` (Borde sutil): Separador estructural silencioso.
*   **Colores de Estado (Feedback):**
    *   `--success: #10B981;` / Fondo: `#F0FDF4` (Verde: Cierre de lote, completitud 100%).
    *   `--warning: #D97706;` / Fondo: `#FEF3C7` (Ámbar: Faltante de stock, mermas reutilizables).
    *   `--danger: #DC2626;` / Fondo: `#FEE2E2` (Rojo: Descarte crítico, alerta financiera).

### 1.2 Jerarquía Matemática de Espacios
Music OS utiliza una cuadrícula dura basada en múltiplos de `4px` y `8px`:
*   `--spacing-xs: 4px;` (Distancia entre un ícono y texto adyacente).
*   `--spacing-sm: 8px;` (Padding interno mínimo para inputs y píldoras).
*   `--spacing-md: 16px;` (Distancia estándar entre filas de una tabla o ítems de inventario).
*   `--spacing-lg: 24px;` (Separación estructural entre el header de un módulo y su contenido principal).
*   `--spacing-xl: 32px;` (Separación masiva entre grandes bloques lógicos, ej. entre el KDS y la barra de navegación).

---

## 2. Elevaciones Z: Modelo Híbrido HIG + Material

Music OS combina la planitud del Apple Human Interface Guidelines (para listas y esqueleto del sistema) con las "sombras-como-metáfora-física" de Google Material Design (únicamente para objetos reales y superposiciones críticas).

*   `--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);`
    *   **Uso:** Inputs, dropdowns menores, separadores.
*   `--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);`
    *   **Uso:** La superficie estándar (`.card`). Representa la "Mesa de trabajo" (Dashboard, Contenedor de Inventario).
*   `--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);`
    *   **Uso:** Tarjetas magnéticas del POS y Slide-overs. Objetos que están un nivel por encima de la mesa, esperando interacción inminente.
*   `--shadow-xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);`
    *   **Uso Exclusivo:** Modales de edición, Facturas subidas (PDF Viewer) y Split Payment. Es un objeto "físico" pegado contra la cara del usuario. Todo lo demás por detrás de él se inactiva y debe cubrirse con `backdrop-filter: blur(2px)`.

---

## 3. Anatomía de Componentes Reutilizables

Bajo el principio de Cero Carga Cognitiva, los componentes base tienen reglas biológicas de comportamiento.

### 3.1 Botones de Acción (El Pulso)
El sistema reconoce 3 niveles de botones, pero solo uno lidera.
1.  **Botón Primario (Call To Action):** `class="btn-primary"`. Es un "Pill" (`border-radius: 30px`), tiene fondo de gradiente sutil y es el **ÚNICO** elemento que puede invocar la animación de pulso magnético cuando requiere atención imperativa de confirmación.
    *   *Interacción:* Debe escalar hacia abajo al presionarse (`transform: scale(0.98)`) en 150ms `cubic-bezier` simulando hundir una tecla física de caja registradora.
2.  **Botón Secundario:** `class="btn-outline"`. Sin fondo, texto naranja o gris, borde de `1px solid --border-light`. Para acciones de apoyo ("Filtrar", "Cancelar").
3.  **Botón Fantasma:** `class="btn-ghost"`. Para acciones altamente repetitivas que no ocupan jerarquía (ej. la "X" para cerrar un modal, o el ojito de visibilidad).

### 3.2 Inputs Defensivos
Ningún input de Music OS es un campo de texto simple. Todos son "Defensivos" y asumen la incompetencia/velocidad extrema del usuario (5ta Heurística).
*   **Alineación:** Números siempre a la derecha (Tabular). Textos siempre a la izquierda.
*   **Normalización Numérica:** Un `input` de stock jamás permite letras, e invoca automáticamente el teclado numérico en pantallas móviles (`inputmode="decimal"`).
*   **Foco Automático:** Al abrir cualquier Modal de búsqueda o edición, el cursor debe estar *autofocused* inmediatamente sobre el input clave. Un click del ratón/dedo menos por cada acción salva horas de vida operativa al mes.

### 3.3 El Ecosistema de Avatares e Iconografía
*   **Prohibidos los textos en listas densas:** En tablas como el Libro Diario o Recepción de Pedidos, el nombre del proveedor ("Frigorífico") debe estar acompañado invariablemente de su **Avatar de Inicial** (Ej. un círculo verde oscuro con la letra "F"). El ojo humano procesa colores e íconos 60.000 veces más rápido que texto.
*   **Micro-Insignias (Badges):** Los estados de un objeto (ej. "En Camino", "Pago Atrasado") no se escriben; se anexan como micro-íconos circulares anclados a la esquina inferior derecha del avatar del ítem o proveedor.

---

> [!WARNING]
> **Normativa de Implementación Frontend:** Cualquier componente UI desarrollado que no refleje estas variables, que falle en la transición `cubic-bezier` de un botón, o que emplee sombras distintas a las estipuladas, será rechazado en *Code Review* y considerado un desvío arquitectónico.
