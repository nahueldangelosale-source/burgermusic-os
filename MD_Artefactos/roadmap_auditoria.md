# 🗺️ Roadmap y Auditoría Funcional — Music OS (Fuente Única de la Verdad)

> Documento maestro consolidado que cruza el **Anexo Funcional (ANEXO_FUNCIONAL_MUSIC_OS.docx)**, el relevamiento de **Catálogo Real (Pedix)**, el **Análisis Operativo (WhatsApp/BOM)** y las **Definiciones Directas de Gerencia (Gaby)** para garantizar el éxito y la adopción del sistema.

---

## 1. Arquitectura de Datos Central
*Principio rector 4.1 y 4.3: Un único sistema integrado, sin duplicidad de datos.*

**Decisión Estratégica de Gerencia:** "No puede haber diferencias de nombres entre el stock, producción, compras y el resto de los módulos. Vamos a trabajar sobre un catálogo único de artículos."

### 1.1 El Catálogo Unificado (Mapeo Real)
Music OS se construirá utilizando los nombres reales de los productos que el personal maneja diariamente (Temática Musical).
* **Categorías Principales (11):** Burgers, Para acompañar, Sanguches, Music Pizza, Promos, Picadas Beat, Ensaladas, Postres, Tostados, Cervezas Goyeneche, Bebidas.
* **Modificadores Transversales:** Tamaño (Simple/Doble/Triple), Papas (Tradicional/Cheddar/Queen), Extras (Nuggets/Aros).

### 1.2 La Cascada de Materiales (BOM)
Music OS vincula de forma invisible el Catálogo (POS) con el Stock mediante la "Lista de Materiales" extraída de `Productos_BOM_completado_con_detalle.xlsx`.
* **Ejemplo Práctico:** Al vender una *Mala Fama Triple*, el módulo 5.7 (POS) alerta automáticamente al módulo 5.5 (Stock) para descontar: 3 medallones, 1 pan, panceta, huevo, cebolla y 3 porciones de cheddar. 
* Esto es lo que habilitará el cálculo real de consumo sin que el operario intervenga.

---

## 2. Flujo Operativo Relevado: Stock y Producción
*Principio rector 4.6: Simplicidad Operativa.*

### 2.1 Módulo 5.5 - Control de Stock
**Situación Actual (Pain Points):** El control se hace vía grupo de WhatsApp ("📌 STOCK COCINA").
* El conteo es 100% manual por turno (ej. Flor o Marian).
* No hay alertas, lo que provoca quiebres críticos (Ej: Domingo 26/07 quedaron solo 10 medallones, Salchichas marcaron "No hay" por 4 reportes seguidos).
* Mezcla de unidades ("5 de 10 unid / 3.200 kg").

**Solución Music OS:**
* **Conteo Rápido Normalizado:** Pantalla optimizada donde el usuario solo ingresa números sobre unidades estandarizadas por el sistema (bolsas, unidades, barras).
* **Alertas Inteligentes (Respondemos Pregunta 12 y 13):** Las alertas de stock mínimo se configurarán **por producto individual**. Cuando los medallones bajen de su umbral (ej. 50), el Dashboard central alertará al responsable.
* **Mermas (Respondemos Pregunta 11):** Se cargarán en la misma pantalla de Stock durante el cierre de turno.

### 2.2 Módulo 5.4 - Producción
**Definición de Gerencia:** 
* **Físico:** Hay un único local operativo en Lanús donde ocurre toda la producción y donde reside el depósito.
* **Sistema de Lotes:** Hoy NO existe. Music OS introducirá la gestión de lotes por primera vez.
* **Hardware:** Se incorporará una impresora de etiquetas para identificar los lotes producidos.
* **Interfaz (Respondemos Pregunta 10):** Toda la gestión de producción (iniciar lote, reportar rendimiento) debe estar **optimizada para uso desde un Teléfono Celular** por el personal de cocina.

---

## 3. Compras y Recepción de Mercadería
*Principio rector 4.2: Automatización.*

### 3.1 Recepción e IA (Módulo 5.3)
**Flujo Objetivo definido por Gerencia:**
1. Los proveedores enviarán facturas/remitos directamente a una casilla de correo.
2. La Inteligencia Artificial del sistema procesará el documento automáticamente.
3. El documento cae en el **"Módulo de Validaciones"**.
4. La encargada (Mariana) revisa "lado a lado" (Imagen vs. Datos Extraídos) y confirma. Recién ahí entra la mercadería al stock.
*(Con esto respondemos las Preguntas 8 y 9).*

### 3.2 Excepciones de Facturación (Módulo 5.2)
* **El Problema:** La Verdulería y el proveedor de Aceite no entregan factura.
* **La Solución Music OS:** Se creará una función de **"Comprobante Interno de Compra"**. Mariana o el encargado de compras generarán este documento digital para que el circuito no se rompa, manteniendo la trazabilidad exacta de los costos y el ingreso de la mercadería.

---

## 4. Estado de las Preguntas Clave (Auditoría)

Gracias a las definiciones de Gaby y el análisis de datos, el nivel de incertidumbre funcional ha bajado drásticamente.

### ✅ Preguntas recientemente CERRADAS
* **#6 (Compras):** *¿OC Sugeridas o manuales?* Se generarán sugerencias basadas en el cruce de BOM + Stock Mínimo + Consumo promedio calculado por IA.
* **#8 y #9 (IA):** *¿Auto-aprobación o manual?* Toda factura extraída por IA pasará por la revisión visual (lado a lado) de Mariana/Encargado.
* **#10 (Producción):** *¿Formato de UI?* Optimizada para **Mobile (celular)**, orientada a generación e impresión de etiquetas de Lotes.
* **#11, #12, #13, #14 (Stock):** Mínimos configurables por producto individual, conteos rápidos por turno, mermas integradas.
* **#1 y #2 (Cajas):** Fichaje obligatorio para acceder.
* **#4 y #5 (Delivery):** Integración automática de API de apps y asignación de flota.
* **NUEVO - KDS Routing:** Ruteo automático de pedidos según estación (Parrilla vs Mostrador) para evitar embudos.
* **NUEVO - Modificadores Estrictos:** Eliminación de texto libre, uso de botones de exclusión y agregados.
* **NUEVO - Consumo de Personal:** Cobro 100% bonificado en POS que descuenta receta exacta en stock sin afectar caja.
* **NUEVO - Dashboard (Torre de Control):** Consolidación de grilla financiera (Promedios y Filtros), divulgación progresiva de Canales de Venta y Alertas Inteligentes unificadas en formato minimalista.
* **NUEVO - Edge Cases Operativos (UX/CRO):** Implementación de "Desglose Dinámico" y anulación en POS, "Checklist Atómico" y "Recall 10s" en KDS, y "Match Perfecto" en Cajas para cadetes.
* **NUEVO - Arquitectura Dual de Producción:** Separación del módulo en dos vistas. `produccion_prototipo.html` (Móvil, táctico, sin métricas financieras para el operario) y `produccion_gerencial_prototipo.html` (Escritorio, estratégico, con tracking de rendimiento de lotes y eficiencia).
* **NUEVO - Onboarding Pedagógico Inline:** 8 disparadores contextuales con animación slide-down, telemetría GA4 y lenguaje "Riesgo Alto/Bajo" en lugar de terminología alarmista.
* **NUEVO - Telemetría GA4:** Eventos `trigger_shown` / `trigger_resolved` para medir qué alertas se resuelven y cuáles se ignoran.
* **NUEVO - Presentaciones Mad-Libs (Compras):** Unificación visual de la carga de presentaciones en Facturas y Órdenes de Compra usando un formato pedagógico (Sentence Builder) que elimina la carga cognitiva.
* **NUEVO - Gateway Financiero Outcome-Driven:** Integración dinámica de Cajas y Bancos en Cuentas Corrientes. Previene inconsistencias contables bloqueando el pago si el origen de fondos tiene saldo insuficiente.

### 📜 Fuente de Verdad: Las "193 Líneas"
El relevamiento crudo original de WhatsApp (las famosas 193 líneas) se encuentra procesado y consolidado dentro del artefacto: `analisis_stock_operativo.md`. Allí se documentan los dolores operativos reales que justifican estas decisiones.

### ⏳ Preguntas pendientes por resolver (Fase 3/4)
| Módulo | Pregunta Crítica para Diseño |
|--------|------------------------------|
| **RRHH (5.12)** | ¿Pantalla propia de fichaje/legajos o se mantiene el PIN integrado en POS? |
| **Finanzas (5.13)** | ¿Pantalla propia de flujo de fondos o se mantiene Cta Cte integrada en POS? |
| **BI (5.17)** | ¿Dashboards pre-armados o reportes ad-hoc? |

---

## 5. Roadmap Actualizado de Prototipado

```mermaid
gantt
    title Roadmap de Prototipado Frontend — Music OS
    dateFormat  YYYY-MM-DD
    axisFormat  %d/%m

    section Fase 1 - CORE (✅ CERRADA)
    Dashboard Ejecutivo (Optimizado)  :done,    f1a, 2026-07-27, 1d
    POS Interactivo (con Menú Real)   :done,    f1b, 2026-07-27, 1d
    Cocina Kanban (KDS y Enrutamiento):done,    f1c, 2026-07-27, 1d
    Integración de Catálogo y Precios :done,    f1d, 2026-07-27, 1d
    Gestión de Cajas (Fichaje/Cta Cte):done,    f1e, 2026-07-27, 1d
    Consumo de Personal y Modificadores:done,    f1f, 2026-07-27, 1d
    Edge Cases (Split Pay, Recall, Match):done,  f1g, 2026-07-27, 1d

    section Fase 2 - Abastecimiento y Stock (✅ CERRADA)
    Stock (Mobile/Web) y Conteo       :done,    f2a, 2026-07-28, 2d
    Producción (Mobile) y Lotes       :done,    f2b, after f2a, 2d
    Validación IA de Facturas         :done,    f2c, after f2b, 2d
    Compras y Comprobantes Internos   :done,    f2d, after f2c, 2d

    section Fase 2 - Refinamiento Neuroestético (✅ CERRADA)
    Rediseño Inventario (Tabs, Cards, Recetas) :done, 2026-08-01, 1d
    Historial de Movimientos (Timeline)        :done, 2026-08-03, 1d
    Arquitectura Dual Producción (Gerencial)   :done, 2026-08-05, 1d
    Onboarding Pedagógico Inline (Disparadores):done, 2026-08-05, 1d
    Auditoría de Cobertura y Docs              :done, 2026-08-05, 1d

    section Fase 2.5 - Conectividad Inter-Módulo (ACTIVA)
    Links profundos Dashboard-Inventario       :done,   2026-08-06, 1d
    Toast post-cobro POS-Stock                 :        2026-08-06, 1d
    Badge ingreso Compras-Timeline             :        2026-08-06, 1d
    Widget consumo Producción-Stock            :        2026-08-06, 1d

    section Fase 3 - Gestión Corporativa (EN PROGRESO)
    Unificación UI Presentaciones (Mad-Libs)   :done,   2026-08-07, 1d
    Finanzas: Cuentas Corrientes y Cajas       :active, 2026-08-07, 2d
    Finanzas: 3-Way Match & Auditoría          :        2026-08-08, 2d
    RRHH (Fichaje y Legajos)                   :        2026-08-10, 2d
```

---

## 6. Brechas de Conectividad Detectadas (Auditoría 05/08)

Para que la demo sea 100% fluida de punta a punta, estos 4 micro-cambios cierran el circuito visual entre módulos:

| # | Brecha | Módulos | Solución |
|---|--------|---------|----------|
| 1 | Las alertas del Dashboard no enlazan al artículo en Inventario | Dashboard → Inventario | Agregar `href` con anchor al acordeón correspondiente |
| 2 | Al cobrar en POS no hay feedback de descuento de stock | POS → Stock | Toast sutil post-cobro: "Stock actualizado: -1 Medallón, -1 Pan TBP" |
| 3 | Al validar factura en Compras no se refleja ingreso en timeline | Compras → Inventario | Badge "Recién ingresado" en el timeline de movimientos |
| 4 | Al cerrar lote en Producción no se muestra consumo de MP | Producción → Stock | Widget "Consumo de MP" en produccion_gerencial |

### Próximo paso técnico (Acción Inmediata):
1. **Cerrar las 4 brechas de conectividad** para lograr una demo integral.
2. Evaluar si **RRHH** y **Finanzas** necesitan pantallas propias o se mantienen embebidos en POS/Dashboard.

