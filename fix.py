import os

path = r'c:\Antigravity IDE\WEB DEIS\Influenza_Web\rechazos.js'
with open(path, 'r', encoding='utf-8', errors='replace') as f:
    text = f.read()

replacements = {
    'variacin': 'variación',
    'Variacin': 'Variación',
    'nǧmero': 'número',
    'perodo': 'período',
    'histrica': 'histórica',
    'disminucin': 'disminución',
    'ao': 'año',
    'existan': 'existían',
    'proporcin': 'proporción',
    'anǭlisis': 'análisis',
    'Anǭlisis': 'Análisis',
    'segǧn': 'según',
    'Epidemiolgica': 'Epidemiológica',
    'Gestin': 'Gestión',
    'Metodolgicas': 'Metodológicas',
    'ǧnico': 'único',
    'estadstica': 'estadística',
    's ': 'sí ',
    'encontr': 'encontró',
    'Poblacin': 'Población',
    'Vacunacin': 'Vacunación',
    'vacunacin': 'vacunación',
    'mǭs': 'más',
    'Distribucin': 'Distribución',
    'distribucin': 'distribución',
    'Posicin': 'Posición',
    'Campaa': 'Campaña',
    'campaa': 'campaña',
    'estǭ': 'está',
    'tǸrminos': 'términos',
    'constituyǸndose': 'constituyéndose',
    'informacin': 'información',
    'desde 2025  2024': 'desde 2025 · 2024',
    'Y\"?': '🌐',
    '\"?\"? RECHAZOS REGISTRADOS \"?\"?': '📌📌 RECHAZOS REGISTRADOS 📌📌',
    '\"\"?\"?\"?\"?\"?\"?\"?\"?\"?\"?\"': '\"..........\"',
    '(indexPos + 1) + \"\"': '(indexPos + 1) + \"°\"',
    '(rankIndex + 1) + \'\'': '(rankIndex + 1) + \"°\"',
    'seleccin': 'selección',
    'Opcin': 'Opción',
    'opcin': 'opción',
    'Recomendacin': 'Recomendación',
}

for k, v in replacements.items():
    text = text.replace(k, v)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Fixed!')
