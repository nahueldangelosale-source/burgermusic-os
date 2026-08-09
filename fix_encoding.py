import os
import glob

directory = r'D:\Musica Descargada\Burger_Music_OS\HTML_Prototipos'
html_files = glob.glob(os.path.join(directory, '*.html'))

replacements = {
    'AuditorÃ­a': 'Auditoría',
    'Auditora': 'Auditoría',
    'DepÃ³sito': 'Depósito',
    'Depsito': 'Depósito',
    'Produccin': 'Producción',
    'ProducciÃ³n': 'Producción',
    'Mn:': 'Mín:',
    'Lanǧs': 'Lanús',
    'Rinde "ptimo': 'Rinde Óptimo',
    'sltimos 7 das': 'Últimos 7 días',
    'artculo': 'artículo',
    'categora': 'categoría',
    'tems': 'ítems',
    'estn': 'están',
    'atencin': 'atención',
    'Medalln': 'Medallón',
    '-': '-',
    '?"': '-',
    '?': 'Í',
    'Diseo Atmico': 'Diseño Atómico',
    'Nǧmeros': 'Números'
}

for file_path in html_files:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        modified = False
        for bad, good in replacements.items():
            if bad in content:
                content = content.replace(bad, good)
                modified = True
                
        if modified:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f'Fixed {os.path.basename(file_path)}')
    except Exception as e:
        print(f'Error reading {file_path}: {e}')
