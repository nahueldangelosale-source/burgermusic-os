# 🎨 Master UX/UI & Frontend Audit: BurgerMusic OS (v3.1)

## 1. Directivas del Agente
- **Rol:** Actúa como Principal Frontend Architect y Lead UX/UI Designer.
- **Objetivo:** Auditar todos los componentes visuales, flujos de usuario (workflows) y módulos de la plataforma actual. Identificar pantallas faltantes (especialmente para la nueva unidad de pizzas) y brechas en la experiencia de usuario.
- **Modo:** "Review-driven development". No modifiques código aún. Genera un reporte de auditoría y un plan de acción visual.

## 2. Estándares de Diseño y Arquitectura (2026) a Verificar
Por favor, escanea el directorio frontend (ej. `/src/app`, `/src/components`) y evalúa el código contra los siguientes pilares:

### A. Arquitectura Frontend (Feature-Sliced Design)
- Verifica si estamos utilizando un enfoque modular escalable (como Feature-Sliced Design o FSD) para separar páginas, widgets y entidades [6, 7]. 
- Confirma la adopción de Tailwind CSS v4 y bibliotecas de componentes "copy-paste" como shadcn/ui o Radix UI, que garantizan accesibilidad sin inflar el bundle [8-10].

### B. Patrones de Diseño Visual (Bento Grids & UI Adaptativa)
- **Bento Grids:** El dashboard de los gerentes y C-Level debe utilizar el diseño "Bento Grid" (cuadrículas modulares asimétricas) para mostrar KPIs de ventas, mermas y alertas logísticas sin abrumar al usuario [11-13].
- **Estética y Tema:** Verifica la implementación de *Dark Mode* por defecto para reducir la fatiga visual en entornos de baja luz (turnos nocturnos de la hamburguesería) [14, 15].
- **Transiciones:** Evalúa la integración de la *View Transitions API* nativa del navegador para asegurar cambios de página fluidos (tipo aplicación nativa) sin depender de librerías pesadas de JavaScript [16, 17].

### C. Micro-interacciones y Reducción de Carga Cognitiva
- Audita el uso de micro-interacciones (ej. botones que reaccionan al toque, feedback háptico/visual) que sirven como "Prueba de Trabajo" cuando la IA o el sistema procesan inventario [3, 18].
- Verifica que los formularios y procesos (ej. Cierre de Caja) usen "Revelación Progresiva" para no saturar al personal [19, 20].

### D. Accesibilidad (WCAG 3.0)
- Confirma que el contraste de texto sigue el estándar APCA (Advanced Perceptual Contrast Algorithm) [21, 22].
- Verifica que todo el frontend sea navegable por teclado y los lectores de pantalla interactúen correctamente (evitando el uso excesivo o incorrecto de ARIA) [23].

## 3. Identificación de Módulos Incompletos
Mapea específicamente el estado de los siguientes módulos críticos de frontera (Closed-Loop):
1. **Módulo `/kitchen` (Tablets):** Flujo de declaración de mermas y visualización de recetas (BOM) para hamburguesas y **pizzas** (ingredientes fraccionarios).
2. **Módulo `/receive`:** UI de ingreso de remitos.
3. **Módulo `/cashier`:** Flujo UX para el Cierre Z y declaración de discrepancias.
4. **Dashboard C-Level:** Área de inteligencia de negocios (BI) y panel de configuración de alertas (Twilio/WhatsApp).

## 4. Salida Esperada (Artefactos)
Genera un documento estructurado que contenga:
1. Un **UX/UI Gap Analysis** detallando qué vistas faltan o tienen mala experiencia de usuario.
2. Un **Frontend Refactor Plan** priorizando la adopción de Bento Grids, Tailwind v4 y View Transitions.
3. Propuesta de wireframes/layout en texto para el nuevo módulo de Pizzas y el Dashboard de Alertas.
