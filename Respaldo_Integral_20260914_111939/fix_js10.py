import os
import re

files = [
    r'C:\Antigravity IDE\WEB DEIS\Influenza_Web\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\Covid_Web\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\VRS\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\VPH_Web\autoconsulta.js'
]

for path in files:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find: text: ✅ Archivo descargado: ${outputName},
    # Replace with: text: `✅ Archivo descargado: ${outputName}`,
    content = re.sub(r'text:\s*✅ Archivo descargado:\s*\$\{outputName\},', r'text: `✅ Archivo descargado: ${outputName}`,', content)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
        print("Fixed toast in", path)
