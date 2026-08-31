import os

files = [
    r'C:\Antigravity IDE\WEB DEIS\Influenza_Web\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\Covid_Web\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\VRS\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\VPH_Web\autoconsulta.js'
]

for path in files:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    content = content.replace("text: ✅ Archivo descargado: ,", "text: `✅ Archivo descargado: ${outputName}`,")

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
        print("Fixed toast in", path)
