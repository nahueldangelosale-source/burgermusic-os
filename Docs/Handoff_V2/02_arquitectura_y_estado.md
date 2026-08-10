# Handoff V2.0 - Parte 2: Arquitectura UX Global y Estado del Sistema

Esta sección documenta la infraestructura invisible que sostiene a Music OS. Detalla cómo se mueve la información a través de la interfaz y establece las reglas de validación obligatorias para la comunicación entre el Cliente y el Servidor.

---

## 1. El Sistema Nervioso Central: Estado Global (Global State)

Music OS no es una colección de páginas aisladas; es una *Single Page Application* (SPA) interconectada. Para evitar el "Prop Drilling" (pasar datos de componente en componente infinitamente) y asegurar la consistencia, el uso de un gestor de estado global (como **Zustand**, **Redux Toolkit** o **Context API**) es estrictamente obligatorio.

### 1.1 Contexto de Sucursal (Branch Context)
La plataforma es multi-sucursal. El dato más importante de toda la aplicación es **"¿En qué sucursal estoy operando ahora mismo?"**.
*   **Regla de Persistencia:** El ID de la sucursal seleccionada vive en el Estado Global.
*   **Regla de Inyección:** Todo interceptor HTTP (ej. usando Axios) debe inyectar automáticamente el `branch_id` en los headers de *cada* petición al backend. El usuario jamás debería tener que seleccionar la sucursal en un formulario de alta de stock o cobro.

### 1.2 Identidad y Autorización (Tokens JWT)
La trazabilidad exigida por el Anexo Funcional dicta que toda mutación de datos debe registrar al autor.
*   **Flujo de Fichaje (Clock-In):** El Módulo de RRHH no es meramente informativo. Cuando un empleado "Ficha" el inicio de su turno ingresando su PIN/Biometría, el backend responde con un Token JWT.
*   **Almacenamiento:** Este token se almacena en el Estado Global (y de forma segura en almacenamiento persistente, evitando `localStorage` expuesto a XSS si es posible; prefiriendo cookies HTTP-Only para la sesión pesada o *sessionStorage* para tokens transaccionales rápidos).
*   **Firma de Transacciones:** Cada ticket del KDS marcado como "Listo", cada merma registrada, y cada factura aprobada lleva la firma de este Token.

---

## 2. Navegación Unificada: El Patrón Sidebar

La aplicación entera ocurre dentro del esqueleto principal definido en `index.html`. El usuario nunca debe sentir que "cambió de página" abruptamente.

### 2.1 Jerarquía del Sidebar
El menú lateral izquierdo (Sidebar) es el ancla de la experiencia del usuario.
*   **Estado por Defecto:** Siempre visible en resoluciones de escritorio/tablet. En mobile, se esconde tras un botón hamburguesa deslizable.
*   **Ruteo Visual:** La ruta actual (ej. `/compras/historial`) debe aplicar incondicionalmente la clase `.active` (color naranja de alta visibilidad) al link correspondiente en el Sidebar para ofrecer orientación (Breadcrumb visual).

### 2.2 Despliegue de Acordeones (Dropdowns)
Para mantener un Sidebar limpio, las categorías secundarias se anidan (Ej: Inventario -> Control de Stock / Recetario).
*   **Interacción DOM:** Al hacer clic en un `.nav-dropdown-toggle`, se expande el `.nav-submenu` empujando el resto de los elementos hacia abajo suavemente (`transition: max-height 0.3s ease`). La flecha (chevron) debe rotar 180° indicando el estado abierto.

---

## 3. Simetría Validativa (Backend Defensivo)

El pilar de "Defensa en Profundidad" prohíbe que el Frontend sea el único guardián de los datos operativos. Toda regla de UX diseñada para prevenir errores humanos debe contar con un espejo exacto en el Backend.

### 3.1 Regla del Espejo Estricto
Si el diseño de la interfaz (Frontend) impide al usuario realizar una acción inválida, el Servidor (Backend) debe bloquear esa misma acción mediante una respuesta `HTTP 400 Bad Request` si los datos llegan alterados.

*   **Caso de Uso 1 (Tipado de Insumos):** El Frontend bloquea la carga de "2.5 Cajas" si el insumo está configurado en "Unidades enteras". El Backend **debe** rechazar el payload si `cantidad: 2.5` y `unidad_medida: int`.
*   **Caso de Uso 2 (Wizards de Compras):** En la carga de facturas de Compras, el Frontend exige que el subtotal y los impuestos coincidan matemáticamente con el Total de la factura antes de habilitar el botón "Aprobar". El Backend **debe** recalcular esta ecuación al recibir el POST y rechazar la petición si las sumas difieren, previniendo inyección de datos corruptos mediante APIs o herramientas de desarrollo.

### 3.2 Manejo Estandarizado de Errores (Toast Notifications)
Cuando el Backend rechaza una operación, no se debe mostrar el error en un modal de pánico, ni mucho menos dejar la pantalla congelada.
*   Se utilizará un componente **Toast (Notificación flotante)** en la esquina superior derecha o inferior central.
*   **Formato del Error:** Fondo rojo suave (`--danger`), ícono de alerta, y el mensaje del backend traducido a un lenguaje operativo humano. 
    *   *Incorrecto:* `HTTP 409 Conflict: integrity constraint violation.`
    *   *Correcto:* `El número de factura ya fue registrado para este proveedor.`
