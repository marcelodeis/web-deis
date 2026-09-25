import pandas as pd
import glob
import os
import re
from datetime import datetime
import json
import logging
from dateutil.relativedelta import relativedelta

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

BASE_DIR = r"c:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL"
OUTPUT_DIR = r"c:\Antigravity IDE\WEB DEIS\Programáticas_Web"

# Helper to normalize RUN
def normalize_run(run):
    if pd.isna(run): return None
    s = str(run).upper().replace('.', '').replace(' ', '').strip()
    if '-' in s:
        parts = s.split('-')
        if len(parts) == 2:
            return parts[0] + '-' + parts[1]
    # If no dash but ends in K or digit, assume last char is DV
    if len(s) > 1:
        return s[:-1] + '-' + s[-1]
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

def process_chunk(df):
    df = df.dropna(subset=['RUN', 'NOMBRE_VACUNA'])
    df['RUN_NORM'] = df['RUN'].apply(normalize_run)
    df['VACUNA_GRUPO'] = df['NOMBRE_VACUNA'].apply(get_vaccine_group)
    df = df[df['VACUNA_GRUPO'].notna()].copy()
    return df

def extract_doses():
    files = glob.glob(os.path.join(BASE_DIR, '**', 'Programáticas_*.csv'), recursive=True)
    cols = ['RUN', 'NOMBRE_VACUNA', 'DOSIS', 'FECHA_INMUNIZACION', 'ESTABLECIMIENTO', 'COMUNA_RESIDENCIA', 'FECHA_NACIMIENTO', 'VACUNA_ADMINISTRADA', 'REGISTRO_ELIMINADO']
    
    all_chunks = []
    max_ocurrencia = pd.NaT
    max_residencia = pd.NaT
    
    for f in files:
        logging.info(f"Procesando {f}...")
        try:
            df = pd.read_csv(f, sep='|', encoding='latin-1', dtype=str, usecols=lambda c: c in cols)
            
            # Apply global filters
            if 'VACUNA_ADMINISTRADA' in df.columns:
                df = df[df['VACUNA_ADMINISTRADA'].astype(str).str.strip().str.upper() == 'SI']
            if 'REGISTRO_ELIMINADO' in df.columns:
                df = df[df['REGISTRO_ELIMINADO'].astype(str).str.strip().str.upper() != 'SI']
            
            df = process_chunk(df)
            if df.empty: continue
            
            df['FECHA_INMUNIZACION'] = pd.to_datetime(df['FECHA_INMUNIZACION'], format='%Y-%m-%d', errors='coerce')
            df['FECHA_NACIMIENTO'] = pd.to_datetime(df['FECHA_NACIMIENTO'], format='%Y-%m-%d', errors='coerce')
            
            if 'Ocurrencia' in f:
                c_max = df['FECHA_INMUNIZACION'].max()
                if pd.isna(max_ocurrencia) or c_max > max_ocurrencia: max_ocurrencia = c_max
            elif 'Residencia' in f:
                c_max = df['FECHA_INMUNIZACION'].max()
                if pd.isna(max_residencia) or c_max > max_residencia: max_residencia = c_max
            
            df['SOURCE'] = 'Ocurrencia' if 'Ocurrencia' in f else 'Residencia'
            all_chunks.append(df)
        except Exception as e:
            logging.error(f"Error procesando {f}: {e}")
            
    if not all_chunks:
        return pd.DataFrame(), pd.NaT, pd.NaT
        
    final_df = pd.concat(all_chunks, ignore_index=True)
    return final_df, max_ocurrencia, max_residencia

def get_defunciones():
    files = glob.glob(os.path.join(BASE_DIR, '**', 'DEF*.csv'), recursive=True)
    defunciones = set()
    muertes_data = {}
    
    for f in files:
        try:
            df = pd.read_csv(f, sep='|', encoding='latin-1', dtype=str, usecols=lambda c: 'RUN' in c or 'FECHA' in c or 'DEFUNCION' in c)
            
            run_col = next((c for c in df.columns if 'RUN' in c.upper()), None)
            fecha_col = next((c for c in df.columns if 'FECHA' in c.upper()), None)
            
            if run_col:
                df['RUN_NORM'] = df[run_col].apply(normalize_run)
                for _, row in df.dropna(subset=['RUN_NORM']).iterrows():
                    r = row['RUN_NORM']
                    defunciones.add(r)
                    if fecha_col and not pd.isna(row[fecha_col]):
                        muertes_data[r] = row[fecha_col]
        except Exception as e:
            pass
            
    return defunciones, muertes_data

def get_fecha_exigible(nacimiento, prev_dosis_fecha, prog_months, min_months=None, min_days=None):
    if pd.isna(nacimiento) or pd.isna(prev_dosis_fecha): return pd.NaT
    prog_date = nacimiento + relativedelta(months=prog_months)
    if min_days is not None:
        min_date = prev_dosis_fecha + pd.Timedelta(days=min_days)
    else:
        min_date = prev_dosis_fecha + relativedelta(months=min_months)
    
    return max(prog_date, min_date)

def main():
    logging.info("Extrayendo datos de vacunas...")
    df_all, f_max_ocurrencia, f_max_residencia = extract_doses()
    
    if df_all.empty:
        logging.error("No se extrajeron datos.")
        return
        
    fecha_corte = min(f_max_ocurrencia, f_max_residencia)
    logging.info(f"Fechas Máximas - Ocurrencia: {f_max_ocurrencia}, Residencia: {f_max_residencia}")
    logging.info(f"FECHA_CORTE_EVALUACION = {fecha_corte}")
    
    # Filter strictly by cut-off date
    df_all = df_all[df_all['FECHA_INMUNIZACION'] <= fecha_corte]
    
    # Deduplicate keeping sequence (RUN, VACUNA, DOSIS, FECHA).
    df_all = df_all.sort_values('FECHA_INMUNIZACION').drop_duplicates(subset=['RUN_NORM', 'VACUNA_GRUPO', 'DOSIS', 'FECHA_INMUNIZACION'], keep='last')
    
    logging.info("Cargando defunciones...")
    defunciones, defunciones_fechas = get_defunciones()
    
    # Handle PCV10 exclusion
    df_pcv10 = df_all[df_all['VACUNA_GRUPO'] == 'PCV10'].copy()
    df_pcv10['ESTADO'] = 'PCV10_EXCLUIDA_REVISION'
    df_all = df_all[df_all['VACUNA_GRUPO'] != 'PCV10']
    
    # Sort for sequence evaluation
    df_all = df_all.sort_values(['RUN_NORM', 'VACUNA_GRUPO', 'FECHA_INMUNIZACION'])
    
    resultados = []
    
    # Evaluate by RUN and Vaccine
    grouped = df_all.groupby(['RUN_NORM', 'VACUNA_GRUPO'])
    count_processed = 0
    
    for (run, vacuna), group in grouped:
        count_processed += 1
        if count_processed % 100000 == 0: logging.info(f"Evaluados {count_processed} grupos...")
        
        is_fallecido = run in defunciones
        fecha_fallecimiento = defunciones_fechas.get(run, None)
        nacimiento = group['FECHA_NACIMIENTO'].dropna().max() if 'FECHA_NACIMIENTO' in group.columns else pd.NaT
        
        # Get doses
        dosis_map = {}
        for _, row in group.iterrows():
            d_str = str(row['DOSIS']).lower()
            if '1' in d_str and 'refuerzo' not in d_str: d_num = 1
            elif '2' in d_str and 'refuerzo' not in d_str: d_num = 2
            elif '3' in d_str and 'refuerzo' not in d_str: d_num = 3
            else: continue
            
            if d_num not in dosis_map or row['FECHA_INMUNIZACION'] > dosis_map[d_num]['FECHA_INMUNIZACION']:
                dosis_map[d_num] = row
                
        # HEXAVALENTE
        if vacuna == 'Hexavalente':
            # Rescate 2da
            if 1 in dosis_map:
                row_prev = dosis_map[1]
                fecha_prev = row_prev['FECHA_INMUNIZACION']
                fecha_exigible = get_fecha_exigible(nacimiento, fecha_prev, 4, min_months=1)
                
                estado = 'AÚN NO CORRESPONDE'
                if 2 in dosis_map:
                    if dosis_map[2]['FECHA_INMUNIZACION'] < fecha_prev: estado = 'ERROR DE SECUENCIA'
                    else: estado = 'ESQUEMA AL DÍA'
                elif fecha_exigible <= fecha_corte:
                    estado = 'FALLECIDO' if is_fallecido else 'RESCATE ACTIVO'
                    
                resultados.append({
                    'RUN_NORMALIZADO': run, 'MODULO': 'Hexavalente 2.ª',
                    'DOSIS_PREVIA_IDENTIFICADA': '1.ª dosis', 'FECHA_DOSIS_PREVIA': fecha_prev.strftime('%d-%m-%Y'),
                    'FECHA_ESPERADA_SIGUIENTE_DOSIS': fecha_exigible.strftime('%d-%m-%Y') if not pd.isna(fecha_exigible) else 'ERROR',
                    'ESTADO_RESCATE': estado
                })
            
            # Rescate 3ra
            if 2 in dosis_map:
                row_prev = dosis_map[2]
                fecha_prev = row_prev['FECHA_INMUNIZACION']
                fecha_exigible = get_fecha_exigible(nacimiento, fecha_prev, 6, min_months=1)
                
                estado = 'AÚN NO CORRESPONDE'
                if 1 not in dosis_map or dosis_map[1]['FECHA_INMUNIZACION'] > fecha_prev: estado = 'ERROR DE SECUENCIA'
                elif 3 in dosis_map:
                    if dosis_map[3]['FECHA_INMUNIZACION'] < fecha_prev: estado = 'ERROR DE SECUENCIA'
                    else: estado = 'ESQUEMA AL DÍA'
                elif fecha_exigible <= fecha_corte:
                    estado = 'FALLECIDO' if is_fallecido else 'RESCATE ACTIVO'
                    
                resultados.append({
                    'RUN_NORMALIZADO': run, 'MODULO': 'Hexavalente 3.ª',
                    'DOSIS_PREVIA_IDENTIFICADA': '2.ª dosis', 'FECHA_DOSIS_PREVIA': fecha_prev.strftime('%d-%m-%Y'),
                    'FECHA_ESPERADA_SIGUIENTE_DOSIS': fecha_exigible.strftime('%d-%m-%Y') if not pd.isna(fecha_exigible) else 'ERROR',
                    'ESTADO_RESCATE': estado
                })
                
        elif vacuna == 'Neumococica':
            if 1 in dosis_map:
                row_prev = dosis_map[1]
                fecha_prev = row_prev['FECHA_INMUNIZACION']
                fecha_exigible = get_fecha_exigible(nacimiento, fecha_prev, 4, min_months=1)
                
                estado = 'AÚN NO CORRESPONDE'
                if 2 in dosis_map:
                    if dosis_map[2]['FECHA_INMUNIZACION'] < fecha_prev: estado = 'ERROR DE SECUENCIA'
                    else: estado = 'ESQUEMA AL DÍA'
                elif fecha_exigible <= fecha_corte:
                    estado = 'FALLECIDO' if is_fallecido else 'RESCATE ACTIVO'
                    
                resultados.append({
                    'RUN_NORMALIZADO': run, 'MODULO': 'Neumocócica Conjugada 2.ª',
                    'DOSIS_PREVIA_IDENTIFICADA': '1.ª dosis', 'FECHA_DOSIS_PREVIA': fecha_prev.strftime('%d-%m-%Y'),
                    'FECHA_ESPERADA_SIGUIENTE_DOSIS': fecha_exigible.strftime('%d-%m-%Y') if not pd.isna(fecha_exigible) else 'ERROR',
                    'ESTADO_RESCATE': estado
                })
                
        elif vacuna == 'Meningococica B':
            if 1 in dosis_map:
                row_prev = dosis_map[1]
                fecha_prev = row_prev['FECHA_INMUNIZACION']
                fecha_exigible = get_fecha_exigible(nacimiento, fecha_prev, 4, min_months=2)
                
                estado = 'AÚN NO CORRESPONDE'
                if 2 in dosis_map:
                    if dosis_map[2]['FECHA_INMUNIZACION'] < fecha_prev: estado = 'ERROR DE SECUENCIA'
                    else: estado = 'ESQUEMA AL DÍA'
                elif fecha_exigible <= fecha_corte:
                    estado = 'FALLECIDO' if is_fallecido else 'RESCATE ACTIVO'
                    
                resultados.append({
                    'RUN_NORMALIZADO': run, 'MODULO': 'Meningocócica B 2.ª',
                    'DOSIS_PREVIA_IDENTIFICADA': '1.ª dosis', 'FECHA_DOSIS_PREVIA': fecha_prev.strftime('%d-%m-%Y'),
                    'FECHA_ESPERADA_SIGUIENTE_DOSIS': fecha_exigible.strftime('%d-%m-%Y') if not pd.isna(fecha_exigible) else 'ERROR',
                    'ESTADO_RESCATE': estado
                })
                
        elif vacuna == 'SRP':
            if 1 in dosis_map:
                row_prev = dosis_map[1]
                fecha_prev = row_prev['FECHA_INMUNIZACION']
                fecha_exigible = get_fecha_exigible(nacimiento, fecha_prev, 36, min_days=28)
                
                estado = 'AÚN NO CORRESPONDE'
                if 2 in dosis_map:
                    if dosis_map[2]['FECHA_INMUNIZACION'] < fecha_prev: estado = 'ERROR DE SECUENCIA'
                    else: estado = 'ESQUEMA AL DÍA'
                elif fecha_exigible <= fecha_corte:
                    estado = 'FALLECIDO' if is_fallecido else 'RESCATE ACTIVO'
                    
                resultados.append({
                    'RUN_NORMALIZADO': run, 'MODULO': 'SRP 2.ª',
                    'DOSIS_PREVIA_IDENTIFICADA': '1.ª dosis', 'FECHA_DOSIS_PREVIA': fecha_prev.strftime('%d-%m-%Y'),
                    'FECHA_ESPERADA_SIGUIENTE_DOSIS': fecha_exigible.strftime('%d-%m-%Y') if not pd.isna(fecha_exigible) else 'ERROR',
                    'ESTADO_RESCATE': estado
                })
                
        elif vacuna == 'Varicela':
            if 1 in dosis_map:
                row_prev = dosis_map[1]
                fecha_prev = row_prev['FECHA_INMUNIZACION']
                fecha_exigible = get_fecha_exigible(nacimiento, fecha_prev, 36, min_months=3)
                
                estado = 'AÚN NO CORRESPONDE'
                if 2 in dosis_map:
                    if dosis_map[2]['FECHA_INMUNIZACION'] < fecha_prev: estado = 'ERROR DE SECUENCIA'
                    else: estado = 'ESQUEMA AL DÍA'
                elif fecha_exigible <= fecha_corte:
                    estado = 'FALLECIDO' if is_fallecido else 'RESCATE ACTIVO'
                    
                resultados.append({
                    'RUN_NORMALIZADO': run, 'MODULO': 'Varicela 2.ª',
                    'DOSIS_PREVIA_IDENTIFICADA': '1.ª dosis', 'FECHA_DOSIS_PREVIA': fecha_prev.strftime('%d-%m-%Y'),
                    'FECHA_ESPERADA_SIGUIENTE_DOSIS': fecha_exigible.strftime('%d-%m-%Y') if not pd.isna(fecha_exigible) else 'ERROR',
                    'ESTADO_RESCATE': estado
                })

    df_res = pd.DataFrame(resultados)
    
    metrics = {
        'fecha_max_ocurrencia': f_max_ocurrencia.strftime('%d-%m-%Y') if not pd.isna(f_max_ocurrencia) else None,
        'fecha_max_residencia': f_max_residencia.strftime('%d-%m-%Y') if not pd.isna(f_max_residencia) else None,
        'fecha_corte_evaluacion': fecha_corte.strftime('%d-%m-%Y') if not pd.isna(fecha_corte) else None,
        'base_procesada': datetime.now().strftime('%d-%m-%Y %H:%M:%S'),
        'metrics': {},
        'pcv10_count': len(df_pcv10)
    }
    
    print("=== MÉTRICAS DE CLASIFICACIÓN ===")
    for mod in df_res['MODULO'].unique():
        sub = df_res[df_res['MODULO'] == mod]
        counts = sub['ESTADO_RESCATE'].value_counts().to_dict()
        metrics['metrics'][mod] = counts
        print(f"\n[{mod}]")
        for k, v in counts.items(): print(f"  {k}: {v}")
        
        print(f"  -- 10 casos de auditoría (anonimizados) --")
        audit = sub.sample(min(10, len(sub)))
        for _, row in audit.iterrows():
            anon_run = row['RUN_NORMALIZADO'][:3] + "***" + row['RUN_NORMALIZADO'][-2:]
            print(f"    RUN: {anon_run} | Prev: {row['FECHA_DOSIS_PREVIA']} | Esp: {row['FECHA_ESPERADA_SIGUIENTE_DOSIS']} | Est: {row['ESTADO_RESCATE']}")
    
    print(f"\nPCV10 Excluidas: {len(df_pcv10)}")
    
    with open(os.path.join(OUTPUT_DIR, 'rescates_metrics.json'), 'w', encoding='utf-8') as f:
        json.dump(metrics, f, ensure_ascii=False, indent=2)

if __name__ == '__main__':
    main()
