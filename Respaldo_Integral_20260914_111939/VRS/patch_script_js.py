import os
import re

TARGET_FILE = r'C:\Antigravity IDE\WEB DEIS\VRS\script.js'

with open(TARGET_FILE, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Replace terminology in getHelpTextData

content = re.sub(r'Para consolidar un escudo protector.*?\)', 'Para alcanzar una cobertura programática (referencia visual 80%)', content)
content = re.sub(r'blindar la red asistencial pedi.*?trica', 'reducir el riesgo de hospitalización', content)
content = re.sub(r'umbral biol.*?gico m.*?nimo', 'umbral programático referencial', content)

content = content.replace("Falla Operacional:", "Brecha Operacional:")
content = re.sub(r'falla\s+sist.*?mica', 'falta de avance', content)

# Remove glossary definition for rebaño
content = re.sub(r"if\s*\([^)]*includes\('reba.*?o'\)[^)]*\)\s*\{[^}]*\}", "", content, flags=re.DOTALL)

with open(TARGET_FILE, 'w', encoding='utf-8') as f:
    f.write(content)
print("script.js patched successfully")
