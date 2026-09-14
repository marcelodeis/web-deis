import os

TARGET = r"C:\Antigravity IDE\WEB DEIS\VPH_Web\scripts\generar_indice_vph.py"

with open(TARGET, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace normalizar_run_sin_dv
old_func = """def normalizar_run_sin_dv(val):
    if pd.isna(val): return ""
    s = str(val).strip().lower().replace(".", "").replace("-", "").replace(" ", "")
    if not s: return ""
    if s.endswith('k'): return s[:-1]
    if s.isdigit():
        if len(s) <= 1: return s
        cuerpo = s[:-1]
        dv = s[-1]
        if dv == calcular_dv_chile(cuerpo):
            return cuerpo
    return s"""

new_func = """def normalizar_run_con_dv(val):
    if pd.isna(val): return ""
    s = str(val).strip().upper().replace(".", "").replace("-", "").replace(" ", "")
    return s"""

content = content.replace(old_func, new_func)
content = content.replace("normalizar_run_sin_dv", "normalizar_run_con_dv")

# Add territory filter
old_filter = """                # Filtros DEIS
                if 'VACUNA_ADMINISTRADA' in df.columns:"""

new_filter = """                # Filtro territorial Osorno
                COMUNAS_OSORNO = ['10301', '10302', '10303', '10304', '10305', '10306', '10307']
                if 'CODIGO_COMUNA_OCURR' in df.columns:
                    df = df[df['CODIGO_COMUNA_OCURR'].astype(str).str.strip().isin(COMUNAS_OSORNO)]
                elif 'COD_COMUNA_OCURR' in df.columns:
                    df = df[df['COD_COMUNA_OCURR'].astype(str).str.strip().isin(COMUNAS_OSORNO)]
                
                # Filtros DEIS
                if 'VACUNA_ADMINISTRADA' in df.columns:"""

content = content.replace(old_filter, new_filter)

with open(TARGET, 'w', encoding='utf-8') as f:
    f.write(content)

print("VPH Autoconsulta script patched.")
