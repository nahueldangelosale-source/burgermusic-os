import os

file_path = r'D:\Musica Descargada\Burger_Music_OS\HTML_Prototipos\inventario_prototipo.html'
template_path = r'D:\Musica Descargada\Burger_Music_OS\HTML_Prototipos\produccion_gerencial_prototipo.html'

with open(template_path, 'r', encoding='utf-8') as f:
    template = f.read()

# Extract the header and sidebar parts, and the closing parts
start_main = template.find('<main class="main-content">')
end_main = template.find('</main>') + 7

header_sidebar = template[:start_main]
footer = template[end_main:]

main_content = '''<main class="main-content">
        <!-- Topbar -->
        <header class="topbar">
            <div class="topbar-left">
                <button class="icon-btn" style="display:none;" id="mobileMenuBtn">
                    <i class="ri-menu-line"></i>
                </button>
            </div>
            <div class="topbar-right">
                <button class="icon-btn" title="Notificaciones" style="position:relative;">
                    <i class="ri-notification-3-line"></i>
                    <span style="position:absolute; top:4px; right:4px; width:8px; height:8px; background:var(--alert-high-text); border-radius:50%;"></span>
                </button>
                <div class="user-profile">
                    <div class="avatar">
                        <i class="ri-user-3-fill"></i>
                    </div>
                    <span class="lato" style="font-weight: 700;">Gerente LAN</span>
                </div>
            </div>
        </header>

        <!-- Contenido Principal -->
        <div class="content-wrapper">
            <div class="page-header" style="margin-bottom: 24px;">
                <h1 class="page-title">Inventario</h1>
                <p class="page-subtitle">Stock, recetas (BOM) y alertas de reposición.</p>
            </div>

            <!-- TABS -->
            <div class="tabs" style="display: flex; gap: 24px; border-bottom: 1px solid var(--border-light); margin-bottom: 24px;">
                <div class="tab active" style="padding-bottom: 12px; font-family: 'Montserrat'; font-weight: 700; color: var(--brand-primary); border-bottom: 3px solid var(--brand-primary); cursor: pointer; display: flex; align-items: center; gap: 8px;">
                    <i class="ri-box-3-line"></i> Vista de Stock
                </div>
                <div class="tab" style="padding-bottom: 12px; font-family: 'Montserrat'; font-weight: 600; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; gap: 8px;">
                    <i class="ri-restaurant-line"></i> Vista de Recetas
                </div>
                <div class="tab" style="padding-bottom: 12px; font-family: 'Montserrat'; font-weight: 600; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; gap: 8px;">
                    <i class="ri-history-line"></i> Historial de Movimientos
                </div>
            </div>

            <!-- FILTERS & SEARCH -->
            <div style="display: flex; gap: 16px; margin-bottom: 24px; align-items: center;">
                <div class="filter-chip active" style="background: white; border: 1px solid var(--brand-primary); color: var(--brand-primary); padding: 8px 16px; border-radius: 20px; font-family: 'Lato'; font-weight: 700; font-size: 13px; cursor: pointer;">
                    Todos <span style="background: var(--bg-main); padding: 2px 6px; border-radius: 10px; margin-left: 4px; font-size: 11px;">193</span>
                </div>
                <div class="filter-chip" style="background: white; border: 1px solid var(--border-light); color: var(--text-main); padding: 8px 16px; border-radius: 20px; font-family: 'Lato'; font-weight: 700; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                    <i class="ri-flag-fill" style="color: var(--alert-medium-text);"></i> Requiere Acción <span style="background: var(--bg-main); padding: 2px 6px; border-radius: 10px; font-size: 11px;">21</span>
                </div>
                <div style="flex-grow: 1;"></div>
                <div class="search-box" style="position: relative; width: 300px;">
                    <i class="ri-search-line" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted);"></i>
                    <input type="text" placeholder="Buscar artículo..." style="width: 100%; padding: 10px 10px 10px 36px; border: 1px solid var(--border-light); border-radius: 8px; font-family: 'Lato'; outline: none;">
                </div>
            </div>

            <!-- TIP -->
            <div style="background: #F0F7FF; border: 1px solid #BAE6FD; padding: 16px; border-radius: 8px; display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
                <i class="ri-lightbulb-line" style="color: #0284C7; font-size: 20px;"></i>
                <div style="font-family: 'Lato'; font-size: 13px; color: #0369A1; flex-grow: 1;">
                    Cada categoría agrupa artículos por tipo. Hacé clic en una fila para ver su receta o stock detallado. Los ítems sin color están <strong>en orden</strong>; solo los marcados necesitan atención.
                </div>
                <i class="ri-close-line" style="color: #7DD3FC; cursor: pointer; font-size: 20px;"></i>
            </div>

            <!-- ACCORDION ITEMS -->
            <div class="category-block" style="background: white; border: 1px solid var(--border-light); border-radius: 12px; margin-bottom: 16px; overflow: hidden;">
                <!-- Header -->
                <div style="padding: 16px 24px; display: flex; align-items: center; cursor: pointer; border-bottom: 1px solid var(--border-light);">
                    <div style="width: 32px; height: 32px; border-radius: 8px; background: #F97316; display: flex; justify-content: center; align-items: center; color: white; margin-right: 16px;">
                        <i class="ri-burger-line"></i>
                    </div>
                    <div style="font-family: 'Montserrat'; font-weight: 700; font-size: 15px; flex-grow: 1;">
                        Burgers <span style="color: var(--text-muted); font-weight: 400; font-size: 13px;">(12)</span>
                    </div>
                    <div style="font-family: 'Lato'; font-weight: 700; font-size: 12px; color: #F59E0B; margin-right: 16px;">
                        4 pendientes
                    </div>
                    <i class="ri-arrow-up-s-line" style="color: var(--text-muted); font-size: 20px;"></i>
                </div>

                <!-- Table -->
                <div style="padding: 0;">
                    <!-- Table Header -->
                    <div style="display: grid; grid-template-columns: 24px 2fr 1fr 1fr 1fr 40px; padding: 12px 24px; background: #F8FAFC; border-bottom: 1px solid var(--border-light); font-family: 'Lato'; font-weight: 700; font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">
                        <div></div>
                        <div>ARTÍCULO</div>
                        <div>RECETA</div>
                        <div>PRECIO</div>
                        <div>MARGEN</div>
                        <div></div>
                    </div>

                    <!-- Row 1 -->
                    <div style="display: grid; grid-template-columns: 24px 2fr 1fr 1fr 1fr 40px; padding: 16px 24px; border-bottom: 1px solid var(--border-light); align-items: center; cursor: pointer; transition: background 0.2s;">
                        <div style="display: flex; justify-content: center;"><div style="width: 6px; height: 6px; border-radius: 50%; background: #CBD5E1;"></div></div>
                        <div>
                            <div style="font-family: 'Montserrat'; font-weight: 700; font-size: 14px;">AC/DC</div>
                            <div style="font-family: 'Lato'; font-size: 12px; color: var(--text-muted);">Producto Venta</div>
                        </div>
                        <div style="font-family: 'Lato'; font-size: 13px; font-weight: 600; color: var(--text-main);">8/8 ✓</div>
                        <div style="font-family: 'Lato'; font-size: 13px; font-weight: 700;">.300</div>
                        <div style="font-family: 'Montserrat'; font-size: 13px; font-weight: 700; color: #10B981;">66%</div>
                        <div style="display: flex; justify-content: flex-end;"><i class="ri-arrow-down-s-line" style="color: var(--text-muted);"></i></div>
                    </div>

                    <!-- Row 2 -->
                    <div style="display: grid; grid-template-columns: 24px 2fr 1fr 1fr 1fr 40px; padding: 16px 24px; border-bottom: 1px solid var(--border-light); align-items: center; cursor: pointer;">
                        <div style="display: flex; justify-content: center;"><div style="width: 6px; height: 6px; border-radius: 50%; background: #CBD5E1;"></div></div>
                        <div>
                            <div style="font-family: 'Montserrat'; font-weight: 700; font-size: 14px;">CLASSIC</div>
                            <div style="font-family: 'Lato'; font-size: 12px; color: var(--text-muted);">Producto Venta</div>
                        </div>
                        <div style="font-family: 'Lato'; font-size: 13px; font-weight: 600; color: var(--text-main);">4/4 ✓</div>
                        <div style="font-family: 'Lato'; font-size: 13px; font-weight: 700;">.300</div>
                        <div style="font-family: 'Montserrat'; font-size: 13px; font-weight: 700; color: #10B981;">62%</div>
                        <div style="display: flex; justify-content: flex-end;"><i class="ri-arrow-down-s-line" style="color: var(--text-muted);"></i></div>
                    </div>

                    <!-- Row 3 -->
                    <div style="display: grid; grid-template-columns: 24px 2fr 1fr 1fr 1fr 40px; padding: 16px 24px; border-bottom: 1px solid var(--border-light); align-items: center; cursor: pointer;">
                        <div style="display: flex; justify-content: center;"><div style="width: 6px; height: 6px; border-radius: 50%; background: #CBD5E1;"></div></div>
                        <div>
                            <div style="font-family: 'Montserrat'; font-weight: 700; font-size: 14px;">DUKO</div>
                            <div style="font-family: 'Lato'; font-size: 12px; color: var(--text-muted);">Producto Venta</div>
                        </div>
                        <div style="font-family: 'Lato'; font-size: 13px; font-weight: 600; color: var(--text-main);">6/6 ✓</div>
                        <div style="font-family: 'Lato'; font-size: 13px; font-weight: 700;">.100</div>
                        <div style="font-family: 'Montserrat'; font-size: 13px; font-weight: 700; color: #10B981;">58%</div>
                        <div style="display: flex; justify-content: flex-end;"><i class="ri-arrow-down-s-line" style="color: var(--text-muted);"></i></div>
                    </div>

                    <!-- Row 4 (Alert) -->
                    <div style="display: grid; grid-template-columns: 24px 2fr 1fr 1fr 1fr 40px; padding: 16px 24px; border-bottom: 1px solid var(--border-light); align-items: center; cursor: pointer;">
                        <div style="display: flex; justify-content: center;"><div style="width: 6px; height: 6px; border-radius: 50%; background: #F59E0B;"></div></div>
                        <div>
                            <div style="font-family: 'Montserrat'; font-weight: 700; font-size: 14px;">CHARLY</div>
                            <div style="font-family: 'Lato'; font-size: 12px; color: var(--text-muted);">Producto Venta</div>
                        </div>
                        <div style="font-family: 'Lato'; font-size: 13px; font-weight: 700; color: #DC2626;">2/8 ⚠</div>
                        <div style="font-family: 'Lato'; font-size: 13px; font-weight: 700;">.500</div>
                        <div style="font-family: 'Montserrat'; font-size: 13px; font-weight: 700; color: var(--text-muted);">--</div>
                        <div style="display: flex; justify-content: flex-end;"><i class="ri-arrow-down-s-line" style="color: var(--text-muted);"></i></div>
                    </div>
                    
                    <!-- Row 5 (Alert) -->
                    <div style="display: grid; grid-template-columns: 24px 2fr 1fr 1fr 1fr 40px; padding: 16px 24px; border-bottom: 1px solid var(--border-light); align-items: center; cursor: pointer;">
                        <div style="display: flex; justify-content: center;"><div style="width: 6px; height: 6px; border-radius: 50%; background: #F59E0B;"></div></div>
                        <div>
                            <div style="font-family: 'Montserrat'; font-weight: 700; font-size: 14px;">GORILLAZ</div>
                            <div style="font-family: 'Lato'; font-size: 12px; color: var(--text-muted);">Producto Venta</div>
                        </div>
                        <div style="font-family: 'Lato'; font-size: 13px; font-weight: 700; color: #F59E0B;">5/8 ⚠</div>
                        <div style="font-family: 'Lato'; font-size: 13px; font-weight: 700;">.900</div>
                        <div style="font-family: 'Montserrat'; font-size: 13px; font-weight: 700; color: var(--text-muted);">--</div>
                        <div style="display: flex; justify-content: flex-end;"><i class="ri-arrow-down-s-line" style="color: var(--text-muted);"></i></div>
                    </div>
                    
                    <!-- Row 6 (Alert) -->
                    <div style="display: grid; grid-template-columns: 24px 2fr 1fr 1fr 1fr 40px; padding: 16px 24px; border-bottom: 1px solid var(--border-light); align-items: center; cursor: pointer;">
                        <div style="display: flex; justify-content: center;"><div style="width: 6px; height: 6px; border-radius: 50%; background: #F59E0B;"></div></div>
                        <div>
                            <div style="font-family: 'Montserrat'; font-weight: 700; font-size: 14px;">TECHNO CHICKEN</div>
                            <div style="font-family: 'Lato'; font-size: 12px; color: var(--text-muted);">Producto Venta</div>
                        </div>
                        <div style="font-family: 'Lato'; font-size: 13px; font-weight: 700; color: #F59E0B;">4/8 ⚠</div>
                        <div style="font-family: 'Lato'; font-size: 13px; font-weight: 700;">.600</div>
                        <div style="font-family: 'Montserrat'; font-size: 13px; font-weight: 700; color: var(--text-muted);">--</div>
                        <div style="display: flex; justify-content: flex-end;"><i class="ri-arrow-down-s-line" style="color: var(--text-muted);"></i></div>
                    </div>
                </div>
            </div>
            
            <!-- HISTORIAL DE MOVIMIENTOS (Badge Re-added) -->
            <div class="category-block" style="background: white; border: 1px solid var(--border-light); border-radius: 12px; margin-bottom: 16px; overflow: hidden; display: none;" id="historial-block">
                <div style="padding: 24px;">
                    <div class="timeline-item" style="display: flex; gap: 16px; margin-bottom: 24px;">
                        <div style="display: flex; flex-direction: column; align-items: center;">
                            <div style="width: 12px; height: 12px; border-radius: 50%; background: #10B981; margin-top: 4px;"></div>
                            <div style="width: 2px; height: 100%; background: var(--border-light); margin-top: 4px;"></div>
                        </div>
                        <div>
                            <div style="font-family: 'Montserrat'; font-size: 14px; font-weight: 700;">Ingreso de Mercadería <span style="background: var(--brand-primary); color: white; padding: 2px 8px; border-radius: 12px; font-size: 10px; margin-left: 8px;">Recién ingresado</span></div>
                            <div style="font-family: 'Lato'; font-size: 12px; color: var(--text-muted); margin-top: 4px;">Hace 5 minutos por Gerente LAN</div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    </main>'''

header_sidebar = header_sidebar.replace('produccion_gerencial_prototipo.html', 'produccion_gerencial_prototipo_off.html').replace('inventario_prototipo.html', 'inventario_prototipo.html" class="nav-item active').replace('nav-item active"><i class="ri-hammer-fill', 'nav-item"><i class="ri-hammer-fill')
header_sidebar = header_sidebar.replace('_off.html', '.html')

final_content = header_sidebar + main_content + footer

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(final_content)
