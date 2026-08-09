import os

file_path = r'D:\Musica Descargada\Burger_Music_OS\HTML_Prototipos\inventario_prototipo.html'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('class="nav-item active" class="nav-item"', 'class="nav-item active"')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
