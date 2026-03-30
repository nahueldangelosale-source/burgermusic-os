# 🏛 Master Audit Specification: BurgerMusic OS (v3.1)

## 1. Contexto del Sistema y Estado Actual
Actúa como un Principal Software Architect y un Agente de Auditoría SRE (Site Reliability Engineering). Estás analizando el repositorio de "BurgerMusic OS v3.1", un ERP SaaS Event-Driven para la gestión de 3 locales de hamburguesas y una nueva unidad de pizzas.
- **Frontend:** Next.js (App Router), Tailwind CSS.
- **Backend:** Node.js (Server Actions), API Webhooks (Push architecture).
- **Base de Datos:** Turso DB (SQLite distribuido en el Edge), Drizzle ORM.
- **Validación:** Zod schemas.

## 2. Objetivo de la Misión (Deep Research & Code Archaeology)
Tu tarea es realizar una auditoría integral del código base actual utilizando tus capacidades de **Code Archaeology** [9]. No debes modificar código fuente en esta fase; tu objetivo es diagnosticar la salud estructural, identificar deuda técnica y validar la preparación del sistema para la Fase 1, 2 y 3 del roadmap.

## 3. Directivas de Auditoría (Análisis Requerido)
Por favor, escanea el repositorio completo e infórmame sobre los siguientes dominios:

1. **Integridad del Motor de Inventario (BOM):**
   - Analiza el archivo `recipe-parser.ts` (o similares) y evalúa su lógica de deducción atómica.
   - Identifica qué refactorizaciones exactas son necesarias para que el motor soporte la nueva unidad de pizzas (descuentos por gramaje de masa, queso, etc., en lugar de unidades discretas).

2. **Seguridad y Control de Acceso (Zero-Trust):**
   - Verifica la implementación de RBAC (Role-Based Access Control). 
   - Confirma que el filtrado por sucursal (`store_id`) es estricto en todas las consultas a la base de datos para garantizar que el aislamiento Multi-Tenant funcione correctamente al añadir el tercer local.

3. **Revisión del Contrato API Webhook (Push):**
   - Audita el endpoint diseñado para recibir los datos locales (ej. `/api/webhooks/pos`).
   - Verifica la idempotencia (manejo de `ticket_id` duplicados) y la coerción de tipos con Zod para evitar corrupción de datos.

4. **Rendimiento y Consultas a Base de Datos:**
   - Busca problemas de N+1 queries o ineficiencias en las agrupaciones de datos de Drizzle ORM que puedan disparar la latencia.

## 4. Protocolo de Self-Correction (Red Team)
Antes de entregar tus resultados, aplica un protocolo de "Red Team" sobre tus propios hallazgos [10]. Busca activamente posibles fallos lógicos en la arquitectura propuesta para el Webhook y verifica vulnerabilidades de seguridad OWASP (ej. inyección SQL o falta de validación de encabezados `x-api-key`).

## 5. Salida Esperada (Artefactos)
Genera los siguientes **Artefactos** para mi revisión [6, 11]:
1. Un **Implementation Plan** estructurado en Markdown detallando los hallazgos críticos de la auditoría (Alta, Media, Baja prioridad) [6].
2. Un **Task List** (Lista de Tareas) con los pasos exactos a codificar para adaptar el sistema a la unidad de pizzas y finalizar la integración del Webhook [6].
3. Un reporte de dependencias (identificando librerías obsoletas o riesgos de seguridad en el `package.json`).
