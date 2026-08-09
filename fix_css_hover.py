import os
import glob
import re

directory = r'D:\Musica Descargada\Burger_Music_OS\HTML_Prototipos'
html_files = glob.glob(os.path.join(directory, '*.html'))

for file_path in html_files:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # CSS pseudo-classes shouldn't have spaces
        content = content.replace(': hover', ':hover')
        content = content.replace(': active', ':active')
        content = content.replace(': focus', ':focus')
        content = content.replace(': focus-within', ':focus-within')
        content = content.replace(': first-child', ':first-child')
        content = content.replace(': last-child', ':last-child')
        content = content.replace(': checked', ':checked')
        content = content.replace(': before', ':before')
        content = content.replace(': after', ':after')
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
    except Exception as e:
        print(f"Error on {file_path}: {e}")
        
print("Fixed CSS pseudo-classes.")
