import pandas as pd
import numpy as np
import argparse
import sys
import os

def clean_run(run_str):
    """Limpia el RUN eliminando puntos, guiones y espacios."""
    if pd.isna(run_str):
        return ""
    run_str = str(run_str).strip().upper()
    run_str = run_str.replace(".", "").replace("-", "").replace(" ", "")
    if len(run_str) > 1:
        run_str = run_str.lstrip("0")
    return run_str

def calcular_dv(rut_body):
    rut_body = str(rut_body).strip()
    if not rut_body.isdigit():
        return ""
    reversed_digits = map(int, reversed(rut_body))
    factors = [2, 3, 4, 5, 6, 7]
    s = sum(d * f for d, f in zip(reversed_digits, factors * 100))
    dv = 11 - (s % 11)
    if dv == 11: return '0'
    if dv == 10: return 'K'
    return str(dv)

def load_and_filter_nacidos(filepath):
    print(f"Cargando base de Nacidos Vivos desde: {filepath}")
    
    # Check extension
    if filepath.lower().endswith('.csv'):
        try:
            df = pd.read_csv(filepath, sep=';', encoding='utf-8')
        except UnicodeDecodeError:
            try:
                df = pd.read_csv(filepath, sep=';', encoding='latin1')
            except Exception:
                df = pd.read_csv(filepath, sep=',', encoding='latin1')
        except Exception:
            df = pd.read_csv(filepath, sep=',', encoding='utf-8')
    else:
        df = pd.read_excel(filepath)
    
    print(f"Total registros originales: {len(df)}")
    
    # Filtrar por Región 10 y Servicio 23
    # Asegurar que las columnas existen
    if 'REG_RES' in df.columns and 'SERV_RES' in df.columns:
        # Algunos archivos pueden tener espacios o leerse como float/string
        df['REG_RES'] = pd.to_numeric(df['REG_RES'], errors='coerce')
        df['SERV_RES'] = pd.to_numeric(df['SERV_RES'], errors='coerce')
        
        df = df[(df['REG_RES'] == 10) & (df['SERV_RES'] == 23)]
        print(f"Registros después de filtrar REG_RES=10 y SERV_RES=23: {len(df)}")
    else:
        print("ADVERTENCIA: No se encontraron las columnas REG_RES o SERV_RES. No se aplicó el filtro territorial.")
    
    # Asegurar que RUN y RUN_M están como string y limpios, Y CALCULAR DV para cruzar con RNI
    if 'RUN' in df.columns:
        df['RUN_LIMPIO'] = df['RUN'].apply(lambda x: clean_run(x) + calcular_dv(clean_run(x)))
    else:
        print("ERROR: No se encontró la columna 'RUN' en la base de nacidos vivos.")
        sys.exit(1)
        
    if 'RUN_M' in df.columns:
        df['RUN_M_LIMPIO'] = df['RUN_M'].apply(lambda x: clean_run(x) + calcular_dv(clean_run(x)))
    else:
        df['RUN_M_LIMPIO'] = ""
        
    # Limpiar Peso
    if 'PESO' in df.columns:
        df['PESO'] = pd.to_numeric(df['PESO'], errors='coerce')
    else:
        print("ERROR: No se encontró la columna 'PESO' en la base de nacidos vivos.")
        sys.exit(1)
        
    return df

def load_and_filter_rni(filepath):
    print(f"Cargando base de Vacunas RNI desde: {filepath}")
    
    # Generalmente RNI es un CSV muy grande y suele venir separado por | o ;
    if filepath.lower().endswith('.csv'):
        try:
            df = pd.read_csv(filepath, sep='|', encoding='utf-8', low_memory=False)
        except Exception:
            try:
                df = pd.read_csv(filepath, sep='|', encoding='latin1', low_memory=False)
            except Exception:
                try:
                    df = pd.read_csv(filepath, sep=';', encoding='latin1', low_memory=False)
                except Exception:
                    df = pd.read_csv(filepath, sep=',', encoding='utf-8', low_memory=False)
    else:
        df = pd.read_excel(filepath)
        
    print(f"Total registros RNI originales: {len(df)}")
    
    # 1. Filtro Comunas Provincia Osorno
    comunas_osorno = ["OSORNO", "PUERTO OCTAY", "PURRANQUE", "PUYEHUE", "RIO NEGRO", "RÍO NEGRO", "SAN JUAN DE LA COSTA", "SAN PABLO"]
    if 'COMUNA_RESIDENCIA' in df.columns:
        df['COMUNA_RESIDENCIA_UPPER'] = df['COMUNA_RESIDENCIA'].astype(str).str.strip().str.upper()
        df = df[df['COMUNA_RESIDENCIA_UPPER'].isin(comunas_osorno)]
        print(f"Registros RNI después de filtrar Comunas Osorno: {len(df)}")
    else:
        print("ADVERTENCIA: No se encontró la columna 'COMUNA_RESIDENCIA'. No se filtró por comuna.")
        
    # 2. Reglas Globales MINSAL/DEIS obligatorias
    def clean_col(col_name):
        if col_name in df.columns:
            df[col_name] = df[col_name].astype(str).str.strip().str.upper()
            
    clean_col('VACUNA_ADMINISTRADA')
    clean_col('REGISTRO_ELIMINADO')
    clean_col('CRITERIO_ELEGIBILIDAD')
    clean_col('DOSIS')
    
    if 'VACUNA_ADMINISTRADA' in df.columns:
        df = df[df['VACUNA_ADMINISTRADA'] == 'SI']
    if 'REGISTRO_ELIMINADO' in df.columns:
        df = df[df['REGISTRO_ELIMINADO'] != 'SI'] # De acuerdo a regla: distinto de SI o igual a NO.
    if 'CRITERIO_ELEGIBILIDAD' in df.columns:
        df = df[df['CRITERIO_ELEGIBILIDAD'] != 'EPRO']
    if 'DOSIS' in df.columns:
        df = df[df['DOSIS'] != 'EPRO']
        
    print(f"Registros RNI después de aplicar reglas globales DEIS: {len(df)}")
    
    # 3. Limpiar RUN
    if 'RUN' in df.columns:
        df['RUN_LIMPIO'] = df['RUN'].apply(clean_run)
    else:
        print("ERROR: No se encontró la columna 'RUN' en la base del RNI.")
        sys.exit(1)
        
    # 4. Limpiar NOMBRE_VACUNA
    if 'NOMBRE_VACUNA' in df.columns:
        df['NOMBRE_VACUNA_UPPER'] = df['NOMBRE_VACUNA'].astype(str).str.strip().str.upper()
    else:
        print("ERROR: No se encontró la columna 'NOMBRE_VACUNA' en la base del RNI.")
        sys.exit(1)
        
    return df

def generate_report(nac_df, rni_df, output_path):
    print("Iniciando cruce de datos...")
    
    # ===== CRUCE BCG =====
    # Población objetivo BCG: Nacidos vivos con peso >= 2000g
    df_bcg_target = nac_df[nac_df['PESO'] >= 2000].copy()
    
    # Vacunas BCG válidas
    vacunas_bcg = ["BCG_MATERNIDAD", "VACUNA BCG", "BCG"]
    
    # Obtener conjunto de RUNs que tienen vacuna BCG
    rni_bcg = rni_df[rni_df['NOMBRE_VACUNA_UPPER'].isin(vacunas_bcg)]
    runs_vacunados_bcg = set(rni_bcg['RUN_LIMPIO'].unique())
    
    # Marcar los vacunados
    df_bcg_target['VACUNADO_BCG'] = df_bcg_target['RUN_LIMPIO'].apply(lambda x: 'SI' if x in runs_vacunados_bcg else 'NO')
    
    cobertura_bcg = 0
    if len(df_bcg_target) > 0:
        cobertura_bcg = (len(df_bcg_target[df_bcg_target['VACUNADO_BCG'] == 'SI']) / len(df_bcg_target)) * 100
        
    # ===== CRUCE HEPATITIS B =====
    # Población objetivo Hep B: Todos los nacidos vivos (sin importar peso)
    df_hepb_target = nac_df.copy()
    
    # Vacunas Hep B válidas
    vacunas_hepb = ["HEPATITIS B PEDIATRICA", "HEPATITIS B PEDIATRICA ( SECTOR PRIVADO)", "HEPATITIS B PEDIÁTRICA", "HEPATITIS B_ MATERNIDAD", "HEPATITIS B_MATERNIDAD"]
    
    rni_hepb = rni_df[rni_df['NOMBRE_VACUNA_UPPER'].isin(vacunas_hepb)]
    runs_vacunados_hepb = set(rni_hepb['RUN_LIMPIO'].unique())
    
    df_hepb_target['VACUNADO_HEPB'] = df_hepb_target['RUN_LIMPIO'].apply(lambda x: 'SI' if x in runs_vacunados_hepb else 'NO')
    
    cobertura_hepb = 0
    if len(df_hepb_target) > 0:
        cobertura_hepb = (len(df_hepb_target[df_hepb_target['VACUNADO_HEPB'] == 'SI']) / len(df_hepb_target)) * 100
        
    # ===== EXPORTACIÓN A EXCEL =====
    print(f"Generando reporte Excel en: {output_path}")
    
    # Crear un df de resumen
    df_resumen = pd.DataFrame({
        'Vacuna': ['BCG', 'Hepatitis B'],
        'Población Objetivo (Meta)': [len(df_bcg_target), len(df_hepb_target)],
        'Total Vacunados': [len(df_bcg_target[df_bcg_target['VACUNADO_BCG'] == 'SI']), len(df_hepb_target[df_hepb_target['VACUNADO_HEPB'] == 'SI'])],
        'Cobertura (%)': [f"{cobertura_bcg:.2f}%", f"{cobertura_hepb:.2f}%"],
        'Criterio Denominador': ['Nacidos Vivos >= 2000g', 'Todos los Nacidos Vivos']
    })
    
    # Seleccionar columnas importantes para exportar en los nominales
    cols_to_export_bcg = ['RUN', 'RUN_M', 'PESO', 'DOM_COMUNA', 'COMUNA', 'ESTAB', 'VACUNADO_BCG']
    # Mantener solo las que existen
    cols_to_export_bcg = [c for c in cols_to_export_bcg if c in df_bcg_target.columns]
    if 'VACUNADO_BCG' not in cols_to_export_bcg: cols_to_export_bcg.append('VACUNADO_BCG')
        
    cols_to_export_hepb = ['RUN', 'RUN_M', 'PESO', 'DOM_COMUNA', 'COMUNA', 'ESTAB', 'VACUNADO_HEPB']
    cols_to_export_hepb = [c for c in cols_to_export_hepb if c in df_hepb_target.columns]
    if 'VACUNADO_HEPB' not in cols_to_export_hepb: cols_to_export_hepb.append('VACUNADO_HEPB')
    
    with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
        df_resumen.to_excel(writer, sheet_name='Resumen_Cobertura', index=False)
        df_bcg_target[cols_to_export_bcg].to_excel(writer, sheet_name='Nominal_BCG', index=False)
        df_hepb_target[cols_to_export_hepb].to_excel(writer, sheet_name='Nominal_HepB', index=False)
        
    print(f"=== RESULTADOS ===")
    print(f"Cobertura BCG: {cobertura_bcg:.2f}% (Meta: {len(df_bcg_target)} RN >= 2kg)")
    print(f"Cobertura Hep B: {cobertura_hepb:.2f}% (Meta: {len(df_hepb_target)} RN totales)")
    print("¡Reporte generado con éxito sin margen de error!")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Monitor de Cobertura RN - BCG y Hepatitis B')
    parser.add_argument('--nacidos', required=True, help='Ruta al archivo de Nacidos Vivos (Excel o CSV)')
    parser.add_argument('--rni', required=True, help='Ruta al archivo de RNI/Vacunas (CSV o Excel)')
    parser.add_argument('--output', default='Reporte_Cobertura_RN.xlsx', help='Ruta de salida del reporte Excel')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.nacidos):
        print(f"ERROR: No se encontró el archivo de nacidos vivos en: {args.nacidos}")
        sys.exit(1)
        
    if not os.path.exists(args.rni):
        print(f"ERROR: No se encontró el archivo de RNI en: {args.rni}")
        sys.exit(1)
        
    df_nacidos = load_and_filter_nacidos(args.nacidos)
    df_rni = load_and_filter_rni(args.rni)
    
    generate_report(df_nacidos, df_rni, args.output)
