import re

with open("HTML_Prototipos/auditoria_deposito_prototipo.html", "r", encoding="utf-8") as f:
    html = f.read()

css = """
        .category-header { cursor: pointer; user-select: none; }
        .chevron-icon { font-size: 24px; color: var(--text-muted); transition: transform 0.3s; margin-left: 4px; }
        .chevron-icon.open { transform: rotate(180deg); }
        .category-items { display: none; }
        .category-items.open { display: block; }
"""
html = html.replace("</style>", css + "\n    </style>")

js = """
    function toggleCategory(catId) {
        const items = document.getElementById('items-' + catId);
        const chev = document.getElementById('chev-' + catId);
        if(items.classList.contains('open')) {
            items.classList.remove('open');
            chev.classList.remove('open');
        } else {
            items.classList.add('open');
            chev.classList.add('open');
        }
    }
"""
html = html.replace("function updateProgress()", js + "\n    function updateProgress()")

cats = ["carnes", "panes", "quesos", "congelados", "produccion"]

for cat in cats:
    pill_line = f'<div class="progress-pill" id="prog-{cat}">0'
    idx = html.find(pill_line)
    if idx == -1: continue
    
    end_of_pill_line = html.find('\n', idx)
    end_of_header_div = html.find('</div>', end_of_pill_line) + 6
    
    part1 = html[:end_of_pill_line]
    part2 = html[end_of_pill_line:end_of_header_div]
    part3 = html[end_of_header_div:]
    
    chevron = f'\n                <i class="ri-arrow-down-s-line chevron-icon" id="chev-{cat}"></i>'
    wrapper_open = f'\n            <div class="category-items" id="items-{cat}">'
    
    html = part1 + chevron + part2 + wrapper_open + part3

    header_str = f'<div class="category-card" id="cat-{cat}">\n            <div class="category-header">'
    html = html.replace(header_str, f'<div class="category-card" id="cat-{cat}">\n            <div class="category-header" onclick="toggleCategory(\'{cat}\')">')

    if cat == "produccion":
        search_str = '                <div class="status-indicator"><i class="ri-checkbox-blank-circle-line"></i></div>\n            </div>\n        </div>\n        \n    </div>\n\n    <!-- Botón Inferior -->'
        replace_str = '                <div class="status-indicator"><i class="ri-checkbox-blank-circle-line"></i></div>\n            </div>\n            </div>\n        </div>\n        \n    </div>\n\n    <!-- Botón Inferior -->'
        html = html.replace(search_str, replace_str, 1)
    else:
        search_str = '                <div class="status-indicator"><i class="ri-checkbox-blank-circle-line"></i></div>\n            </div>\n        </div>\n\n        <!-- Categoría'
        replace_str = '                <div class="status-indicator"><i class="ri-checkbox-blank-circle-line"></i></div>\n            </div>\n            </div>\n        </div>\n\n        <!-- Categoría'
        html = html.replace(search_str, replace_str, 1)

with open("HTML_Prototipos/auditoria_deposito_prototipo.html", "w", encoding="utf-8") as f:
    f.write(html)
print("Done safely.")
