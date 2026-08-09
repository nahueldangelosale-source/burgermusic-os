import os
import glob

directory = r'D:\Musica Descargada\Burger_Music_OS\HTML_Prototipos'
html_files = glob.glob(os.path.join(directory, '*.html'))

unknowns = set()
for file_path in html_files:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # We are looking for the Unicode Replacement Character \ufffd
        if '\ufffd' in content:
            print(f'Found replacement character in {os.path.basename(file_path)}')
            lines = content.splitlines()
            for i, line in enumerate(lines):
                if '\ufffd' in line:
                    print(f'  L{i+1}: {line.strip()}')
                    
    except Exception as e:
        print(f'Error reading {file_path}: {e}')
