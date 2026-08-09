import os
import glob
import re

directory = r'D:\Musica Descargada\Burger_Music_OS\HTML_Prototipos'
html_files = glob.glob(os.path.join(directory, '*.html'))

for file_path in html_files:
    try:
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
            
        # Fix missing ternary operators and specific broken characters that show as \ufffd ()
        content = content.replace(' === 0  ', ' === 0 ? ')
        content = content.replace('===0 ', '===0 ?')
        content = content.replace('=== 0 ', '=== 0 ?')
        content = content.replace('vaca', 'vacía')
        content = content.replace('lmite', 'límite')
        content = content.replace('Lmite', 'Límite')
        content = content.replace('Cortesa', 'Cortesía')
        content = content.replace('Martn', 'Martín')
        content = content.replace('Auditora', 'Auditoría')
        content = content.replace('Panadera', 'Panadería')
        content = content.replace('Impresin', 'Impresión')
        content = content.replace('Ingres', 'Ingresó')
        content = content.replace('Mx', 'Máx')
        content = content.replace('vlido', 'válido')
        content = content.replace('categora', 'categoría')
        content = content.replace('artculo', 'artículo')
        content = content.replace('ARTCULO', 'ARTÍCULO')
        content = content.replace('atencin', 'atención')
        content = content.replace('Recin', 'Recién')
        content = content.replace('Crtico', 'Crítico')
        content = content.replace('ttulo', 'título')
        content = content.replace('Lmite', '¡Límite')
        
        # In JS ternary:
        content = re.sub(r'(\w+)\s*\s*(\'.*?\'|\w+)\s*:\s*(\'.*?\'|\w+)', r'\1 ? \2 : \3', content)
        content = re.sub(r'(\w+\s*===\s*\w+)\s*\s*', r'\1 ? ', content)
        content = re.sub(r'(\w+\.length)\s*\s*', r'\1 ? ', content)
        
        # '' itself in strings might be an unknown byte. 
        # But we don't want to blindly replace  with ? if it's inside text.
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
    except Exception as e:
        print(f"Error on {file_path}: {e}")
        
print("Fixed remaining encoding/logic issues.")
