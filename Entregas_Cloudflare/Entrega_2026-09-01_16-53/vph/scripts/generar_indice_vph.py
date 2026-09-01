# -*- coding: utf-8 -*-
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import os
import time
import pandas as pd

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
BASE_DIR = os.path.join(os.path.dirname(PROJECT_DIR), "BASE DATOS MINSAL")
OUTPUT_JS = os.path.join(PROJECT_DIR, "vph_runs_index.js")

ARCHIVOS_OCURRENCIA = {
    2014: "Programáticas_Ocurrencia_2014",
    2015: "Programáticas_Ocurrencia_2015",
    2016: "Programáticas_Ocurrencia_2016",
    2017: "Programáticas_Ocurrencia_2017",
    2018: "Programáticas_Ocurrencia_2018",
    2019: "Programáticas_Ocurrencia_2019.csv",
    2020: "Programáticas_Ocurrencia_2020.csv",
    2021: "Programáticas_Ocurrencia_2021.csv",
    2022: "Programáticas_Ocurrencia_2022.csv",
    2023: "Programáticas_Ocurrencia_2023.csv",
    2024: "Programáticas_Ocurrencia_2024.csv",
    2025: "Programáticas_Ocurrencia_2025.csv",
    2026: "Programáticas_Ocurrencia_2026.csv",
}

def get_db_dir(year):
    if int(year) <= 2024:
        return os.path.join(BASE_DIR, "2000-2024")
    else:
        return os.path.join(BASE_DIR, str(year))

def calcular_dv_chile(cuerpo_numerico):
    try:
        suma = 0
        multiplicador = 2
        for digito in reversed(cuerpo_numerico):
            suma += int(digito) * multiplicador
            multiplicador = multiplicador + 1 if multiplicador < 7 else 2
        resto = 11 - (suma % 11)
        if resto == 11: return '0'
        if resto == 10: return 'k'
        return str(resto)
    except:
        return '?'

def normalizar_run_sin_dv(val):
    if pd.isna(val): return ""
    s = str(val).strip().lower().replace(".", "").replace("-", "").replace(" ", "")
    if not s: return ""
    if s.endswith('k'): return s[:-1]
    if s.isdigit():
        if len(s) <= 1: return s
        cuerpo = s[:-1]
        dv = s[-1]
        if dv == calcular_dv_chile(cuerpo):
            return cuerpo
    return s

def generar_indice_vph():
    print("="*60)
    print("  GENERADOR DE INDICE DE RUNs - VPH 2014-2026")
    print("="*60)
    
    t0 = time.time()
    runs_validos = set()
    total_filas = 0
    total_filtradas = 0
    
    for year, file_name in ARCHIVOS_OCURRENCIA.items():
        file_path = os.path.join(get_db_dir(year), file_name)
        if not os.path.exists(file_path):
            print(f"  [!] No encontrado: {file_path}")
            continue
            
        print(f"  Procesando {year}...")
        try:
            for chunk in pd.read_csv(file_path, sep='|', encoding='latin-1', dtype=str, chunksize=100000):
                total_filas += len(chunk)
                df = chunk
                
                # Filtro VPH
                if 'NOMBRE_VACUNA' in df.columns:
                    df = df[df['NOMBRE_VACUNA'].str.upper().str.contains("VPH", na=False)]
                
                # Filtros DEIS
                if 'VACUNA_ADMINISTRADA' in df.columns:
                    df = df[df['VACUNA_ADMINISTRADA'].str.strip().str.upper() == 'SI']
                if 'REGISTRO_ELIMINADO' in df.columns:
                    df = df[df['REGISTRO_ELIMINADO'].str.strip().str.upper() != 'SI']
                if 'CRITERIO_ELEGIBILIDAD' in df.columns:
                    df = df[df['CRITERIO_ELEGIBILIDAD'].str.strip().str.upper() != 'EPRO']
                if 'DOSIS' in df.columns:
                    df = df[df['DOSIS'].str.strip().str.upper() != 'EPRO']
                
                total_filtradas += len(df)
                
                if 'RUN' in df.columns:
                    runs = df['RUN'].dropna().apply(normalizar_run_sin_dv)
                    runs_validos.update(runs[runs != ""].tolist())
        except Exception as e:
            print(f"  [!] Error procesando {year}: {e}")
            
    print("\n[3/3] Generando vph_runs_index.js...")
    runs_sorted = sorted(list(runs_validos))
    
    with open(OUTPUT_JS, 'w', encoding='utf-8') as f:
        f.write("window.VPH_RUNS_INDEX = new Set([\\n")
        len_runs = len(runs_sorted)
        for i, run in enumerate(runs_sorted):
            f.write(f'"{run}"')
            if i < len_runs - 1:
                f.write(",\\n")
            else:
                f.write("\\n")
        f.write("]);\\n")
        
    mb = os.path.getsize(OUTPUT_JS) / (1024 * 1024)
    print(f"      Archivo generado : vph_runs_index.js ({mb:.2f} MB)")
    print(f"      RUNs únicos      : {len(runs_sorted)}")
    print(f"      Tiempo total     : {time.time() - t0:.1f}s")
    print("="*60)

if __name__ == '__main__':
    generar_indice_vph()
