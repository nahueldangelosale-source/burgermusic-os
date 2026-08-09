import os
import glob

directory = r'D:\Musica Descargada\Burger_Music_OS\HTML_Prototipos'
html_files = glob.glob(os.path.join(directory, '*.html'))

fixes = {
    'Estaci ? n :': 'Estación:',
    'Cortes ? a :': 'Cortesía:',
    'INTERCEPTACIN :': 'INTERCEPTACIÓN:',
    'Producci ? n :': 'Producción:',
    'pinCount === 4 ? )': 'pinCount === 4)',
    'remaining === 0 ? )': 'remaining === 0)',
    'id === 2 ? )': 'id === 2)',
    'filledCount === totalInputs ? )': 'filledCount === totalInputs)'
}

for file_path in html_files:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        for bad, good in fixes.items():
            content = content.replace(bad, good)
            
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
    except Exception as e:
        print(f"Error on {file_path}: {e}")
        
print("Reverted last few regex.")
