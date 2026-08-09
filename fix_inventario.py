import os

file_path = r'D:\Musica Descargada\Burger_Music_OS\HTML_Prototipos\inventario_prototipo.html'
try:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Strip BOM if present
    if content.startswith('\ufeff'):
        content = content[1:]
        
    try:
        original_bytes = content.encode('cp1252')
        correct_content = original_bytes.decode('utf-8')
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(correct_content)
        print("Successfully reversed double-encoding for inventario_prototipo.html")
    except Exception as inner_e:
        print(f"Could not automatically reverse double-encoding: {inner_e}")
        
except Exception as e:
    print(f"Error: {e}")
