import os

file_path = r'D:\Musica Descargada\Burger_Music_OS\HTML_Prototipos\inventario_prototipo.html'
try:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Reverse the bad single-character replacements in reverse order
    content = content.replace('ítems', 'tems')
    content = content.replace('ó', '"')
    content = content.replace('ón', 'n')
    content = content.replace('ía', 'a')
    content = content.replace('ú', 's')
    
    # 2. Reverse the logic replacements
    content = content.replace('q ? count', 'qcount')
    content = content.replace('m ? ', 'm')
    content = content.replace('isAction ? ', 'isAction')
    content = content.replace('? count', 'count')
    
    # 3. Restore the original 'ó' characters that became '"'
    words_with_o = {
        'Producci"n': 'Producción',
        'Acci"n': 'Acción',
        'acci"n': 'acción',
        'Dep"sito': 'Depósito',
        '"ptimo': 'óptimo',
        '"ptima': 'óptima',
        'Acorde"n': 'Acordeón',
        'At"mico': 'Atómico',
        'c"digo': 'código',
        'opci"n': 'opción',
        'versi"n': 'versión',
        'reposici"n': 'reposición',
        'Informaci"n': 'Información',
        'informaci"n': 'información',
        'Gesti"n': 'Gestión',
        'gesti"n': 'gestión',
        'hist"rico': 'histórico',
        'Hist"rico': 'Histórico',
        'bot"n': 'botón',
        'Bot"n': 'Botón',
        'secci"n': 'sección',
        'Secci"n': 'Sección',
        'Descripci"n': 'Descripción',
        'descripci"n': 'descripción',
        'Configuraci"n': 'Configuración'
    }
    
    for bad, good in words_with_o.items():
        content = content.replace(bad, good)
        
    # Also fix 'tems' back to 'ítems' properly (without breaking other things)
    content = content.replace('tems', 'ítems')
    # wait, 'items' or 'tems'? The bad script replaced 'tems' with 'ítems'. So 'ítems' became 'íítems'.
    content = content.replace('íítems', 'ítems')
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("Reversed damage in inventario_prototipo.html")
except Exception as e:
    print(f"Error: {e}")
