import os

TARGET_FILE = r'C:\Antigravity IDE\WEB DEIS\VRS\Scripts_Procesamiento\parse_vrs.py'

with open(TARGET_FILE, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add NOMBRE_VACUNA to usecols in clean_and_filter_df
content = content.replace("'FECHA_INMUNIZACION', 'RUN'", "'FECHA_INMUNIZACION', 'RUN', 'NOMBRE_VACUNA'")

# 2. Add deduplication function
dedup_func = """
def deduplicate_events(df_main, df_prog, context_name):
    print(f"\\n--- Deduplicando Universo: {context_name} ---")
    if df_prog.empty:
        print("   Sin registros en Programáticas para deduplicar.")
        df_main['FUENTE'] = 'VRS'
        return df_main
        
    df_main['FUENTE'] = 'VRS'
    df_prog['FUENTE'] = 'PROG'
    
    # Normalizar para comparación
    combined = pd.concat([df_main, df_prog], ignore_index=True)
    
    # 1. RUN
    combined['DEDUP_RUN'] = combined['RUN_NORMALIZADO'].fillna('')
    
    # 2. FECHA
    combined['DEDUP_FECHA'] = combined['FECHA_INMUNIZACION'].fillna('').astype(str)
    
    # 3. PRODUCTO (Asumimos Nirsevimab para VRS, pero normalizamos por si acaso)
    if 'NOMBRE_VACUNA' in combined.columns:
        combined['DEDUP_PROD'] = combined['NOMBRE_VACUNA'].fillna('').str.upper().str.strip()
    else:
        combined['DEDUP_PROD'] = 'NIRSEVIMAB'
        
    # 4. ESTABLECIMIENTO (Prioridad CODIGO_DEIS, sino ESTABLECIMIENTO normalizado)
    if 'CODIGO_DEIS' in combined.columns:
        combined['DEDUP_ESTAB'] = combined['CODIGO_DEIS'].fillna('').astype(str).str.strip()
        # Fallback a nombre de establecimiento si no hay código
        mask_no_cod = combined['DEDUP_ESTAB'] == ''
        if 'ESTABLECIMIENTO' in combined.columns:
            combined.loc[mask_no_cod, 'DEDUP_ESTAB'] = combined.loc[mask_no_cod, 'ESTABLECIMIENTO'].fillna('').str.upper().str.strip()
    else:
        combined['DEDUP_ESTAB'] = combined['ESTABLECIMIENTO'].fillna('').str.upper().str.strip()
        
    # Clave de deduplicación
    combined['EVENT_KEY'] = combined['DEDUP_RUN'] + "|" + combined['DEDUP_FECHA'] + "|" + combined['DEDUP_PROD'] + "|" + combined['DEDUP_ESTAB']
    
    total_initial = len(combined)
    
    # Separar anónimos (RUN vacío) para no deduplicarlos automáticamente
    mask_anon = combined['DEDUP_RUN'] == ''
    df_anon = combined[mask_anon]
    df_nominal = combined[~mask_anon]
    
    print(f"   Total combinado antes de deduplicar: {total_initial:,}")
    print(f"   Registros con RUN anónimo/vacío (no se deduplican automáticamente): {len(df_anon):,}")
    
    # Check possible overlaps in anonymous records based on Date + Prod + Estab
    anon_overlaps = len(df_anon) - len(df_anon.drop_duplicates(subset=['DEDUP_FECHA', 'DEDUP_PROD', 'DEDUP_ESTAB']))
    print(f"   Posibles coincidencias en RUNs anónimos (Fecha+Prod+Estab): {anon_overlaps:,}")
    
    # Encontrar solapamientos por RUN
    runs_vrs = set(df_main[df_main['RUN_NORMALIZADO'].notna() & (df_main['RUN_NORMALIZADO'] != '')]['RUN_NORMALIZADO'])
    runs_prog = set(df_prog[df_prog['RUN_NORMALIZADO'].notna() & (df_prog['RUN_NORMALIZADO'] != '')]['RUN_NORMALIZADO'])
    overlap_runs = runs_vrs.intersection(runs_prog)
    print(f"   RUNs presentes en ambas fuentes (VRS y Prog): {len(overlap_runs):,}")
    
    # Ordenar priorizando VRS
    df_nominal = df_nominal.sort_values('FUENTE', ascending=False)
    
    # Deduplicar
    df_nominal_dedup = df_nominal.drop_duplicates(subset=['EVENT_KEY'], keep='first')
    duplicados_eliminados = len(df_nominal) - len(df_nominal_dedup)
    
    print(f"   Eventos duplicados exactos eliminados: {duplicados_eliminados:,}")
    print(f"   Eventos distintos preservados (nominales): {len(df_nominal_dedup):,}")
    
    df_final = pd.concat([df_nominal_dedup, df_anon], ignore_index=True)
    print(f"   Total {context_name} post-deduplicación: {len(df_final):,}")
    
    return df_final
"""

# Find where to inject
insert_idx = content.find("# ── 1. Pipeline de Ocurrencia")
content = content[:insert_idx] + dedup_func + "\n" + content[insert_idx:]

# 3. Replace the concat blocks with deduplicate_events
# Ocurrencia
ocur_concat = """if not df_prog_ocur.empty:
    df_ocur = pd.concat([df_ocur, df_prog_ocur], ignore_index=True)
    print(f"   Total combinado Ocurrencia (VRS + Programáticas): {len(df_ocur):,}")"""
content = content.replace(ocur_concat, "df_ocur = deduplicate_events(df_ocur, df_prog_ocur, 'Ocurrencia')")

# Residencia
resi_concat = """if not df_prog_resi.empty:
    df_resi = pd.concat([df_resi, df_prog_resi], ignore_index=True)
    print(f"   Total combinado Residencia (VRS + Programáticas): {len(df_resi):,}")"""
content = content.replace(resi_concat, "df_resi = deduplicate_events(df_resi, df_prog_resi, 'Residencia')")

# 4. Fix mtime logic
mtime_block = """        try:
            mtime_base = max(os.path.getmtime(CSV_OCURRENCIA_PATH), os.path.getmtime(CSV_RESIDENCIA_PATH))
            fecha_base_str = datetime.fromtimestamp(mtime_base).strftime("%d-%m-%Y")
        except:
            fecha_base_str = datetime.now().strftime("%d-%m-%Y")"""
new_mtime_block = """        try:
            # Obtener max fecha de df_resi_valid_dates
            if 'df_resi_valid_dates' in locals() and not df_resi_valid_dates.empty:
                max_d = df_resi_valid_dates['FECHA_DT'].max()
                fecha_base_str = max_d.strftime("%d-%m-%Y")
            else:
                fecha_base_str = datetime.now().strftime("%d-%m-%Y")
        except:
            fecha_base_str = datetime.now().strftime("%d-%m-%Y")"""
content = content.replace(mtime_block, new_mtime_block)

mtime_block_2 = """try:
    mtime = max(os.path.getmtime(CSV_OCURRENCIA_PATH), os.path.getmtime(CSV_RESIDENCIA_PATH))
    fecha_referencia = datetime.fromtimestamp(mtime).strftime("%d/%m/%Y %H:%M")
except:
    fecha_referencia = datetime.now().strftime("%d/%m/%Y %H:%M")"""
new_mtime_block_2 = """try:
    if 'df_resi_valid_dates' in locals() and not df_resi_valid_dates.empty:
        max_d = df_resi_valid_dates['FECHA_DT'].max()
        fecha_referencia = max_d.strftime("%d-%m-%Y")
    else:
        fecha_referencia = datetime.now().strftime("%d-%m-%Y")
except:
    fecha_referencia = datetime.now().strftime("%d-%m-%Y")
timestamp_generacion = datetime.now().strftime("%d/%m/%Y %H:%M")
"""
content = content.replace(mtime_block_2, new_mtime_block_2)

# Update resultado to include timestamp_generacion
resultado_block = """resultado = {
    "fecha_actualizacion": fecha_referencia,"""
new_resultado_block = """resultado = {
    "fecha_actualizacion": fecha_referencia,
    "timestamp_generacion": timestamp_generacion,"""
content = content.replace(resultado_block, new_resultado_block)

# Remove the line that adds ultima_se directly using isocalendar if we need to add it, but parse_vrs actually computes SE and stores it in "avance_semanal". But we also need "ultima_se" in the dashboard JSON. Let's add it.
content = content.replace('"fecha_actualizacion": fecha_referencia,', 
                          '"fecha_actualizacion": fecha_referencia,\n    "ultima_se": f"SE{max_d.isocalendar()[1]}" if \'max_d\' in locals() else "Desconocido",')

with open(TARGET_FILE, 'w', encoding='utf-8') as f:
    f.write(content)
print("parse_vrs.py patched successfully")
