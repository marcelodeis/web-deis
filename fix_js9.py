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

    # Re-insert backticks around the filename template
    # Find: const outputName = ${baseName}_AUTOCONSULTA_INFLUENZA.xlsx;
    # Replace with: const outputName = `${baseName}_AUTOCONSULTA_INFLUENZA.xlsx`;
    
    if "const outputName = ${baseName}" in content:
        content = content.replace("const outputName = ${baseName}", "const outputName = `${baseName}")
        content = content.replace(".xlsx;", ".xlsx`;")
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
            print("Fixed outputName in", path)
