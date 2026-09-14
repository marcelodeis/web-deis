"""
Integrar datos de ocurrencia procesados en dashboard_data_vph.js
Reemplaza las secciones: dosis_anuales, top_establecimientos, 
matriz_establecimientos, evolucion_vacunas
"""
import json
import os
import re

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DASHBOARD_JS = os.path.join(BASE_DIR, "dashboard_data_vph.js")
OCURRENCIA_JSON = os.path.join(BASE_DIR, "produccion_ocurrencia_vph.json")

# Leer datos de ocurrencia procesados
with open(OCURRENCIA_JSON, 'r', encoding='utf-8') as f:
    ocurrencia = json.load(f)

# Leer dashboard_data_vph.js completo
with open(DASHBOARD_JS, 'r', encoding='utf-8') as f:
    content = f.read()

# Extraer el objeto JSON del JS (quitar "window.VPH_DASHBOARD_DATA = " y el ";" final)
json_start = content.index('{')
json_end = content.rindex('}') + 1
json_str = content[json_start:json_end]

# Parsear
dashboard = json.loads(json_str)

# Reemplazar las 4 secciones de producción
dashboard["dosis_anuales"] = ocurrencia["dosis_anuales"]
dashboard["top_establecimientos"] = ocurrencia["top_establecimientos"]
dashboard["matriz_establecimientos"] = ocurrencia["matriz_establecimientos"]
dashboard["evolucion_vacunas"] = ocurrencia["evolucion_vacunas"]

# Actualizar metadata para reflejar el cambio de fuente
dashboard["metadata"]["criterio_produccion"] = "Criterio de Ocurrencia — Establecimientos del S.S. Osorno (comunas 10301-10307)."

# Reconstruir el JS
new_json = json.dumps(dashboard, ensure_ascii=False, indent=2)
new_content = f"// Datos autogenerados del Observatorio VPH S.S. Osorno\nwindow.VPH_DASHBOARD_DATA = {new_json};\n"

# Escribir
with open(DASHBOARD_JS, 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f"dashboard_data_vph.js actualizado exitosamente.")
print(f"  Establecimientos: {len(ocurrencia['matriz_establecimientos'])}")
print(f"  Anos dosis_anuales: {list(ocurrencia['dosis_anuales'].keys())}")
print(f"  Anos evolucion_vacunas: {list(ocurrencia['evolucion_vacunas'].keys())}")

# Verificar tamaño
size = os.path.getsize(DASHBOARD_JS)
print(f"  Tamaño archivo: {size:,} bytes ({size/1024/1024:.1f} MB)")
