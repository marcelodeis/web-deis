import pandas as pd
import json

df_vrs = pd.read_csv(r'BASE DATOS MINSAL\2026\VRS_Ocurrencia_2026.csv', sep='|', encoding='latin-1', dtype=str, low_memory=False)
df_prog = pd.read_csv(r'BASE DATOS MINSAL\2026\Programáticas_Ocurrencia_2026.csv', sep='|', encoding='latin-1', dtype=str, low_memory=False)

df_prog = df_prog[df_prog['NOMBRE_VACUNA'] == 'Nirsevimab_ maternidad']

# Normalizar RUN (igual que el script)
def normalizar(r):
    return str(r).replace('.','').replace('-','').strip().lower()

df_vrs['RUN_NORM'] = df_vrs['RUN'].apply(normalizar)
df_prog['RUN_NORM'] = df_prog['RUN'].apply(normalizar)

r1 = set(df_vrs['RUN_NORM'].dropna())
r2 = set(df_prog['RUN_NORM'].dropna())

overlap = r1.intersection(r2)

cases = []
for run in overlap:
    vrs_rows = df_vrs[df_vrs['RUN_NORM'] == run].to_dict('records')
    prog_rows = df_prog[df_prog['RUN_NORM'] == run].to_dict('records')
    
    cases.append({
        "RUN": run,
        "VRS": [{
            "FECHA": r.get("FECHA_INMUNIZACION", ""),
            "DOSIS": r.get("DOSIS", ""),
            "ESTABLECIMIENTO": r.get("ESTABLECIMIENTO", ""),
            "COMUNA": r.get("COMUNA_OCURR", "")
        } for r in vrs_rows],
        "PROG": [{
            "FECHA": r.get("FECHA_INMUNIZACION", ""),
            "DOSIS": r.get("DOSIS", ""),
            "ESTABLECIMIENTO": r.get("ESTABLECIMIENTO", ""),
            "COMUNA": r.get("COMUNA_OCURR", "")
        } for r in prog_rows]
    })

with open("vrs_duplicates.json", "w", encoding="utf-8") as f:
    json.dump(cases, f, indent=4, ensure_ascii=False)
    
