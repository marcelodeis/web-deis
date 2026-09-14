import pandas as pd
import os
import glob

def clean_run(val):
    if pd.isna(val):
        return ""
    s = str(val).strip().upper()
    s = s.replace('.', '').replace('-', '')
    return s

def process_file(y, file_type, base_dir, qa_original_groups, qa_homologated_groups, qa_comunas, qa_ruts_before, qa_ruts_after, qa_totals):
    file_path = os.path.join(base_dir, str(y), f"Influenza_{file_type}_{y}.csv")
    
    if not os.path.exists(file_path):
        print(f"[{y}] No se encontro archivo: {file_path}")
        return None
        
    print(f"\n[{y}] Procesando {file_path}...")
    
    try:
        df = pd.read_csv(file_path, sep='|', encoding='latin-1', dtype=str)
    except:
        df = pd.read_csv(file_path, sep=';', encoding='latin-1', dtype=str)
    
    if 'CRITERIO_ELEGIBILIDAD' not in df.columns:
        print(f"Error: No se encontro columna CRITERIO_ELEGIBILIDAD en {y}")
        return None

    # Llenar vacíos
    df['VACUNA_ADMINISTRADA'] = df['VACUNA_ADMINISTRADA'].fillna('').str.strip().str.upper()
    df['REGISTRO_ELIMINADO'] = df['REGISTRO_ELIMINADO'].fillna('').str.strip().str.upper()
    df['CRITERIO_ELEGIBILIDAD'] = df['CRITERIO_ELEGIBILIDAD'].fillna('SIN GRUPO REGISTRADO').str.strip()
    df['DOSIS'] = df['DOSIS'].fillna('').str.strip().str.upper()
    if file_type == 'Residencia':
        df['COMUNA_RESIDENCIA'] = df['COMUNA_RESIDENCIA'].fillna('DESCONOCIDA').str.strip().str.upper()
    else:
        df['COMUNA_OCURR'] = df['COMUNA_OCURR'].fillna('DESCONOCIDA').str.strip().str.upper()
    
    # QA: recolectar grupos originales
    qa_original_groups.update(df['CRITERIO_ELEGIBILIDAD'].unique())

    # Homologar variantes
    df['CRITERIO_ELEGIBILIDAD'] = df['CRITERIO_ELEGIBILIDAD'].str.replace(
        r'^Personas mayores de 60.*', 'Personas de 60 años y más', regex=True
    )
    df['CRITERIO_ELEGIBILIDAD'] = df['CRITERIO_ELEGIBILIDAD'].str.replace(
        r'Personas mayores de 60 a.*', 'Personas de 60 años y más', regex=True
    )
    df['CRITERIO_ELEGIBILIDAD'] = df['CRITERIO_ELEGIBILIDAD'].replace({
        'Personas mayores de 60 aÃ±os y mÃ¡s': 'Personas de 60 años y más',
        'Personas mayores de 60 aÃ±os y mÃ¡s (aÃ±o 1966)': 'Personas de 60 años y más',
        'Poblacion general': 'Población general',
        'PoblaciÃ³n general': 'Población general',
    })

    qa_homologated_groups.update(df['CRITERIO_ELEGIBILIDAD'].unique())

    comunas_osorno = [
        'OSORNO', 'PUERTO OCTAY', 'PURRANQUE', 'PUYEHUE', 
        'RÍO NEGRO', 'RIO NEGRO', 'SAN JUAN DE LA COSTA', 'SAN PABLO'
    ]
    
    if file_type == 'Residencia':
        df = df[df['COMUNA_RESIDENCIA'].isin(comunas_osorno)]
        qa_comunas.update(df['COMUNA_RESIDENCIA'].unique())
    else:
        df = df[df['COMUNA_OCURR'].isin(comunas_osorno)]
        qa_comunas.update(df['COMUNA_OCURR'].unique())
    
    df['RUN'] = df['RUN'].apply(clean_run)
    
    df_vacunados = df[(df['VACUNA_ADMINISTRADA'] == 'SI') & (df['REGISTRO_ELIMINADO'] != 'SI')]
    rut_vacunados = set(df_vacunados['RUN'].tolist())
    rut_vacunados.discard("")
    
    df_rechazos = df[
        (df['VACUNA_ADMINISTRADA'] != 'SI') & 
        (df['REGISTRO_ELIMINADO'] != 'SI') &
        (df['CRITERIO_ELEGIBILIDAD'] != 'EPRO') &
        (df['DOSIS'] != 'EPRO')
    ]
    
    df_rechazos = df_rechazos[~df_rechazos['RUN'].isin(rut_vacunados)]
    df_rechazos = df_rechazos[df_rechazos['RUN'] != ""]

    qa_ruts_before[y] = df_rechazos['RUN'].nunique()
    df_rechazos = df_rechazos.drop_duplicates(subset=['RUN'], keep='first')
    qa_ruts_after[y] = df_rechazos['RUN'].nunique()
    qa_totals[y] = len(df_rechazos)

    print(f"[{y}] [{file_type}] RUTs únicos antes de drop_duplicates: {qa_ruts_before[y]}")
    print(f"[{y}] [{file_type}] RUTs únicos después de drop_duplicates: {qa_ruts_after[y]}")
    print(f"[{y}] [{file_type}] Total de personas con rechazo (filas restantes): {len(df_rechazos)}")
    
    df_rechazos['ESTABLECIMIENTO'] = df_rechazos['ESTABLECIMIENTO'].fillna('SIN INFORMACION').str.strip().str.upper()
    
    if file_type == 'Residencia':
        agg = df_rechazos.groupby(['COMUNA_RESIDENCIA', 'CRITERIO_ELEGIBILIDAD', 'ESTABLECIMIENTO']).size().reset_index(name='count')
    else:
        agg = df_rechazos.groupby(['COMUNA_OCURR', 'CRITERIO_ELEGIBILIDAD', 'ESTABLECIMIENTO']).size().reset_index(name='count')
        
    agg['year'] = y
    return agg

def process_rechazos():
    base_dir = r"C:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL"
    years = [2024, 2025, 2026]
    
    all_agg = []
    
    print("="*60)
    print("  GENERADOR DE DATA RECHAZOS INFLUENZA CON QA")
    print("="*60)
    
    # QA Data tracking
    qa_original_groups = set()
    qa_homologated_groups = set()
    qa_ruts_before = {}
    qa_ruts_after = {}
    qa_comunas = set()
    qa_totals = {}

    years = [2024, 2025, 2026]
    
    all_agg_residencia = []
    all_agg_ocurrencia = []
    
    for y in years:
        agg_res = process_file(y, 'Residencia', base_dir, qa_original_groups, qa_homologated_groups, qa_comunas, qa_ruts_before, qa_ruts_after, qa_totals)
        if agg_res is not None:
            all_agg_residencia.append(agg_res)
            
        agg_ocurr = process_file(y, 'Ocurrencia', base_dir, qa_original_groups, qa_homologated_groups, qa_comunas, qa_ruts_before, qa_ruts_after, qa_totals)
        if agg_ocurr is not None:
            all_agg_ocurrencia.append(agg_ocurr)

    js_lines = []
    
    if all_agg_residencia:
        final_res = pd.concat(all_agg_residencia, ignore_index=True)
        js_lines.append("window.dataRechazos = [")
        for _, row in final_res.iterrows():
            c = row['COMUNA_RESIDENCIA'].replace("'", "\\'")
            g = row['CRITERIO_ELEGIBILIDAD'].replace("'", "\\'")
            e = row['ESTABLECIMIENTO'].replace("'", "\\'")
            js_lines.append(f"    {{ year: {row['year']}, comuna: '{c}', grupo: '{g}', establecimiento: '{e}', count: {row['count']} }},")
        js_lines.append("];\n")
        
    if all_agg_ocurrencia:
        final_ocurr = pd.concat(all_agg_ocurrencia, ignore_index=True)
        js_lines.append("window.dataRechazosOcurrencia = [")
        for _, row in final_ocurr.iterrows():
            o = row['COMUNA_OCURR'].replace("'", "\\'")
            g = row['CRITERIO_ELEGIBILIDAD'].replace("'", "\\'")
            e = row['ESTABLECIMIENTO'].replace("'", "\\'")
            js_lines.append(f"    {{ year: {row['year']}, comuna_ocurrencia: '{o}', grupo: '{g}', establecimiento: '{e}', count: {row['count']} }},")
        js_lines.append("];")

    if js_lines:
        out_path = r"C:\Antigravity IDE\WEB DEIS\Influenza_Web\data_rechazos.js"
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write("\n".join(js_lines))
        print(f"\nDatos guardados exitosamente en: {out_path}")
    # ========================================================
    # 4. TABLA DE VALIDACIÓN QA
    # ========================================================
    print("\n" + "="*60)
    print("  TABLA DE VALIDACIÓN (QA)")
    print("="*60)
    print(f"Cantidad original de denominaciones: {len(qa_original_groups)}")
    # show a few to prove it 
    original_60 = [g for g in qa_original_groups if "60" in str(g)]
    print(f"Ej. Originales de 60 años: {original_60}")
    
    print(f"Cantidad denominaciones tras homologar: {len(qa_homologated_groups)}")
    homolog_60 = [g for g in qa_homologated_groups if "60" in str(g)]
    print(f"Ej. Homologadas de 60 años: {homolog_60}")
    
    print("\nComunas consideradas en el análisis (Filtro Osorno):")
    print(", ".join(sorted(list(qa_comunas))))
    
    print("\nValidación de RUT Únicos y Totales por Año:")
    for y in years:
        if qa_totals.get(y) is None: continue
        before = qa_ruts_before.get(y, 0)
        after = qa_ruts_after.get(y, 0)
        tot = qa_totals.get(y, 0)
        print(f"  [{y}] RUTs únicos antes: {before} -> Después de homologar/deduplicar: {after}")
        print(f"  [{y}] Total final de personas con rechazo contabilizadas: {tot}")
        if after == tot:
            print(f"      [OK] COMPROBADO: Ningún RUT se contabiliza dos veces en {y} (RUT únicos = Conteo final)")
        else:
            print(f"      [ERROR] Descuadre en RUTs en {y} (Únicos: {after}, Total conteo: {tot})")
    
if __name__ == '__main__':
    process_rechazos()
