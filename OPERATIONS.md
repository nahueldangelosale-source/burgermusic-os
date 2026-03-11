# 🍔 Manual de Operaciones: BurgerMusic OS

¡Bienvenido al sistema operativo de BurgerMusic! Este documento detalla cómo operar la plataforma en el día a día.

## 🔑 Credenciales y Roles

| Rol | Usuario (Email) | Contraseña (Default) | PIN Cocina | Permisos |
| :--- | :--- | :--- | :--- | :--- |
| **Manager** | `admin` | `admin123` | - | Acceso Total (Costos, Ventas, Usuarios) (PIN: `123456`) |
| **Kitchen** | (Terminal) | - | `1234` | Solo Reportar Stock (/ingest) |
| **Receiver** | (Terminal) | - | `9999` | Escanear Facturas (/receive) |

> **IMPORTANTE**: Cambiar las contraseñas en el primer inicio de sesión.

---

## 📅 Flujo Diario (Workflow)

### 1. 🍳 Cierre de Cocina (Noche)
**Responsable**: Jefe de Cocina
**URL**: `/ingest`
1. Ingresar PIN `1234`.
2. Escribir el reporte de stock en lenguaje natural.
   - *Ejemplo: "Quedan 3 cajas de cheddar, 20 panes, y 5kg de carne."*
3. Presionar "Analizar" y confirmar cantidades.
4. **Resultado**: El sistema actualiza el stock real.

### 2. 🚚 Recepción de Mercadería (Mañana)
**Responsable**: Recibidor / Encargado
**URL**: `/receive`
1. Cuando llega un proveedor, sacar foto a la factura o subir el PDF.
2. El sistema detecta proveedor e ítems automáticamente.
3. Verificar precios y cantidades.
4. **Resultado**: Se actualiza el stock y el costo de los ingredientes.

### 3. 🧠 Gestión y Compras (Mediodía)
**Responsable**: Manager
**URL**: `/dashboard`
1. **Revisar Alertas**: Ver KPIs de margen (Rojo = Peligro).
2. **El Oráculo (/dashboard/ordering)**: Ver qué falta comprar.
   - El sistema calcula consumo promedio y stock actual.
   - Generar pedidos y enviarlos por WhatsApp con un clic.
3. **Ingeniería de Menú (/dashboard/menu)**: Ajustar precios de venta si los costos subieron.

---

## 🛠️ Solución de Problemas

### El sistema "no carga" o da error
1. Verificar conexión a internet.
2. Recargar la página (F5 o Pull-to-refresh).
3. Verificar estado en `/api/health`.

### La IA no entiende mi mensaje de cocina
- Intentar ser más explícito.
- *Mal*: "quedan pocos panes"
- *Bien*: "quedan 2 bolsas de pan"

### Error al subir factura
- Asegurarse que la foto esté bien iluminada.
- Si falla, ingresar los ítems críticos manualmente en una nota de cocina.

---

## 📞 Soporte
Para problemas técnicos graves, contactar al equipo de desarrollo.
*Versión del Sistema: 1.0.0 (Release Candidate)*
