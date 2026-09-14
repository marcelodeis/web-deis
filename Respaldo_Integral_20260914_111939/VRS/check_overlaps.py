import pandas as pd

csv_resi_vrs = r"C:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL\2026\VRS_Residencia_2026.csv"
csv_resi_prog = r"C:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL\2026\Programáticas_Residencia_2026.csv"

df_vrs = pd.read_csv(csv_resi_vrs, sep='|', encoding='latin-1', dtype=str)
df_prog = pd.read_csv(csv_resi_prog, sep='|', encoding='latin-1', dtype=str)

df_prog = df_prog[df_prog['NOMBRE_VACUNA'].str.strip() == 'Nirsevimab_ maternidad']

# Sin filtros, cuantos RUN coinciden?
runs_vrs = set(df_vrs['RUN'].dropna().str.strip())
runs_prog = set(df_prog['RUN'].dropna().str.strip())

coinciden = runs_vrs.intersection(runs_prog)
print(f"Coincidencias de RUN sin filtro territorial: {len(coinciden)}")

# Cuantos con filtro territorial?
df_vrs_terr = df_vrs[df_vrs['COD_COMUNA_RESID'].isin(['10301', '10302', '10303', '10304', '10305', '10306', '10307'])]
df_prog_terr = df_prog[df_prog['CODIGO_COMUNA_RESIDENCIA'].isin(['10301', '10302', '10303', '10304', '10305', '10306', '10307'])]

runs_vrs_terr = set(df_vrs_terr['RUN'].dropna().str.strip())
runs_prog_terr = set(df_prog_terr['RUN'].dropna().str.strip())

coinciden_terr = runs_vrs_terr.intersection(runs_prog_terr)
print(f"Coincidencias de RUN CON filtro territorial: {len(coinciden_terr)}")
