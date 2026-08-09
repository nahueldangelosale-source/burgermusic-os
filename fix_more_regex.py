import os
import glob
import re

directory = r'D:\Musica Descargada\Burger_Music_OS\HTML_Prototipos'
html_files = glob.glob(os.path.join(directory, '*.html'))

fixes = {
    'Lato: wght': 'Lato:wght',
    'Montserrat: wght': 'Montserrat:wght',
    'donut-hole ? span :': 'donut-hole span:',
    'Stock ? actual :': 'Stock actual:',
    'Reportado ? por :': 'Reportado por:',
    'de ? Venta :': 'de Venta:',
    'Sin ? Urgencia :': 'Sin Urgencia:',
    'OVER ? MODAL :': 'OVER MODAL:',
    'Hoy ? 11 : 45': 'Hoy • 11:45',
    'Hoy ? 09 : 10': 'Hoy • 09:10',
    'Merm ? a :': 'Merma:',
    'Encargad ? o :': 'Encargado:',
    'Merm ? a : 8%': 'Merma: 8%',
    'Encargad ? o : Lucas': 'Encargado: Lucas'
}

for file_path in html_files:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        for bad, good in fixes.items():
            content = content.replace(bad, good)
            
        # Also let's fix any remaining stray spaces around colon in HTML
        content = re.sub(r'([a-zA-Z0-9_-]+)\s*\?\s*([a-zA-Z0-9_-]+)\s*:', r'\1 \2:', content)
            
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
    except Exception as e:
        print(f"Error on {file_path}: {e}")
        
print("Reverted more regex.")
