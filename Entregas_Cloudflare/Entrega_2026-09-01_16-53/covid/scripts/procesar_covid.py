import os
import pandas as pd
import json
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Patrón para identificar establecimientos privados por nombre
PRIVADOS_PATRON = r'clinica|mutual|achs|particular|privad|isapre|mutualidad|vaxplus|cochrane'
# Códigos DEIS conocidos de establecimientos privados en la provincia
DEIS_PRIVADOS = {'201811','23-203','23-205','23-209','23-212'}

def clasificar_tipo_establecimiento(df):
    """Clasifica cada registro como 'Público' o 'Privado'. NO excluye registros."""
    mask_privado = pd.Series(False, index=df.index)
    if 'ESTABLECIMIENTO' in df.columns:
        mask_privado |= df['ESTABLECIMIENTO'].str.lower().str.contains(PRIVADOS_PATRON, na=False)
    if 'CODIGO_DEIS' in df.columns:
        mask_privado |= df['CODIGO_DEIS'].isin(DEIS_PRIVADOS)
    df['TIPO_ESTABLECIMIENTO'] = mask_privado.map({True: 'Privado', False: 'Público'})
    return df

def process_year(year, ocurrencia_file, residencia_file, metas_file, output_js):
    logging.info(f"Procesando año {year}...")
    
    # 1 & 2. Leer CSVs en chunks y Filtrar
    def read_and_filter(filepath, is_ocurrencia=True):
        chunks = []
        columna_comuna = 'COMUNA_OCURR' if is_ocurrencia else 'COMUNA_RESIDENCIA'
        comunas_osorno = ["OSORNO", "PUERTO OCTAY", "PURRANQUE", "PUYEHUE", "RÍO NEGRO", "RIO NEGRO", "SAN JUAN DE LA COSTA", "SAN PABLO"]
        total_rows = 0
        
        try:
            for chunk in pd.read_csv(filepath, sep='|', dtype=str, encoding='utf-8', chunksize=100000):
                total_rows += len(chunk)
                df = chunk
                
                try:
                    df = df[df['VACUNA_ADMINISTRADA'].str.strip().str.upper() == 'SI']
                    df = df[df['REGISTRO_ELIMINADO'].str.strip().str.upper() != 'SI']
                    df = df[df['CRITERIO_ELEGIBILIDAD'].str.strip().str.upper() != 'EPRO']
                    df = df[df['DOSIS'].str.strip().str.upper() != 'EPRO']
                    
                    if columna_comuna in df.columns:
                        df = df[df[columna_comuna].str.strip().str.upper().isin(comunas_osorno)]
                    
                    if 'EDAD_ANOS' in df.columns:
                        df['EDAD_ANOS'] = pd.to_numeric(df['EDAD_ANOS'], errors='coerce').fillna(0)
                        df['ES_MAYOR_60'] = df['EDAD_ANOS'] >= 60
                    else:
                        df['ES_MAYOR_60'] = False
                        
                    chunks.append(df)
                except KeyError as e:
                    logging.error(f"Falta una columna requerida en {filepath}: {e}")
                    raise e
                    
            if chunks:
                filtered_df = pd.concat(chunks, ignore_index=True)
                filtered_df = clasificar_tipo_establecimiento(filtered_df)
                logging.info(f"    {filepath} -> Filtrado de {total_rows} a {len(filtered_df)} registros.")
                return filtered_df
            else:
                return pd.DataFrame()
        except Exception as e:
            logging.error(f"Error general leyendo {filepath}: {e}")
            return pd.DataFrame()

    logging.info(f"  Leyendo y filtrando {ocurrencia_file}...")
    df_ocu = read_and_filter(ocurrencia_file, is_ocurrencia=True)
    logging.info(f"  Leyendo y filtrando {residencia_file}...")
    df_res = read_and_filter(residencia_file, is_ocurrencia=False)
    
    if df_ocu.empty and df_res.empty:
        logging.warning(f"No hay datos para procesar en el año {year}.")
        return
    
    # Normalizar columnas necesarias
    for df in [df_ocu, df_res]:
        df['FECHA_INMUNIZACION'] = pd.to_datetime(df['FECHA_INMUNIZACION'], errors='coerce')
        valid_dates = df['FECHA_INMUNIZACION'].notna()
        
        df['MES'] = '0'
        df.loc[valid_dates, 'MES'] = df.loc[valid_dates, 'FECHA_INMUNIZACION'].dt.month.astype(int).astype(str)
        
        df['SE'] = '0'
        # Semana Epidemiológica empieza en domingo
        df.loc[valid_dates, 'SE'] = (df.loc[valid_dates, 'FECHA_INMUNIZACION'] + pd.Timedelta(days=1)).dt.isocalendar().week.astype(int).astype(str)
        
        df['NOMBRE_VACUNA'] = df['NOMBRE_VACUNA'].fillna('Desconocida').str.strip()
        df['DOSIS'] = df['DOSIS'].fillna('Desconocida').str.strip()
        df['CRITERIO_ELEGIBILIDAD'] = df['CRITERIO_ELEGIBILIDAD'].fillna('Desconocido').str.strip()
        
        # Combinar vacuna y dosis si es necesario, pero para estandarizar:
        # Usaremos NOMBRE_VACUNA
        df['VAC_KEY'] = df['NOMBRE_VACUNA']
    
    # Obtener todas las vacunas únicas
    todas_vacunas = sorted(list(set(df_ocu['VAC_KEY'].unique()) | set(df_res['VAC_KEY'].unique())))
    
    # 3. Agrupar Ocurrencia
    logging.info("  Agrupando Ocurrencia...")
    ocu_grouped_mes = df_ocu.groupby(['COMUNA_OCURR', 'ESTABLECIMIENTO', 'TIPO_ESTABLECIMIENTO', 'CRITERIO_ELEGIBILIDAD', 'VAC_KEY', 'MES']).size().reset_index(name='count')
    ocu_grouped_se = df_ocu.groupby(['COMUNA_OCURR', 'ESTABLECIMIENTO', 'TIPO_ESTABLECIMIENTO', 'CRITERIO_ELEGIBILIDAD', 'VAC_KEY', 'SE']).size().reset_index(name='count')
    
    dict_ocu = {}
    for _, r in ocu_grouped_mes.iterrows():
        k = (r['COMUNA_OCURR'], r['ESTABLECIMIENTO'], r['TIPO_ESTABLECIMIENTO'], r['CRITERIO_ELEGIBILIDAD'])
        if k not in dict_ocu: dict_ocu[k] = {'datos_mes': {}, 'datos_se': {}, 'total': 0}
        vac, mes, cnt = r['VAC_KEY'], r['MES'], int(r['count'])
        if vac not in dict_ocu[k]['datos_mes']: dict_ocu[k]['datos_mes'][vac] = {}
        dict_ocu[k]['datos_mes'][vac][mes] = cnt
        dict_ocu[k]['total'] += cnt
        
    for _, r in ocu_grouped_se.iterrows():
        k = (r['COMUNA_OCURR'], r['ESTABLECIMIENTO'], r['TIPO_ESTABLECIMIENTO'], r['CRITERIO_ELEGIBILIDAD'])
        if k not in dict_ocu: dict_ocu[k] = {'datos_mes': {}, 'datos_se': {}, 'total': 0}
        vac, se, cnt = r['VAC_KEY'], r['SE'], int(r['count'])
        if vac not in dict_ocu[k]['datos_se']: dict_ocu[k]['datos_se'][vac] = {}
        dict_ocu[k]['datos_se'][vac][se] = cnt

    data_ocurrencia = []
    for k, v in dict_ocu.items():
        data_ocurrencia.append({
            "comuna": k[0],
            "establecimiento": k[1],
            "tipo": k[2],
            "criterio": k[3],
            "datos_mes": v['datos_mes'],
            "datos_se": v['datos_se'],
            "total": v['total']
        })
        
    # Resumen por tipo de establecimiento por comuna
    resumen_tipo = {}
    comunas_osorno = ["OSORNO", "PUERTO OCTAY", "PURRANQUE", "PUYEHUE", "RÍO NEGRO", "RIO NEGRO", "SAN JUAN DE LA COSTA", "SAN PABLO"]
    for com in comunas_osorno:
        sub_pub = df_ocu[(df_ocu['COMUNA_OCURR'] == com) & (df_ocu['TIPO_ESTABLECIMIENTO'] == 'Público')]
        sub_priv = df_ocu[(df_ocu['COMUNA_OCURR'] == com) & (df_ocu['TIPO_ESTABLECIMIENTO'] == 'Privado')]
        resumen_tipo[com] = {"publico": len(sub_pub), "privado": len(sub_priv)}

    # Listar establecimientos privados encontrados
    estab_privados = df_ocu[df_ocu['TIPO_ESTABLECIMIENTO'] == 'Privado']['ESTABLECIMIENTO'].unique().tolist()
    logging.info(f"   Establecimientos PRIVADOS encontrados ({len(estab_privados)}): {estab_privados}")

    # 4. Agrupar Residencia
    logging.info("  Agrupando Residencia...")
    res_grouped_mes = df_res.groupby(['COMUNA_RESIDENCIA', 'CRITERIO_ELEGIBILIDAD', 'ES_MAYOR_60', 'VAC_KEY', 'MES']).size().reset_index(name='count')
    res_grouped_se = df_res.groupby(['COMUNA_RESIDENCIA', 'CRITERIO_ELEGIBILIDAD', 'ES_MAYOR_60', 'VAC_KEY', 'SE']).size().reset_index(name='count')
    
    dict_res = {}
    for _, r in res_grouped_mes.iterrows():
        k = (r['COMUNA_RESIDENCIA'], r['CRITERIO_ELEGIBILIDAD'], bool(r['ES_MAYOR_60']))
        if k not in dict_res: dict_res[k] = {'datos_mes': {}, 'datos_se': {}, 'total': 0}
        vac, mes, cnt = r['VAC_KEY'], r['MES'], int(r['count'])
        if vac not in dict_res[k]['datos_mes']: dict_res[k]['datos_mes'][vac] = {}
        dict_res[k]['datos_mes'][vac][mes] = cnt
        dict_res[k]['total'] += cnt
        
    for _, r in res_grouped_se.iterrows():
        k = (r['COMUNA_RESIDENCIA'], r['CRITERIO_ELEGIBILIDAD'], bool(r['ES_MAYOR_60']))
        if k not in dict_res: dict_res[k] = {'datos_mes': {}, 'datos_se': {}, 'total': 0}
        vac, se, cnt = r['VAC_KEY'], r['SE'], int(r['count'])
        if vac not in dict_res[k]['datos_se']: dict_res[k]['datos_se'][vac] = {}
        dict_res[k]['datos_se'][vac][se] = cnt

    data_residencia = []
    for k, v in dict_res.items():
        data_residencia.append({
            "comuna": k[0],
            "criterio": k[1],
            "es_mayor_60": k[2],
            "datos_mes": v['datos_mes'],
            "datos_se": v['datos_se'],
            "total": v['total']
        })

    # 5. Metas
    logging.info(f"  Procesando Metas desde {metas_file}...")
    metas_dict = {}
    if os.path.exists(metas_file):
        try:
            # Leer excel completo (pueden ser multiples hojas)
            xls = pd.ExcelFile(metas_file)
            df_metas = pd.read_excel(xls, sheet_name=0, header=3)
            
            # buscar columna que parezca comuna
            comuna_col = None
            for col in df_metas.columns:
                if 'comuna' in str(col).lower():
                    comuna_col = col
                    break
            
            if comuna_col:
                df_metas = df_metas.dropna(subset=[comuna_col])
                # Excluir totales
                df_metas = df_metas[~df_metas[comuna_col].astype(str).str.upper().str.contains("TOTAL", na=False)]
                
                for _, row in df_metas.iterrows():
                    com = str(row[comuna_col]).strip()
                    if com not in metas_dict:
                        metas_dict[com] = {"Criterios": {}, "Poblacion_Objetivo": 0}
                    
                    try:
                        if 'TOTAL' in df_metas.columns:
                            metas_dict[com]["Poblacion_Objetivo"] = float(row['TOTAL'])
                    except:
                        pass
                    
                    for col in df_metas.columns:
                        if col != comuna_col and not str(col).startswith('Unnamed'):
                            try:
                                val = float(row[col])
                                if pd.notna(val):
                                    criterio_key = str(col)
                                    metas_dict[com]["Criterios"][criterio_key] = val
                            except:
                                pass
        except Exception as e:
            logging.error(f"    Error al leer metas: {e}")
    else:
        logging.warning(f"    Archivo de metas no encontrado: {metas_file}")
    
    # Calcular Velocidad Promedio
    logging.info("  Calculando Velocidad Promedio...")
    df_ocu_fechas = pd.to_datetime(df_ocu['FECHA_INMUNIZACION'], errors='coerce').dt.date.dropna()
    fechas_unicas = sorted(df_ocu_fechas.unique())
    business_days = [f for f in fechas_unicas if f.weekday() < 5]
    last_3_days = business_days[-3:] if len(business_days) >= 3 else business_days
    if last_3_days:
        dosis_last_3 = df_ocu_fechas.isin(last_3_days).sum()
        velocidad_promedio = int(dosis_last_3 / len(last_3_days))
    else:
        velocidad_promedio = 0

    # Extract file modification date
    try:
        mtime1 = os.path.getmtime(residencia_file)
        mtime2 = os.path.getmtime(ocurrencia_file)
        mtime = max(mtime1, mtime2)
        fecha_actualizacion = datetime.fromtimestamp(mtime).strftime("%d-%m-%Y %H:%M")
    except:
        fecha_actualizacion = datetime.now().strftime("%d-%m-%Y %H:%M")

    # 6. Crear JSON final
    final_data = {
        "fecha_actualizacion": fecha_actualizacion,
        "fuente": "COVID-19 (Ocurrencia + Residencia)",
        "headers": todas_vacunas,
        "meses_base": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        "semanas_base": list(range(1, 54)),
        "velocidad_promedio": velocidad_promedio,
        "data_ocurrencia": data_ocurrencia,
        "data_residencia": data_residencia,
        "metas": metas_dict,
        "resumen_tipo": resumen_tipo,
        "estab_privados": estab_privados
    }

    # 7. Guardar JSON
    logging.info(f"  Guardando {output_js}...")
    with open(output_js, 'w', encoding='utf-8') as f:
        json.dump(final_data, f, ensure_ascii=False, indent=2)
        
    # Guardar como JS para fallback (file:///)
    output_js_file = output_js.replace('.json', '.js')
    logging.info(f"  Guardando {output_js_file}...")
    with open(output_js_file, 'w', encoding='utf-8') as f:
        f.write(f"window.COVID_DATA_{year} = ")
        json.dump(final_data, f, ensure_ascii=False, indent=2)
        f.write(";\n")
    
    logging.info("  Hecho!")


if __name__ == '__main__':
    base_dir = r"C:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL"
    output_dir = r"C:\Antigravity IDE\WEB DEIS\Covid_Web\data"
    
    # Asegurar que el directorio de salida exista
    os.makedirs(output_dir, exist_ok=True)
    
    # 2025
    process_year(
        "2025",
        os.path.join(base_dir, "2025", "Covid_Ocurrencia_2025.csv"),
        os.path.join(base_dir, "2025", "Covid_Residencia_2025.csv"),
        os.path.join(base_dir, "2025", "COBERTURA COVID 2025 POR COMUNA_2025-11-17.xlsx"),
        os.path.join(output_dir, "covid_data_2025.json")
    )
    
    # 2026
    process_year(
        "2026",
        os.path.join(base_dir, "2026", "Covid_Ocurrencia_2026.csv"),
        os.path.join(base_dir, "2026", "Covid_Residencia_2026.csv"),
        os.path.join(base_dir, "2026", "COBERTURA COVID 2026 POR COMUNA_2026-07-22.xlsx"),
        os.path.join(output_dir, "covid_data_2026.json")
    )
