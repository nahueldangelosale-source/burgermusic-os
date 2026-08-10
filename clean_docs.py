import os
import re

# 1. Update auditoria_cobertura.md
file1 = "Docs/auditoria_cobertura.md"
with open(file1, "r", encoding="utf-8") as f:
    content1 = f.read()

# Update date
content1 = re.sub(r'> \*\*Fecha:\*\* .*', '> **Fecha:** 10/08/2026', content1)

# Replace conteo_stock with auditoria_deposito
content1 = content1.replace("conteo_stock_prototipo.html", "auditoria_deposito_prototipo.html")

# Replace Documentación table
new_doc_table1 = """## 6. Documentación del Proyecto — Estado Actual

| Artefacto MD | Estado | Última Actualización |
|--------------|--------|---------------------|
| [roadmap_auditoria.md](file:///D:/Musica%20Descargada/Burger_Music_OS/Docs/roadmap_auditoria.md) | ✅ Al día | Fuente única de la verdad |
| [fuente_de_verdad_completa.md](file:///D:/Musica%20Descargada/Burger_Music_OS/Docs/fuente_de_verdad_completa.md) | ⚠️ Pendiente de Burger Music | Tiene ~120 campos ⬜ COMPLETAR |
| [Handoff V2: Cimientos](file:///D:/Musica%20Descargada/Burger_Music_OS/Docs/Handoff_V2/01_cimientos_y_componentes.md) | ✅ Nuevo | Reglas visuales y CSS |
| [Handoff V2: Estado](file:///D:/Musica%20Descargada/Burger_Music_OS/Docs/Handoff_V2/02_arquitectura_y_estado.md) | ✅ Nuevo | JWT, Redux, Validaciones |
| [Handoff V2: Módulos Core](file:///D:/Musica%20Descargada/Burger_Music_OS/Docs/Handoff_V2/03_autopsia_modulos_core.md) | ✅ Nuevo | Interacciones detalladas |
| [Handoff V2: Módulos Futuros](file:///D:/Musica%20Descargada/Burger_Music_OS/Docs/Handoff_V2/04_arquitectura_futura.md) | ✅ Nuevo | RRHH, Finanzas, BI |
| [anexo_funcional_contrato.md](file:///D:/Musica%20Descargada/Burger_Music_OS/Docs/anexo_funcional_contrato.md) | ✅ Estable | Documento contractual base |
| [analisis_stock_operativo.md](file:///D:/Musica%20Descargada/Burger_Music_OS/Docs/analisis_stock_operativo.md) | ✅ Al día | Relevamiento de WhatsApp |
| [catalogo_music_burger.md](file:///D:/Musica%20Descargada/Burger_Music_OS/Docs/catalogo_music_burger.md) | ✅ Al día | Refleja carta activa de Pedix |"""

content1 = re.sub(r'## 6\. Documentación del Proyecto — Estado Actual.*?---', new_doc_table1 + "\n\n---", content1, flags=re.DOTALL)

# Update Next Steps
content1 = content1.replace("4. Prototipar **RRHH** como pantalla propia", "4. Prototipar **RRHH** como pantalla propia (EN PROCESO)")

with open(file1, "w", encoding="utf-8") as f:
    f.write(content1)


# 2. Update roadmap_auditoria.md
file2 = "Docs/roadmap_auditoria.md"
with open(file2, "r", encoding="utf-8") as f:
    content2 = f.read()

content2 = re.sub(r'> \*\*Última actualización:\*\* .*', '> **Última actualización:** 10/08/2026', content2)
content2 = content2.replace("conteo_stock_prototipo.html", "auditoria_deposito_prototipo.html")

new_doc_table2 = """## 7. Inventario de Artefactos de Documentación

| Artefacto | Propósito |
|-----------|-----------|
| [roadmap_auditoria.md](file:///D:/Musica%20Descargada/Burger_Music_OS/Docs/roadmap_auditoria.md) | **Este documento.** Fuente única de la verdad. |
| [fuente_de_verdad_completa.md](file:///D:/Musica%20Descargada/Burger_Music_OS/Docs/fuente_de_verdad_completa.md) | Catálogo completo, BOM, insumos base, precios y unidades. |
| [anexo_funcional_contrato.md](file:///D:/Musica%20Descargada/Burger_Music_OS/Docs/anexo_funcional_contrato.md) | Copia del Anexo Funcional contractual (alcance legal). |
| Carpeta `Docs/Handoff_V2/` | **Guía Definitiva de Diseño Frontend y Handoff Técnico V2.0** en 4 partes (Core, Estado, Prototipos, Futuro). |
| [analisis_stock_operativo.md](file:///D:/Musica%20Descargada/Burger_Music_OS/Docs/analisis_stock_operativo.md) | Relevamiento crudo de WhatsApp (las "193 líneas"). |
| [catalogo_music_burger.md](file:///D:/Musica%20Descargada/Burger_Music_OS/Docs/catalogo_music_burger.md) | Extracción original del catálogo Pedix. |"""

content2 = re.sub(r'## 7\. Inventario de Artefactos de Documentación.*?---', new_doc_table2 + "\n\n---", content2, flags=re.DOTALL)

# Update Gantt chart
gantt_update = """    section Fase 4 — Pendiente
    Handoff Definitivo V2.0             :done, f4a, 2026-08-10, 1d
    RRHH (Fichaje, Cta Cte, Legajos)    :active, f4b, after f4a, 2d
    Backend 3-Way Match (Compras↔Stock) :       f4c, after f4b, 3d
    Finanzas (Cta Cte Empresas)         :       f4d, after f4c, 2d"""
content2 = re.sub(r'    section Fase 4 — Pendiente.*', gantt_update + "\n```", content2, flags=re.DOTALL)

# Update Next Steps
next_steps = """## 9. Próximos Pasos Técnicos (Acción Inmediata)

| Prioridad | Tarea | Descripción |
|-----------|-------|-------------|
| 🔴 Alta | **Módulo de Recursos Humanos** | Iniciar prototipado visual de `equipo_prototipo.html` (Fichaje, Adelantos, Cuentas Corrientes, Legajos) basándose en las reglas del Handoff V2.0. |
| 🔴 Alta | **Definición Backend 3-Way Match** | Estructurar cómo las validaciones del frontend se auditan y cruzan a nivel base de datos entre Compras ↔ Stock ↔ Pagos. |
| 🟡 Media | **Workflow de Salsas y Pan TBP** | Definir con Gerencia los rendimientos exactos de estos productos intermedios. |"""
content2 = re.sub(r'## 9\. Próximos Pasos Técnicos \(Acción Inmediata\).*', next_steps, content2, flags=re.DOTALL)

with open(file2, "w", encoding="utf-8") as f:
    f.write(content2)

print("Update completed.")
