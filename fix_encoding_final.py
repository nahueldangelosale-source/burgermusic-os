import os
import glob
import re

directory = r'D:\Musica Descargada\Burger_Music_OS\HTML_Prototipos'
html_files = glob.glob(os.path.join(directory, '*.html'))

replacements = {
    'Ã­': 'í',
    'Ã³': 'ó',
    'Ã¡': 'á',
    'Ã©': 'é',
    'Ãº': 'ú',
    'Ã±': 'ñ',
    'Ã“': 'Ó',
    'Ã ': 'Í',
    'Ã ': 'Á',
    'Ã‰': 'É',
    'Ãš': 'Ú',
    'Ã‘': 'Ñ',
    'CATEGORÃ AS': 'CATEGORÍAS',
    'PEDAGOGÃ A': 'PEDAGOGÍA',
    'ACORDEÃ“N': 'ACORDEÓN',
    'â€“': '-',
    'â€”': '-',
    'âœ”': '✓',
    'âš ': '⚠',
    'â€œ': '"',
    'â€': '"',
    'â€¢': '•',
    'â€²': "'",
    'â• ': '=',
    'Ã\x8d': 'Í'
}

for file_path in html_files:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        modified = False
        for bad, good in replacements.items():
            if bad in content:
                content = content.replace(bad, good)
                modified = True
                
        # Fix any doubled accents if they exist
        content = content.replace('íítems', 'ítems')
        content = content.replace('óó', 'ó')
        content = content.replace('íñ', 'í')
        
        if modified:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f'Fixed encoding characters in {os.path.basename(file_path)}')
    except Exception as e:
        print(f'Error on {file_path}: {e}')
