# Walkthrough: Edge Cases de Fase 1 (Core Operativo)

Este documento resume la implementación exitosa de los conceptos avanzados de diseño (Edge Cases) que inyectan inteligencia, prevención de errores y reducción de fricción en la operatoria de Burger Music.

## 1. Módulo POS (Velocidad y Precisión)
**Archivo:** [pos_prototipo.html](file:///D:/Musica%20Descargada/Burger_Music_OS/HTML_Prototipos/pos_prototipo.html)

*   **El Freno de Emergencia (Botón Anular):** 
    Integrado en la cabecera del ticket. Al mantener pulsado el botón "Anular", un timer de 2 segundos provee feedback visual de prevención de error (*"Mantén..."*). Si se completa, solicita PIN y vacía el ticket.
*   **Desglose Dinámico (Split Payments):** 
    Al seleccionar el método "Efectivo", la parte inferior del ticket se expande inteligentemente mostrando un campo de ingreso de billetes. Si el cajero ingresa un monto inferior al total, aparece una alerta roja calculando instantáneamente el saldo restante (`Resta: $X`), con un botón rápido para saldar esa diferencia con MercadoPago.
*   **Trazabilidad Transparente (Menú de Cortesías):** 
    Se agregó el botón `[Acciones]` que despliega un submenú contextual para inyectar líneas en negativo al ticket (Ej: `Cortesía: Demora (10%)`), impactando el subtotal y garantizando que no haya sobrantes/faltantes ciegos en la caja.

## 2. Módulo KDS (Control y Flujo Continuo)
**Archivo:** [kds_prototipo.html](file:///D:/Musica%20Descargada/Burger_Music_OS/HTML_Prototipos/kds_prototipo.html)

*   **Checklist Atómico (Despacho Parcial):** 
    Las filas dentro de las comandas ahora son interactivas (hover). Al tocar una hamburguesa que ya salió de la plancha, se tacha, se vuelve grisácea y una **barra de progreso verde flúo** avanza en la cabecera del ticket. Provee feedback visual instantáneo sobre el estado del pedido sin necesidad de marcar todo como listo.
*   **La Línea de Vida (Panel de Recall):** 
    Cuando un ticket es despachado (marcado como entregado), no desaparece en el vacío. En su lugar, "vuela" a un panel flotante en la esquina inferior derecha llamado **Recientes**. Allí reposa durante 10 segundos con un botón claro de `Deshacer`, permitiendo al parrillero revertir toques accidentales y restaurar el ticket a la pantalla de cocina.

## 3. Módulo Cajas (Liquidación sin Fricción)
**Archivo:** [cajas_prototipo.html](file:///D:/Musica%20Descargada/Burger_Music_OS/HTML_Prototipos/cajas_prototipo.html)

*   **El Match Perfecto (Rendición de Cadetes):** 
    Se agregó una pestaña dedicada en Cajas (`Rendición Delivery`). La pantalla está dividida: a la izquierda, los pedidos entregados por el cadete con indicadores visuales hiper-claros (billetes verdes o logo azul de MP). A la derecha, un campo de `Efectivo a Rendir`. El cajero cuenta los billetes, ingresa el número, y **solo si el monto ingresado coincide exactamente con el esperado por el sistema**, el input se vuelve verde y se habilita el botón gigante de "Liquidar Cadete". Esto transfiere el riesgo contable con una confirmación lúdica y segura.

---

> [!TIP]
> **Próximo Paso Sugerido**
> Con la Fase 1 (Core Operativo) completamente cerrada a nivel conceptual y visual (incluyendo sus edge cases), el terreno está preparado para avanzar a la **Fase 2: Producción y Stock**.
> Recomiendo iniciar con la **pantalla móvil de Conteo Rápido de Stock**, que eliminará el uso de WhatsApp y solucionará el dolor número 1 de los encargados.
