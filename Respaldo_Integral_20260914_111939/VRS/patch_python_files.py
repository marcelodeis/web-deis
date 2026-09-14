import os

TARGET1 = r"C:\Antigravity IDE\WEB DEIS\VRS\Scripts_Procesamiento\parse_vrs.py"
TARGET2 = r"C:\Antigravity IDE\WEB DEIS\VRS\scripts\generar_indice_vrs.py"

def patch_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Define the new logic
    old_func = """def normalizar_run_sin_dv(val) -> str:
    if pd.isna(val):
        return ""
    s = str(val).strip().lower().replace(".", "").replace("-", "").replace(" ", "")
    if not s:
        return ""
    if s.endswith('k'):
        return s[:-1]
    if s.isdigit():
        if len(s) <= 1:
            return s
        return s[:-1]
    return s"""

    new_func = """def normalizar_run_con_dv(val) -> str:
    if pd.isna(val):
        return ""
    s = str(val).strip().upper().replace(".", "").replace("-", "").replace(" ", "")
    return s"""

    if "def normalizar_run_sin_dv(val) -> str:" in content:
        content = content.replace(old_func, new_func)
        content = content.replace("normalizar_run_sin_dv", "normalizar_run_con_dv")
    
    # In generar_indice_vrs.py, add territory filter
    if "is_ocurrencia=False)" in content and "def generar_indice():" in content:
        # We need to add the territory filter
        old_territory_logic = """df_resi = df_resi[df_resi['VACUNA_ADMINISTRADA'].str.strip().str.upper() == 'SI']"""
        new_territory_logic = """COD_COMUNAS = ['10301', '10302', '10303', '10304', '10305', '10306', '10307']
    df_resi['COD_COMUNA_RESID'] = pd.to_numeric(df_resi['COD_COMUNA_RESID'], errors='coerce')
    df_resi = df_resi[df_resi['COD_COMUNA_RESID'].isin([int(x) for x in COD_COMUNAS])]
    
    df_resi = df_resi[df_resi['VACUNA_ADMINISTRADA'].str.strip().str.upper() == 'SI']"""
        
        old_territory_logic_prog = """df_prog = df_prog[df_prog['VACUNA_ADMINISTRADA'].str.strip().str.upper() == 'SI']"""
        new_territory_logic_prog = """df_prog['CODIGO_COMUNA_RESIDENCIA'] = pd.to_numeric(df_prog['CODIGO_COMUNA_RESIDENCIA'], errors='coerce')
    df_prog = df_prog[df_prog['CODIGO_COMUNA_RESIDENCIA'].isin([int(x) for x in COD_COMUNAS])]
    
    df_prog = df_prog[df_prog['VACUNA_ADMINISTRADA'].str.strip().str.upper() == 'SI']"""
        
        if old_territory_logic in content:
            content = content.replace(old_territory_logic, new_territory_logic)
        if old_territory_logic_prog in content:
            content = content.replace(old_territory_logic_prog, new_territory_logic_prog)
            
    # Modify temporal wording in final print for parse_vrs.py
    if "Ao: 2026" in content:
        content = content.replace("Ao: 2026", "Año: 2026")
    if "Fecha de corte: " in content and "parse_vrs.py" in filepath:
        content = content.replace(r"print(f'   Fecha de corte: {fecha_max_global.strftime(\"%d-%m-%Y\")}')", 
                                  r"print(f'   Datos disponibles hasta: {fecha_max_global.strftime(\"%d-%m-%Y\")}')\n    print(f'   Última SE con registros disponibles: {ultima_se}')\n    import datetime\n    print(f'   Fecha/hora real de generación: {datetime.datetime.now().strftime(\"%Y-%m-%d %H:%M:%S\")}')")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
patch_file(TARGET1)
patch_file(TARGET2)
print("Files patched for RUN normalization and territory filter.")
