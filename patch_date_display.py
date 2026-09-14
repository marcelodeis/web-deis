import os
import re

def update_script(filepath):
    if not os.path.exists(filepath): return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Patrón para buscar donde se asigna la fecha
    # Ejemplo: reportDateEl.innerText = `... ${dashboardData.fecha_actualizacion}`;
    # Reemplazaremos esto con una función que determine qué mostrar
    
    # Añadir la función global de formateo de fecha si no existe
    func_str = """
function formatHeaderDate(data) {
    if (data.fecha_max_residencia && data.fecha_max_ocurrencia && data.fecha_max_residencia !== data.fecha_max_ocurrencia) {
        return `Residencia: ${data.fecha_max_residencia} | Ocurrencia: ${data.fecha_max_ocurrencia}`;
    }
    return `Datos disponibles hasta: ${data.fecha_actualizacion || data.datos_disponibles_hasta}`;
}
"""
    if "function formatHeaderDate" not in content:
        # Inyectar al principio del archivo
        content = func_str + content

    # Reemplazar asignaciones estáticas (VRS, Influenza)
    # Busca: reportDateEl.innerText = `Fuente:... | Fecha de corte: ${dashboardData.fecha_actualizacion}`;
    pattern1 = re.compile(r'reportDateEl\.innerText\s*=\s*`[^`]*\$\{dashboardData\.fecha_actualizacion\}[^`]*`;')
    content = pattern1.sub('reportDateEl.innerText = formatHeaderDate(dashboardData);', content)
    
    # Para Covid y otros que usen textContent u otras variables
    pattern2 = re.compile(r'reportDateEl\.innerText\s*=\s*`[^`]*\$\{window\.DASHBOARD_DATA\.fecha_actualizacion\}[^`]*`;')
    content = pattern2.sub('reportDateEl.innerText = formatHeaderDate(window.DASHBOARD_DATA);', content)

    # Para Covid que usa textContent
    pattern3 = re.compile(r'reportDateEl\.textContent\s*=\s*`[^`]*\$\{window\.DASHBOARD_DATA\.fecha_actualizacion\}[^`]*`;')
    content = pattern3.sub('reportDateEl.textContent = formatHeaderDate(window.DASHBOARD_DATA);', content)

    # Influenza que puede usar DASHBOARD_DATA
    pattern4 = re.compile(r'document\.getElementById\([\'"]reportDate[\'"]\)\.innerText\s*=\s*`[^`]*\$\{DASHBOARD_DATA\.datos_disponibles_hasta\}[^`]*`;')
    content = pattern4.sub("document.getElementById('reportDate').innerText = formatHeaderDate(DASHBOARD_DATA);", content)
    
    pattern5 = re.compile(r'reportDateEl\.innerText\s*=\s*`[^`]*\$\{dashboardData\.datos_disponibles_hasta\}[^`]*`;')
    content = pattern5.sub('reportDateEl.innerText = formatHeaderDate(dashboardData);', content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Patched {filepath}")

update_script('VRS/script.js')
update_script('Influenza_Web/script.js')
update_script('Covid_Web/script.js')
update_script('Programáticas_Web/script.js')
