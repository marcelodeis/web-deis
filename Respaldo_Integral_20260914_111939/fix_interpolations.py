import os

path = r'c:\Antigravity IDE\WEB DEIS\Influenza_Web\rechazos.js'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Fix the literal interpolations
text = text.replace(r'\${', '${')
text = text.replace(r'\`', '`') # just in case I escaped backticks too

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Fixed interpolations')
