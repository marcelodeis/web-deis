import os
import re

files = ['Influenza_Web/autoconsulta.js', 'Covid_Web/autoconsulta.js', 'VRS/autoconsulta.js', 'VPH_Web/autoconsulta.js']

for f in files:
    path = os.path.join(r"C:\Antigravity IDE\WEB DEIS", f)
    if not os.path.exists(path): continue
    
    with open(path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # We want to replace `<div class="autoconsulta-centro-item">`
    # with a version that has a dynamic title attribute containing the explanation.
    # Note: the `title` attribute supports multiline if we want, but single line is fine.
    
    pattern = r'<div class="autoconsulta-centro-item">'
    replacement = r'<div class="autoconsulta-centro-item" title="Interpretación de la cohorte subida: \n✓ ${stats.si} usuarios tienen vacuna vigente y contribuyen a la inmunidad.\n× ${stats.no} usuarios figuran como susceptibles o rezagados.">'
    
    if pattern in content:
        content = content.replace(pattern, replacement)
        with open(path, 'w', encoding='utf-8') as file:
            file.write(content)
        print(f"Added tooltip to {f}")
    else:
        print(f"Pattern not found in {f}")
