import pandas as pd
import json
import os
import re
from datetime import datetime, timedelta
import argparse
import openpyxl

parser = argparse.ArgumentParser(description='Process VRS Data')
parser.add_argument('--year', type=str, default='2026', help='Year to process')
args = parser.parse_args()
YEAR = args.year

CSV_OCURRENCIA_PATH = rf"C:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL\{YEAR}\VRS_Ocurrencia_{YEAR}.csv"
CSV_RESIDENCIA_PATH = rf"C:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL\{YEAR}\VRS_Residencia_{YEAR}.csv"
PROG_OCURRENCIA_PATH = rf"C:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL\{YEAR}\Programáticas_Ocurrencia_{YEAR}.csv"
PROG_RESIDENCIA_PATH = rf"C:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL\{YEAR}\Programáticas_Residencia_{YEAR}.csv"
NAC_2025_PATH = rf"C:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL\2025\NAC2025.csv"
NAC_2026_PATH = rf"C:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL\2026\NAC2026.csv"
import os
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(SCRIPT_DIR)
OUTPUT_PATH = os.path.join(PARENT_DIR, f"dashboard_data_{YEAR}.json")
JS_OUTPUT_PATH = os.path.join(PARENT_DIR, f"dashboard_data_{YEAR}.js")

COMUNAS_OSORNO = [
    "Osorno", "Puerto Octay", "Purranque", "Puyehue",
    "Río Negro", "San Juan de la Costa", "San Pablo"
]
COD_COMUNAS = {'10301','10302','10303','10304','10305','10306','10307'}
CODIGO_A_COMUNA = {
    '10301': 'Osorno', '10302': 'Puerto Octay', '10303': 'Purranque',
    '10304': 'Puyehue', '10305': 'Río Negro', '10306': 'San Juan de la Costa', '10307': 'San Pablo'
}

def get_epi_week(d):
    day_of_week = d.isoweekday() % 7 # Sun=0
    wednesday = d + timedelta(days=3 - day_of_week)
    return (wednesday.timetuple().tm_yday - 1) // 7 + 1

# Patrón para identificar establecimientos privados por nombre
PRIVADOS_PATRON = r'clinica|mutual|achs|particular|privad|isapre|mutualidad|vaxplus|cochrane'
# Códigos DEIS conocidos de establecimientos privados en la provincia
DEIS_PRIVADOS = {'201811','23-203','23-205','23-209','23-212'}

def clasificar_tipo_establecimiento(df):
    """Clasifica cada registro como 'Público' o 'Privado' basándose en el nombre
    del establecimiento y/o su código DEIS. NO excluye registros."""
    mask_privado = pd.Series(False, index=df.index)
    
    if 'ESTABLECIMIENTO' in df.columns:
        mask_privado |= df['ESTABLECIMIENTO'].str.lower().str.contains(PRIVADOS_PATRON, na=False)
    
    if 'CODIGO_DEIS' in df.columns:
        mask_privado |= df['CODIGO_DEIS'].isin(DEIS_PRIVADOS)
    
    df['TIPO_ESTABLECIMIENTO'] = mask_privado.map({True: 'Privado', False: 'Público'})
    
    n_priv = mask_privado.sum()
    n_pub = (~mask_privado).sum()
    print(f"   Clasificación: {n_pub:,} públicos + {n_priv:,} privados = {len(df):,} total")
    return df

def calcular_dv_chile(cuerpo_numerico: str) -> str:
    try:
        suma = 0
        multiplicador = 2
        for digito in reversed(cuerpo_numerico):
            suma += int(digito) * multiplicador
            multiplicador = multiplicador + 1 if multiplicador < 7 else 2
        resto = 11 - (suma % 11)
        if resto == 11:
            return '0'
        if resto == 10:
            return 'k'
        return str(resto)
    except Exception:
        return '?'

def leer_defunciones_vrs():
    print("\nLeyendo bases históricas de DEFUNCIONES para descartar fallecidos (VRS)...")
    base_dir = r"C:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL"
    defunciones_set = set()
    
    # Buscar archivos DEF*.csv y DEF*.xlsx (desde 1999 hasta 2026)
    archivos_def = []
    for root, _, files in os.walk(base_dir):
        for f in files:
            if f.upper().startswith("DEF") and (f.endswith(".csv") or f.endswith(".xlsx")):
                archivos_def.append(os.path.join(root, f))
                
    for archivo in sorted(archivos_def):
        try:
            if archivo.endswith(".csv"):
                df = pd.read_csv(archivo, sep="|", usecols=lambda c: 'RUN' in str(c).upper(), dtype=str, encoding='utf-8')
                if df.empty:
                    df = pd.read_csv(archivo, sep=";", usecols=lambda c: 'RUN' in str(c).upper(), dtype=str, encoding='utf-8')
            else:
                df = pd.read_excel(archivo, usecols=lambda c: 'RUN' in str(c).upper(), dtype=str)
                
            for col in df.columns:
                if 'RUN' in col.upper():
                    cleaned = df[col].apply(normalizar_run_sin_dv)
                    defunciones_set.update(cleaned.dropna().unique())
                    break
        except Exception as e:
            try:
                if archivo.endswith(".csv"):
                    df = pd.read_csv(archivo, sep="|", usecols=lambda c: 'RUN' in str(c).upper(), dtype=str, encoding='latin-1')
                    for col in df.columns:
                        if 'RUN' in col.upper():
                            defunciones_set.update(df[col].apply(normalizar_run_sin_dv).dropna().unique())
                            break
            except Exception:
                pass
                
    print(f"Total RUN fallecidos históricos encontrados: {len(defunciones_set)}\n")
    return defunciones_set

def normalizar_run_sin_dv(val) -> str:
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
        cuerpo_candidato = s[:-1]
        dv_candidato = s[-1]
        dv_esperado = calcular_dv_chile(cuerpo_candidato)
        if dv_candidato == dv_esperado:
            return cuerpo_candidato
        else:
            return s
    return s

def clean_and_filter_df(df_path, filter_col_codigo):
    print(f"\nProcesando {df_path}...")
    df = pd.read_csv(
        df_path, sep='|', encoding='latin-1', dtype=str,
        usecols=lambda c: c in [
            'COD_COMUNA_OCURR', 'COMUNA_OCURR', 'COD_COMUNA_RESID', 'COMUNA_RESIDENCIA', 
            'CODIGO_DEIS', 'ESTABLECIMIENTO', 'CRITERIO_ELEGIBILIDAD',
            'VACUNA_ADMINISTRADA', 'REGISTRO_ELIMINADO', 'DOSIS',
            'COD_PUEBLO_ORIGINARIO', 'PUEBLO_ORIGINARIO',
            'FECHA_INMUNIZACION', 'RUN'
        ]
    )
    for col in df.columns:
        df[col] = df[col].str.strip()
        
    df['VACUNA_ADMINISTRADA'] = df['VACUNA_ADMINISTRADA'].str.upper()
    df['REGISTRO_ELIMINADO']  = df['REGISTRO_ELIMINADO'].str.upper()
    
    # Filtros base obligatorios
    df = df[df['VACUNA_ADMINISTRADA'] == 'SI']
    df = df[df['REGISTRO_ELIMINADO'] == 'NO']
    
    # Filtro EPRO
    if 'CRITERIO_ELEGIBILIDAD' in df.columns:
        df = df[df['CRITERIO_ELEGIBILIDAD'].str.upper() != 'EPRO']
        # Fix encoding issue just in case
        df['CRITERIO_ELEGIBILIDAD'] = df['CRITERIO_ELEGIBILIDAD'].replace({'Recin nacido': 'Recién nacido', 'ReciÃ³n nacido': 'Recién nacido'})
        
    if 'DOSIS' in df.columns:
        df = df[df['DOSIS'].str.upper() != 'EPRO']
    
    # Filtro geográfico
    df = df[df[filter_col_codigo].isin(COD_COMUNAS)]
    
    df['COMUNA_CANONICA'] = df[filter_col_codigo].map(CODIGO_A_COMUNA)
    
    if 'RUN' in df.columns:
        df['RUN_NORMALIZADO'] = df['RUN'].apply(normalizar_run_sin_dv)
    
    df = clasificar_tipo_establecimiento(df)
    
    print(f"   Total registros válidos post-filtro: {len(df):,}")
    return df

def load_programaticas(prog_path, filter_col_codigo):
    """Carga la base Programáticas, filtra solo Nirsevimab_ maternidad y aplica filtros estándar."""
    if not os.path.exists(prog_path):
        print(f"   ADVERTENCIA: No se encontró {prog_path}. Se omite base Programáticas.")
        return pd.DataFrame()
    
    print(f"\nProcesando Programáticas: {prog_path}...")
    df = pd.read_csv(
        prog_path, sep='|', encoding='latin-1', dtype=str, low_memory=False,
        usecols=lambda c: c in [
            'COD_COMUNA_OCURR', 'COMUNA_OCURR', 'COD_COMUNA_RESID', 'COMUNA_RESIDENCIA',
            'CODIGO_DEIS', 'ESTABLECIMIENTO', 'CRITERIO_ELEGIBILIDAD',
            'VACUNA_ADMINISTRADA', 'REGISTRO_ELIMINADO', 'DOSIS',
            'NOMBRE_VACUNA', 'FECHA_INMUNIZACION', 'RUN'
        ]
    )
    for col in df.columns:
        df[col] = df[col].str.strip()
    
    # Filtro específico: solo Nirsevimab de maternidad
    df = df[df['NOMBRE_VACUNA'] == 'Nirsevimab_ maternidad']
    print(f"   Registros Nirsevimab_ maternidad encontrados: {len(df):,}")
    
    df['VACUNA_ADMINISTRADA'] = df['VACUNA_ADMINISTRADA'].str.upper()
    df['REGISTRO_ELIMINADO']  = df['REGISTRO_ELIMINADO'].str.upper()
    
    # Filtros base obligatorios
    df = df[df['VACUNA_ADMINISTRADA'] == 'SI']
    df = df[df['REGISTRO_ELIMINADO'] == 'NO']
    
    # Filtro EPRO
    if 'CRITERIO_ELEGIBILIDAD' in df.columns:
        df = df[df['CRITERIO_ELEGIBILIDAD'].str.upper() != 'EPRO']
        df['CRITERIO_ELEGIBILIDAD'] = df['CRITERIO_ELEGIBILIDAD'].replace({'Recin nacido': 'Recién nacido', 'ReciÃ³n nacido': 'Recién nacido'})
    if 'DOSIS' in df.columns:
        df = df[df['DOSIS'].str.upper() != 'EPRO']
    
    # Filtro geográfico
    df = df[df[filter_col_codigo].isin(COD_COMUNAS)]
    df['COMUNA_CANONICA'] = df[filter_col_codigo].map(CODIGO_A_COMUNA)
    
    # Los registros de Nirsevimab en maternidad no traen CRITERIO_ELEGIBILIDAD;
    # se asigna "Recién nacido" ya que son inmunizados al nacer.
    if 'CRITERIO_ELEGIBILIDAD' in df.columns:
        df['CRITERIO_ELEGIBILIDAD'] = df['CRITERIO_ELEGIBILIDAD'].fillna('Recién nacido')
    
    # Eliminar columna NOMBRE_VACUNA ya que no existe en la base principal
    if 'NOMBRE_VACUNA' in df.columns:
        df = df.drop(columns=['NOMBRE_VACUNA'])
        
    if 'RUN' in df.columns:
        df['RUN_NORMALIZADO'] = df['RUN'].apply(normalizar_run_sin_dv)
    
    print(f"   Total registros Programáticas válidos post-filtro: {len(df):,}")
    return df

# ── 1. Pipeline de Ocurrencia ──────────────────────────────────
df_ocur = clean_and_filter_df(CSV_OCURRENCIA_PATH, 'COD_COMUNA_OCURR')

# Integrar Programáticas Ocurrencia
df_prog_ocur = load_programaticas(PROG_OCURRENCIA_PATH, 'COD_COMUNA_OCURR')
if not df_prog_ocur.empty:
    df_ocur = pd.concat([df_ocur, df_prog_ocur], ignore_index=True)
    print(f"   Total combinado Ocurrencia (VRS + Programáticas): {len(df_ocur):,}")

if 'FECHA_INMUNIZACION' in df_ocur.columns:
    df_ocur['MES'] = pd.to_datetime(df_ocur['FECHA_INMUNIZACION'], format='%Y-%m-%d', errors='coerce').dt.month
else:
    df_ocur['MES'] = 0

meses_base = []
if 'MES' in df_ocur.columns:
    meses_base = sorted(df_ocur['MES'].dropna().unique().astype(int).tolist())

grouped_ocur = df_ocur.groupby(['COMUNA_CANONICA', 'ESTABLECIMIENTO', 'TIPO_ESTABLECIMIENTO', 'CRITERIO_ELEGIBILIDAD', 'MES']).size().reset_index(name='count')
all_criterios_ocur = sorted(df_ocur['CRITERIO_ELEGIBILIDAD'].dropna().unique().tolist())

# Crear lookup de tipo por establecimiento
tipo_lookup = df_ocur.groupby('ESTABLECIMIENTO')['TIPO_ESTABLECIMIENTO'].first().to_dict()

data_ocurrencia = []
for (comuna, estab, tipo), sub in grouped_ocur.groupby(['COMUNA_CANONICA', 'ESTABLECIMIENTO', 'TIPO_ESTABLECIMIENTO']):
    datos = {}
    for crit, sub_crit in sub.groupby('CRITERIO_ELEGIBILIDAD'):
        datos[crit] = {str(int(row['MES'])): int(row['count']) for _, row in sub_crit.iterrows() if pd.notna(row['MES'])}
    
    for crit in all_criterios_ocur: 
        datos.setdefault(crit, {})
        
    total = sum(sum(mes_counts.values()) for mes_counts in datos.values())
    data_ocurrencia.append({
        "comuna": comuna,
        "establecimiento": estab,
        "tipo": tipo,
        "datos": datos,
        "total": total
    })
data_ocurrencia.sort(key=lambda x: (x['comuna'], -x['total']))

# Resumen por tipo de establecimiento por comuna
resumen_tipo = {}
for com in COMUNAS_OSORNO:
    sub_pub = df_ocur[(df_ocur['COMUNA_CANONICA'] == com) & (df_ocur['TIPO_ESTABLECIMIENTO'] == 'Público')]
    sub_priv = df_ocur[(df_ocur['COMUNA_CANONICA'] == com) & (df_ocur['TIPO_ESTABLECIMIENTO'] == 'Privado')]
    resumen_tipo[com] = {"publico": len(sub_pub), "privado": len(sub_priv)}

# Listar establecimientos privados encontrados
estab_privados = df_ocur[df_ocur['TIPO_ESTABLECIMIENTO'] == 'Privado']['ESTABLECIMIENTO'].unique().tolist()
print(f"\n   Establecimientos PRIVADOS encontrados ({len(estab_privados)}): {estab_privados}")

# ── 2. Pipeline de Residencia ───────────────────────
if os.path.exists(CSV_RESIDENCIA_PATH):
    df_resi = clean_and_filter_df(CSV_RESIDENCIA_PATH, 'COD_COMUNA_RESID')
else:
    print(f"   ADVERTENCIA: No se encontró {CSV_RESIDENCIA_PATH}. Usando Ocurrencia temporalmente.")
    df_resi = df_ocur.copy()
    if 'COD_COMUNA_RESID' not in df_resi.columns:
        df_resi['COD_COMUNA_RESID'] = df_resi.get('COD_COMUNA_OCURR', '')

# Integrar Programáticas Residencia
df_prog_resi = load_programaticas(PROG_RESIDENCIA_PATH, 'COD_COMUNA_RESID')
if not df_prog_resi.empty:
    df_resi = pd.concat([df_resi, df_prog_resi], ignore_index=True)
    print(f"   Total combinado Residencia (VRS + Programáticas): {len(df_resi):,}")

grouped_resi = df_resi.groupby(['COMUNA_CANONICA', 'CRITERIO_ELEGIBILIDAD']).size().reset_index(name='count')
all_criterios_resi = sorted(df_resi['CRITERIO_ELEGIBILIDAD'].dropna().unique().tolist())

data_residencia = []
for comuna in COMUNAS_OSORNO:
    sub = grouped_resi[grouped_resi['COMUNA_CANONICA'] == comuna]
    datos = {row['CRITERIO_ELEGIBILIDAD']: int(row['count']) for _, row in sub.iterrows()}
    for crit in all_criterios_resi: datos.setdefault(crit, 0)
    total = sum(datos.values())
    data_residencia.append({
        "comuna": comuna,
        "datos": datos,
        "total": total
    })

avance_semanal = {"TOTAL_PROVINCIAL": {}}
for com in COMUNAS_OSORNO:
    avance_semanal[com] = {}

if 'FECHA_INMUNIZACION' in df_resi.columns:
    df_resi_valid_dates = df_resi.dropna(subset=['FECHA_INMUNIZACION']).copy()
    df_resi_valid_dates['FECHA_DT'] = pd.to_datetime(df_resi_valid_dates['FECHA_INMUNIZACION'], format='%Y-%m-%d', errors='coerce')
    df_resi_valid_dates = df_resi_valid_dates.dropna(subset=['FECHA_DT'])
    df_resi_valid_dates['SE'] = df_resi_valid_dates['FECHA_DT'].apply(get_epi_week)
    
    if 'CRITERIO_ELEGIBILIDAD' in df_resi_valid_dates.columns:
        df_resi_valid_dates = df_resi_valid_dates[df_resi_valid_dates['CRITERIO_ELEGIBILIDAD'] != 'Otras prioridades']
        
    semanas_grouped = df_resi_valid_dates.groupby(['COMUNA_CANONICA', 'SE']).size().reset_index(name='count')
    
    for _, row in semanas_grouped.iterrows():
        com = row['COMUNA_CANONICA']
        se = str(int(row['SE']))
        cnt = int(row['count'])
        if com in avance_semanal:
            avance_semanal[com][se] = cnt
            avance_semanal["TOTAL_PROVINCIAL"][se] = avance_semanal["TOTAL_PROVINCIAL"].get(se, 0) + cnt

velocidad_promedio = {"TOTAL_PROVINCIAL": 0}
for com in COMUNAS_OSORNO:
    velocidad_promedio[com] = 0

if 'FECHA_INMUNIZACION' in df_resi.columns and not df_resi_valid_dates.empty:
    max_date = df_resi_valid_dates['FECHA_DT'].max()
    ultimos_3 = []
    current = max_date
    while len(ultimos_3) < 3:
        if current.weekday() < 5:
            ultimos_3.append(current)
        current -= timedelta(days=1)
        
    df_ultimos = df_resi_valid_dates[df_resi_valid_dates['FECHA_DT'].isin(ultimos_3)]
    velocidad_promedio["TOTAL_PROVINCIAL"] = round(len(df_ultimos) / 3.0, 1)
    
    comuna_counts = df_ultimos.groupby('COMUNA_CANONICA').size()
    for com, count in comuna_counts.items():
        if com in velocidad_promedio:
            velocidad_promedio[com] = round(count / 3.0, 1)

# Pueblos Originarios
PUEBLOS_VALIDOS = {'1','2','3','4','5','6','7','8','9','10'}
if 'COD_PUEBLO_ORIGINARIO' in df_resi.columns:
    df_pueblos = df_resi[df_resi['COD_PUEBLO_ORIGINARIO'].isin(PUEBLOS_VALIDOS)].copy()
    df_pueblos['grupo_epi'] = df_pueblos['CRITERIO_ELEGIBILIDAD']
    pueblos_grouped = df_pueblos.groupby(['COMUNA_CANONICA', 'PUEBLO_ORIGINARIO', 'grupo_epi']).size().reset_index(name='count')
    grupos_pueblos = df_pueblos['grupo_epi'].unique().tolist()

    pueblos_json = {}
    for com in COMUNAS_OSORNO:
        com_data = pueblos_grouped[pueblos_grouped['COMUNA_CANONICA'] == com]
        pueblos_json[com] = {}
        for pueblo in sorted(com_data['PUEBLO_ORIGINARIO'].unique()):
            p_sub = com_data[com_data['PUEBLO_ORIGINARIO'] == pueblo]
            dist = {row['grupo_epi']: int(row['count']) for _, row in p_sub.iterrows()}
            for k in grupos_pueblos: dist.setdefault(k, 0)
            pueblos_json[com][pueblo] = {"total": int(p_sub['count'].sum()), "distribucion": dist}

    prov_pueblos_grouped = df_pueblos.groupby(['PUEBLO_ORIGINARIO', 'grupo_epi']).size().reset_index(name='count')
    pueblos_json['TOTAL_PROVINCIAL'] = {}
    for pueblo in sorted(prov_pueblos_grouped['PUEBLO_ORIGINARIO'].unique()):
        p_sub = prov_pueblos_grouped[prov_pueblos_grouped['PUEBLO_ORIGINARIO'] == pueblo]
        dist = {row['grupo_epi']: int(row['count']) for _, row in p_sub.iterrows()}
        for k in grupos_pueblos: dist.setdefault(k, 0)
        pueblos_json['TOTAL_PROVINCIAL'][pueblo] = {"total": int(p_sub['count'].sum()), "distribucion": dist}
else:
    pueblos_json = {}

# ── 3. Metas ───────────────────────────────────────────────────────────────────
metas = {}
if YEAR in ['2025', '2026']:
    print("\nCalculando metas dinámicas desde bases NAC (Nacidos Vivos)...")
    df_nac_list = []
    for path in [NAC_2025_PATH, NAC_2026_PATH]:
        if os.path.exists(path):
            df_nac_list.append(pd.read_csv(path, sep=';', encoding='latin-1', dtype=str, low_memory=False))
        else:
            print(f"   ADVERTENCIA: No se encontró {path}")
    
    if df_nac_list:
        df_nac = pd.concat(df_nac_list, ignore_index=True)
        # Limpiar columnas relevantes
        for col in ['REG_RES', 'SERV_RES', 'COMUNA', 'ANO_NAC', 'MES_NAC', 'DIA_NAC']:
            if col in df_nac.columns:
                df_nac[col] = df_nac[col].astype(str).str.strip()
        
        # Filtro residencia Osorno
        df_nac = df_nac[(df_nac['REG_RES'] == '10') & (df_nac['SERV_RES'] == '23')]
        
        # Mapear a comuna canónica (usando el código en 'COMUNA')
        df_nac['COMUNA_CANONICA'] = df_nac['COMUNA'].map(CODIGO_A_COMUNA)
        df_nac = df_nac.dropna(subset=['COMUNA_CANONICA'])
        
        # Parsear fecha de nacimiento
        df_nac['FECHA'] = pd.to_datetime(
            df_nac['ANO_NAC'] + '-' + df_nac['MES_NAC'].str.zfill(2) + '-' + df_nac['DIA_NAC'].str.zfill(2), 
            errors='coerce'
        )
        df_nac = df_nac.dropna(subset=['FECHA'])
        
        # Normalizar RUN en base NAC
        df_nac['RUN_NORMALIZADO'] = df_nac['RUN'].apply(normalizar_run_sin_dv)
        
        # Set de RUNs vacunados (para cruce nominal)
        vacunados_set = set()
        if 'RUN_NORMALIZADO' in df_resi.columns:
            vacunados_set = set(df_resi['RUN_NORMALIZADO'].dropna().unique())
        
        # Leer defunciones
        defunciones_set = leer_defunciones_vrs()
        
        rescates_list = []
        
        for comuna in COMUNAS_OSORNO:
            sub = df_nac[df_nac['COMUNA_CANONICA'] == comuna]
            
            # Lactantes: nacidos entre 01/10/2025 y 28/02/2026
            mask_lactantes = (sub['FECHA'] >= '2025-10-01') & (sub['FECHA'] < '2026-03-01')
            sub_lactantes = sub[mask_lactantes]
            lactantes = len(sub_lactantes)
            
            # Recién nacido: nacidos a partir de 01/03/2026
            mask_rn = sub['FECHA'] >= '2026-03-01'
            sub_rn = sub[mask_rn]
            recien_nacidos = len(sub_rn)
            
            # Población objetivo de la comuna
            sub_objetivo = sub[mask_lactantes | mask_rn]
            
            # Identificar pendientes (rescates)
            for _, row in sub_objetivo.iterrows():
                run_norm = row.get('RUN_NORMALIZADO', '')
                if run_norm and run_norm not in vacunados_set:
                    row_dict = row.to_dict()
                    row_dict['GRUPO_ELEGIBILIDAD'] = 'Recién Nacido' if row['FECHA'] >= pd.to_datetime('2026-03-01') else 'Lactante'
                    row_dict['COMUNA_CANONICA'] = comuna
                    row_dict['ESTADO_VITAL'] = 'FALLECIDO' if run_norm in defunciones_set else 'VIVO'
                    rescates_list.append(row_dict)
            
            total_meta = lactantes + recien_nacidos
            
            criterios_meta = {}
            if lactantes > 0:
                criterios_meta['Lactantes'] = lactantes
            if recien_nacidos > 0:
                criterios_meta['Recién nacido'] = recien_nacidos
                
            metas[comuna] = {"Total": total_meta, "Criterios": criterios_meta}
            
        print(f"   Metas calculadas para: {list(metas.keys())}")
        
        # Determinar fecha de la base para el nombre del archivo
        import glob
        try:
            mtime_base = max(os.path.getmtime(CSV_OCURRENCIA_PATH), os.path.getmtime(CSV_RESIDENCIA_PATH))
            fecha_base_str = datetime.fromtimestamp(mtime_base).strftime("%d-%m-%Y")
        except:
            fecha_base_str = datetime.now().strftime("%d-%m-%Y")
            
        # Generar archivo de rescates
        df_rescates = pd.DataFrame(rescates_list)
        base_filename = f"Rescates_VRS_Pendientes_{YEAR}_{fecha_base_str}.xlsx"
        rescates_path = os.path.join(PARENT_DIR, base_filename)
        
        # Eliminar archivos de rescate antiguos para evitar ocupar espacio innecesario
        old_rescates = glob.glob(os.path.join(PARENT_DIR, f"Rescates_VRS_Pendientes_{YEAR}*.xlsx"))
        for old_file in old_rescates:
            if os.path.basename(old_file) != base_filename and not os.path.basename(old_file) == f"Rescates_VRS_Pendientes_{YEAR}.xlsx":
                try:
                    os.remove(old_file)
                except Exception:
                    pass
        try:
            if not df_rescates.empty:
                if 'FECHA' in df_rescates.columns:
                    df_rescates['FECHA'] = df_rescates['FECHA'].dt.strftime('%Y-%m-%d')
                
                def format_run_with_dv(run_val):
                    try:
                        run_str = str(run_val).replace('.','').replace('-','').strip()
                        if not run_str or not run_str.isdigit(): return run_val
                        r = int(run_str)
                        if r == 0: return run_val
                        s = 1
                        m = 0
                        temp_r = r
                        while temp_r:
                            s = (s + temp_r % 10 * (9 - m % 6)) % 11
                            temp_r //= 10
                            m += 1
                        dv = 'K' if s == 10 else str(s)
                        return f"{run_str}-{dv}"
                    except:
                        return run_val
                        
                for col in df_rescates.columns:
                    if 'RUN' in str(col).upper():
                        df_rescates[col] = df_rescates[col].apply(format_run_with_dv)
                
                cols = list(df_rescates.columns)
                if 'GRUPO_ELEGIBILIDAD' in cols: cols.remove('GRUPO_ELEGIBILIDAD')
                if 'COMUNA_CANONICA' in cols: cols.remove('COMUNA_CANONICA')
                cols = ['GRUPO_ELEGIBILIDAD', 'COMUNA_CANONICA'] + cols
                df_rescates = df_rescates[cols]
                
                writer = pd.ExcelWriter(rescates_path, engine='xlsxwriter')
                workbook = writer.book
                worksheet = workbook.add_worksheet('Menores Pendientes')
                worksheet.hide_gridlines(2)
                
                fmt_header = workbook.add_format({
                    'bold': True, 'font_color': 'white', 'bg_color': '#0F69B4',
                    'border': 1, 'align': 'center', 'valign': 'vcenter', 'text_wrap': True,
                    'font_name': 'Segoe UI', 'size': 10
                })
                fmt_data = workbook.add_format({'border': 1, 'font_name': 'Segoe UI', 'size': 10})
                
                title_fmt = workbook.add_format({'bold': True, 'size': 14, 'font_name': 'Segoe UI', 'font_color': '#0F69B4'})
                worksheet.write('A1', f'NÓMINA DE MENORES PENDIENTES VRS {YEAR} - SERVICIO DE SALUD OSORNO', title_fmt)
                worksheet.write('A2', f'Filtro aplicado: Población objetivo sin registro de vacunación Nirsevimab | Fecha de corte base: {fecha_base_str}', workbook.add_format({'italic': True, 'font_name': 'Segoe UI', 'size': 10}))
                
                for col_num, value in enumerate(df_rescates.columns):
                    worksheet.write(3, col_num, value, fmt_header)
                
                for row_idx, row_data in enumerate(df_rescates.values):
                    for col_idx, value in enumerate(row_data):
                        val = "" if pd.isna(value) else str(value)
                        worksheet.write(row_idx + 4, col_idx, val, fmt_data)
                
                worksheet.autofit()
                writer.close()
                
                try:
                    import win32com.client
                    import os
                    excel = win32com.client.Dispatch("Excel.Application")
                    excel.DisplayAlerts = False
                    abs_path = os.path.abspath(rescates_path)
                    wb = excel.Workbooks.Open(abs_path)
                    wb.Password = 'DEIS2026'
                    wb.SaveAs(abs_path, Password='DEIS2026')
                    wb.Close()
                    excel.Quit()
                    print(f"\n   -> Archivo cifrado con contraseña (DEIS2026): {rescates_path}")
                except Exception as ex_pwd:
                    print(f"   ADVERTENCIA: No se pudo cifrar con contraseña el archivo: {ex_pwd}")
                
                print(f"   -> Archivo de rescates generado exitosamente: {rescates_path}")
                print(f"   -> Total de menores pendientes de inmunización: {len(df_rescates):,}")
            else:
                print("   -> No hay rescates pendientes para exportar.")
        except Exception as e:
            print(f"   ADVERTENCIA: No se pudo guardar el archivo de rescates. Error: {e}")
            
    else:
        print("   ADVERTENCIA: No se pudieron calcular las metas ni generar rescates, bases NAC faltantes.")

# ── 4. Exportar ────────────────────────────────────────────────────────────────
try:
    mtime = max(os.path.getmtime(CSV_OCURRENCIA_PATH), os.path.getmtime(CSV_RESIDENCIA_PATH))
    fecha_referencia = datetime.fromtimestamp(mtime).strftime("%d/%m/%Y %H:%M")
except:
    fecha_referencia = datetime.now().strftime("%d/%m/%Y %H:%M")

resultado = {
    "fecha_actualizacion": fecha_referencia,
    "fuente": "Archivos Híbridos (Ocurrencia + Residencia)",
    "headers": all_criterios_resi,
    "meses_base": meses_base,
    "data_ocurrencia": data_ocurrencia,
    "data_residencia": data_residencia,
    "avance_semanal": avance_semanal,
    "velocidad_promedio": velocidad_promedio,
    "metas": metas,
    "pueblos_data": pueblos_json,
    "total_rescates": len(df_rescates) if 'df_rescates' in locals() else 0,
    "archivo_rescates": base_filename if 'base_filename' in locals() else f"Rescates_VRS_Pendientes_{YEAR}.xlsx"
}

with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(resultado, f, ensure_ascii=False, indent=2)

with open(JS_OUTPUT_PATH, 'w', encoding='utf-8') as f:
    f.write(f"var DASHBOARD_DATA_OFFLINE_{YEAR} = {json.dumps(resultado, ensure_ascii=False, indent=2)};")

print(f"\n{'='*55}")
print(f"Proceso VRS Finalizado Exitosamente")
print(f"   Año: {YEAR}")
print(f"   Fecha de corte: {fecha_referencia}")
print(f"   Total Vacunas (Ocurrencia): {sum(r['total'] for r in data_ocurrencia):,}")
print(f"   Total Vacunas (Residencia): {sum(r['total'] for r in data_residencia):,}")
print(f"{'='*55}")
