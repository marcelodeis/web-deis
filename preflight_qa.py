import os
import pandas as pd
from datetime import datetime

staging_dir = r"C:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL\2026\STAGING_NUEVAS_BASES"
files = ["Influenza_Residencia_2026.csv", "Influenza_Ocurrencia_2026.csv"]

def detect_encoding(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            f.read(10000)
        return 'utf-8'
    except UnicodeDecodeError:
        return 'latin-1'

def get_se(date_obj):
    return date_obj.isocalendar()[1]

def process_file(file_name):
    file_path = os.path.join(staging_dir, file_name)
    if not os.path.exists(file_path):
        print(f" ARCHIVO NO ENCONTRADO: {file_name}")
        return False
        
    print(f"\n{'='*50}\n PREFLIGHT: {file_name}\n{'='*50}")
    
    enc = detect_encoding(file_path)
    print(f"[*] Encoding detectado (muestra): {enc}")
    
    # Try reading headers to detect separator
    try:
        df_preview = pd.read_csv(file_path, nrows=10, encoding=enc)
        if len(df_preview.columns) < 5:
            df_preview = pd.read_csv(file_path, nrows=10, encoding=enc, sep='|')
            sep = '|'
        else:
            sep = ','
    except Exception as e:
        print(f" Error leyendo preview: {e}")
        return False
        
    print(f"[*] Delimitador detectado: '{sep}'")
    
    # Required columns
    expected_columns = [
        'COD_COMUNA_RESID', 'COMUNA_RESIDENCIA', 'COD_COMUNA_OCURR', 'COMUNA_OCURR',
        'ESTABLECIMIENTO', 'CRITERIO_ELEGIBILIDAD', 'VACUNA_ADMINISTRADA',
        'REGISTRO_ELIMINADO', 'FECHA_INMUNIZACION', 'RUN',
        'COD_PUEBLO_ORIGINARIO', 'PUEBLO_ORIGINARIO', 'DOSIS'
    ]
    
    # Leer el archivo completo
    print("[*] Leyendo archivo completo, esto puede tardar un momento...")
    try:
        df = pd.read_csv(file_path, encoding=enc, sep=sep, dtype=str)
    except Exception as e:
        print(f" Error leyendo archivo completo: {e}")
        return False
        
    print(f"[*] Filas totales (registros): {len(df):,}")
    print(f"[*] Columnas totales: {len(df.columns)}")
    
    missing_cols = [col for col in expected_columns if col not in df.columns]
    if missing_cols:
        print(f"️ Columnas requeridas FALTANTES: {missing_cols}")
    else:
        print(f" Todas las columnas requeridas están presentes.")
        
    # Temporal analysis
    if 'FECHA_INMUNIZACION' in df.columns:
        # Filter valid dates
        valid_dates = pd.to_datetime(df['FECHA_INMUNIZACION'], errors='coerce')
        valid_dates = valid_dates.dropna()
        
        if len(valid_dates) > 0:
            min_date = valid_dates.min()
            max_date = valid_dates.max()
            print(f"\n--- ANÁLISIS TEMPORAL ---")
            print(f"[*] Fecha MÍNIMA registrada: {min_date.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"[*] Fecha MÁXIMA de inmunización registrada (Datos hasta): {max_date.strftime('%Y-%m-%d %H:%M:%S')}")
            
            se_min = get_se(min_date)
            se_max = get_se(max_date)
            print(f"[*] SE correspondiente a la fecha máxima (Última SE con registros): SE {se_max}")
            
            # Anomalies
            today = datetime.now()
            future_dates = valid_dates[valid_dates > today]
            if not future_dates.empty:
                print(f"️ ALERTA: Se detectaron {len(future_dates)} registros con fechas en el FUTURO (posteriores a hoy).")
            
            old_dates = valid_dates[valid_dates.dt.year < 2026]
            if not old_dates.empty:
                print(f"️ ALERTA: Se detectaron {len(old_dates)} registros con fechas anteriores al año 2026.")
        else:
            print(" No se encontraron fechas válidas en FECHA_INMUNIZACION.")
            
    return True

print("INICIANDO PREFLIGHT QA...")
all_passed = True
for f in files:
    if not process_file(f):
        all_passed = False

print(f"\n{'='*50}")
metas_path = os.path.join(staging_dir, "Metas_Influenza_2026.xlsx")
if os.path.exists(metas_path):
    print(f"ℹ️ Archivo Metas_Influenza_2026.xlsx detectado en Staging.")
else:
    print(f"ℹ️ Archivo Metas_Influenza_2026.xlsx NO detectado en Staging. Se usará la versión productiva actual respaldada.")

if all_passed:
    print("\n PREFLIGHT ESTRUCTURAL COMPLETO. Esperando revisión.")
else:
    print("\n PREFLIGHT FINALIZÓ CON ERRORES.")
