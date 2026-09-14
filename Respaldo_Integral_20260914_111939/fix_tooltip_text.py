import os

files = [
    ('Influenza_Web/autoconsulta.js', 'Influenza 2026'),
    ('Covid_Web/autoconsulta.js', 'COVID-19 2026'),
    ('VRS/autoconsulta.js', 'Nirsevimab (VRS) 2026'),
    ('VPH_Web/autoconsulta.js', 'VPH 2026')
]

for f, camp_name in files:
    path = os.path.join(r"C:\Antigravity IDE\WEB DEIS", f)
    if not os.path.exists(path): continue
    
    with open(path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    old_tooltip = r'title="Interpretación de la cohorte subida: \n✓ ${stats.si} usuarios tienen vacuna vigente y contribuyen a la inmunidad.\n× ${stats.no} usuarios figuran como susceptibles o rezagados."'
    new_tooltip = f'title="Interpretación:\n✓ ${{stats.si}} usuarios con registro de vacuna {camp_name}.\n× ${{stats.no}} usuarios sin registro de vacuna {camp_name}."'
    
    if old_tooltip in content:
        content = content.replace(old_tooltip, new_tooltip)
        with open(path, 'w', encoding='utf-8') as file:
            file.write(content)
        print(f"Updated tooltip in {f}")
    else:
        print(f"Old tooltip not found in {f}")
