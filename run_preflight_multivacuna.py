import os
import pandas as pd
from datetime import datetime

archivos = [
    r"BASE DATOS MINSAL\2026\Covid_Residencia_2026.csv",
    r"BASE DATOS MINSAL\2026\Covid_Ocurrencia_2026.csv",
    r"BASE DATOS MINSAL\2026\VRS_Residencia_2026.csv",
    r"BASE DATOS MINSAL\2026\VRS_Ocurrencia_2026.csv",
    r"BASE DATOS MINSAL\2026\Programáticas_Residencia_2026.csv",
    r"BASE DATOS MINSAL\2026\Programáticas_Ocurrencia_2026.csv",
    r"BASE DATOS MINSAL\2026\Influenza_Residencia_2026.csv",
    r"BASE DATOS MINSAL\2026\Influenza_Ocurrencia_2026.csv",
    r"BASE DATOS MINSAL\2026\NAC2026.csv",
    r"BASE DATOS MINSAL\2026\DEF2026.csv"
]

def detect_encoding_and_delimiter(file_path):
    encodings = ['latin-1', 'utf-8']
    for enc in encodings:
        try:
            with open(file_path, 'r', encoding=enc) as f:
                line = f.readline()
                if '|' in line: return enc, '|'
                if ';' in line: return enc, ';'
                if ',' in line: return enc, ','
                return enc, '\t'
        except:
            pass
    return 'latin-1', '|'

print("# PREFLIGHT MULTIVACUNA")

for filepath in archivos:
    if not os.path.exists(filepath):
        print(f"## {os.path.basename(filepath)} - NO ENCONTRADO")
        continue
    
    encoding, delim = detect_encoding_and_delimiter(filepath)
    
    print(f"## {os.path.basename(filepath)}")
    print(f"- **Encoding detectado:** {encoding}")
    print(f"- **Delimitador:** '{delim}'")
    
    try:
        df = pd.read_csv(filepath, sep=delim, encoding=encoding, dtype=str, low_memory=False)
        print(f"- **Total registros:** {len(df):,}")
        print(f"- **Total columnas:** {len(df.columns)}")
        
        # Identify date column
        date_cols = [c for c in df.columns if 'FECHA' in c.upper() or 'DIA' in c.upper() or 'MES' in c.upper()]
        
        if 'FECHA_INMUNIZACION' in df.columns:
            fechas = pd.to_datetime(df['FECHA_INMUNIZACION'], errors='coerce').dropna()
            if not fechas.empty:
                print(f"- **Fecha mínima de inmunización:** {fechas.min().strftime('%d-%m-%Y')}")
                print(f"- **Fecha máxima de inmunización:** {fechas.max().strftime('%d-%m-%Y')}")
                print(f"- **Años presentes en la base:** {sorted(fechas.dt.year.unique().tolist())}")
        elif 'FECHA_DEF' in df.columns: # For DEF
            fechas = pd.to_datetime(df['FECHA_DEF'], format="%d/%m/%Y", errors='coerce').dropna()
            if not fechas.empty:
                print(f"- **Fecha mínima de defunción:** {fechas.min().strftime('%d-%m-%Y')}")
                print(f"- **Fecha máxima de defunción:** {fechas.max().strftime('%d-%m-%Y')}")
        
        # Comunas and other critical fields
        crit_cols = []
        for col in ['COMUNA_RESIDENCIA', 'COMUNA_OCURR', 'ESTABLECIMIENTO', 'NOMBRE_VACUNA', 'DOSIS', 'CRITERIO_ELEGIBILIDAD', 'RUN']:
            if col in df.columns:
                crit_cols.append(col)
        
        if crit_cols:
            print(f"- **Campos críticos encontrados:** {', '.join(crit_cols)}")
            
    except Exception as e:
        print(f"- **Error al leer:** {str(e)}")
    
    print("")

