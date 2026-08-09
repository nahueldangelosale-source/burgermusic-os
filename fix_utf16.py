import os
import glob

file_path = r'D:\Musica Descargada\Burger_Music_OS\HTML_Prototipos\inventario_prototipo.html'
try:
    with open(file_path, 'rb') as f:
        data = f.read()
    
    # Check if it's UTF-16 LE (it usually starts with BOM \xff\xfe, or every second byte is 0)
    if b'\x00' in data[:20]:
        text = data.decode('utf-16')
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(text)
        print("Restored inventario_prototipo.html from UTF-16 to UTF-8")
        
    else:
        print("Not UTF-16 LE")
except Exception as e:
    print(f"Error: {e}")
