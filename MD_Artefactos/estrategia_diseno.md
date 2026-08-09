# Estrategia de Diseño Frontend: Music OS

Para lograr que Music OS sea una herramienta ágil, intuitiva y con la menor carga cognitiva posible para el equipo de Burger Music, recomiendo estructurar la entrega al equipo de producción en tres fases clave. 

## 1. Creación de un Prototipo Navegable (Prueba de Concepto)
Como primer paso, **es altamente recomendable crear un prototipo navegable (Mockup)** de las pantallas principales (comenzando por el Dashboard). Esto permite:
*   **Validar la estética:** Ver en vivo la combinación de tipografías (Montserrat y Lato) y la paleta de colores.
*   **Probar la interactividad:** Experimentar las microinteracciones (hovers, transiciones) antes de programar la lógica compleja.
*   **Alinear expectativas:** Darle al equipo de producción un objetivo visual claro (un "Norte" a seguir).

*(He creado un primer prototipo interactivo del Dashboard adjunto a esta respuesta para que puedas visualizar el concepto).*

## 2. Definición de un "Design System" (Sistema de Diseño)
En lugar de pasarle al equipo de desarrollo solo pantallas sueltas, debemos entregarles un mini Sistema de Diseño. Esto asegura que el software sea escalable y coherente. El documento para ellos debe contener:

### A. Tipografía y Jerarquía
*   **Encabezados (Títulos, Tarjetas principales):** `Montserrat` (Pesos: SemiBold 600, Bold 700). Da un aspecto moderno y estructurado.
*   **Cuerpo y Tablas (Datos, Textos largos, Menús):** `Lato` (Pesos: Regular 400, Medium 500). Es excelente para la legibilidad de números y datos densos.

### B. Paleta de Colores (Minimalista y Funcional)
*   **Fondo principal:** Gris ultra claro (`#F8F9FA`) en lugar de blanco puro, para reducir la fatiga visual.
*   **Tarjetas/Superficies:** Blanco puro (`#FFFFFF`) con sombras sutiles.
*   **Color de Marca/Acento:** Un naranja refinado (ej. `#EA580C`) para acciones principales, evitando tonos demasiado chillones que generen ruido.
*   **Alertas:** 
    *   *Alta Prioridad:* Rojo suave (`#DC2626`) con fondo rojizo claro.
    *   *Baja Prioridad:* Ámbar/Naranja cálido (`#D97706`).

### C. Tangibilidad y Elevación (Material Design)
*   **Reposo:** Sombras muy difusas y amplias (ej. `box-shadow: var(--shadow-md)`).
*   **Interacción (Hover):** La tarjeta o botón "se eleva" hacia el usuario aumentando la sombra y desplazándose 1px o 2px hacia arriba (Efecto "Hover Magnético"). Esto comunica que las superficies son manipulables.

### D. Dinamismo y Microinteracciones (Feedback Inmediato)
*   **Estados de Botones:** Todo botón debe tener estados claros: *Default, Hover, Active (Presionado) y Disabled*.
*   **Efecto Ripple / Pulso (`.btn-action-pulse`):** Al hacer clic en un botón de acción (ej. "Completar", "Investigar"), el botón emitirá un pulso sutil para confirmar que el sistema registró el clic, eliminando la incertidumbre del usuario y reduciendo clics dobles.
*   **Feedback visual:** Al interactuar con el sistema debe haber una transición suave de color de `0.2s`.

### E. Onboarding Pedagógico Inline
*   No usar tooltips intrusivos ni modales de bloqueo.
*   Usar **Micromensajes Contextuales** (Banners inline) que aparecen solo en momentos de fricción cognitiva (ej. una receta incompleta) y desaparecen automáticamente al resolverse el problema (Sistema de Recompensa Visual).

### F. Arquitectura Dual (Adaptación por Rol)
*   **Operarios:** Interfaces tácticas, Mobile-first. Botones grandes, sin métricas financieras ni ruido analítico para evitar parálisis por análisis (Ej. `produccion_prototipo.html`).
*   **Gerentes:** Interfaces estratégicas, Desktop-first. Sidebars, KPIs, paneles analíticos y herramientas de seguimiento de anomalías (Ej. `produccion_gerencial_prototipo.html`).

## 3. Estrategia de Refactorización (Cómo implementarlo)
Para el equipo de producción, la estrategia de adopción debe ser iterativa:
1.  **Capa Base (CSS/Tokens):** Primero, deben configurar las variables globales de CSS (colores, fuentes, sombras).
2.  **Componentes Core:** Rediseñar los componentes más usados aisladamente (Botones, Inputs, Tarjetas de datos, Menú lateral).
3.  **Vistas Principales:** Aplicar estos componentes al Dashboard y al POS.
4.  **Lógica defensiva:** Implementar la deshabilitación de botones hasta que los formularios/comandas estén completos, reduciendo los errores operativos.

---
> [!TIP]
> Al mostrarle el prototipo al equipo, enfóquense en cómo se **siente** la interfaz (la rapidez de lectura y la claridad de los números) más que solo en cómo se ve.

## 4. Diseño Sistémico y Anti-Patrones (Outcome-Driven)

Para mantener la integridad arquitectónica de Music OS (especialmente en módulos críticos como Finanzas y Cuentas por Pagar), es vital evitar los siguientes Anti-Patrones:

1. **Anti-Patrón "UI-Driven / Solutioning en Capa de Presentación"**: No hardcodear lógica de negocio ni dependencias estáticas en el frontend. Las opciones (ej. Cajas, Bancos) deben alimentarse de un **contrato de datos (JSON/API)** basado en el contexto real (ej. Sucursal Activa, Centro de Efectivo).
2. **Anti-Patrón "Fábrica de Features"**: Entregar un componente visual (ej. un selector) no es el objetivo. El objetivo es el **Outcome**. Por ejemplo, el objetivo de un selector de "Origen de Fondos" no es que el usuario haga clic, sino **prevenir discrepancias en arqueos y evitar pagos sin saldo**.

### Heurísticas Clave para Interfaces Financieras
* **Carga Cognitiva y Minimalismo:** Ocultar selectores o información que dependa de un paso previo. Ej: No mostrar "Cajas" hasta que se seleccione "Efectivo".
* **Prevención de Errores (Heurística 5):** Bloquear el avance físicamente. Si el saldo es insuficiente, el botón de confirmar debe estar `disabled`.
* **Microinteracciones:** Mostrar el saldo disponible en tiempo real y teñir de rojo los inputs si se excede, para dar feedback inmediato sin necesidad de enviar el formulario.
