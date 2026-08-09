# Preguntas Clave por Fase — Definiciones de Diseño

Para seguir avanzando con velocidad y sin ambigüedad, necesito tus decisiones sobre los siguientes puntos antes de maquetar cada módulo. Están organizadas estrictamente por el orden de las fases.

---

## Fase 1 — Módulos Core (✅ CERRADA)

### 5.14 Gestión de Cajas
1. ✅ **Flujo de apertura de caja:** El cajero ingresa monto inicial manualmente. Implementado en `cajas_prototipo.html`.
2. ✅ **Movimientos de efectivo (retiros/ingresos):** Requiere motivo escrito. Implementado.
3. ✅ **Cierre y Arqueo:** Pantalla de conciliación "esperado vs. real" con diferencia calculada automáticamente. Implementado.

### 5.9 Delivery Inteligente
4. ✅ **Asignación de repartidores:** Semi-automática (el sistema sugiere, el encargado confirma). Implementado en `delivery_prototipo.html`.
5. ✅ **Seguimiento en pantalla:** Estados textuales (Asignado → En camino → Entregado) con timeline visual. Implementado.
6. ✅ **Integración con apps externas:** Los pedidos de Rappi/PedidosYa/Uber entran automáticamente al KDS. Definido por gerencia.

### Edge Cases (Fase 1)
- ✅ **Fichaje (RRHH):** PIN numérico obligatorio para acceder al POS. Implementado en `pos_prototipo.html`.
- ✅ **Cuentas Corrientes (Finanzas):** Botón "Cta. Corriente" en métodos de pago del POS con límite dinámico. Implementado.
- ✅ **Multi-Sucursal:** Selector de contexto en el header del Dashboard. Implementado en `dashboard_prototipo.html`.
- ✅ **KDS Routing:** Ruteo automático Parrilla vs Mostrador. Implementado en `kds_prototipo.html`.
- ✅ **Modificadores Estrictos:** Botones de exclusión y agregados sin texto libre. Implementado en `pos_prototipo.html`.
- ✅ **Consumo de Personal:** Cobro 100% bonificado en POS. Implementado.

---

## Fase 2 — Abastecimiento, Stock y UX (✅ CERRADA)

### 5.2 Compras y Proveedores
7. ✅ **Flujo de compra:** OC sugeridas basadas en BOM + Stock Mínimo + Consumo IA. Definido por gerencia.
8. ✅ **Cuenta corriente del proveedor:** Historial completo tipo extracto bancario. Definido.

### 5.3 Facturación Inteligente (IA)
9. ✅ **Revisión de facturas:** Vista "lado a lado" (imagen vs. datos extraídos). Implementado en `compras_validacion_prototipo.html`.
10. ✅ **Nivel de autonomía de la IA:** Toda factura requiere revisión humana sin excepción. Definido por gerencia.

### 5.4 Producción
11. ✅ **Recetas y elaboración:** Tabla de lotes con cantidades + tracking de rendimiento. Implementado en `produccion_prototipo.html` (Operario) y `produccion_gerencial_prototipo.html` (Gerente).
12. ✅ **Mermas:** Se registran en la misma pantalla de Producción al cerrar lote. Implementado.

### 5.5 Control de Stock
13. ✅ **Alertas de stock bajo:** Nivel mínimo configurable por producto individual. Implementado en `inventario_prototipo.html`.
14. ✅ **Auditoría de inventario:** Flujo de "Conteo Rápido" ítem por ítem con inputs táctiles. Implementado en `conteo_stock_prototipo.html`.

### 5.6 Packaging
15. ⏳ **Packaging como producto separado:** Pendiente. Se integrará como sub-categoría dentro de Inventario en una fase posterior.

### Refinamientos UX (Fase 2)
- ✅ **Rediseño Inventario:** Tabs, Cards acordeón, Recetas con barras proporcionales.
- ✅ **Timeline de Movimientos de Stock:** Historial cronológico con color coding direccional.
- ✅ **Arquitectura Dual de Producción:** Operario (Mobile) vs. Gerente (Desktop).
- ✅ **Onboarding Pedagógico Inline:** 8 disparadores contextuales con animación slide-down, telemetría GA4 y lenguaje "Riesgo Alto/Bajo".

---

## Fase 3 — Gestión Corporativa (⏳ PENDIENTE)

### 5.12 Recursos Humanos
16. ⏳ **Asistencia:** ¿Integración con reloj biométrico/fichaje digital, o registro manual?
17. ⏳ **Desempeño:** ¿KPIs automáticos del sistema o evaluaciones manuales del gerente?

### 5.13 Finanzas
18. ⏳ **Conciliación bancaria:** ¿Importar extractos vía CSV/OFX o carga manual?
19. ⏳ **Cuentas por cobrar:** ¿Facturación a clientes corporativos?

### 5.15 Manuales y Procesos
20. ⏳ **Formato:** ¿Videos embebidos o solo PDF/texto?

### 5.16 Mantenimiento
21. ⏳ **Equipos:** ¿Inventario de equipos con fecha de último mantenimiento, o solo alertas generales?

---

## Fase 4 — Experiencia e Inteligencia (⏳ PENDIENTE)

### 5.10 Experiencia del Cliente
22. ⏳ **Fidelidad:** ¿QR, teléfono o DNI?
23. ⏳ **Encuestas:** ¿Post-compra automáticas vía WhatsApp o email?

### 5.11 Comunicación
24. ⏳ **WhatsApp:** ¿Campañas masivas o solo transaccional?

### 5.17 Business Intelligence
25. ⏳ **Reportes:** ¿Dashboards pre-armados o también reportes ad-hoc?

### 5.18 Motor de Automatizaciones
26. ⏳ **Reglas de negocio:** ¿Solo Administrador o también Gerente de sucursal?
27. ⏳ **Top 3 automatizaciones urgentes:** Pendiente definición del dueño.

---

> [!TIP]
> Las Fases 1 y 2 están 100% cerradas a nivel funcional y de prototipo. Las preguntas de Fase 3 y 4 se resolverán cuando entremos en esas etapas del roadmap.
