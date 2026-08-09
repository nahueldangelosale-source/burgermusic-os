import os

file_path = r'D:\Musica Descargada\Burger_Music_OS\HTML_Prototipos\inventario_prototipo.html'
try:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Verify we are cutting correctly:
    if content.startswith('?\ufeff?'):
        restored = content[1::2]
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(restored)
        print("Restored from bad ? insertion.")
    else:
        print("Does not start with ?\ufeff?")
        
except Exception as e:
    print("Error:", e)
