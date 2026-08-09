import os
import glob

directory = r'D:\Musica Descargada\Burger_Music_OS\HTML_Prototipos'
html_files = glob.glob(os.path.join(directory, '*.html'))

for file_path in html_files:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if 'align-iítems' in content:
            content = content.replace('align-iítems', 'align-items')
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f'Fixed CSS typo in {os.path.basename(file_path)}')
            
        if 'DiseÃ±o Atómico' in content:
            content = content.replace('DiseÃ±o Atómico', 'Diseño Atómico')
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
    except Exception as e:
        pass
