import os

def insert_dict_keys(filepath, target_key, inject_str):
    if not os.path.exists(filepath): return
    lines = open(filepath, encoding='utf-8').readlines()
    for i, l in enumerate(lines):
        if target_key in l:
            # Insert inject_str before this line
            lines.insert(i, inject_str)
            break
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(lines)

# Covid
insert_dict_keys(
    'Covid_Web/scripts/procesar_covid.py', 
    '"fecha_actualizacion":', 
    '        "fuente": "Servidor DEIS–MINSAL",\n        "fecha_procesamiento": datetime.now().strftime("%d-%m-%Y %H:%M"),\n'
)
# Influenza
insert_dict_keys(
    'Influenza_Web/Scripts_Procesamiento/parse_influenza.py', 
    '"fecha_actualizacion":', 
    '        "fuente": "Servidor DEIS–MINSAL",\n        "fecha_procesamiento": datetime.now().strftime("%d-%m-%Y %H:%M"),\n'
)
# VRS
insert_dict_keys(
    'VRS/Scripts_Procesamiento/parse_vrs.py', 
    '"fecha_actualizacion":', 
    '        "fuente": "Servidor DEIS–MINSAL",\n        "fecha_procesamiento": datetime.now().strftime("%d-%m-%Y %H:%M"),\n'
)
# Programáticas
insert_dict_keys(
    'Programáticas_Web/generate_data_2026.py', 
    '"fecha_actualizacion":', 
    '        "fuente": "Servidor DEIS–MINSAL",\n        "fecha_procesamiento": datetime.now().strftime("%d-%m-%Y %H:%M"),\n        "fecha_max_residencia": datos_disponibles_hasta,\n        "fecha_max_ocurrencia": datos_disponibles_hasta,\n'
)

# VPH
filepath_vph = 'VPH_Web/procesar_observatorio_vph.py'
if os.path.exists(filepath_vph):
    lines = open(filepath_vph, encoding='utf-8').readlines()
    # Add datetime import if missing
    if not any('from datetime import datetime' in l for l in lines):
        lines.insert(0, 'from datetime import datetime\n')
    
    # Compute max_fecha_str before data_payload
    for i, l in enumerate(lines):
        if 'data_payload = {' in l:
            inject = '    max_fecha_str = df_final["FECHA_INMUNIZACION"].max().strftime("%d-%m-%Y") if "FECHA_INMUNIZACION" in df_final.columns else "Desconocida"\n'
            lines.insert(i, inject)
            
            inject2 = '        "fuente": "Servidor DEIS–MINSAL",\n        "fecha_procesamiento": datetime.now().strftime("%d-%m-%Y %H:%M"),\n        "fecha_max_residencia": max_fecha_str,\n        "fecha_max_ocurrencia": max_fecha_str,\n        "ultima_se_residencia": None,\n        "ultima_se_ocurrencia": None,\n'
            lines.insert(i+2, inject2)
            break
    with open(filepath_vph, 'w', encoding='utf-8') as f:
        f.writelines(lines)
