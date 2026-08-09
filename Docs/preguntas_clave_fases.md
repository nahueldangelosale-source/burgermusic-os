# Preguntas Clave por Fase — Definiciones de Diseño

Para seguir avanzando con velocidad y sin ambigüedad, necesito tus decisiones sobre los siguientes puntos antes de maquetar cada módulo. Están organizadas estrictamente por el orden de las fases.

---

## Fase 1 — Módulos Restantes

### 5.14 Gestión de Cajas
1. **Flujo de apertura de caja:** ¿El cajero debe ingresar un monto inicial de efectivo manualmente o el sistema pre-carga un monto sugerido basado en el día anterior?
2. **Movimientos de efectivo (retiros/ingresos):** ¿Requiere aprobación de un supervisor para registrar un retiro de efectivo, o solo un motivo escrito?
3. **Cierre y Arqueo:** ¿Se muestra una pantalla de conciliación que compare "efectivo esperado vs. efectivo real" con la diferencia calculada automáticamente? ¿O se hace manualmente?

### 5.9 Delivery Inteligente
4. **Asignación de repartidores:** ¿Es manual (el encargado elige al repartidor de una lista) o semi-automática (el sistema sugiere al repartidor más cercano/disponible)?
5. **Seguimiento en pantalla:** ¿La pantalla de Delivery muestra un mapa con la ubicación del repartidor en tiempo real, o simplemente estados textuales (Asignado → En camino → Entregado)?
6. **Integración con apps externas:** ¿Los pedidos de Rappi/PedidosYa/Uber deben entrar automáticamente al KDS, o se cargan manualmente?

---

## Fase 2 — Abastecimiento y Control

### 5.2 Compras y Proveedores
7. **Flujo de compra:** ¿El sistema genera automáticamente órdenes de compra sugeridas basándose en el stock mínimo, o el usuario siempre crea la OC manualmente?
8. **Cuenta corriente del proveedor:** ¿La pantalla de "Cuenta" debe mostrar un historial completo de facturas y pagos (tipo extracto bancario) o solo el saldo actual?

### 5.3 Facturación Inteligente (IA)
9. **Revisión de facturas:** Cuando la IA extrae los datos de una factura, ¿el usuario ve una vista "lado a lado" (imagen de la factura vs. datos extraídos) para comparar, o solo ve los campos pre-llenados?
10. **Nivel de autonomía de la IA:** ¿Las facturas con alto grado de confianza (>95%) se aprueban automáticamente, o toda factura requiere revisión humana sin excepción?

### 5.4 Producción
11. **Recetas y elaboración:** ¿La pantalla de producción debe funcionar como un checklist visual (tipo Kanban) donde el encargado marca cada etapa, o como una tabla de lotes con cantidades?
12. **Mermas:** ¿El registro de mermas se hace en la misma pantalla de producción o en una sección separada de "Control de Stock"?

### 5.5 Control de Stock
13. **Alertas de stock bajo:** ¿El nivel mínimo se configura por producto individualmente, o por categoría (ej. todos los panes tienen mínimo X)?
14. **Auditoría de inventario:** ¿Se necesita un flujo de "Conteo Físico" donde el usuario recorra item por item y cargue cantidades reales?

### 5.6 Packaging
15. **Packaging como producto separado:** ¿Las cajas/bolsas se descuentan automáticamente del stock cuando se despacha un pedido, o se registran manualmente?

---

## Fase 3 — Gestión Corporativa

### 5.12 Recursos Humanos
16. **Asistencia:** ¿Se espera una integración con reloj biométrico/fichaje digital, o el registro es manual?
17. **Desempeño:** ¿Se mide con KPIs automáticos del sistema (velocidad de preparación, tickets atendidos) o con evaluaciones manuales del gerente?

### 5.13 Finanzas
18. **Conciliación bancaria:** ¿El sistema debe importar extractos bancarios automáticamente (vía archivo CSV/OFX) o el usuario carga los movimientos manualmente?
19. **Cuentas por cobrar:** ¿Existe facturación a clientes corporativos (cuentas corrientes de empresas) o todo se cobra al contado?

### 5.15 Manuales y Procesos
20. **Formato:** ¿El repositorio de manuales soporta videos embebidos o solo documentos PDF/texto?

### 5.16 Mantenimiento
21. **Equipos:** ¿Se necesita un inventario de equipos (heladera X, plancha Y) con fecha de último mantenimiento, o solo alertas generales?

---

## Fase 4 — Experiencia e Inteligencia

### 5.10 Experiencia del Cliente
22. **Fidelidad:** ¿El programa de puntos/beneficios se activa con un código QR del cliente, un número de teléfono, o un DNI?
23. **Encuestas:** ¿Se envían encuestas automáticas post-compra (vía WhatsApp o email)?

### 5.11 Comunicación
24. **WhatsApp:** ¿Se espera envío masivo de campañas (tipo "Promo Lunes") o solo mensajes transaccionales (confirmación de pedido)?

### 5.17 Business Intelligence
25. **Reportes:** ¿El dueño necesita dashboards pre-armados con los KPIs más importantes, o también la posibilidad de crear reportes ad-hoc con filtros personalizados?

### 5.18 Motor de Automatizaciones
26. **Reglas de negocio:** ¿Las automatizaciones las configura solo el Administrador o también el Gerente de sucursal?
27. **Ejemplo clave:** Necesito el top 3 de automatizaciones que el dueño considera más urgentes para definir las plantillas de reglas.

---

> [!IMPORTANT]
> No necesito todas las respuestas ahora. Con que respondas las **preguntas de la fase que estamos trabajando actualmente (Fase 1: Cajas y Delivery)** puedo avanzar inmediatamente. Las demás las iremos resolviendo a medida que entremos en cada fase.
