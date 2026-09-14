import pandas as pd
import os

bases = {
    'COVID': {
        'res': r'BASE DATOS MINSAL\2026\Covid_Residencia_2026.csv',
        'ocu': r'BASE DATOS MINSAL\2026\Covid_Ocurrencia_2026.csv',
        'sep': ';'
    },
    'Influenza': {
        'res': r'BASE DATOS MINSAL\2026\Influenza_Residencia_2026.csv',
        'ocu': r'BASE DATOS MINSAL\2026\Influenza_Ocurrencia_2026.csv',
        'sep': ';'
    },
    'VRS': {
        'res': r'BASE DATOS MINSAL\2026\VRS_Residencia_2026.csv',
        'ocu': r'BASE DATOS MINSAL\2026\VRS_Ocurrencia_2026.csv',
        'sep': '|'
    },
    'Programáticas': {
        'res': r'BASE DATOS MINSAL\2026\Programáticas_Residencia_2026.csv',
        'ocu': r'BASE DATOS MINSAL\2026\Programáticas_Ocurrencia_2026.csv',
        'sep': ';'
    }
}

print(f"{'Módulo':<15} | {'Max Residencia':<15} | {'Max Ocurrencia':<15}")
print("-" * 50)

for mod, paths in bases.items():
    try:
        df_res = pd.read_csv(paths['res'], sep=paths['sep'], usecols=['FECHA_INMUNIZACION', 'VACUNA_ADMINISTRADA', 'REGISTRO_ELIMINADO', 'CRITERIO_ELEGIBILIDAD', 'DOSIS'], dtype=str, encoding='latin-1', engine='python', on_bad_lines='skip')
        df_res = df_res[(df_res['VACUNA_ADMINISTRADA'].str.upper() == 'SI') & (df_res['REGISTRO_ELIMINADO'].str.upper() != 'SI') & (df_res['CRITERIO_ELEGIBILIDAD'].str.upper() != 'EPRO') & (df_res['DOSIS'].str.upper() != 'EPRO')]
        max_res = pd.to_datetime(df_res['FECHA_INMUNIZACION'], errors='coerce').max().strftime("%d-%m-%Y")
    except Exception as e:
        max_res = f"Error: {e}"

    try:
        df_ocu = pd.read_csv(paths['ocu'], sep=paths['sep'], usecols=['FECHA_INMUNIZACION', 'VACUNA_ADMINISTRADA', 'REGISTRO_ELIMINADO', 'CRITERIO_ELEGIBILIDAD', 'DOSIS'], dtype=str, encoding='latin-1', engine='python', on_bad_lines='skip')
        df_ocu = df_ocu[(df_ocu['VACUNA_ADMINISTRADA'].str.upper() == 'SI') & (df_ocu['REGISTRO_ELIMINADO'].str.upper() != 'SI') & (df_ocu['CRITERIO_ELEGIBILIDAD'].str.upper() != 'EPRO') & (df_ocu['DOSIS'].str.upper() != 'EPRO')]
        max_ocu = pd.to_datetime(df_ocu['FECHA_INMUNIZACION'], errors='coerce').max().strftime("%d-%m-%Y")
    except Exception as e:
        max_ocu = f"Error: {e}"
        
    print(f"{mod:<15} | {str(max_res):<15} | {str(max_ocu):<15}")
