import os

file_path = r'D:\Musica Descargada\Burger_Music_OS\HTML_Prototipos\inventario_prototipo.html'
try:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We replace the literal broken strings with correct Spanish words
    replacements = {
        'artÃ­culo': 'artículo',
        'ArtÃ­culo': 'Artículo',
        'ARTÃ\x8dCULO': 'ARTÍCULO',
        'ARTÃ CULO': 'ARTÍCULO',
        'categorÃ­a': 'categoría',
        'CategorÃ­a': 'Categoría',
        'Ã­tems': 'ítems',
        'Ã\x8dtems': 'Ítems',
        'estÃ¡n': 'están',
        'acciÃ³n': 'acción',
        'AcciÃ³n': 'Acción',
        'MÃ­n': 'Mín',
        'mÃ­nimo': 'mínimo',
        'LanÃºs': 'Lanús',
        '': '', # Remove replacement characters
        'â€“': '-',
        'âœ”': '✓',
        'âš ': '⚠'
    }
    
    for bad, good in replacements.items():
        if bad in content:
            content = content.replace(bad, good)
            
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("Replacements done for inventario_prototipo.html")
except Exception as e:
    print(f"Error: {e}")
