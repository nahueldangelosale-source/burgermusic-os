import os
import glob
import re

directory = r'D:\Musica Descargada\Burger_Music_OS\HTML_Prototipos'
html_files = glob.glob(os.path.join(directory, '*.html'))

for file_path in html_files:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Reverse the catastrophic regex
        # Pattern: Word characters (including hyphens) followed by " ? " then a single character, then " :"
        # E.g. "margi ? n :" -> "margin:"
        content = re.sub(r'([a-zA-Z0-9_-]+)\s*\?\s*([a-zA-Z0-9])\s*:', r'\1\2:', content)
        
        # There was also displa ? y : none; which was fixed manually in the previous script to display: none;
        # But this regex will catch everything else.
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
    except Exception as e:
        print(f"Error on {file_path}: {e}")
        
print("Reverted catastrophic regex.")
