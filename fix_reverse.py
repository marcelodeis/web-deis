import os

path = r'c:\Antigravity IDE\WEB DEIS\Influenza_Web\rechazos.js'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Reverse the exact dictionary
replacements = {
    'sí ': 's ',  # This fixes grupossí -> gruposs , optionssí -> optionss
    # but I also need to fix por s solos back to por sí solos
}

for k, v in replacements.items():
    text = text.replace(k, v)

# Fix the legitimate ones
text = text.replace('por s solos', 'por sí solos')

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Reversed!')
