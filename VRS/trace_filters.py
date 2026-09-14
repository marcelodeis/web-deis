import pandas as pd
import os

COD_COMUNAS = [10301, 10302, 10303, 10304, 10305, 10306, 10307]

def trace_filters(file_path, is_ocurrencia):
    print(f"\n--- Tracing {file_path} ---")
    df = pd.read_csv(file_path, sep='|', encoding='latin-1', dtype=str)
    print(f"Total inicial: {len(df)}")
    
    col_comuna = 'COD_COMUNA_OCURR' if is_ocurrencia else 'COD_COMUNA_RESID'
    
    # 1. Territorio
    df['COD'] = pd.to_numeric(df[col_comuna], errors='coerce')
    df = df[df['COD'].isin(COD_COMUNAS)]
    print(f"Post filtro territorial (SS Osorno): {len(df)}")
    
    # 2. VACUNA_ADMINISTRADA == SI
    df = df[df['VACUNA_ADMINISTRADA'].str.strip().str.upper() == 'SI']
    print(f"Post VACUNA_ADMINISTRADA == 'SI': {len(df)}")
    
    # 3. REGISTRO_ELIMINADO != SI
    df = df[df['REGISTRO_ELIMINADO'].str.strip().str.upper() != 'SI']
    print(f"Post REGISTRO_ELIMINADO != 'SI': {len(df)}")
    
    # 4. CRITERIO_ELEGIBILIDAD != EPRO
    df = df[df['CRITERIO_ELEGIBILIDAD'].str.strip().str.upper() != 'EPRO']
    print(f"Post CRITERIO_ELEGIBILIDAD != 'EPRO': {len(df)}")
    
    # 5. DOSIS != EPRO
    df = df[df['DOSIS'].str.strip().str.upper() != 'EPRO']
    print(f"Post DOSIS != 'EPRO': {len(df)}")

csv_resi = r"C:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL\2026\VRS_Residencia_2026.csv"
csv_ocur = r"C:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL\2026\VRS_Ocurrencia_2026.csv"

trace_filters(csv_resi, False)
trace_filters(csv_ocur, True)
