# Estrategia de Diseño Frontend: Music OS

Para lograr que Music OS sea una herramienta ágil, intuitiva y con la menor carga cognitiva posible para el equipo de Burger Music, la filosofía de diseño se estructura bajo un principio innegociable: **Velocidad Precisa**.

## 1. Filosofía UX Central
Todas las interfaces se diseñan bajo estos principios:
*   **Cero carga cognitiva:** Palabras simples, sin jerga técnica. El usuario nunca debería necesitar un manual.
*   **Pedagogía visual progresiva:** El sistema enseña mientras se usa (tooltips educativos, badges de color, empty states claros).
*   **Defensa en profundidad:** Frontend (UX) + Backend (transacciones atómicas). Doble capa de validación.
*   **F-Pattern de lectura:** La información más crítica siempre arriba a la izquierda.

## 2. Definición del "Design System" (Sistema de Diseño)

### A. Tipografía y Jerarquía
*   **Encabezados (Títulos, Tarjetas principales):** `Montserrat` (Pesos: SemiBold 600, Bold 700). Da un aspecto moderno y estructurado.
*   **Cuerpo y Tablas (Datos, Textos largos, Menús):** `Lato` (Pesos: Regular 400, Medium 500). Es excelente para la legibilidad de números y datos densos.

### B. Paleta de Colores (Minimalista y Funcional)
*   **Fondo principal:** Gris ultra claro (`#F8FAFC` o `#F8F9FA`) en lugar de blanco puro, para reducir la fatiga visual.
*   **Tarjetas/Superficies:** Blanco puro (`#FFFFFF`) con bordes sutiles (`var(--border-light)`).
*   **Color de Marca/Acento:** Un naranja refinado (ej. `#EA580C` o `#F97316`) para acciones principales.
*   **Alertas y Estados:** 
    *   *Alta Prioridad / Peligro:* Rojo suave (`#DC2626`) con fondo rojizo claro.
    *   *Advertencia / Reutilización:* Ámbar/Naranja cálido (`#D97706`).
    *   *Éxito / Validación:* Verde vibrante (`#10B981`) con fondo verde claro (`#F0FDF4`).

### C. Elevación y Sombras (Enfoque Híbrido Material / Apple HIG)
*   **Listas y Estructura (Apple HIG):** Diseños planos, limpios, con mucho desenfoque (blur) y bordes redondeados sutiles para escaneo rápido. Sin sombras pesadas.
*   **Metáfora de Documento (Material Design):** Reservamos la "elevación Z" y sombras pesadas (`box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25)`) exclusivamente para paneles que representan objetos físicos reales (Facturas, Hojas de Órdenes de Compra). Esto diferencia la navegación de la "realidad operativa".
*   **Interacción Magnética (Hover):** Las tarjetas interactivas se "elevan" hacia el usuario aumentando la sombra y escalando ligerísimamente (`transform: scale(1.02)`) para dar sensación de tangibilidad.

## 3. Patrones de Interfaz Avanzados (UX Patterns)

A medida que el sistema creció, incorporamos patrones de interacción complejos para manejar grandes volúmenes de información sin saturar la pantalla:

### A. Container Transform (Expansión Contextual)
Utilizado para revelar acciones secundarias o campos de entrada sin sacar al usuario de su contexto actual.
*   **Ejemplo:** Al presionar el botón de "Tacho de basura" en el Control de Stock, se despliega suavemente un contenedor rojo debajo del ítem para cargar la "Merma del turno".

### B. Slide-Overs vs. Modales Centrales
*   **Slide-Overs (Contexto):** Paneles que se deslizan desde la derecha. Se usan para tareas de edición (ej. "+ Nueva Receta" o detalle de lotes) donde el usuario necesita seguir espiando la lista principal de fondo.
*   **Modales Centrales (Foco):** Para revisión de documentos críticos (ej. Ver Factura en el Inbox). El modal aparece en el centro exacto oscureciendo todo el fondo. Fuerza al usuario a concentrarse 100% en el documento físico renderizado en pantalla.

### C. Acordeones y Sub-Acordeones (Progressive Disclosure)
Para listas masivas (como el Recetario de BOM o el Catálogo), la información se colapsa.
*   **Ejemplo:** En la Vista de Recetas, el usuario ve una lista compacta de las burgers. Solo al hacer clic en "GORILLAZ" se desliza hacia abajo la tabla con su receta (BOM) completa. Esto elimina el exceso de scroll.

### D. Formularios Dinámicos "2-en-1" (Reducción de Vistas)
Para evitar saturar la interfaz con múltiples modales casi idénticos, se consolidan las acciones afines en un solo modal inteligente.
*   **Ejemplo:** En lugar de tener un modal para "Crear Producto" y otro para "Crear Insumo", se utiliza un único modal que muta internamente ocultando/mostrando bloques del formulario mediante JS según lo que el usuario elija en la pestaña superior.


### E. Identidad Visual Ágil (Avatares y Status Badges)
*   **Adiós a los íconos genéricos:** En listados transaccionales (Inbox, Órdenes) se utilizan **Avatares** (Inicial grande del proveedor, ej. `[ F ]` para Frigorífico) para que el cerebro escanee remitentes en milisegundos.
*   **Micro-Insignias:** Íconos súper pequeños anclados a los avatares (✅, 📦, 🤖) para informar el estado del proceso sin ocupar espacio en la tabla.
*   **Categorización Semántica Visual:** Los gastos no son solo texto. Las categorías (Sueldos, Impuestos) tienen un avatar con ícono y color específico (ej. Rojo para Impuestos, Verde para Alquiler). El cerebro procesa el color mucho antes de leer la palabra, acelerando la auditoría visual de los libros contables.

### D. Microinteracciones de Guía (Gamificación)
*   **Botones con Pulso (`btn-action-pulse`):** Usados para llamar la atención sobre la acción principal de la pantalla (Ej: "+ Nueva Receta" o "Aprobar Factura").
*   **Estados Vacíos (Empty States):** Diseños amigables (ícono gris + texto descriptivo) que le indican al usuario qué debe hacer cuando una lista o un buscador están vacíos, evitando la confusión de una pantalla en blanco.
*   **Feedback de Completitud:** Botones y barras que mutan de color (ej. de gris a verde) y hacen un pequeño destello (*pulse*) cuando el usuario completó una tarea al 100% (como el Control de Stock).

---

## 4. Alineación UX con el Anexo Funcional (Principios de Diseño)

El sistema de diseño de Music OS no es puramente estético; es la traducción visual de los requerimientos contractuales (Sección 4 del Anexo Funcional).

### A. Simplicidad Operativa (Principio 4.6)
*   **Traducción UX:** Micro-copy en lenguaje claro y directo ("Argentino Operativo", sin jerga contable). Minimización de clics mediante *Smart Defaults* (ej. inyectar un 95% de rinde técnico esperado por defecto en producción).
*   **Patrones Clave:** Wizards defensivos paso a paso (ej. Carga de Factura Manual) y botones "Lote Rápido" para limpiar formularios instantáneamente.

### B. Inteligencia de Negocio y Automatizaciones (Principios 4.7 y 4.8)
*   **Traducción UX:** Los Dashboards no son solo informativos; son operativos. El diseño prioriza Alertas Unificadas (Rojo/Ámbar) con Call-to-Actions (ej. "Auditar Lote", "Crear Orden").
*   **Patrones Clave:** Grillas financieras modulares, *Yield Cards* (medidores de eficiencia de producción) y el layout **"Lado a Lado"** (Side-by-side) para la supervisión humana ágil de la Inteligencia Artificial (ej. Validación de Compras).

### C. Trazabilidad (Principio 4.5)
*   **Traducción UX:** El registro de quién, cuándo y por qué alteró un dato se diseña como una narrativa visual fácil de auditar.
*   **Patrones Clave:** Uso de *Timelines* (Líneas de tiempo verticales) en Inventario y Ventas, con avatares del empleado y badges del comprobante asociado (Ticket POS, Ajuste Manual, Remito).

### D. Centralización, Integración y Escalabilidad (Principios 4.1, 4.3 y 4.4)
*   **Traducción UX:** La navegación global debe hacer sentir que el usuario está dentro de un ecosistema, no en módulos aislados.
*   **Patrones Clave:** Menú Lateral Unificado (Sidebar desplegable), selector de Sucursal/Usuario global persistente, y *Cross-linking* profundo (donde un click en una alerta de pago inminente abre automáticamente el módulo de Caja).

---

## 5. Arquitectura Técnica de los Prototipos (Guía Definitiva de Implementación)

Para asegurar **cero fallas de interpretación** al momento de pasar estos prototipos interactivos al equipo de desarrollo (backend/frontend real), todos los archivos `*_prototipo.html` comparten una arquitectura HTML/CSS estandarizada y estricta.

No se utilizan frameworks externos (como Bootstrap o Tailwind) en el código fuente para garantizar que la identidad visual "Burger Music" sea nativa y 100% controlable.

### A. Estructura Maestra del DOM (Layout Global)
Absolutamente todas las vistas respetan el patrón de pantalla completa (`height: 100vh; overflow: hidden;`), aislando el scroll únicamente al contenido principal:

```html
<body>
    <!-- 1. Menú de Navegación Global (Fijo) -->
    <aside class="sidebar">...</aside>
    
    <!-- 2. Contenedor Principal (Scrollable independiente) -->
    <main class="main-content">
        <div class="content-area">
            <!-- 3. Cabecera de Página (Título y Contexto) -->
            <div class="page-header">
                <h1>Título</h1>
                <p>Descripción pedagógica</p>
            </div>
            
            <!-- 4. Contenido Específico del Módulo -->
            <div class="card">...</div>
        </div>
    </main>
</body>
```

### B. Diccionario de Clases CSS (Componentes Base)
Cualquier desarrollador que mire el código debe reutilizar estas clases semánticas:
*   **Superficies (`.card`):** Fondos blancos (`#FFF`) con `border-radius: var(--radius-lg)` y sombra sutil `var(--shadow-md)`.
*   **Tarjetas Interactivas (POS):** Llevan bordes deliberadamente más gruesos y oscuros (`2px solid #94A3B8`) para maximizar el contraste y la facilidad de toque, en lugar de depender solo de sombras muy suaves.
*   **Acciones Principales (`.btn-primary`):** Diseño "Pill" (`border-radius: 30px`), utilizando `linear-gradient` para un look premium, y transiciones rápidas `cubic-bezier(0.4, 0, 0.2, 1)` con `transform: scale(0.98)` en el estado `:active` para dar feedback táctil intenso. Solo debe haber **UN** `.btn-primary` por pantalla (Call to Action).
*   **Acciones Secundarias (`.btn-outline`):** Botones "fantasma" sin fondo, con borde. Usados para cancelar, cerrar o filtrar.
*   **Formularios (`.form-group` y `.form-input`):** Todo input lleva la clase `.form-input` para heredar el padding de 12px, border-radius de 8px y borde gris sutil.
*   **Buscadores Específicos:** Siempre incluyen un contenedor `position: relative;` con un `<i class="ri-search-line"></i>` anclado a la izquierda (`position: absolute; left: 12px;`) y el input con `padding-left: 40px`.

### C. Navegación y Estado (Sidebar)
*   **Despliegue de Submenús:** Controlado por DOM simple. Al hacer clic en un `.nav-dropdown-toggle`, se le inyecta la clase `.open` al `.nav-dropdown` padre. El CSS se encarga de mostrar el `.nav-submenu` (`display: flex`) y de rotar la flecha `.chevron` 180°.
*   **Página Actual:** El desarrollador backend deberá encargarse de rutear la clase `.active` al `<a>` que corresponda según la URL actual, para encenderlo en color Naranja.

### D. CSS Grid vs Flexbox (Reglas de Uso)
*   **Uso de Grid (`display: grid`):** Obligatorio para **Dashboards** (tarjetas de KPIs) y **Filtros Superiores** (donde necesitamos columnas exactas, ej: `grid-template-columns: repeat(4, 1fr)`).
*   **Uso de Flexbox (`display: flex`):** Obligatorio para alineación de iconos con texto, toolbars, y modales internos donde los elementos "fluyen" naturalmente según su contenido (ej. `gap: 12px; align-items: center;`).

### E. Modales y Overlays Estratégicos
Los modales de edición (ej. Compras Manual, Split Payment, Consumo Empleados) no utilizan librerías de JS de terceros.
*   Se construyen inyectando un `div` con `position: fixed; inset: 0; z-index: 1000;`.
*   Tienen un fondo translúcido (`background: rgba(0,0,0,0.5); backdrop-filter: blur(2px);`).
*   La tarjeta central del modal siempre tiene `max-width` (ej. 600px o 400px según el contexto) y `max-height: 90vh; overflow-y: auto;` para evitar que se rompa en pantallas pequeñas.
*   **Diseño Consistente (Normalización):** Todos los modales de acción rápida (Ej: Seleccionar un Empleado para Descuento, o Modificar Ingredientes) comparten exactamente las mismas clases base (`.modifier-modal`, `.mod-section`, `.mod-btn`) para mantener una curva de aprendizaje mínima y familiaridad visual inmediata.

---

## 6. Estrategia UI/UX por Módulo Específico (Referencia Frontend)

Para facilitar la implementación en React/Vue, aquí está el "por qué" de las decisiones de layout de cada pantalla:

### A. Dashboard Ejecutivo (`dashboard_prototipo.html`)
*   **Layout:** CSS Grid masivo (4 columnas).
*   **Patrón Clave:** `Yield Card` (Medidor de Rinde). Es una barra de progreso lineal (Verde → Ámbar → Rojo) que resume la eficiencia. 
*   **Slide-over de Alertas:** Las notificaciones (Lotes desviados, stock crítico) no se abren en otra página, sino en un panel lateral derecho para no perder el contexto de la Torre de Control.

### B. Punto de Venta - POS (`pos_prototipo.html`)
*   **Layout:** Asimétrico. 70% Izquierda (Catálogo scrollable), 30% Derecha (Comanda fija - `sticky`).
*   **Patrón Clave:** Tarjetas de producto con bordes gruesos (`2px solid #94A3B8`) para alta visibilidad y feedback de hover magnético (`transform: scale(1.02)`).
*   **Flujos Especiales (Edge Cases):** Cero alertas nativas feas del navegador (`alert()`, `prompt()`). Cualquier acción compleja (Fiar, Descuento a Empleados, Dividir Pago) se maneja a través de un Modal Normalizado sobre la misma pantalla.

### C. Kitchen Display System - KDS (`kds_prototipo.html`)
*   **Layout:** Tablero Kanban 100% horizontal. No hay menú lateral (la sidebar está oculta o no existe) para maximizar el uso de los monitores de cocina.
*   **Patrón Clave:** El Checklist atómico. El cocinero debe poder tocar (hacer clic) en un ingrediente específico para tacharlo. El ticket entero debe cambiar de color (Ej: Blanco → Amarillo → Verde) a medida que pasa de "Nuevo" a "Preparando" y a "Listo".

### D. Inventario y BOM (`inventario_prototipo.html`)
*   **Layout:** Pestañas (Tabs) superiores para alternar rápidamente entre *Stock Actual*, *Recetario BOM* e *Historial*.
*   **Patrón Clave:** "Progressive Disclosure" (Acordeones). Como el recetario es inmenso, solo se muestra el título de la Burger. Al hacer clic, se expande hacia abajo la tabla interna con los insumos (BOM).
*   **Formularios de Creación:** Unificación mediante un único modal "2-en-1" con pestañas internas para evitar que el usuario se pierda navegando entre 3 pantallas distintas para dar de alta algo en el sistema.

### E. Compras y Validación (`compras_layout_prototipo.html`)
*   **Layout:** "Side-by-side" (50% - 50%).
*   **Patrón Clave:** A la izquierda, el PDF/Foto del comprobante físico renderizado a pantalla completa. A la derecha, el formulario de validación (inputs). Obliga al usuario a hacer "matching visual" (Auditoría humana cruzada con IA) sin cambiar de pestaña del navegador.

### F. Producción Mobile (`produccion_prototipo.html`)
*   **Layout:** Mobile-First (Una sola columna centrada).
*   **Patrón Clave:** Tarjetas colapsables por Lote. Colores semánticos obligatorios para clasificar las Mermas: Rojo (`#DC2626`) para Descarte, y Ámbar (`#D97706`) para Recorte Reutilizable.

---
> [!TIP]
> **La regla de oro del equipo de Front-End:** Si el usuario tiene que pensar más de 2 segundos para entender qué hace un botón o adónde fue a parar un dato, el diseño falló y debe simplificarse.
