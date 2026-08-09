import os
import glob

directory = r'D:\Musica Descargada\Burger_Music_OS\HTML_Prototipos'
html_files = glob.glob(os.path.join(directory, '*.html'))

fixes = {
    'displa ? y :': 'display:',
    'colo ? r :': 'color:',
    'font-siz ? e :': 'font-size:',
    'paddin ? g :': 'padding:',
    'margin-to ? p :': 'margin-top:',
    'margin-botto ? m :': 'margin-bottom:',
    'font-weigh ? t :': 'font-weight:',
    'text-alig ? n :': 'text-align:',
    'ga ? p :': 'gap:',
    'fle ? x :': 'flex:',
    'da ? y :': 'day:',
    'mont ? h :': 'month:',
    'yea ? r :': 'year:',
    'E ? j :': 'Ej:',
    'Format ? o :': 'Formato:',
    'ESTAD ? O :': 'ESTADO:',
    'btnActionFas ? t :': 'btnActionFast :',
    "meatInputGroup ? '": "meatInputGroup'",
    "trayInputGroup ? '": "trayInputGroup'",
    "standardInputGroup ? '": "standardInputGroup'",
    'currentPin.length ? === 4 ?': 'currentPin.length === 4',
    'currentPin.length ? < 4': 'currentPin.length < 4',
    'inputs.length ? ;': 'inputs.length;',
    'items.length ? ?': 'items.length ?',
    'completed.length ? /': 'completed.length /',
    'items.length ? ) * 10 ? 0 : 0': 'items.length) * 100 : 0',
    'cartItems.length ? === 0 ?': 'cartItems.length === 0',
    'mods.length ? > 0': 'mods.length > 0',
    'cartItems.length ? > 0': 'cartItems.length > 0',
    'Esperado ? :': 'Esperado:',
    'Técnico ? Esperado': 'Técnico Esperado',
    'currentPin.length ? )': 'currentPin.length)'
}

for file_path in html_files:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        for bad, good in fixes.items():
            content = content.replace(bad, good)
            
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
    except Exception as e:
        print(f"Error on {file_path}: {e}")
        
print("Reverted broken regex.")
