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

def normalize_run(run):
    if pd.isna(run): return None
    s = str(run).upper().replace('.', '').replace(' ', '').strip()
    if '-' in s:
        parts = s.split('-')
        if len(parts) == 2: return parts[0] + '-' + parts[1]
    if len(s) > 1: return s[:-1] + '-' + s[-1]
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
    qa_results = []
    
    for f in sorted(files):
        try:
            df = pd.read_csv(f, sep='|', encoding='latin-1', dtype=str)
            run_col = next((c for c in df.columns if 'RUN' in c.upper() or 'RUT' in c.upper()), None)
            
            total_regs = len(df)
            valid_runs = 0
            unique_runs = 0
            
            if run_col:
                df['RUN_NORM'] = df[run_col].apply(normalize_run)
                runs = df['RUN_NORM'].dropna()
                valid_runs = len(runs)
                unique_runs = runs.nunique()
                defunciones.update(runs.unique())
                
            qa_results.append({
                'Archivo': os.path.basename(f),
                'Campo_RUN': run_col,
                'Registros': total_regs,
                'Validos': valid_runs,
                'Unicos': unique_runs
            })
        except Exception as e:
            qa_results.append({'Archivo': os.path.basename(f), 'Error': str(e)})
            
    return defunciones, qa_results

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
            df['RUN_NORM'] = df['RUN'].apply(normalize_run)
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
    defunciones, qa_def = extract_defunciones()
    
    logging.info("Extrayendo Dosis Programaticas...")
    df_all, max_oc, max_res = extract_doses()
    if df_all.empty: return
    
    fecha_corte = min(max_oc, max_res) if not pd.isna(max_oc) and not pd.isna(max_res) else pd.to_datetime('2026-09-11')
    logging.info(f"Corte: {fecha_corte}")
    
    df_all = df_all[df_all['FECHA_INMUNIZACION'] <= fecha_corte]
    df_all = df_all.sort_values('FECHA_INMUNIZACION').drop_duplicates(subset=['RUN_NORM', 'VACUNA_GRUPO', 'DOSIS', 'FECHA_INMUNIZACION'], keep='last')
    
    df_pcv10 = df_all[df_all['VACUNA_GRUPO'] == 'PCV10'].copy()
    df_all = df_all[df_all['VACUNA_GRUPO'] != 'PCV10']
    
    df_all = df_all.sort_values(['RUN_NORM', 'VACUNA_GRUPO', 'FECHA_INMUNIZACION'])
    
    # Store latest residencia per RUN
    latest_residencia = df_all.sort_values('FECHA_INMUNIZACION').drop_duplicates(subset=['RUN_NORM'], keep='last').set_index('RUN_NORM')['COMUNA_RESIDENCIA'].to_dict()
    
    # Check intersection with DEF
    inter = len(set(df_all['RUN_NORM'].unique()).intersection(defunciones))
    logging.info(f"Interseccion RUNs Vacunas vs DEF: {inter}")
    
    resultados = []
    
    for (run, vacuna), group in df_all.groupby(['RUN_NORM', 'VACUNA_GRUPO']):
        is_fallecido = run in defunciones
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
                
        def format_res(mod, estado, prev_row, alias=""):
            com_res_raw = latest_residencia.get(run, "")
            com_ocu_raw = prev_row['COMUNA_OCURR'] if 'COMUNA_OCURR' in prev_row else ""
            com_res_norm = normalize_comuna(com_res_raw)
            com_ocu_norm = normalize_comuna(com_ocu_raw)
            
            is_sso_res = com_res_norm in COMUNAS_SSO
            is_sso_ocu = com_ocu_norm in COMUNAS_SSO
            
            estado_final = 'FALLECIDO' if is_fallecido and estado != 'ESQUEMA AL DÍA' else estado
            
            # Sub-states for RESCATE_ACTIVO
            if estado_final == 'RESCATE ACTIVO':
                if is_sso_res: resultados.append(create_row(run, mod, 'RESCATE_RESIDENCIA_SSO', com_res_norm, com_ocu_norm, alias))
                if is_sso_ocu: resultados.append(create_row(run, mod, 'RESCATE_OCURRENCIA_SSO', com_res_norm, com_ocu_norm, alias))
                if not is_sso_res and not is_sso_ocu:
                    resultados.append(create_row(run, mod, 'RESCATE_FUERA_SSO', com_res_norm, com_ocu_norm, alias))
            else:
                resultados.append(create_row(run, mod, estado_final, com_res_norm, com_ocu_norm, alias))

        def create_row(run, mod, est, c_res, c_ocu, alias):
            return {'RUN': run, 'MODULO': mod, 'ESTADO': est, 'COMUNA_RESIDENCIA': c_res, 'COMUNA_OCURR': c_ocu, 'ALIAS': alias}

        if vacuna == 'Hexavalente':
            # Age limit < 7 years
            if not pd.isna(edad_anios_corte) and edad_anios_corte >= 7:
                resultados.append(create_row(run, 'Hexavalente 2.ª', 'FUERA_EDAD_HEXAVALENTE', "", "", ""))
                resultados.append(create_row(run, 'Hexavalente 3.ª', 'FUERA_EDAD_HEXAVALENTE', "", "", ""))
                continue
                
            # Hexa 2
            if 1 in dosis_map:
                prev = dosis_map[1]
                fecha_prev = prev['FECHA_INMUNIZACION']
                ex = max(nacimiento + relativedelta(months=4), fecha_prev + relativedelta(months=1))
                estado = 'AÚN NO CORRESPONDE'
                if 2 in dosis_map:
                    if dosis_map[2]['FECHA_INMUNIZACION'] < fecha_prev: estado = 'ERROR DE SECUENCIA'
                    else: estado = 'ESQUEMA AL DÍA'
                elif ex <= fecha_corte: estado = 'RESCATE ACTIVO'
                format_res('Hexavalente 2.ª', estado, prev)

            # Hexa 3
            if 2 in dosis_map:
                prev = dosis_map[2]
                fecha_prev = prev['FECHA_INMUNIZACION']
                ex = max(nacimiento + relativedelta(months=6), fecha_prev + relativedelta(months=1))
                estado = 'AÚN NO CORRESPONDE'
                if 1 not in dosis_map or dosis_map[1]['FECHA_INMUNIZACION'] > fecha_prev: estado = 'ERROR DE SECUENCIA'
                elif 3 in dosis_map:
                    if dosis_map[3]['FECHA_INMUNIZACION'] < fecha_prev: estado = 'ERROR DE SECUENCIA'
                    else: estado = 'ESQUEMA AL DÍA'
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
                        if 2 in dosis_map and dosis_map[2]['FECHA_INMUNIZACION'] >= fecha_prev: estado = 'ESQUEMA AL DÍA'
                        elif ex <= fecha_corte: estado = 'RESCATE ACTIVO'
                    elif 7 <= start_age <= 11:
                        # Expect REFUERZO after 12m, min 2m
                        ex = max(nacimiento + relativedelta(months=12), fecha_prev + relativedelta(months=2))
                        if 'REF' in dosis_map and dosis_map['REF']['FECHA_INMUNIZACION'] >= fecha_prev: estado = 'ESQUEMA AL DÍA'
                        elif ex <= fecha_corte: estado = 'RESCATE ACTIVO'
                    elif 12 <= start_age <= 23:
                        ex = fecha_prev + relativedelta(months=2)
                        if 2 in dosis_map and dosis_map[2]['FECHA_INMUNIZACION'] >= fecha_prev: estado = 'ESQUEMA AL DÍA'
                        elif ex <= fecha_corte: estado = 'RESCATE ACTIVO'
                    elif start_age >= 24:
                        estado = 'ESQUEMA AL DÍA' # Completo
                        
                format_res('Neumocócica Conjugada 2.ª', estado, prev)

        elif vacuna == 'Meningococica B':
            # Cohort check
            if not pd.isna(nacimiento) and nacimiento < pd.to_datetime('2023-05-01'):
                resultados.append(create_row(run, 'Meningocócica B 2.ª', 'FUERA_DE_COHORTE_PROGRAMATICA', "", "", ""))
                continue
                
            if 1 in dosis_map:
                prev = dosis_map[1]
                fecha_prev = prev['FECHA_INMUNIZACION']
                start_age = get_age_months(nacimiento, fecha_prev)
                
                estado = 'AÚN NO CORRESPONDE'
                if start_age is not None:
                    if start_age < 24:
                        ex = max(nacimiento + relativedelta(months=4), fecha_prev + relativedelta(months=2))
                        if 2 in dosis_map and dosis_map[2]['FECHA_INMUNIZACION'] >= fecha_prev: estado = 'ESQUEMA AL DÍA'
                        elif ex <= fecha_corte: estado = 'RESCATE ACTIVO'
                    elif 24 <= start_age <= 59:
                        ex = fecha_prev + relativedelta(months=1)
                        if 2 in dosis_map and dosis_map[2]['FECHA_INMUNIZACION'] >= fecha_prev: estado = 'ESQUEMA AL DÍA'
                        elif ex <= fecha_corte: estado = 'RESCATE ACTIVO'
                    else:
                        estado = 'FUERA_EDAD_MENINGOCÓCICA'
                        
                format_res('Meningocócica B 2.ª', estado, prev)

        elif vacuna == 'SRP':
            # Cohort check (13m to <1.o basico 2026 proxy)
            if pd.isna(nacimiento) or nacimiento < pd.to_datetime('2019-04-01') or nacimiento > (fecha_corte - relativedelta(months=13)):
                resultados.append(create_row(run, 'SRP 2.ª', 'FUERA_POBLACION_OPERATIVA_2026', "", "", ""))
                continue
                
            if 1 in dosis_map:
                prev = dosis_map[1]
                fecha_prev = prev['FECHA_INMUNIZACION']
                
                # If they have 2 valid doses, it's complete regardless of age
                if 2 in dosis_map and dosis_map[2]['FECHA_INMUNIZACION'] >= fecha_prev + pd.Timedelta(days=28):
                    estado = 'ESQUEMA AL DÍA'
                else:
                    age_at_eval = get_age_months(nacimiento, fecha_corte)
                    # Operative: either hit 36 months, OR if they are >36m, just 28 days interval
                    if age_at_eval is not None and age_at_eval >= 36:
                        ex = max(nacimiento + relativedelta(months=36), fecha_prev + pd.Timedelta(days=28))
                    else:
                        ex = max(nacimiento + relativedelta(months=36), fecha_prev + pd.Timedelta(days=28))
                        
                    estado = 'AÚN NO CORRESPONDE'
                    if ex <= fecha_corte: estado = 'RESCATE ACTIVO'
                        
                format_res('SRP 2.ª', estado, prev)
                
        elif vacuna == 'Varicela':
            if pd.isna(nacimiento) or nacimiento < pd.to_datetime('2019-01-01'):
                resultados.append(create_row(run, 'Varicela 2.ª', 'FUERA_DE_COHORTE_PROGRAMATICA', "", "", ""))
                continue
                
            if 1 in dosis_map:
                prev = dosis_map[1]
                fecha_prev = prev['FECHA_INMUNIZACION']
                ex = max(nacimiento + relativedelta(months=36), fecha_prev + relativedelta(months=3))
                
                estado = 'AÚN NO CORRESPONDE'
                if 2 in dosis_map and dosis_map[2]['FECHA_INMUNIZACION'] >= fecha_prev: estado = 'ESQUEMA AL DÍA'
                elif ex <= fecha_corte: estado = 'RESCATE ACTIVO'
                
                format_res('Varicela 2.ª', estado, prev)

    df_res = pd.DataFrame(resultados)
    
    print("\n\n=== QA FALLECIDOS (DEF) ===")
    for qa in qa_def:
        if 'Error' in qa: print(f"{qa['Archivo']}: ERROR -> {qa['Error']}")
        else: print(f"{qa['Archivo']} | Campo RUN: {qa['Campo_RUN']} | Registros: {qa['Registros']} | Validos: {qa['Validos']} | Unicos: {qa['Unicos']}")
    print(f"-> TOTAL RUNs ÚNICOS EN UNIVERSO DEF: {len(defunciones)}")
    print(f"-> Intersección con Programáticas: {inter}")
    
    print("\n\n=== REPORTE FINAL V3 ===")
    
    for mod in df_res['MODULO'].unique():
        sub = df_res[df_res['MODULO'] == mod]
        print(f"\n[{mod}]")
        print(sub['ESTADO'].value_counts().to_string())
        
        # Breakdown SSO Residencia vs Ocurrencia
        res_sso = len(sub[sub['ESTADO'] == 'RESCATE_RESIDENCIA_SSO'])
        ocu_sso = len(sub[sub['ESTADO'] == 'RESCATE_OCURRENCIA_SSO'])
        
        if res_sso > 0 or ocu_sso > 0:
            print(f"  -> Rescates Ocurrencia SSO (territorio): {ocu_sso}")
            print(f"  -> Rescates Residencia SSO (territorio): {res_sso}")
            
            # Print 5 anonymized cases of RESCATE_RESIDENCIA_SSO
            sso_cases = sub[sub['ESTADO'].isin(['RESCATE_RESIDENCIA_SSO', 'RESCATE_OCURRENCIA_SSO'])].sample(min(5, res_sso+ocu_sso))
            print("  -> Muestra casos SSO:")
            for _, r in sso_cases.iterrows():
                print(f"     RUN: {r['RUN'][:3]}*** | Tipo: {r['ESTADO']} | Comuna Res: {r['COMUNA_RESIDENCIA']} | Comuna Ocu: {r['COMUNA_OCURR']}")

if __name__ == '__main__':
    main()
