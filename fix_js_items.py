import os
import glob
import re

directory = r'D:\Musica Descargada\Burger_Music_OS\HTML_Prototipos'
html_files = glob.glob(os.path.join(directory, '*.html'))

for file_path in html_files:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Fix CSS align-items
        content = re.sub(r'align-i?ítems', 'align-items', content)
        content = re.sub(r'align-i?Ã­tems', 'align-items', content)
        
        # Fix pos_prototipo IDs and variables
        content = re.sub(r'ticket-i?ítems', 'ticket-items', content)
        content = re.sub(r'cartI?ítems', 'cartItems', content)
        content = re.sub(r'cartI?Ã­tems', 'cartItems', content)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
    except Exception as e:
        print(f"Error on {file_path}: {e}")
        
print("Fixed JS/CSS item names.")
