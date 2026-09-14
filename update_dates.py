import os
import re
from datetime import datetime

# 1. ACTUALIZAR FRONTEND (JS)
js_files = [
    'Covid_Web/js/app.js',
    'Influenza_Web/script.js',
    'VRS/script.js',
    'Programáticas_Web/app_v9.js',
    'VPH_Web/app.js'
]

new_func = """function formatHeaderDate(data) {
    if (!data) return "Fuente: Servidor DEIS–MINSAL | Base procesada: Desconocida | Datos válidos hasta: Desconocida";
    const fProc = data.fecha_procesamiento || "Desconocida";
    const maxR = data.fecha_max_residencia;
    const maxO = data.fecha_max_ocurrencia;
    
    if (maxR && maxO && maxR !== maxO) {
        return `Fuente: Servidor DEIS–MINSAL | Base procesada: ${fProc} | Residencia hasta: ${maxR} | Ocurrencia hasta: ${maxO}`;
    }
    
    const valid = maxR || maxO || data.fecha_actualizacion || data.datos_disponibles_hasta || "Desconocida";
    return `Fuente: Servidor DEIS–MINSAL | Base procesada: ${fProc} | Datos válidos hasta: ${valid}`;
}"""

for fp in js_files:
    if os.path.exists(fp):
        with open(fp, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # We need to replace existing formatHeaderDate
        # In most files it looks like: function formatHeaderDate(data) { ... }
        pattern = re.compile(r'function formatHeaderDate\(data\)\s*\{[^\}]*\}[^\}]*\}', flags=re.DOTALL)
        
        idx = content.find('function formatHeaderDate(data)')
        if idx != -1:
            end_idx = content.find('}', content.find('}', idx) + 1) + 1
            content = content[:idx] + new_func + content[end_idx:]
            
            with open(fp, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated JS formatHeaderDate in {fp}")

# 2. LIMPIAR APP_V9.JS PROGRAMATICAS HARDCODED
prog_js = 'Programáticas_Web/app_v9.js'
if os.path.exists(prog_js):
    with open(prog_js, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check for hardcoded reportDate lines and replace them
    # Example: reportDate.innerText = currentYear === '2025' ? `Datos disponibles hasta: 31-12-2025` : formatHeaderDate(DATA);
    # Actually, we should just let formatHeaderDate handle it if we can, but the user said:
    # "Para 2025 puede mantenerse un valor histórico fijo como: Datos disponibles hasta: 31-12-2025"
    
    # We remove any 20/08/2026
    content = content.replace("20/08/2026", "")
    content = content.replace("`Fuente: Archivos Híbridos (Ocurrencia + Residencia) | Fecha de corte: 20/08/2026`", "formatHeaderDate(DATA)")
    
    with open(prog_js, 'w', encoding='utf-8') as f:
        f.write(content)
        
# 3. ACTUALIZAR PYTHON SCRIPTS PARA INCLUIR LA METADATA
# I will do this manually for accuracy.
