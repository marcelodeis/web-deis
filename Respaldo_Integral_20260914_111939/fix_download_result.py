import os
import re

files = [
    r'C:\Antigravity IDE\WEB DEIS\Influenza_Web\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\Covid_Web\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\VRS\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\VPH_Web\autoconsulta.js'
]

def fix_download_result(path):
    if not os.path.exists(path): return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Fix outputName
    content = re.sub(r'outputName\s*=\s*\$\{baseName\}_AUTOCONSULTA_([A-Z]+)\.xlsx;', r'outputName = `${baseName}_AUTOCONSULTA_\1.xlsx`;', content)
    
    # Fix text: ✅ Archivo descargado: ,
    content = re.sub(r'text:\s*✅ Archivo descargado:\s*,', r'text: `✅ Archivo descargado: `,', content)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Fixed download result in {path}")

for f in files:
    fix_download_result(f)
