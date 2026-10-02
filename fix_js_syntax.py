import os

js_files = [
    'Covid_Web/js/app.js',
    'Influenza_Web/script.js',
    'VRS/script.js',
    'Programáticas_Web/app_v9.js',
    'VPH_Web/app.js'
]

BAD_CODE = """} | Ocurrencia hasta: ${maxO}`;
    }
    
    const valid = maxR || maxO || data.fecha_actualizacion || data.datos_disponibles_hasta || "Desconocida";
    return `Fuente: Servidor DEIS–MINSAL | Base procesada: ${fProc} | Datos válidos hasta: ${valid}`;
}"""

for fp in js_files:
    if os.path.exists(fp):
        with open(fp, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if BAD_CODE in content:
            content = content.replace(BAD_CODE, "}")
            with open(fp, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Fixed syntax in {fp}")
