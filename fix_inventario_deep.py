import os

file_path = r'D:\Musica Descargada\Burger_Music_OS\HTML_Prototipos\inventario_prototipo.html'
try:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We replace weird invisible bytes that break encoding
    replacements = {
        '\x90': '',
        '\x8d': '',
        '\x8f': '',
        '\x81': '',
        '': '?',
        'count': '? count',
        'isAction': 'isAction ? ',
        'm': 'm ? ',
        'qcount': 'q ? count',
        '8/8 o"': '8/8 ✓',
        '4/4 o"': '4/4 ✓',
        '6/6 o"': '6/6 ✓',
        '2/8 i': '2/8 ⚠',
        '5/8 i': '5/8 ⚠',
        '4/8 i': '4/8 ⚠',
        '?A': 'ÍA',
        '?"': '-',
        's': 'ú',
        'a': 'ía',
        'n': 'ón',
        '"': 'ó',
        'tems': 'ítems'
    }
    
    for bad, good in replacements.items():
        if bad in content:
            content = content.replace(bad, good)
            
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("Final deep cleanup done for inventario_prototipo.html")
except Exception as e:
    print(f"Error: {e}")
