import pandas as pd
import glob
import os
import logging
from datetime import datetime
from dateutil.relativedelta import relativedelta
import json

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
BASE_DIR = r"c:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL"
OUTPUT_DIR = r"c:\Antigravity IDE\WEB DEIS\Programáticas_Web"

COMUNAS_SSO = ["OSORNO", "RIO NEGRO", "PURRANQUE", "SAN PABLO", "SAN JUAN DE LA COSTA", "PUERTO OCTAY", "PUYEHUE"]

def extract_cuerpo(run):
    if pd.isna(run): return ""
    s = str(run).upper().replace('.', '').replace(' ', '').replace('-', '').strip()
    if s.endswith('.0'): s = s[:-2]
    s = s.lstrip('0')
    return s

def normalize_comuna(c):
    if pd.isna(c): return ""
    import unicodedata
    s = str(c).upper().strip()
    s = unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode('utf-8')
    return s

def get_vaccine_group(name):
    n = str(name).lower()
    if 'hexavalente' in n: return 'Hexavalente'
    if 'neumoc' in n and 'conjugada' in n and '10v' not in n: return 'Neumococica'
    if '10v' in n: return 'PCV10'
    if 'bexsero' in n: return 'Meningococica B'
    if 'srp' in n or 'trivirica' in n: return 'SRP'
    if 'varicela' in n and 'inmunoglobulina' not in n: return 'Varicela'
    return None

def extract_defunciones():
    files = glob.glob(os.path.join(BASE_DIR, '**', 'DEF*.csv'), recursive=True)
    defunciones = set()
    
    for f in sorted(files):
        try:
            df = pd.read_csv(f, sep='|', encoding='latin-1', dtype=str)
            run_col = next((c for c in df.columns if 'RUN' in c.upper() or 'RUT' in c.upper()), None)
            
            if run_col:
                raw = df[run_col].dropna()
                for r in raw:
                    c = extract_cuerpo(r)
                    if c: defunciones.add(c)
        except Exception as e:
            pass
            
    return defunciones

def extract_doses():
    files = glob.glob(os.path.join(BASE_DIR, '**', 'Programáticas_*.csv'), recursive=True)
    all_chunks = []
    max_oc = pd.NaT
    max_res = pd.NaT
    
    for f in files:
        try:
            cols = pd.read_csv(f, sep='|', encoding='latin-1', nrows=0).columns.tolist()
            use_cols = [c for c in cols if c in ['RUN', 'NOMBRE_VACUNA', 'DOSIS', 'FECHA_INMUNIZACION', 'ESTABLECIMIENTO', 'COMUNA_RESIDENCIA', 'FECHA_NACIMIENTO', 'VACUNA_ADMINISTRADA', 'REGISTRO_ELIMINADO', 'COMUNA_OCURR']]
            
            df = pd.read_csv(f, sep='|', encoding='latin-1', dtype=str, usecols=use_cols)
            
            if 'VACUNA_ADMINISTRADA' in df.columns: df = df[df['VACUNA_ADMINISTRADA'].astype(str).str.strip().str.upper() == 'SI']
            if 'REGISTRO_ELIMINADO' in df.columns: df = df[df['REGISTRO_ELIMINADO'].astype(str).str.strip().str.upper() != 'SI']
            if 'DOSIS' in df.columns: df = df[df['DOSIS'].astype(str).str.strip().str.upper() != 'EPRO']
            
            df = df.dropna(subset=['RUN', 'NOMBRE_VACUNA'])
            # Create RUN_CUERPO for matching with DEF
            df['RUN_CUERPO'] = df['RUN'].apply(lambda x: extract_cuerpo(x)[:-1] if len(extract_cuerpo(x))>1 else extract_cuerpo(x))
            df['RUN_RAW'] = df['RUN'] # Keep original for output
            df['VACUNA_GRUPO'] = df['NOMBRE_VACUNA'].apply(get_vaccine_group)
            df = df[df['VACUNA_GRUPO'].notna()].copy()
            if df.empty: continue
            
            df['FECHA_INMUNIZACION'] = pd.to_datetime(df['FECHA_INMUNIZACION'], format='%Y-%m-%d', errors='coerce')
            df['FECHA_NACIMIENTO'] = pd.to_datetime(df['FECHA_NACIMIENTO'], format='%Y-%m-%d', errors='coerce')
            
            if 'Ocurrencia' in f:
                c_max = df['FECHA_INMUNIZACION'].max()
                if pd.isna(max_oc) or c_max > max_oc: max_oc = c_max
            else:
                c_max = df['FECHA_INMUNIZACION'].max()
                if pd.isna(max_res) or c_max > max_res: max_res = c_max
                
            all_chunks.append(df)
        except Exception as e:
            logging.error(f"Error procesando {f}: {e}")
            
    final_df = pd.concat(all_chunks, ignore_index=True) if all_chunks else pd.DataFrame()
    return final_df, max_oc, max_res

def get_age_months(birth, target):
    if pd.isna(birth) or pd.isna(target): return None
    return (target.year - birth.year) * 12 + target.month - birth.month

def get_age_years(birth, target):
    if pd.isna(birth) or pd.isna(target): return None
    return relativedelta(target, birth).years

def main():
    logging.info("Extrayendo Defunciones...")
    defunciones = extract_defunciones()
    
    logging.info("Extrayendo Dosis Programaticas...")
    df_all, max_oc, max_res = extract_doses()
    if df_all.empty: return
    
    fecha_corte = min(max_oc, max_res) if not pd.isna(max_oc) and not pd.isna(max_res) else pd.to_datetime('2026-09-11')
    logging.info(f"Corte: {fecha_corte}")
    
    df_all = df_all[df_all['FECHA_INMUNIZACION'] <= fecha_corte]
    df_all = df_all.sort_values('FECHA_INMUNIZACION').drop_duplicates(subset=['RUN_CUERPO', 'VACUNA_GRUPO', 'DOSIS', 'FECHA_INMUNIZACION'], keep='last')
    
    df_all = df_all[df_all['VACUNA_GRUPO'] != 'PCV10']
    df_all = df_all.sort_values(['RUN_CUERPO', 'VACUNA_GRUPO', 'FECHA_INMUNIZACION'])
    
    latest_residencia = df_all.sort_values('FECHA_INMUNIZACION').drop_duplicates(subset=['RUN_CUERPO'], keep='last').set_index('RUN_CUERPO')['COMUNA_RESIDENCIA'].to_dict()
    
    resultados = []
    
    # Audit tracking for deceased children
    deceased_hits = {'total_runs_prog': 0, 'res_sso': 0, 'ocu_sso': 0, 'would_be_rescate': 0, 'modules_affected': []}
    fallecidos_runs_prog = set()
    
    for (run, vacuna), group in df_all.groupby(['RUN_CUERPO', 'VACUNA_GRUPO']):
        is_fallecido = run in defunciones
        if is_fallecido: fallecidos_runs_prog.add(run)
        
        nacimiento = group['FECHA_NACIMIENTO'].dropna().max() if 'FECHA_NACIMIENTO' in group.columns else pd.NaT
        edad_anios_corte = get_age_years(nacimiento, fecha_corte)
        
        dosis_map = {}
        for _, row in group.iterrows():
            d_str = str(row['DOSIS']).lower()
            if 'refuerzo' in d_str: d_num = 'REF'
            elif '1' in d_str: d_num = 1
            elif '2' in d_str: d_num = 2
            elif '3' in d_str: d_num = 3
            else: continue
            
            if d_num not in dosis_map or row['FECHA_INMUNIZACION'] > dosis_map[d_num]['FECHA_INMUNIZACION']:
                dosis_map[d_num] = row
                
        def format_res(mod, estado, prev_row):
            com_res_raw = latest_residencia.get(run, "")
            com_ocu_raw = prev_row['COMUNA_OCURR'] if 'COMUNA_OCURR' in prev_row else ""
            com_res_norm = normalize_comuna(com_res_raw)
            com_ocu_norm = normalize_comuna(com_ocu_raw)
            
            is_sso_res = com_res_norm in COMUNAS_SSO
            is_sso_ocu = com_ocu_norm in COMUNAS_SSO
            
            # If the user is dead, and WOULD HAVE BEEN rescate, record audit info
            if is_fallecido and estado == 'RESCATE ACTIVO':
                deceased_hits['would_be_rescate'] += 1
                if is_sso_res: deceased_hits['res_sso'] += 1
                if is_sso_ocu: deceased_hits['ocu_sso'] += 1
                deceased_hits['modules_affected'].append(mod)
            
            estado_final = 'FALLECIDO' if is_fallecido else estado
            
            # Record base metrics explicitly
            resultados.append({
                'RUN': run, 'MODULO': mod, 'ESTADO_ORIGINAL': estado, 'ESTADO_FINAL': estado_final,
                'IS_SSO_RESIDENCIA': is_sso_res, 'IS_SSO_OCURRENCIA': is_sso_ocu, 'COMUNA_RESIDENCIA': com_res_norm
            })

        if vacuna == 'Hexavalente':
            if not pd.isna(edad_anios_corte) and edad_anios_corte >= 7:
                resultados.append({'RUN': run, 'MODULO': 'Hexavalente 2.ª', 'ESTADO_FINAL': 'FUERA_COHORTE_EDAD', 'IS_SSO_RESIDENCIA': False, 'IS_SSO_OCURRENCIA': False})
                resultados.append({'RUN': run, 'MODULO': 'Hexavalente 3.ª', 'ESTADO_FINAL': 'FUERA_COHORTE_EDAD', 'IS_SSO_RESIDENCIA': False, 'IS_SSO_OCURRENCIA': False})
                continue
                
            if 1 in dosis_map:
                prev = dosis_map[1]
                fecha_prev = prev['FECHA_INMUNIZACION']
                ex = max(nacimiento + relativedelta(months=4), fecha_prev + relativedelta(months=1))
                estado = 'AÚN NO CORRESPONDE'
                if 2 in dosis_map:
                    if dosis_map[2]['FECHA_INMUNIZACION'] < fecha_prev: estado = 'ERROR_SECUENCIA'
                    else: estado = 'ESQUEMA_AL_DIA'
                elif ex <= fecha_corte: estado = 'RESCATE ACTIVO'
                format_res('Hexavalente 2.ª', estado, prev)

            if 2 in dosis_map:
                prev = dosis_map[2]
                fecha_prev = prev['FECHA_INMUNIZACION']
                ex = max(nacimiento + relativedelta(months=6), fecha_prev + relativedelta(months=1))
                estado = 'AÚN NO CORRESPONDE'
                if 1 not in dosis_map or dosis_map[1]['FECHA_INMUNIZACION'] > fecha_prev: estado = 'ERROR_SECUENCIA'
                elif 3 in dosis_map:
                    if dosis_map[3]['FECHA_INMUNIZACION'] < fecha_prev: estado = 'ERROR_SECUENCIA'
                    else: estado = 'ESQUEMA_AL_DIA'
                elif ex <= fecha_corte: estado = 'RESCATE ACTIVO'
                format_res('Hexavalente 3.ª', estado, prev)

        elif vacuna == 'Neumococica':
            if 1 in dosis_map:
                prev = dosis_map[1]
                fecha_prev = prev['FECHA_INMUNIZACION']
                start_age = get_age_months(nacimiento, fecha_prev)
                
                estado = 'AÚN NO CORRESPONDE'
                if start_age is not None:
                    if start_age < 7:
                        ex = max(nacimiento + relativedelta(months=4), fecha_prev + relativedelta(months=1))
                        if 2 in dosis_map and dosis_map[2]['FECHA_INMUNIZACION'] >= fecha_prev: estado = 'ESQUEMA_AL_DIA'
                        elif ex <= fecha_corte: estado = 'RESCATE ACTIVO'
                    elif 7 <= start_age <= 11:
                        ex = max(nacimiento + relativedelta(months=12), fecha_prev + relativedelta(months=2))
                        if 'REF' in dosis_map and dosis_map['REF']['FECHA_INMUNIZACION'] >= fecha_prev: estado = 'ESQUEMA_AL_DIA'
                        elif ex <= fecha_corte: estado = 'RESCATE ACTIVO'
                    elif 12 <= start_age <= 23:
                        ex = fecha_prev + relativedelta(months=2)
                        if 2 in dosis_map and dosis_map[2]['FECHA_INMUNIZACION'] >= fecha_prev: estado = 'ESQUEMA_AL_DIA'
                        elif ex <= fecha_corte: estado = 'RESCATE ACTIVO'
                    elif start_age >= 24:
                        estado = 'ESQUEMA_AL_DIA'
                        
                format_res('Neumocócica 2.ª', estado, prev)

        elif vacuna == 'Meningococica B':
            if not pd.isna(nacimiento) and nacimiento < pd.to_datetime('2023-05-01'):
                resultados.append({'RUN': run, 'MODULO': 'Meningocócica B 2.ª', 'ESTADO_FINAL': 'FUERA_COHORTE_EDAD', 'IS_SSO_RESIDENCIA': False, 'IS_SSO_OCURRENCIA': False})
                continue
                
            if 1 in dosis_map:
                prev = dosis_map[1]
                fecha_prev = prev['FECHA_INMUNIZACION']
                start_age = get_age_months(nacimiento, fecha_prev)
                
                estado = 'AÚN NO CORRESPONDE'
                if start_age is not None:
                    if start_age < 24:
                        ex = max(nacimiento + relativedelta(months=4), fecha_prev + relativedelta(months=2))
                        if 2 in dosis_map and dosis_map[2]['FECHA_INMUNIZACION'] >= fecha_prev: estado = 'ESQUEMA_AL_DIA'
                        elif ex <= fecha_corte: estado = 'RESCATE ACTIVO'
                    elif 24 <= start_age <= 59:
                        ex = fecha_prev + relativedelta(months=1)
                        if 2 in dosis_map and dosis_map[2]['FECHA_INMUNIZACION'] >= fecha_prev: estado = 'ESQUEMA_AL_DIA'
                        elif ex <= fecha_corte: estado = 'RESCATE ACTIVO'
                    else:
                        estado = 'FUERA_COHORTE_EDAD'
                        
                format_res('Meningocócica B 2.ª', estado, prev)

        elif vacuna == 'SRP':
            if pd.isna(nacimiento) or nacimiento < pd.to_datetime('2019-04-01') or nacimiento > (fecha_corte - relativedelta(months=13)):
                resultados.append({'RUN': run, 'MODULO': 'SRP 2.ª', 'ESTADO_FINAL': 'FUERA_COHORTE_EDAD', 'IS_SSO_RESIDENCIA': False, 'IS_SSO_OCURRENCIA': False})
                continue
                
            if 1 in dosis_map:
                prev = dosis_map[1]
                fecha_prev = prev['FECHA_INMUNIZACION']
                
                if 2 in dosis_map and dosis_map[2]['FECHA_INMUNIZACION'] >= fecha_prev + pd.Timedelta(days=28):
                    estado = 'ESQUEMA_AL_DIA'
                else:
                    age_at_eval = get_age_months(nacimiento, fecha_corte)
                    if age_at_eval is not None and age_at_eval >= 36:
                        ex = max(nacimiento + relativedelta(months=36), fecha_prev + pd.Timedelta(days=28))
                    else:
                        ex = max(nacimiento + relativedelta(months=36), fecha_prev + pd.Timedelta(days=28))
                        
                    estado = 'AÚN NO CORRESPONDE'
                    if ex <= fecha_corte: estado = 'RESCATE ACTIVO'
                        
                format_res('SRP 2.ª', estado, prev)
                
        elif vacuna == 'Varicela':
            if pd.isna(nacimiento) or nacimiento < pd.to_datetime('2019-01-01'):
                resultados.append({'RUN': run, 'MODULO': 'Varicela 2.ª', 'ESTADO_FINAL': 'FUERA_COHORTE_EDAD', 'IS_SSO_RESIDENCIA': False, 'IS_SSO_OCURRENCIA': False})
                continue
                
            if 1 in dosis_map:
                prev = dosis_map[1]
                fecha_prev = prev['FECHA_INMUNIZACION']
                ex = max(nacimiento + relativedelta(months=36), fecha_prev + relativedelta(months=3))
                
                estado = 'AÚN NO CORRESPONDE'
                if 2 in dosis_map and dosis_map[2]['FECHA_INMUNIZACION'] >= fecha_prev: estado = 'ESQUEMA_AL_DIA'
                elif ex <= fecha_corte: estado = 'RESCATE ACTIVO'
                
                format_res('Varicela 2.ª', estado, prev)

    df_res = pd.DataFrame(resultados)
    
    # Calculate stats exactly as requested
    resumen = {'RESIDENCIA_SSO': {}, 'OCURRENCIA_SSO': {}}
    
    for mod in ['Neumocócica 2.ª', 'Hexavalente 2.ª', 'Hexavalente 3.ª', 'Varicela 2.ª', 'SRP 2.ª', 'Meningocócica B 2.ª']:
        sub = df_res[df_res['MODULO'] == mod]
        
        # Residencia metrics
        sub_res = sub[sub['IS_SSO_RESIDENCIA'] == True]
        resumen['RESIDENCIA_SSO'][mod] = {
            'UNIVERSO_EVALUABLE': len(sub_res),
            'ESQUEMA_AL_DIA': len(sub_res[sub_res['ESTADO_FINAL'] == 'ESQUEMA_AL_DIA']),
            'RESCATE_ACTIVO': len(sub_res[sub_res['ESTADO_FINAL'] == 'RESCATE ACTIVO']),
            'AUN_NO_CORRESPONDE': len(sub_res[sub_res['ESTADO_FINAL'] == 'AÚN NO CORRESPONDE']),
            'FALLECIDOS': len(sub_res[sub_res['ESTADO_FINAL'] == 'FALLECIDO']),
            'ERROR_SECUENCIA': len(sub_res[sub_res['ESTADO_FINAL'] == 'ERROR_SECUENCIA']),
            'FUERA_COHORTE_EDAD': len(sub_res[sub_res['ESTADO_FINAL'] == 'FUERA_COHORTE_EDAD'])
        }
        
        # Ocurrencia metrics
        sub_ocu = sub[sub['IS_SSO_OCURRENCIA'] == True]
        resumen['OCURRENCIA_SSO'][mod] = {
            'UNIVERSO_EVALUABLE': len(sub_ocu),
            'ESQUEMA_AL_DIA': len(sub_ocu[sub_ocu['ESTADO_FINAL'] == 'ESQUEMA_AL_DIA']),
            'RESCATE_ACTIVO': len(sub_ocu[sub_ocu['ESTADO_FINAL'] == 'RESCATE ACTIVO']),
            'AUN_NO_CORRESPONDE': len(sub_ocu[sub_ocu['ESTADO_FINAL'] == 'AÚN NO CORRESPONDE']),
            'FALLECIDOS': len(sub_ocu[sub_ocu['ESTADO_FINAL'] == 'FALLECIDO']),
            'ERROR_SECUENCIA': len(sub_ocu[sub_ocu['ESTADO_FINAL'] == 'ERROR_SECUENCIA']),
            'FUERA_COHORTE_EDAD': len(sub_ocu[sub_ocu['ESTADO_FINAL'] == 'FUERA_COHORTE_EDAD'])
        }
    
    # Audit info
    print("=== IMPACTO FALLECIDOS (180 RUNs Históricos) ===")
    print(f"Total RUNs fallecidos presentes en la base de vacunas: {len(fallecidos_runs_prog)}")
    print(f"Total clasificados previamente como RESCATE ACTIVO (Nacional): {deceased_hits['would_be_rescate']}")
    print(f"  -> Afectando a RESIDENCIA SSO: {deceased_hits['res_sso']}")
    print(f"  -> Afectando a OCURRENCIA SSO: {deceased_hits['ocu_sso']}")
    from collections import Counter
    print(f"  -> Módulos afectados: {dict(Counter(deceased_hits['modules_affected']))}")
    
    print("\n=== REPORTE FINAL V4 ===")
    print("\n--- RESIDENCIA_SSO ---")
    df_res_print = pd.DataFrame(resumen['RESIDENCIA_SSO']).T
    print(df_res_print.to_string())
    
    print("\n--- OCURRENCIA_SSO ---")
    df_ocu_print = pd.DataFrame(resumen['OCURRENCIA_SSO']).T
    print(df_ocu_print.to_string())

    # Build JSON Output
    json_data = {
        'fecha_corte_evaluacion': fecha_corte.strftime('%d-%m-%Y'),
        'base_procesada': datetime.now().strftime('%d-%m-%Y %H:%M:%S'),
        'ultima_comuna_residencia_registrada': "Filtro activo para Residencia_SSO",
        'fallecidos': "Excluidos del universo operativo",
        'residencia': resumen['RESIDENCIA_SSO'],
        'ocurrencia': resumen['OCURRENCIA_SSO']
    }
    with open(os.path.join(OUTPUT_DIR, 'programaticas_rescates.json'), 'w', encoding='utf-8') as f:
        json.dump(json_data, f, ensure_ascii=False, indent=2)
    print("\nJSON definitivo generado.")

if __name__ == '__main__':
    main()
