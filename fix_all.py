import os
import glob
import re

directory = r'D:\Musica Descargada\Burger_Music_OS\HTML_Prototipos'
html_files = glob.glob(os.path.join(directory, '*.html'))

for file_path in html_files:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Fix Google Fonts URL
        content = re.sub(r'css2.family=', 'css2?family=', content)
        
        # Fix JS items inside scripts (const iítems, iítems.length, etc)
        content = content.replace('const iítems', 'const items')
        content = content.replace('iítems.length', 'items.length')
        content = content.replace('let iítems', 'let items')
        content = content.replace('iítems =', 'items =')
        content = content.replace('iítems.', 'items.')
        content = content.replace('/ iítems', '/ items')
        content = content.replace('(iítems', '(items')
        
        # The script also broke ternary operators!
        # iítems.length ?  might have been changed because I had a script that removed ? or replaced it!
        # In KDS output above: iítems.length  (completed.length...
        content = content.replace('length Í (', 'length ? (')
        content = content.replace('length  (', 'length ? (')
        content = content.replace('length ? (', 'length ? (') # fallback
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
    except Exception as e:
        print(f"Error on {file_path}: {e}")
        
print("Fixed fonts and JS.")
