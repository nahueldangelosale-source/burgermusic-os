import os

file_path = r'D:\Musica Descargada\Burger_Music_OS\HTML_Prototipos\kds_prototipo.html'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

import re
match = re.search(r'<!-- CARRIL1: Nuevas -->.*?</main>', content, flags=re.DOTALL)
if match:
    print(match.group(0))
