import os

path = r'c:\Antigravity IDE\WEB DEIS\Influenza_Web\rechazos.js'
with open(path, 'rb') as f:
    b = f.read()

while b.startswith(b'\xef\xbb\xbf'):
    b = b[3:]

text = b.decode('utf-8')

replacements = {
    'Ã³': 'ó',
    'Ã¡': 'á',
    'Ã©': 'é',
    'Ã­': 'í',
    'Ãº': 'ú',
    'Ã±': 'ñ',
    'Ã ': 'Ó',
    'Ã‘': 'Ñ',
    'Ã\xad': 'í',
    'Ã\x8d': 'Í',
    'Ã\x93': 'Ó',
    'Ã\x9c': 'Ü',
    'Ã¼': 'ü',
    'Ã\x81': 'Á',
    'Ã\x89': 'É',
    'Ã\x9a': 'Ú',
    # Handle specific broken strings from the screenshot:
    'EpidemiolÃ³gica': 'Epidemiológica',
    'interpretaciÃ³n': 'interpretación',
    'vacunaciÃ³n': 'vacunación',
    'DistribuciÃ³n': 'Distribución',
    'ComparaciÃ³n': 'Comparación',
    'HistÃ³rica': 'Histórica',
    'GestiÃ³n': 'Gestión',
    'METODOLÃ“GICAS': 'METODOLÓGICAS',
    'AnÃ¡lisis': 'Análisis',
    'anÃ¡lisis': 'análisis',
    'campaÃ±a': 'campaña',
    'estadÃ\xadstica': 'estadística',
    'Ãºnico': 'único',
    'Ã\xbanico': 'único',
    'sÃ\xad': 'sí',
    'perÃ\xadodo': 'período',
    'tÃ©rminos': 'términos',
    'constituyÃ©ndose': 'constituyéndose',
    'informaciÃ³n': 'información',
    'existÃ\xadan': 'existían',
    'segÃºn': 'según',
    'Ã©': 'é',
    'Ã³': 'ó',
    'Ã¡': 'á',
    'Ã±': 'ñ'
}

for k, v in replacements.items():
    text = text.replace(k, v)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Replaced double encoded characters')
