import pandas as pd
import glob
import os
import logging
from datetime import datetime
from dateutil.relativedelta import relativedelta
import json
import unicodedata

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
BASE_DIR = r"c:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL"
OUTPUT_DIR = r"c:\Antigravity IDE\WEB DEIS\Programáticas_Web"
CSV_PRIVADO = r"c:\Antigravity IDE\WEB DEIS\Programáticas_Web\rescates_privado_v5.csv"

COMUNAS_SSO = ["OSORNO", "RIO NEGRO", "PURRANQUE", "SAN PABLO", "SAN JUAN DE LA COSTA", "PUERTO OCTAY", "PUYEHUE"]

def extract_cuerpo(run):
    if pd.isna(run): return ""
    s = str(run).upper().replace('.', '').replace(' ', '').replace('-', '').strip()
    if s.endswith('.0'): s = s[:-2]
    s = s.lstrip('0')
    return s

def normalize_comuna(c):
    if pd.isna(c): return ""
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
    defunciones = {}
    for f in sorted(files):
        try:
            df = pd.read_csv(f, sep='|', encoding='latin-1', dtype=str)
            run_col = next((c for c in df.columns if 'RUN' in c.upper() or 'RUT' in c.upper()), None)
            if run_col:
                df = df.dropna(subset=[run_col])
                if df.empty: continue
                # Vectorize extraction
                df['RUN_C'] = df[run_col].apply(extract_cuerpo)
                df = df[df['RUN_C'].astype(bool)]
                
                # Combine dates
                if 'ANO_DEF' in df.columns and 'MES_DEF' in df.columns and 'DIA_DEF' in df.columns:
                    df['ANO'] = df['ANO_DEF'].fillna('').astype(str).str.strip()
                    df['MES'] = df['MES_DEF'].fillna('').astype(str).str.strip().str.zfill(2)
                    df['DIA'] = df['DIA_DEF'].fillna('').astype(str).str.strip().str.zfill(2)
                    # Solo donde año no esté vacio
                    mask = df['ANO'] != ''
                    df.loc[mask, 'FECHA'] = df.loc[mask, 'ANO'] + '-' + df.loc[mask, 'MES'] + '-' + df.loc[mask, 'DIA']
                    df.loc[~mask, 'FECHA'] = ''
                else:
                    df['FECHA'] = ''
                    
                # Convert to dict
                new_dict = dict(zip(df['RUN_C'], df['FECHA']))
                defunciones.update(new_dict)
        except Exception as e:
            logging.error(f"Error procesando {f}: {e}")
    return defunciones

def load_bases():
    files = glob.glob(os.path.join(BASE_DIR, '**', 'Programáticas_*2026*.csv'), recursive=True)
    chunks_ocu = []
    chunks_res = []
    max_oc = pd.NaT
    max_res = pd.NaT
    
    for f in files:
        try:
            cols = pd.read_csv(f, sep='|', encoding='latin-1', nrows=0).columns.tolist()
            use_cols = [c for c in cols if c in ['RUN', 'NOMBRE_VACUNA', 'DOSIS', 'FECHA_INMUNIZACION', 'ESTABLECIMIENTO', 'FECHA_NACIMIENTO', 'VACUNA_ADMINISTRADA', 'REGISTRO_ELIMINADO', 'COMUNA_OCURR', 'NOMBRES', 'APELLIDO_PATERNO', 'APELLIDO_MATERNO']]
            df = pd.read_csv(f, sep='|', encoding='latin-1', dtype=str, usecols=use_cols)
            
            # Combinar nombres
            nombres = df['NOMBRES'].fillna('') if 'NOMBRES' in df.columns else ''
            ape_pat = df['APELLIDO_PATERNO'].fillna('') if 'APELLIDO_PATERNO' in df.columns else ''
            ape_mat = df['APELLIDO_MATERNO'].fillna('') if 'APELLIDO_MATERNO' in df.columns else ''
            df['NOMBRE_COMPLETO'] = (nombres + ' ' + ape_pat + ' ' + ape_mat).str.strip()
            
            if 'VACUNA_ADMINISTRADA' in df.columns: df = df[df['VACUNA_ADMINISTRADA'].astype(str).str.strip().str.upper() == 'SI']
            if 'REGISTRO_ELIMINADO' in df.columns: df = df[df['REGISTRO_ELIMINADO'].astype(str).str.strip().str.upper() != 'SI']
            if 'DOSIS' in df.columns: df = df[df['DOSIS'].astype(str).str.strip().str.upper() != 'EPRO']
            
            df = df.dropna(subset=['RUN', 'NOMBRE_VACUNA', 'FECHA_INMUNIZACION'])
            df['RUN_CUERPO'] = df['RUN'].apply(lambda x: extract_cuerpo(x)[:-1] if len(extract_cuerpo(x))>1 else extract_cuerpo(x))
            df['VACUNA_GRUPO'] = df['NOMBRE_VACUNA'].apply(get_vaccine_group)
            df = df[df['VACUNA_GRUPO'].notna()].copy()
            if df.empty: continue
            
            df['FECHA_INMUNIZACION'] = pd.to_datetime(df['FECHA_INMUNIZACION'], format='%Y-%m-%d', errors='coerce')
            df['FECHA_NACIMIENTO'] = pd.to_datetime(df['FECHA_NACIMIENTO'], format='%Y-%m-%d', errors='coerce')
            df['COMUNA_OCURR_NORM'] = df['COMUNA_OCURR'].apply(normalize_comuna) if 'COMUNA_OCURR' in df.columns else ""
            
            # Extract DOSIS NUM
            def get_dnum(d):
                d = str(d).lower()
                if 'refuerzo' in d: return 'REF'
                elif '1' in d: return 1
                elif '2' in d: return 2
                elif '3' in d: return 3
                return None
            df['DOSIS_NUM'] = df['DOSIS'].apply(get_dnum)
            df = df.dropna(subset=['FECHA_INMUNIZACION'])
            
            if 'Ocurrencia' in f:
                c_max = df['FECHA_INMUNIZACION'].max()
                if pd.isna(max_oc) or c_max > max_oc: max_oc = c_max
                chunks_ocu.append(df)
            else:
                c_max = df['FECHA_INMUNIZACION'].max()
                if pd.isna(max_res) or c_max > max_res: max_res = c_max
                chunks_res.append(df)
        except Exception as e:
            logging.error(f"Error procesando {f}: {e}")
            
    df_ocu = pd.concat(chunks_ocu, ignore_index=True) if chunks_ocu else pd.DataFrame()
    df_res = pd.concat(chunks_res, ignore_index=True) if chunks_res else pd.DataFrame()
    return df_ocu, df_res, max_oc, max_res

def get_age_months(birth, target):
    if pd.isna(birth) or pd.isna(target): return None
    return (target.year - birth.year) * 12 + target.month - birth.month

def get_age_years(birth, target):
    if pd.isna(birth) or pd.isna(target): return None
    return relativedelta(target, birth).years

def main():
    logging.info("Extrayendo Defunciones...")
    defunciones = extract_defunciones()
    
    logging.info("Extrayendo Bases Programaticas...")
    df_ocu_full, df_res_full, max_oc, max_res = load_bases()
    if df_ocu_full.empty: return
    
    fecha_corte = min(max_oc, max_res) if not pd.isna(max_oc) and not pd.isna(max_res) else pd.to_datetime('2026-09-11')
    logging.info(f"Corte: {fecha_corte}")
    
    # Sort and deduplicate properly retaining the earliest record for the same dose
    df_ocu = df_ocu_full[df_ocu_full['FECHA_INMUNIZACION'] <= fecha_corte].sort_values('FECHA_INMUNIZACION').drop_duplicates(subset=['RUN_CUERPO', 'VACUNA_GRUPO', 'DOSIS_NUM'], keep='first')
    df_res = df_res_full[df_res_full['FECHA_INMUNIZACION'] <= fecha_corte].sort_values('FECHA_INMUNIZACION').drop_duplicates(subset=['RUN_CUERPO', 'VACUNA_GRUPO', 'DOSIS_NUM'], keep='first')
    
    df_ocu = df_ocu[df_ocu['VACUNA_GRUPO'] != 'PCV10']
    df_res = df_res[df_res['VACUNA_GRUPO'] != 'PCV10']
    
    # UNIVERSO_RESIDENTES_REGION_10
    universo_residentes = set(df_res_full['RUN_CUERPO'].unique())
    
    # Para optimizar la búsqueda de dosis siguiente en Residencia
    res_lookup = df_res.set_index(['RUN_CUERPO', 'VACUNA_GRUPO', 'DOSIS_NUM'])
    
    resultados = []
    
    # Modulos a evaluar y sus dosis antecedentes
    # (MODULO, GRUPO_VACUNA, DOSIS_ANTECEDENTE)
    modulos = [
        ('Hexavalente 2.ª', 'Hexavalente', 1),
        ('Hexavalente 3.ª', 'Hexavalente', 2),
        ('Neumocócica 2.ª', 'Neumococica', 1),
        ('Meningocócica B 2.ª', 'Meningococica B', 1),
        ('SRP 2.ª', 'SRP', 1),
        ('Varicela 2.ª', 'Varicela', 1)
    ]
    
    for mod, grupo, dosis_ant in modulos:
        # Cohorte Inicial Ocurrencia: filtramos por vacuna, dosis, y comunas SSO
        cohorte = df_ocu[(df_ocu['VACUNA_GRUPO'] == grupo) & (df_ocu['DOSIS_NUM'] == dosis_ant) & (df_ocu['COMUNA_OCURR_NORM'].isin(COMUNAS_SSO))]
        
        for _, row in cohorte.iterrows():
            run_c = row['RUN_CUERPO']
            nac = row['FECHA_NACIMIENTO']
            f_ant = row['FECHA_INMUNIZACION']
            est_resp = row['ESTABLECIMIENTO']
            comuna_oc = row['COMUNA_OCURR_NORM']
            run_raw = row['RUN']
            
            estado_final = None
            f_exigible = pd.NaT
            f_programatica = pd.NaT
            f_minima = pd.NaT
            next_dose = None
            f_siguiente = pd.NaT
            
            is_residente = 'SI' if run_c in universo_residentes else 'NO'
            
            if is_residente == 'NO':
                estado_final = 'SIN_EVIDENCIA_RESIDENCIA_REGION_10'
            else:
                # Validaciones por vacuna y calculo de FECHA_EXIGIBLE
                if mod == 'Hexavalente 2.ª':
                    edad_anios = get_age_years(nac, fecha_corte)
                    if edad_anios is not None and edad_anios >= 7: estado_final = 'FUERA_COHORTE_EDAD'
                    else:
                        f_programatica = nac + relativedelta(months=4)
                        f_minima = f_ant + relativedelta(months=1)
                        f_exigible = max(f_programatica, f_minima)
                        next_dose = 2
                        
                elif mod == 'Hexavalente 3.ª':
                    edad_anios = get_age_years(nac, fecha_corte)
                    if edad_anios is not None and edad_anios >= 7: estado_final = 'FUERA_COHORTE_EDAD'
                    else:
                        f_programatica = nac + relativedelta(months=6)
                        f_minima = f_ant + relativedelta(months=1)
                        f_exigible = max(f_programatica, f_minima)
                        next_dose = 3
                        
                elif mod == 'Neumocócica 2.ª':
                    start_months = get_age_months(nac, f_ant)
                    if start_months is None: estado_final = 'FUERA_COHORTE_EDAD'
                    elif start_months < 7:
                        f_programatica = nac + relativedelta(months=4)
                        f_minima = f_ant + relativedelta(months=1)
                        f_exigible = max(f_programatica, f_minima)
                        next_dose = 2
                    elif 7 <= start_months <= 11:
                        f_programatica = nac + relativedelta(months=12)
                        f_minima = f_ant + relativedelta(months=2)
                        f_exigible = max(f_programatica, f_minima)
                        next_dose = 'REF'
                    elif 12 <= start_months <= 23:
                        f_exigible = f_ant + relativedelta(months=2)
                        next_dose = 2
                    else:
                        estado_final = 'ESQUEMA_AL_DIA' # ya completo con 1 dosis
                        
                elif mod == 'Meningocócica B 2.ª':
                    if pd.isna(nac) or nac < pd.to_datetime('2023-05-01'): estado_final = 'FUERA_COHORTE_EDAD'
                    else:
                        start_months = get_age_months(nac, f_ant)
                        if start_months is None: estado_final = 'FUERA_COHORTE_EDAD'
                        elif start_months < 24:
                            f_programatica = nac + relativedelta(months=4)
                            f_minima = f_ant + relativedelta(months=2)
                            f_exigible = max(f_programatica, f_minima)
                            next_dose = 2
                        elif 24 <= start_months <= 59:
                            f_exigible = f_ant + relativedelta(months=1)
                            next_dose = 2
                        else: estado_final = 'FUERA_COHORTE_EDAD'
                        
                elif mod == 'SRP 2.ª':
                    if pd.isna(nac) or nac < pd.to_datetime('2019-04-01') or nac > (fecha_corte - relativedelta(months=13)):
                        estado_final = 'FUERA_COHORTE_EDAD'
                    else:
                        f_programatica = nac + relativedelta(months=36)
                        f_minima = f_ant + pd.Timedelta(days=28)
                        f_exigible = max(f_programatica, f_minima)
                        next_dose = 2
                        
                elif mod == 'Varicela 2.ª':
                    if pd.isna(nac) or nac < pd.to_datetime('2019-01-01'):
                        estado_final = 'FUERA_COHORTE_EDAD'
                    else:
                        f_programatica = nac + relativedelta(months=36)
                        f_minima = f_ant + relativedelta(months=3)
                        f_exigible = max(f_programatica, f_minima)
                        next_dose = 2
                        
                # Flujo de verificacion
                if estado_final is None and next_dose is not None:
                    idx = (run_c, grupo, next_dose)
                    if idx in res_lookup.index:
                        f_siguiente = res_lookup.loc[idx, 'FECHA_INMUNIZACION']
                        if type(f_siguiente) == pd.Series: f_siguiente = f_siguiente.iloc[0]
                        
                        if f_siguiente < f_ant:
                            estado_final = 'ERROR_SECUENCIA_REGISTRO'
                        else:
                            estado_final = 'ESQUEMA_AL_DIA'
                    
                    if estado_final is None:
                        # Dosis no encontrada
                        if fecha_corte < f_exigible:
                            estado_final = 'AUN_NO_CORRESPONDE'
                        else:
                            if run_c in defunciones:
                                estado_final = 'FALLECIDO'
                            else:
                                estado_final = 'RESCATE_ACTIVO'
                                
            dias_atraso = 0
            if not pd.isna(f_exigible):
                dias_atraso = (fecha_corte - f_exigible).days
                if dias_atraso < 0: dias_atraso = 0
                
            resultados.append({
                'RUN': run_raw,
                'NOMBRE_COMPLETO': row.get('NOMBRE_COMPLETO', ''),
                'RUN_CUERPO': run_c,
                'FECHA_NACIMIENTO': nac.strftime('%Y-%m-%d') if not pd.isna(nac) else '',
                'VACUNA': mod,
                'DOSIS_ANTECEDENTE': dosis_ant,
                'FECHA_DOSIS_ANTECEDENTE': f_ant.strftime('%Y-%m-%d') if not pd.isna(f_ant) else '',
                'ESTABLECIMIENTO_RESPONSABLE': est_resp,
                'COMUNA_OCURRENCIA': comuna_oc,
                'FECHA_PROGRAMATICA': f_programatica.strftime('%Y-%m-%d') if not pd.isna(f_programatica) else '',
                'FECHA_MINIMA_INTERVALO': f_minima.strftime('%Y-%m-%d') if not pd.isna(f_minima) else '',
                'FECHA_EXIGIBLE': f_exigible.strftime('%Y-%m-%d') if not pd.isna(f_exigible) else '',
                'FECHA_CORTE_EVALUACION': fecha_corte.strftime('%Y-%m-%d'),
                'DIAS_DESDE_EXIGIBILIDAD': dias_atraso,
                'DOSIS_SIGUIENTE_ENCONTRADA': 'SI' if not pd.isna(f_siguiente) else 'NO',
                'FECHA_DOSIS_SIGUIENTE': f_siguiente.strftime('%Y-%m-%d') if not pd.isna(f_siguiente) else '',
                'RESIDENTE_REGION_10': is_residente,
                'FALLECIDO': 'SI' if run_c in defunciones else 'NO',
                'FECHA_DEFUNCION': defunciones.get(run_c, '') if run_c in defunciones else '',
                'ESTADO_FINAL': estado_final
            })
            
    df_res = pd.DataFrame(resultados)
    
    # Save private CSV explicitly outside web ecosystem
    os.makedirs(os.path.dirname(r"c:\Antigravity IDE\WEB DEIS\PRIVADO\rescates_privado_v5.csv"), exist_ok=True)
    df_res.to_csv(r"c:\Antigravity IDE\WEB DEIS\PRIVADO\rescates_privado_v5.csv", index=False, encoding='utf-8')
    
    # JSON Agregado
    json_data = {
        'fecha_corte_evaluacion': fecha_corte.strftime('%d-%m-%Y'),
        'base_procesada': datetime.now().strftime('%d-%m-%Y %H:%M:%S')
    }
    
    for mod, _, _ in modulos:
        sub = df_res[df_res['VACUNA'] == mod]
        mod_dict = {
            'totales': {
                'COHORTE_INICIAL': len(sub),
                'CONFIRMADOS_R10': len(sub[sub['RESIDENTE_REGION_10'] == 'SI']),
                'SIN_EVIDENCIA_R10': len(sub[sub['RESIDENTE_REGION_10'] == 'NO'])
            },
            'comunas': {}
        }
        
        for (com, est), group in sub.groupby(['COMUNA_OCURRENCIA', 'ESTABLECIMIENTO_RESPONSABLE']):
            if pd.isna(com) or com == "": continue
            if com not in mod_dict['comunas']: mod_dict['comunas'][com] = {}
            
            rescates_group = group[group['ESTADO_FINAL'] == 'RESCATE_ACTIVO']
            dias_list = rescates_group['DIAS_DESDE_EXIGIBILIDAD'].tolist()
            
            b_1_30 = len([d for d in dias_list if 1 <= d <= 30])
            b_31_90 = len([d for d in dias_list if 31 <= d <= 90])
            b_91_180 = len([d for d in dias_list if 91 <= d <= 180])
            b_181_365 = len([d for d in dias_list if 181 <= d <= 365])
            b_365_plus = len([d for d in dias_list if d > 365])
            suma_dias = sum(dias_list)
            
            mod_dict['comunas'][com][est] = {
                'RESCATE_ACTIVO': len(rescates_group),
                'AUN_NO_CORRESPONDE': len(group[group['ESTADO_FINAL'] == 'AUN_NO_CORRESPONDE']),
                'ESQUEMA_AL_DIA': len(group[group['ESTADO_FINAL'] == 'ESQUEMA_AL_DIA']),
                'FALLECIDO': len(group[group['ESTADO_FINAL'] == 'FALLECIDO']),
                'SIN_EVIDENCIA_RESIDENCIA': len(group[group['ESTADO_FINAL'] == 'SIN_EVIDENCIA_RESIDENCIA_REGION_10']),
                'FUERA_COHORTE_EDAD': len(group[group['ESTADO_FINAL'] == 'FUERA_COHORTE_EDAD']),
                'ERROR_SECUENCIA': len(group[group['ESTADO_FINAL'] == 'ERROR_SECUENCIA_REGISTRO']),
                'SUMA_DIAS_ATRASO': suma_dias,
                'CUBETAS_ATRASO': {
                    'b_1_30': b_1_30,
                    'b_31_90': b_31_90,
                    'b_91_180': b_91_180,
                    'b_181_365': b_181_365,
                    'b_mas_365': b_365_plus
                }
            }
        json_data[mod] = mod_dict
        
    out_js = os.path.join(OUTPUT_DIR, 'programaticas_rescates_v5.js')
    with open(out_js, 'w', encoding='utf-8') as f:
        f.write("const rescatesDataV5 = ")
        json.dump(json_data, f, ensure_ascii=False, indent=2)
        f.write(";")

    # QA Printouts
    print(f"Total Residentes Región 10 únicos: {len(universo_residentes)}")
    for mod, _, _ in modulos:
        sub = df_res[df_res['VACUNA'] == mod]
        evidencia = len(sub[sub['RESIDENTE_REGION_10'] == 'SI'])
        sin_evidencia = len(sub[sub['RESIDENTE_REGION_10'] == 'NO'])
        aldia = len(sub[sub['ESTADO_FINAL'] == 'ESQUEMA_AL_DIA'])
        aun_no = len(sub[sub['ESTADO_FINAL'] == 'AUN_NO_CORRESPONDE'])
        fallecidos = len(sub[sub['ESTADO_FINAL'] == 'FALLECIDO'])
        rescates = len(sub[sub['ESTADO_FINAL'] == 'RESCATE_ACTIVO'])
        
        candidatos = fallecidos + rescates
        
        print(f"\n--- {mod} ---")
        print(f"A. Cohorte inicial (Ocurrencia): {len(sub)}")
        print(f"B. Evidencia Residencia Reg 10: {evidencia} (Sin evidencia: {sin_evidencia})")
        print(f"C. Dosis posterior (Al Día): {aldia}")
        print(f"D. Aún no corresponde: {aun_no}")
        print(f"E. Candidatos a rescate: {candidatos}")
        print(f"F. Fallecidos: {fallecidos}")
        print(f"G. RESCATE ACTIVO FINAL: {rescates}")
        
    print("\nAuditoria completada. CSV privado generado.")

    # ----------------------------------------------------
    # GENERATE NOMINAL ENCRYPTED EXCEL FILES FOR DASHBOARD
    # ----------------------------------------------------
    import io
    import msoffcrypto
    import openpyxl
    
    mod_file_map = {
        'Hexavalente 2.ª': 'Hexavalente_2',
        'Hexavalente 3.ª': 'Hexavalente_3',
        'Neumocócica 2.ª': 'Neumococica_2',
        'Meningocócica B 2.ª': 'Meningococica_B_2',
        'SRP 2.ª': 'SRP_2',
        'Varicela 2.ª': 'Varicela_2'
    }
    
    logging.info("Generando archivos Excel nominales encriptados...")
    for mod, file_basename in mod_file_map.items():
        sub = df_res[df_res['VACUNA'] == mod]
        
        # Activos y Fallecidos
        activos = sub[sub['ESTADO_FINAL'] == 'RESCATE_ACTIVO']
        fallecidos = sub[sub['ESTADO_FINAL'] == 'FALLECIDO']
        
        buffer = io.BytesIO()
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            activos.to_excel(writer, sheet_name="Rescates Pendientes", index=False)
            fallecidos.to_excel(writer, sheet_name="Fallecidos", index=False)
            
        buffer.seek(0)
        
        file = msoffcrypto.OfficeFile(buffer)
        out_filename = f"Rescates_{file_basename}_Pendientes_2026.xlsx"
        out_filepath = os.path.join(OUTPUT_DIR, out_filename)
        
        with open(out_filepath, "wb") as f_out:
            file.encrypt("DEIS2026", f_out)
            
        logging.info(f"Creado: {out_filename}")
        
    logging.info("Generación de Excels completada.")

if __name__ == '__main__':
    main()
