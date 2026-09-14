import pandas as pd
import json
import os
import re
from datetime import datetime, timedelta

import argparse

parser = argparse.ArgumentParser(description='Process Influenza Data')
parser.add_argument('--year', type=str, default='2026', help='Year to process')
args = parser.parse_args()
YEAR = args.year

# ── Configuración ──────────────────────────────────────────────────────────────
CSV_OCURRENCIA_PATH = rf"C:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL\{YEAR}\Influenza_Ocurrencia_{YEAR}.csv"
CSV_RESIDENCIA_PATH = rf"C:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL\{YEAR}\Influenza_Residencia_{YEAR}.csv"
METAS_PATH  = rf"Archivos_Excel\Metas_Influenza_{YEAR}.xlsx"
OUTPUT_PATH = rf"temp_regen\dashboard_data_{YEAR}.json"
JS_OUTPUT_PATH = rf"temp_regen\dashboard_data_{YEAR}.js"

COMUNAS_OSORNO = [
    "Osorno", "Puerto Octay", "Purranque", "Puyehue",
    "Río Negro", "San Juan de la Costa", "San Pablo"
]

COD_COMUNAS = {'10301','10302','10303','10304','10305','10306','10307'}

CODIGO_A_COMUNA = {
    '10301': 'Osorno', '10302': 'Puerto Octay', '10303': 'Purranque',
    '10304': 'Puyehue', '10305': 'Río Negro', '10306': 'San Juan de la Costa', '10307': 'San Pablo'
}

CRITERIO_MAPPING = {
    'Personas mayores de 60 años y más': 'Personas mayores de 60 años y más (año 1966)',
    'Vacunación privada (No población objetivo)': 'Otras prioridades'
}

# ── Funciones Base ─────────────────────────────────────────────────────────────

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

def get_epi_week(d):
    day_of_week = d.isoweekday() % 7 # Sun=0
    wednesday = d + timedelta(days=3 - day_of_week)
    return (wednesday.timetuple().tm_yday - 1) // 7 + 1

def clean_and_filter_df(df_path, filter_col_codigo):
    print(f"\nProcesando {df_path}...")
    df = pd.read_csv(
        df_path, sep='|', encoding='latin-1', dtype=str,
        usecols=lambda c: c in [
            'COD_COMUNA_OCURR', 'COMUNA_OCURR', 'COD_COMUNA_RESID', 'COMUNA_RESIDENCIA', 
            'CODIGO_DEIS', 'ESTABLECIMIENTO', 'CRITERIO_ELEGIBILIDAD',
            'VACUNA_ADMINISTRADA', 'REGISTRO_ELIMINADO', 'DOSIS',
            'COD_PUEBLO_ORIGINARIO', 'PUEBLO_ORIGINARIO',
            'FECHA_INMUNIZACION'
        ]
    )
    for col in df.columns:
        df[col] = df[col].str.strip()
        
    df['VACUNA_ADMINISTRADA'] = df['VACUNA_ADMINISTRADA'].str.upper()
    df['REGISTRO_ELIMINADO']  = df['REGISTRO_ELIMINADO'].str.upper()
    
    # Filtros base obligatorios
    df = df[df['VACUNA_ADMINISTRADA'] == 'SI']
    df = df[df['REGISTRO_ELIMINADO'] == 'NO']
    df = df[df['CRITERIO_ELEGIBILIDAD'] != 'EPRO']
    df = df[df['DOSIS'] != 'EPRO']
    
    # Filtro geográfico avanzado (Ocurrencia o Residencia)
    df = df[df[filter_col_codigo].isin(COD_COMUNAS)]
    
    # Clasificar tipo de establecimiento (público/privado) — SIN EXCLUIR
    df = clasificar_tipo_establecimiento(df)
        
    # Filtro EPRO
    if 'CRITERIO_ELEGIBILIDAD' in df.columns:
        df = df[df['CRITERIO_ELEGIBILIDAD'].str.upper() != 'EPRO']
        df['CRITERIO_ELEGIBILIDAD'] = df['CRITERIO_ELEGIBILIDAD'].str.replace('  ', ' ')
        df['CRITERIO_ELEGIBILIDAD'] = df['CRITERIO_ELEGIBILIDAD'].replace(CRITERIO_MAPPING)
        
    if 'DOSIS' in df.columns:
        df = df[df['DOSIS'].str.upper() != 'EPRO']
        
    df['COMUNA_CANONICA'] = df[filter_col_codigo].map(CODIGO_A_COMUNA)
    print(f"   Total registros válidos post-filtro: {len(df):,}")
    return df

# ── 1. Pipeline de Ocurrencia (Matriz Técnica) ──────────────────────────────────
df_ocur = clean_and_filter_df(CSV_OCURRENCIA_PATH, 'COD_COMUNA_OCURR')

if 'FECHA_INMUNIZACION' in df_ocur.columns:
    df_ocur['MES'] = pd.to_datetime(df_ocur['FECHA_INMUNIZACION'], format='%Y-%m-%d', errors='coerce').dt.month
else:
    df_ocur['MES'] = 0

meses_base = []
if 'MES' in df_ocur.columns:
    meses_base = sorted(df_ocur['MES'].dropna().unique().astype(int).tolist())
    # Excluir enero y febrero ya que la campaña empieza oficialmente en marzo
    meses_base = [m for m in meses_base if m >= 3]

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

# ── 2. Pipeline de Residencia (Cobertura y Epidemiología) ───────────────────────
if os.path.exists(CSV_RESIDENCIA_PATH):
    df_resi = clean_and_filter_df(CSV_RESIDENCIA_PATH, 'COD_COMUNA_RESID')
else:
    print(f"   ADVERTENCIA: No se encontró {CSV_RESIDENCIA_PATH}. Usando Ocurrencia como Residencia temporalmente.")
    df_resi = df_ocur.copy()
    # Ensure Residencia columns exist if they differ from Ocurrencia in the fallback
    if 'COD_COMUNA_RESID' not in df_resi.columns:
        df_resi['COD_COMUNA_RESID'] = df_resi.get('COD_COMUNA_OCURR', '')


all_criterios_resi = sorted(df_resi['CRITERIO_ELEGIBILIDAD'].dropna().unique().tolist())

def categorizar_grupo_epi(criterio):
    crit = str(criterio).strip()
    if crit == 'Personas mayores de 60 años y más (año 1966)': return 'Adulto Mayor'
    elif crit in ['Niños y niñas de 6 meses a 5 años de edad', 'Escolares de 1° a 5° año básico']: return 'Niños/as'
    elif crit == 'Enfermos cronicos de 11 a 59 años de edad': return 'Crónicos'
    else: return 'Otros'

def build_residencia(df_sub):
    grouped = df_sub.groupby(['COMUNA_CANONICA', 'CRITERIO_ELEGIBILIDAD']).size().reset_index(name='count')
    data_res = []
    for comuna in COMUNAS_OSORNO:
        sub = grouped[grouped['COMUNA_CANONICA'] == comuna]
        datos = {row['CRITERIO_ELEGIBILIDAD']: int(row['count']) for _, row in sub.iterrows()}
        for crit in all_criterios_resi: datos.setdefault(crit, 0)
        data_res.append({
            "comuna": comuna,
            "datos": datos,
            "total": sum(datos.values())
        })
        
    av_semanal = {"TOTAL_PROVINCIAL": {}}
    for com in COMUNAS_OSORNO: av_semanal[com] = {}
    
    if 'FECHA_INMUNIZACION' in df_sub.columns:
        df_dates = df_sub.dropna(subset=['FECHA_INMUNIZACION']).copy()
        df_dates['FECHA_DT'] = pd.to_datetime(df_dates['FECHA_INMUNIZACION'], format='%Y-%m-%d', errors='coerce')
        df_dates = df_dates.dropna(subset=['FECHA_DT'])
        if not df_dates.empty:
            df_dates['SE'] = df_dates['FECHA_DT'].apply(get_epi_week)
            df_semanas = df_dates[df_dates['SE'] >= 9]
            if 'CRITERIO_ELEGIBILIDAD' in df_semanas.columns:
                df_semanas = df_semanas[~df_semanas['CRITERIO_ELEGIBILIDAD'].isin(['Población general', 'Poblacion general'])]
            semanas_grouped = df_semanas.groupby(['COMUNA_CANONICA', 'SE']).size().reset_index(name='count')
            for _, row in semanas_grouped.iterrows():
                com = row['COMUNA_CANONICA']
                se = str(int(row['SE']))
                cnt = int(row['count'])
                if com in av_semanal:
                    av_semanal[com][se] = cnt
                    av_semanal["TOTAL_PROVINCIAL"][se] = av_semanal["TOTAL_PROVINCIAL"].get(se, 0) + cnt
                
    pb_json = {}
    PUEBLOS_VALIDOS = {'1','2','3','4','5','6','7','8','9','10'}
    df_pueblos = df_sub[df_sub['COD_PUEBLO_ORIGINARIO'].isin(PUEBLOS_VALIDOS)].copy() if 'COD_PUEBLO_ORIGINARIO' in df_sub.columns else pd.DataFrame()
    if not df_pueblos.empty:
        df_pueblos['grupo_epi'] = df_pueblos['CRITERIO_ELEGIBILIDAD'].apply(categorizar_grupo_epi)
        pueblos_grouped = df_pueblos.groupby(['COMUNA_CANONICA', 'PUEBLO_ORIGINARIO', 'grupo_epi']).size().reset_index(name='count')
        for com in COMUNAS_OSORNO:
            com_data = pueblos_grouped[pueblos_grouped['COMUNA_CANONICA'] == com]
            pb_json[com] = {}
            for pueblo in sorted(com_data['PUEBLO_ORIGINARIO'].unique()):
                p_sub = com_data[com_data['PUEBLO_ORIGINARIO'] == pueblo]
                dist = {row['grupo_epi']: int(row['count']) for _, row in p_sub.iterrows()}
                for k in ['Adulto Mayor', 'Niños/as', 'Crónicos', 'Otros']: dist.setdefault(k, 0)
                pb_json[com][pueblo] = {"total": int(p_sub['count'].sum()), "distribucion": dist}
                
        prov_pueblos = df_pueblos.groupby(['PUEBLO_ORIGINARIO', 'grupo_epi']).size().reset_index(name='count')
        pb_json['TOTAL_PROVINCIAL'] = {}
        for pueblo in sorted(prov_pueblos['PUEBLO_ORIGINARIO'].unique()):
            p_sub = prov_pueblos[prov_pueblos['PUEBLO_ORIGINARIO'] == pueblo]
            dist = {row['grupo_epi']: int(row['count']) for _, row in p_sub.iterrows()}
            for k in ['Adulto Mayor', 'Niños/as', 'Crónicos', 'Otros']: dist.setdefault(k, 0)
            pb_json['TOTAL_PROVINCIAL'][pueblo] = {"total": int(p_sub['count'].sum()), "distribucion": dist}
    else:
        for com in COMUNAS_OSORNO: pb_json[com] = {}
        pb_json['TOTAL_PROVINCIAL'] = {}

    return data_res, av_semanal, pb_json

data_residencia, avance_semanal, pueblos_json = build_residencia(df_resi)
data_residencia_publico, avance_semanal_publico, pueblos_json_publico = build_residencia(df_resi[df_resi['TIPO_ESTABLECIMIENTO'] == 'Público'])
data_residencia_privado, avance_semanal_privado, pueblos_json_privado = build_residencia(df_resi[df_resi['TIPO_ESTABLECIMIENTO'] == 'Privado'])

# ── 3. Metas ───────────────────────────────────────────────────────────────────
print("\nLeyendo metas oficiales...")
MAPPING_METAS = {
    'Niños/as de 6 meses a 5 años': 'Niños y niñas de 6 meses a 5 años de edad',
    'Niños/as de 6 a 10 años.': 'Escolares de 1° a 5° año básico',
    'Personas de 60 años y más': 'Personas mayores de 60 años y más (año 1966)',
    'Personas con patologías crónicas entre 11 y 59 años': 'Enfermos cronicos de 11 a 59 años de edad',
    'Embarazadas': 'Embarazadas',
    'Estrategia capullo': 'Estrategia Capullo',
    'Trabajadores de la salud (públicos)': 'P. de salud: Público',
    'Trabajadores de la salud (privados)': 'P. de salud: Privado',
    'Trabajadores de la educación escolar y preescolar hasta 8°año de enseñanza básica': 'Trabajadores de la educación preescolar y escolar hasta 8° basico',
    'Trabajadores de avícolas, ganaderas y criaderos de cerdos.': 'Trabajadores de avícolas, ganaderas y de criaderos de cerdo',
    'Cuidadores/as de adultos mayores y funcionarios/as de ELEAM': 'Cuidadores de adultos mayores y funcionarios de los ELEAM',
    'Otras prioridades': 'Otras prioridades'
}

try:
    df_metas = pd.read_excel(METAS_PATH, skiprows=7)
    df_metas.columns = df_metas.iloc[0]
    df_metas = df_metas[1:]

    metas = {}
    for _, row in df_metas.iterrows():
        comuna_name = str(row.get('Comuna', '')).strip()
        if not comuna_name or comuna_name == 'nan': continue
        matched = next((c for c in COMUNAS_OSORNO if c.lower() in comuna_name.lower() or ('negro' in c.lower() and 'negro' in comuna_name.lower())), None)
        if not matched: continue

        total_meta = int(row['Total']) if pd.notna(row['Total']) else 0
        criterios_meta = {}
        for k_excel, k_csv in MAPPING_METAS.items():
            col = next((c for c in df_metas.columns if str(c).strip() == k_excel), None)
            if not col: col = next((c for c in df_metas.columns if k_excel[:15] in str(c).strip()), None)
            criterios_meta[k_csv] = int(row[col]) if col and pd.notna(row[col]) else 0
        metas[matched] = {"Total": total_meta, "Criterios": criterios_meta}
    print(f"   Metas cargadas para: {list(metas.keys())}")
except Exception as e:
    print(f"   No se pudo leer metas ({e}). Se mantiene archivo existente.")
    try:
        with open(OUTPUT_PATH, encoding='utf-8') as f: metas = json.load(f).get('metas', {})
    except: metas = {}

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
    "metas": metas,
    "pueblos_data": pueblos_json,
    "data_residencia_publico": data_residencia_publico,
    "avance_semanal_publico": avance_semanal_publico,
    "pueblos_data_publico": pueblos_json_publico,
    "data_residencia_privado": data_residencia_privado,
    "avance_semanal_privado": avance_semanal_privado,
    "pueblos_data_privado": pueblos_json_privado,
    "resumen_tipo": resumen_tipo,
    "estab_privados": estab_privados
}

with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(resultado, f, ensure_ascii=False, indent=2)

with open(JS_OUTPUT_PATH, 'w', encoding='utf-8') as f:
    f.write(f"var DASHBOARD_DATA_OFFLINE_{YEAR} = {json.dumps(resultado, ensure_ascii=False, indent=2)};")

    print(f"   (Test) Skipped updating index.html")

print(f"\n{'='*55}")
print(f"Proceso Híbrido Finalizado Exitosamente")
print(f"   Año: {YEAR}")
print(f"   Fecha de corte: {fecha_referencia}")
print(f"   Total Vacunas (Ocurrencia): {sum(r['total'] for r in data_ocurrencia):,}")
print(f"   Total Vacunas (Residencia): {sum(r['total'] for r in data_residencia):,}")
print(f"{'='*55}")
