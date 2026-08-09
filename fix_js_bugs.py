import os
import glob
import re

directory = r'D:\Musica Descargada\Burger_Music_OS\HTML_Prototipos'
html_files = glob.glob(os.path.join(directory, '*.html'))

for file_path in html_files:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Fix JS ternary operators that were corrupted to 'Í'
        # e.g., index === 0 Í 'active' : ''
        # We'll just replace ' Í ' with ' ? ' (since ternary operators usually have spaces)
        content = content.replace(' Í ', ' ? ')
        content = content.replace('Í \'', '? \'')
        
        # Fix ticketIítems
        content = content.replace('ticketIítems', 'ticketItems')
        content = content.replace('ticketIÃ­tems', 'ticketItems')
        content = content.replace('const iítems', 'const items')
        content = content.replace('iítems.', 'items.')
        content = content.replace('iítems=', 'items=')
        content = content.replace('let iítems', 'let items')
        content = content.replace('iítems', 'items') # Just replace all remaining 'iítems' with 'items' since it's only ever used in JS. Wait, 'iítems' might not exist in Spanish, it's 'ítems'. So 'iítems' is definitely a JS variable!
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
    except Exception as e:
        print(f"Error on {file_path}: {e}")
        
print("Fixed JS bugs in all files.")
