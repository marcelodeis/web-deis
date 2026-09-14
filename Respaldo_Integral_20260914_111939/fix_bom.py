import os

path = r'c:\Antigravity IDE\WEB DEIS\Influenza_Web\rechazos.js'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Add a fix for literal interpolations if any are still broken
# And replace "EpidemiolÃ³gica" -> "Epidemiológica" if the browser saw it, wait, no, the file HAS correct UTF-8 bytes right now, the browser is just reading it wrong.
# So saving it with utf-8-sig will fix the browser's interpretation.
with open(path, 'w', encoding='utf-8-sig') as f:
    f.write(text)

print('Saved with BOM')
