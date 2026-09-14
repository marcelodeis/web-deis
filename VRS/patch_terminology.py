import os

TARGET_FILE = r'C:\Antigravity IDE\WEB DEIS\VRS\script.js'

with open(TARGET_FILE, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Replace terminology in script.js
content = content.replace('Para alcanzar una cobertura programática (referencia visual 80%)', 'Para alcanzar el umbral interno de semaforización del dashboard (80%)')
content = content.replace('umbral programático referencial', 'umbral interno de semaforización')

with open(TARGET_FILE, 'w', encoding='utf-8') as f:
    f.write(content)
print("script.js terminology patched successfully")
