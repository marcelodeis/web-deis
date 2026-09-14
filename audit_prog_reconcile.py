import pandas as pd

print("--- AUDITORIA DE FECHAS Y REGISTROS PROGRAMATICAS ---")

# 1. Cargar bases originales completas
path_oc = r"C:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL\2026\Programáticas_Ocurrencia_2026.csv"
path_re = r"C:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL\2026\Programáticas_Residencia_2026.csv"

df_oc = pd.read_csv(path_oc, sep='|', encoding='latin-1', dtype=str, low_memory=False)
df_re = pd.read_csv(path_re, sep='|', encoding='latin-1', dtype=str, low_memory=False)

print(f"Total Ocurrencia Original: {len(df_oc)}")
print(f"Total Residencia Original: {len(df_re)}")

# 2. Análisis de fechas de TODO el dataset
for name, df in [("Ocurrencia", df_oc), ("Residencia", df_re)]:
    df['FECHA_DT'] = pd.to_datetime(df['FECHA_INMUNIZACION'], errors='coerce')
    max_date = df['FECHA_DT'].max()
    print(f"Max Fecha {name} general: {max_date}")
    
    # Registros entre 27-08 y 06-09
    mask = (df['FECHA_DT'] >= '2026-08-27') & (df['FECHA_DT'] <= '2026-09-06')
    df_late = df[mask]
    print(f"Registros en {name} entre 27-08 y 06-09: {len(df_late)}")
    if len(df_late) > 0:
        print("Vacunas en esos registros:")
        print(df_late['NOMBRE_VACUNA'].value_counts())

# 3. Simular el filtrado de generate_data_2026.py
print("\n--- SIMULACION DE FILTRADO (generate_data_2026.py) ---")

MAPPING = {
    "BCG_maternidad | Única": "BCG",
    "Vacuna BCG | 0.05 ml": "BCG",
    "VACUNA BEXSERO | 1° Dosis": "BEXSERO1D",
    "VACUNA BEXSERO | Refuerzo": "BEXSERO1R",
    "VACUNA BEXSERO | 2° Dosis": "BEXSERO2D",
    "Hexavalente | 1° dosis": "HEXA1D",
    "Hexavalente | 2° dosis": "HEXA2D",
    "Hexavalente | 3° dosis": "HEXA3D",
    "Hexavalente | 1er refuerzo": "HEXA1R",
    "Hepatitis A pediátrica | Única": "HepA",
    "Hepatitis B_maternidad | Única": "HepB",
    "VACUNA MENQUADFI | Única": "MENINGO",
    "VACUNA NIMENRIX | Única": "MENINGO",
    "VACUNA MENVEO | Única": "MENINGO",
    "Neumocócica conjugada 13V | 1° dosis": "NEUMO1D",
    "Neumocócica conjugada 13V | 2° dosis": "NEUMO2D",
    "Neumocócica conjugada 13V | 1er refuerzo, 12 meses": "NEUMO1R",
    "Neumocócica polisacárida 23V | Única": "NEUMO23",
    "Vacuna SRP (trivirica) Monodosis | 1ra dosis (programática)": "SRP1D",
    "Vacuna SRP (trivirica) Monodosis | 2da dosis (programatica)": "SRP2D",
    "Varicela | 1° dosis": "VARICELA1D",
    "Varicela | 2° dosis": "VARICELA2D",
    "VPH Tetravalente | 1° Dosis": "VPH",
    "VPH Nonavalente | 1° dosis": "VPH",
    "VPH Tetravalente | 2° Dosis": "VPH",
    "VPH Nonavalente | 2° dosis": "VPH",
    "Vacuna dTpa | Única": "dTpa",
}

def clean(x):
    return str(x).strip().upper()

def simular_filtrado(df, is_ocurrencia=True):
    total = len(df)
    
    # Filtro COD_SERV == 23
    df_serv = df[df['COD_SERV'] == '23']
    print(f"Descartados por COD_SERV != 23: {total - len(df_serv)}")
    total = len(df_serv)
    
    # Filtro VACUNA_ADMINISTRADA == SI
    df_vac = df_serv[df_serv['VACUNA_ADMINISTRADA'].apply(clean) == 'SI']
    print(f"Descartados por VACUNA_ADMINISTRADA != SI: {total - len(df_vac)}")
    total = len(df_vac)
    
    # Filtro REGISTRO_ELIMINADO != SI
    df_elim = df_vac[df_vac['REGISTRO_ELIMINADO'].apply(clean) != 'SI']
    print(f"Descartados por REGISTRO_ELIMINADO == SI: {total - len(df_elim)}")
    total = len(df_elim)
    
    # Filtro EPRO
    df_epro = df_elim[(df_elim['CRITERIO_ELEGIBILIDAD'].apply(clean) != 'EPRO') & (df_elim['DOSIS'].apply(clean) != 'EPRO')]
    print(f"Descartados por EPRO: {total - len(df_epro)}")
    total = len(df_epro)
    
    # Filtro MAPPING (Programáticas)
    keys = df_epro['NOMBRE_VACUNA'].str.strip() + " | " + df_epro['DOSIS'].str.strip()
    df_map = df_epro[keys.isin(MAPPING.keys())]
    print(f"Descartados por no pertenecer al MAPPING de vacunas programáticas: {total - len(df_map)}")
    
    print(f"Total Final Válido: {len(df_map)}")
    
    # Check fechas again
    max_date_map = df_map['FECHA_DT'].max()
    print(f"Fecha máxima en el subset filtrado: {max_date_map}")

print("Ocurrencia:")
simular_filtrado(df_oc)
print("\nResidencia:")
simular_filtrado(df_re)

