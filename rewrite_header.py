import os
import re

def rewrite_format_header(filepath):
    if not os.path.exists(filepath): return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    new_func = """function formatHeaderDate(data) {
    if (data && data.fecha_max_residencia && data.fecha_max_ocurrencia && data.fecha_max_residencia !== data.fecha_max_ocurrencia) {
        return `Residencia hasta: ${data.fecha_max_residencia} | Ocurrencia hasta: ${data.fecha_max_ocurrencia}`;
    }
    const fd = (data && (data.fecha_max_residencia || data.fecha_actualizacion || data.datos_disponibles_hasta)) || 'Desconocida';
    return `Datos disponibles hasta: ${fd}`;
}"""

    # We need to replace the old function formatHeaderDate(data) { ... }
    # Using regex to match from function formatHeaderDate to the closing brace
    pattern = re.compile(r'function formatHeaderDate\(data\)\s*\{[^\}]*\}[^\}]*\}', flags=re.DOTALL)
    # The previous regex might capture too much. Let's find index manually.
    
    idx = content.find('function formatHeaderDate(data) {')
    if idx != -1:
        end_idx = content.find('}', content.find('}', idx) + 1) + 1
        content = content[:idx] + new_func + content[end_idx:]
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

rewrite_format_header('VRS/script.js')
rewrite_format_header('Influenza_Web/script.js')
rewrite_format_header('Covid_Web/js/app.js')
rewrite_format_header('Programáticas_Web/app_v9.js')
