import pandas as pd
import glob
import os
import re
from datetime import datetime
from dateutil.relativedelta import relativedelta
import json

BASE_DIR = r"c:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL"

def normalize_run(run):
    if pd.isna(run): return None
    s = str(run).upper().replace('.', '').replace(' ', '').strip()
    if '-' in s:
        parts = s.split('-')
        if len(parts) == 2: return parts[0] + '-' + parts[1]
    if len(s) > 1: return s[:-1] + '-' + s[-1]
    return s

def get_vaccine_group(name):
    n = str(name).lower()
    if 'hexavalente' in n: return 'Hexavalente', name
    if 'neumoc' in n and 'conjugada' in n and '10v' not in n: return 'Neumococica', name
    if '10v' in n: return 'PCV10', name
    if 'bexsero' in n: return 'Meningococica B', name
    if 'srp' in n or 'trivirica' in n: return 'SRP', name
    if 'varicela' in n and 'inmunoglobulina' not in n: return 'Varicela', name
    return None, None

def audit():
    print("Iniciando auditoria profunda...")
    files = glob.glob(os.path.join(BASE_DIR, '**', 'Programáticas_*.csv'), recursive=True)
    cols = ['RUN', 'NOMBRE_VACUNA', 'DOSIS', 'FECHA_INMUNIZACION', 'ESTABLECIMIENTO', 'COMUNA_RESIDENCIA', 'FECHA_NACIMIENTO', 'VACUNA_ADMINISTRADA', 'REGISTRO_ELIMINADO']
    
    all_chunks = []
    pcv10_raw_count = 0
    pcv10_dropped = []
    
    for f in files:
        try:
            df = pd.read_csv(f, sep='|', encoding='latin-1', dtype=str, usecols=lambda c: c in cols)
            
            # PCV10 raw check
            df_pcv10_raw = df[df['NOMBRE_VACUNA'].astype(str).str.contains('10V', na=False)]
            pcv10_raw_count += len(df_pcv10_raw)
            
            # Apply global filters and catch PCV10 drops
            if 'VACUNA_ADMINISTRADA' in df.columns:
                invalid = df[df['VACUNA_ADMINISTRADA'].astype(str).str.strip().str.upper() != 'SI']
                if not invalid.empty:
                    p = invalid[invalid['NOMBRE_VACUNA'].astype(str).str.contains('10V', na=False)]
                    for _, r in p.iterrows(): pcv10_dropped.append(f"VACUNA_ADMINISTRADA != SI: {r['FECHA_INMUNIZACION']}")
                df = df[df['VACUNA_ADMINISTRADA'].astype(str).str.strip().str.upper() == 'SI']
            
            if 'REGISTRO_ELIMINADO' in df.columns:
                invalid = df[df['REGISTRO_ELIMINADO'].astype(str).str.strip().str.upper() == 'SI']
                if not invalid.empty:
                    p = invalid[invalid['NOMBRE_VACUNA'].astype(str).str.contains('10V', na=False)]
                    for _, r in p.iterrows(): pcv10_dropped.append(f"REGISTRO_ELIMINADO == SI: {r['FECHA_INMUNIZACION']}")
                df = df[df['REGISTRO_ELIMINADO'].astype(str).str.strip().str.upper() != 'SI']
            
            df = df.dropna(subset=['RUN', 'NOMBRE_VACUNA'])
            df['RUN_NORM'] = df['RUN'].apply(normalize_run)
            df[['VACUNA_GRUPO', 'ALIAS_ORIGINAL']] = df.apply(lambda r: get_vaccine_group(r['NOMBRE_VACUNA']), axis=1, result_type='expand')
            df = df[df['VACUNA_GRUPO'].notna()].copy()
            if df.empty: continue
            
            df['FECHA_INMUNIZACION'] = pd.to_datetime(df['FECHA_INMUNIZACION'], format='%Y-%m-%d', errors='coerce')
            df['FECHA_NACIMIENTO'] = pd.to_datetime(df['FECHA_NACIMIENTO'], format='%Y-%m-%d', errors='coerce')
            
            # Check pcv10 drops due to date
            df['SOURCE'] = 'Ocurrencia' if 'Ocurrencia' in f else 'Residencia'
            all_chunks.append(df)
        except Exception as e:
            pass

    df_all = pd.concat(all_chunks, ignore_index=True)
    fecha_corte = pd.to_datetime('2026-09-11 00:00:00')
    
    # Check PCV10 drops due to cutoff
    pcv10_late = df_all[(df_all['VACUNA_GRUPO'] == 'PCV10') & (df_all['FECHA_INMUNIZACION'] > fecha_corte)]
    for _, r in pcv10_late.iterrows(): pcv10_dropped.append(f"POSTERIOR AL CORTE: {r['FECHA_INMUNIZACION']}")
    
    df_all = df_all[df_all['FECHA_INMUNIZACION'] <= fecha_corte]
    df_all = df_all.sort_values('FECHA_INMUNIZACION').drop_duplicates(subset=['RUN_NORM', 'VACUNA_GRUPO', 'DOSIS', 'FECHA_INMUNIZACION'], keep='last')
    
    defunciones_files = glob.glob(os.path.join(BASE_DIR, '**', 'DEF*.csv'), recursive=True)
    defunciones = set()
    for f in defunciones_files:
        try:
            df = pd.read_csv(f, sep='|', encoding='latin-1', dtype=str, usecols=lambda c: 'RUN' in c)
            run_col = next((c for c in df.columns if 'RUN' in c.upper()), None)
            if run_col:
                df['RUN_NORM'] = df[run_col].apply(normalize_run)
                defunciones.update(df['RUN_NORM'].dropna().unique())
        except: pass

    df_all = df_all[df_all['VACUNA_GRUPO'] != 'PCV10']
    df_all = df_all.sort_values(['RUN_NORM', 'VACUNA_GRUPO', 'FECHA_INMUNIZACION'])
    
    resultados = []
    
    # Track Hexa 3ra errors specifically
    hexa3_errors = []
    
    for (run, vacuna), group in df_all.groupby(['RUN_NORM', 'VACUNA_GRUPO']):
        is_fallecido = run in defunciones
        nacimiento = group['FECHA_NACIMIENTO'].dropna().max() if 'FECHA_NACIMIENTO' in group.columns else pd.NaT
        
        dosis_map = {}
        alias_map = {}
        for _, row in group.iterrows():
            d_str = str(row['DOSIS']).lower()
            if '1' in d_str and 'refuerzo' not in d_str: d_num = 1
            elif '2' in d_str and 'refuerzo' not in d_str: d_num = 2
            elif '3' in d_str and 'refuerzo' not in d_str: d_num = 3
            else: continue
            
            if d_num not in dosis_map or row['FECHA_INMUNIZACION'] > dosis_map[d_num]['FECHA_INMUNIZACION']:
                dosis_map[d_num] = row
                alias_map[d_num] = row['ALIAS_ORIGINAL']
        
        def calc_exigible(nac_m, min_prev, min_m=None, min_d=None):
            if pd.isna(nacimiento) or pd.isna(min_prev): return pd.NaT
            prog_date = nacimiento + relativedelta(months=nac_m)
            m_date = min_prev + pd.Timedelta(days=min_d) if min_d else min_prev + relativedelta(months=min_m)
            return max(prog_date, m_date)

        # Helper to record result
        def rec(mod, estado, prev_dosis=pd.NaT, alias=""):
            resultados.append({
                'RUN': run, 'MODULO': mod, 'ESTADO': 'FALLECIDO' if is_fallecido and estado != 'ESQUEMA AL DÍA' else estado,
                'NACIMIENTO': nacimiento, 'FECHA_PREV': prev_dosis, 'ALIAS': alias, 
                'IS_FALLECIDO': is_fallecido
            })

        if vacuna == 'Hexavalente':
            # Rescate 3ra
            if 2 in dosis_map:
                prev = dosis_map[2]['FECHA_INMUNIZACION']
                ex = calc_exigible(6, prev, min_m=1)
                estado = 'AÚN NO CORRESPONDE'
                if 1 not in dosis_map: 
                    estado = 'ERROR DE SECUENCIA'
                    hexa3_errors.append({'RUN': run, 'RASON': 'Falta 1ra Dosis', 'DOSIS_REGISTRADA': '2da', 'FECHA': prev.strftime('%Y')})
                elif dosis_map[1]['FECHA_INMUNIZACION'] > prev: 
                    estado = 'ERROR DE SECUENCIA'
                    hexa3_errors.append({'RUN': run, 'RASON': '1ra > 2da', 'DOSIS_REGISTRADA': '1ra y 2da', 'FECHA': prev.strftime('%Y')})
                elif 3 in dosis_map:
                    if dosis_map[3]['FECHA_INMUNIZACION'] < prev: 
                        estado = 'ERROR DE SECUENCIA'
                        hexa3_errors.append({'RUN': run, 'RASON': '3ra < 2da', 'DOSIS_REGISTRADA': '3ra', 'FECHA': dosis_map[3]['FECHA_INMUNIZACION'].strftime('%Y')})
                    else: estado = 'ESQUEMA AL DÍA'
                elif ex <= fecha_corte: estado = 'RESCATE ACTIVO'
                rec('Hexavalente 3.ª', estado, prev)

        elif vacuna == 'Meningococica B':
            if 1 in dosis_map:
                prev = dosis_map[1]['FECHA_INMUNIZACION']
                ex = calc_exigible(4, prev, min_m=2)
                estado = 'AÚN NO CORRESPONDE'
                if 2 in dosis_map:
                    if dosis_map[2]['FECHA_INMUNIZACION'] < prev: estado = 'ERROR DE SECUENCIA'
                    else: estado = 'ESQUEMA AL DÍA'
                elif ex <= fecha_corte: estado = 'RESCATE ACTIVO'
                rec('Meningocócica B 2.ª', estado, prev, alias_map[1])

        elif vacuna == 'SRP':
            if 1 in dosis_map:
                prev = dosis_map[1]['FECHA_INMUNIZACION']
                ex = calc_exigible(36, prev, min_d=28)
                estado = 'AÚN NO CORRESPONDE'
                if 2 in dosis_map:
                    if dosis_map[2]['FECHA_INMUNIZACION'] < prev: estado = 'ERROR DE SECUENCIA'
                    else: estado = 'ESQUEMA AL DÍA'
                elif ex <= fecha_corte: estado = 'RESCATE ACTIVO'
                rec('SRP 2.ª', estado, prev)
                
        elif vacuna == 'Varicela':
            if 1 in dosis_map:
                prev = dosis_map[1]['FECHA_INMUNIZACION']
                ex = calc_exigible(36, prev, min_m=3)
                estado = 'AÚN NO CORRESPONDE'
                if 2 in dosis_map:
                    if dosis_map[2]['FECHA_INMUNIZACION'] < prev: estado = 'ERROR DE SECUENCIA'
                    else: estado = 'ESQUEMA AL DÍA'
                elif ex <= fecha_corte: estado = 'RESCATE ACTIVO'
                rec('Varicela 2.ª', estado, prev)

    df_res = pd.DataFrame(resultados)
    
    print(f"=== REPORTE DE AUDITORÍA ===\n")
    print(f"PCV10 Original Count: {pcv10_raw_count}")
    print(f"PCV10 Excluidas o Eliminadas durante filtros:")
    for m in pcv10_dropped: print(f"  - {m}")
    
    print("\n--- MENINGOCÓCICA B 2.ª (RESCATE ACTIVO) ---")
    mb_res = df_res[(df_res['MODULO'] == 'Meningocócica B 2.ª') & (df_res['ESTADO'] == 'RESCATE ACTIVO')].copy()
    mb_res['COHORTE'] = mb_res['NACIMIENTO'].apply(lambda x: 'Desde 01-05-2023' if x >= pd.to_datetime('2023-05-01') else 'Antes 01-05-2023')
    print(mb_res['COHORTE'].value_counts().to_string())
    print("Por Alias:")
    print(mb_res['ALIAS'].value_counts().to_string())
    
    print("\n--- SRP 2.ª (RESCATE ACTIVO) ---")
    srp_res = df_res[(df_res['MODULO'] == 'SRP 2.ª') & (df_res['ESTADO'] == 'RESCATE ACTIVO')].copy()
    srp_res['AÑO_NAC'] = srp_res['NACIMIENTO'].dt.year
    srp_res['EDAD_CORT'] = ((fecha_corte - srp_res['NACIMIENTO']).dt.days / 365.25).astype(int, errors='ignore')
    srp_res['AÑO_1RA'] = srp_res['FECHA_PREV'].dt.year
    print("Años Nacimiento:")
    print(srp_res['AÑO_NAC'].value_counts().head(5).to_string())
    print("Años 1ra Dosis:")
    print(srp_res['AÑO_1RA'].value_counts().head(5).to_string())
    
    print("\n--- VARICELA 2.ª (RESCATE ACTIVO) ---")
    var_res = df_res[(df_res['MODULO'] == 'Varicela 2.ª') & (df_res['ESTADO'] == 'RESCATE ACTIVO')].copy()
    var_res['COHORTE'] = var_res['NACIMIENTO'].apply(lambda x: 'Desde 01-01-2019' if x >= pd.to_datetime('2019-01-01') else 'Antes 01-01-2019')
    print(var_res['COHORTE'].value_counts().to_string())
    
    print("\n--- HEXAVALENTE 3.ª ERROR DE SECUENCIA ---")
    df_hexa = pd.DataFrame(hexa3_errors)
    print("Motivos de Error:")
    print(df_hexa['RASON'].value_counts().to_string())
    print("Años de vacunación involucrados:")
    print(df_hexa['FECHA'].value_counts().head(5).to_string())
    
    print("\n--- FALLECIDOS ---")
    print(f"Total fallecidos asumiendo módulo ESQUEMA AL DIA excluido: {df_res[df_res['ESTADO'] == 'FALLECIDO'].shape[0]}")
    print(df_res[df_res['ESTADO'] == 'FALLECIDO']['MODULO'].value_counts().to_string())
    
    # Comunas territory
    print("\n--- TERRITORIO (Población Total) ---")
    print("El script actual procesó TODO EL PAÍS contenido en los CSV (no hay filtro regional ni comunal aplicado).")

if __name__ == '__main__':
    audit()
