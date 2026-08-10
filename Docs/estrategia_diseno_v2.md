# Estrategia de Diseño Frontend y Handoff Técnico V2.0

Este documento constituye el manual innegociable de arquitectura y experiencia de usuario para Music OS. Su propósito es alinear el código estático actual con la visión integral del sistema, eliminando procesos aislados y garantizando una transición impecable hacia el entorno de *staging*. Toda implementación técnica debe subordinarse a los principios aquí detallados.

---

## Sección 1: Filosofía UX y Estándares Cognitivos

La filosofía motriz de Music OS se define bajo un único principio innegociable: **Velocidad Precisa**. La interfaz no es un lienzo artístico, sino una herramienta de trabajo de alta fricción donde la velocidad de operación no puede comprometer la exactitud de los datos.

Para garantizar una **política de cero carga cognitiva**, la jerarquía tipográfica está estrictamente segmentada por función neurológica:
*   **Montserrat (Bold/SemiBold):** Exclusiva para encabezados y componentes estructurales. Su anatomía geométrica facilita el escaneo rápido de bloques de información.
*   **Lato (Regular/Medium):** Obligatoria para tablas, formularios y densidad de datos. Su diseño legible minimiza la fatiga visual al procesar cifras financieras y listas de stock.

Bajo el amparo de la **4ta Heurística de Nielsen (Consistencia y estándares)**, queda **absolutamente prohibido el uso de frameworks CSS externos como Bootstrap o Tailwind**. La introducción de clases prefabricadas destruye la consistencia nativa, contamina el DOM y dificulta el mantenimiento a largo plazo. Nuestra arquitectura CSS/Variables nativa es la única fuente de verdad, garantizando que el diseño híbrido (planitud de Apple HIG para navegación y elevación de Material Design para "objetos físicos" como facturas) se mantenga inviolable.

---

## Sección 2: Microinteracciones y Prevención de Errores

El diseño de Music OS asume que el usuario operará bajo estrés. Las microinteracciones no son decorativas, son guías operativas.

*   **Guiado de Atención:** La acción principal y obligatoria de una pantalla (ej. "Aprobar Factura" o "Nueva Receta") debe utilizar botones con pulso animado (`btn-action-pulse`). Este magnetismo visual reduce el tiempo de decisión del usuario a milisegundos.
*   **Defensa en Profundidad:** Siguiendo la 5ta Heurística de Nielsen (Prevención de errores), el frontend diseña barreras visuales (ej. inhabilitación de botones de guardado hasta completar un conteo), pero el handoff exige que el backend asuma una responsabilidad simétrica. En flujos críticos como el Wizard de Compras de Carga Manual, **el backend debe replicar estrictamente las validaciones del frontend**. Si el frontend impide cruzar la categoría "Carnes" con la unidad "Kilos" (para evitar la corrupción de datos operativos), el endpoint que procesa la compra debe validar y rechazar un payload inconsistente antes de que toque la base de datos de *staging*.

---

## Sección 3: Arquitectura DOM y Gestión de Estado (Staging)

Los prototipos actuales han validado la experiencia de usuario. El siguiente paso es la integración con los servicios reales. A partir de este hito, se prohíbe el uso de datos "mockeados" y simulaciones aisladas en `localStorage`.

*   **Integración de Catálogos:** El Punto de Venta (POS) y las pantallas dependientes de inventario deben abandonar las estructuras estáticas quemadas en HTML. El catálogo debe consumirse obligatoriamente mediante un endpoint REST estandarizado: `GET /api/pos/catalog`.
*   **Gestión de Estado Global:** El sistema opera bajo un entorno multi-sucursal y multi-usuario. Es mandatorio implementar un manejador de estado global robusto (Redux, Zustand o React Context).
    *   La **Sucursal Seleccionada** debe residir en el estado global y ser inyectada automáticamente en las cabeceras de cada petición (interceptors).
    *   El módulo de recursos humanos y fichaje no operará de forma pasiva. El evento de "Fichaje" (Clock-in) debe generar y almacenar un **Token JWT** que valide la sesión autenticada del empleado, garantizando la trazabilidad exigida por el Anexo Funcional (quién y cuándo altera un dato).

---

## Sección 4: Roadmap de Cobertura y Prioridades

El *core* operativo de Music OS se encuentra estabilizado a nivel interfaz. Actualmente contamos con **8 módulos prototipados y validados**, lo que representa una fundación sólida. No obstante, restan áreas vitales para alcanzar los **18 módulos totales** definidos en la visión del ecosistema.

**Directriz de la Próxima Ola de Desarrollo:**
La prioridad inmediata es dotar al sistema de contexto histórico y control de abastecimiento. Debemos cerrar las brechas del módulo de **Compras** enfocándonos en la gestión inteligente de proveedores y la generación de órdenes sugeridas basadas en consumo.

**Despliegue de Módulos Restantes:**
Toda planificación futura abandona las etiquetas abstractas (ej. "crítico") y adopta una nomenclatura estricta de prioridad:
*   **Prioridad Alta:** Módulo de Finanzas (Cerebro Financiero) y flujos de conciliación (3-Way Match). Sin este módulo, el ecosistema carece de validación económica cruzada.
*   **Prioridad Baja:** Módulo de Business Intelligence (BI) y tableros predictivos complejos. Estos requerirán una base de datos histórica robusta (construida por los módulos de Prioridad Alta) antes de poder aportar valor real.

---
> *El cumplimiento de este documento no es opcional. Constituye el puente técnico entre la experiencia de usuario diseñada y la estabilidad del servidor en producción.*
