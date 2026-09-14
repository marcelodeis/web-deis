import os
import re

def update_script(filepath):
    if not os.path.exists(filepath): return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    func_str = """
function formatHeaderDate(data) {
    if (data && data.fecha_max_residencia && data.fecha_max_ocurrencia && data.fecha_max_residencia !== data.fecha_max_ocurrencia) {
        return `Residencia: ${data.fecha_max_residencia} | Ocurrencia: ${data.fecha_max_ocurrencia}`;
    }
    return `Datos disponibles hasta: ${(data && data.fecha_actualizacion) || (data && data.datos_disponibles_hasta) || 'Desconocido'}`;
}
"""
    if "function formatHeaderDate" not in content:
        content = func_str + content

    # Covid
    pattern2 = re.compile(r'document\.getElementById\([\'"]reportDate[\'"]\)\.textContent\s*=\s*`[^`]*\$\{DATA\.fecha_actualizacion\}[^`]*`;')
    content = pattern2.sub('document.getElementById(\'reportDate\').textContent = formatHeaderDate(DATA);', content)

    # Programáticas
    pattern3 = re.compile(r'reportDate\.innerText\s*=\s*`Fuente: DEIS-MINSAL, Fecha de corte: \$\{DATA\.fecha_actualizacion\} \(Base Residencia\)[^`]*`;')
    content = pattern3.sub('reportDate.innerText = formatHeaderDate(DATA);', content)
    
    pattern4 = re.compile(r'reportDate\.innerText\s*=\s*year === \'2025\' \? `[^`]*` : `[^`]*\$\{DATA\.fecha_actualizacion\}[^`]*`;')
    content = pattern4.sub("reportDate.innerText = year === '2025' ? 'Datos disponibles hasta: 31/12/2025' : formatHeaderDate(DATA);", content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Patched {filepath}")

update_script('Covid_Web/js/app.js')
update_script('Programáticas_Web/app_v9.js')
