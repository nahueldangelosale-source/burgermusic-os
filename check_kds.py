import os

file_path = r'D:\Musica Descargada\Burger_Music_OS\HTML_Prototipos\kds_prototipo.html'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Let's see the context around lane-new, lane-prep, lane-ready
import re
matches = re.finditer(r'<div class="kanban-lane', content)
for m in matches:
    start = max(0, m.start() - 50)
    end = min(len(content), m.start() + 200)
    print(content[start:end])
    print("-" * 40)
