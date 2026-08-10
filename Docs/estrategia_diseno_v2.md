# Handoff Técnico V2.0: Music OS

Documento normativo de arquitectura técnica y UI/UX para los entornos de Staging y Producción. Su cumplimiento es obligatorio para todo desarrollo.

## 1. UI/UX: Carga Cognitiva Cero y Tipografía
- **Principio Base:** Velocidad Precisa. Interfaz operativa orientada a minimizar el tiempo de decisión.
- **Tipografía:** 
  - **Montserrat (Bold/SemiBold):** Exclusiva para encabezados y estructura.
  - **Lato (Regular/Medium):** Obligatoria para tablas, formularios y densidad de datos.
- **Restricción de Frameworks:** Prohibido el uso de Bootstrap, Tailwind o frameworks CSS externos (4ta Heurística de Nielsen). Se utilizará exclusivamente la arquitectura CSS/Variables nativa del sistema para preservar el modelo híbrido (planitud de Apple HIG para estructura general, y elevación Z de Material Design para objetos físicos).

## 2. Prevención de Errores y Microinteracciones
- **Call To Action (CTA):** Toda acción primaria obligatoria debe implementar la animación `.btn-action-pulse` para guiar la atención inmediatamente.
- **Defensa en Profundidad:** El backend debe replicar simétricamente el 100% de las validaciones de la interfaz.
  - *Regla de Rechazo:* En flujos como el Wizard de Compras, si la UI bloquea variables incompatibles (ej. "Carne" en "Litros"), el endpoint respectivo debe auditar y rechazar el *payload* anómalo antes de tocar la base de datos.

## 3. Arquitectura DOM y Estado Global
- **Datos Dinámicos:** Prohibido el uso de datos estáticos (mocks) o persistencia aislada vía `localStorage` para estructuras de inventario.
  - El Punto de Venta (POS) y sus dependencias deben poblarse exclusivamente vía consumo de API (Ej: `GET /api/pos/catalog`).
- **Manejador de Estado Global:** Implementación mandatoria de Redux, Zustand o React Context.
  - **Contexto de Sucursal:** Almacenado en estado global e inyectado como *Header* automático en todas las peticiones (HTTP Interceptors).
  - **Autenticación (JWT):** El "Fichaje" de empleados genera y almacena un Token JWT. Toda mutación de datos debe ir firmada por este token para garantizar trazabilidad absoluta (quién, cuándo y por qué alteró un registro).

## 4. Despliegue y Prioridades (Roadmap)
- **Cobertura Base:** 8 módulos prototipados estáticamente. Restan 10 módulos.
- **Objetivo Inmediato (Staging):** Conexión del Módulo de Compras (gestión de proveedores y sugerencias de órdenes) para comenzar la recolección de histórico de datos.
- **Matriz de Prioridad Técnica:**
  - **Prioridad Alta:** Módulo de Finanzas y Conciliación (3-Way Match). Motor central para auditoría cruzada de todo el ecosistema.
  - **Prioridad Baja:** Módulo de Business Intelligence (BI). Requiere acumulación previa de datos históricos para que los tableros predictivos sean funcionales.
