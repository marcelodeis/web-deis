import pandas as pd
import os

print("=== AUDITORIA VPH ===")
nac_path = r"BASE DATOS MINSAL\2026\NAC2026.csv"
def_path = r"BASE DATOS MINSAL\2026\DEF2026.csv"

# 1. NAC
try:
    df_nac = pd.read_csv(nac_path, sep=';', encoding='latin-1', dtype=str, low_memory=False)
    if 'ANO_NAC' in df_nac.columns:
        años_nac = sorted(df_nac['ANO_NAC'].dropna().unique().tolist())
        print(f"Años distintos presentes en ANO_NAC de NAC2026.csv: {años_nac}")
        
        # Filtremos para la cohorte de 15 años en 2026 (nacidos en 2011)
        df_nac_2011 = df_nac[df_nac['ANO_NAC'] == '2011']
        print(f"Total nacidos vivos en 2011: {len(df_nac_2011)}")
        
        if 'COMUNA_NAC' in df_nac_2011.columns:
            print("Desglose por COMUNA_NAC (Top 5):")
            print(df_nac_2011['COMUNA_NAC'].value_counts().head(5).to_dict())
    else:
        print("ANO_NAC no está presente en NAC2026.csv")
except Exception as e:
    print(f"Error NAC: {e}")

# 2. DEF
try:
    df_def = pd.read_csv(def_path, sep='|', encoding='latin-1', dtype=str, low_memory=False)
    if 'ANO_DEF' in df_def.columns:
        años_def = sorted(df_def['ANO_DEF'].dropna().unique().tolist())
        print(f"Años distintos presentes en ANO_DEF de DEF2026.csv: {años_def[:5]} ... {años_def[-5:]}")
    elif 'FECHA_DEF' in df_def.columns:
        fechas = pd.to_datetime(df_def['FECHA_DEF'], format="%d/%m/%Y", errors='coerce').dropna()
        años_def = sorted(fechas.dt.year.unique().tolist())
        print(f"Años de defunción presentes según FECHA_DEF de DEF2026.csv: {años_def[:5]} ... {años_def[-5:]}")
    
    # Check if ANO1_NAC and ANO2_NAC exist
    if 'ANO1_NAC' in df_def.columns and 'ANO2_NAC' in df_def.columns:
        print("Columnas ANO1_NAC y ANO2_NAC encontradas en DEF2026.csv.")
except Exception as e:
    print(f"Error DEF: {e}")

print("\n=== AUDITORIA VRS ===")
# Leer parse_vrs.py para ver cómo hace el cruce
vrs_script = r"VRS\Scripts_Procesamiento\parse_vrs.py"
try:
    with open(vrs_script, 'r', encoding='utf-8') as f:
        content = f.read()
        print("Fragmentos de merge/concat en parse_vrs.py:")
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if 'concat' in line.lower() or 'merge' in line.lower() or 'drop_duplicates' in line.lower():
                print(f"Línea {i+1}: {line.strip()}")
except Exception as e:
    print(f"Error VRS Script: {e}")

