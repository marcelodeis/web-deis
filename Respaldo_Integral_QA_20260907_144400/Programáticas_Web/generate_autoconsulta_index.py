import csv
import json
import os
from collections import defaultdict
from datetime import datetime

# Directorios
BASE_DIR = r"C:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL"
OUT_FILE_JS = r"c:\Antigravity IDE\WEB DEIS\Programáticas_Web\programaticas_runs_index.js"

# Archivos a procesar (pueden ser ambos para asegurar cobertura)
FILES_TO_PROCESS = [
    os.path.join(BASE_DIR, "2026", "Programáticas_Ocurrencia_2026.csv"),
    os.path.join(BASE_DIR, "2026", "Programáticas_Residencia_2026.csv")
]

def normalizar_run(run_raw):
    """Extrae solo los números del RUN (sin DV ni puntos)."""
    s = str(run_raw).strip().lower().replace('.', '').replace('-', '').replace(' ', '')
    if not s:
        return ""
    if s.endswith('k'):
        return s[:-1]
    if s.isdigit():
        if len(s) > 1:
            # Asumimos que el último dígito es el DV si no termina en K
            return s[:-1]
        return s
    return s

def generar_indice():
    print("=== Generando Índice de Autoconsulta (Programáticas) ===")
    
    # Estructura: index[run_normalizado][vacuna_nombre] = set(dosis)
    # Usamos set para evitar duplicados si la misma vacuna y dosis aparece en ocurrencia y residencia
    index = defaultdict(lambda: defaultdict(set))
    
    for filepath in FILES_TO_PROCESS:
        if not os.path.exists(filepath):
            print(f"Advertencia: No se encontró el archivo {filepath}")
            continue
            
        print(f"Procesando {os.path.basename(filepath)}...")
        try:
            with open(filepath, encoding='latin1') as f:
                reader = csv.DictReader(f, delimiter='|')
                for row in reader:
                    # Filtros Globales Obligatorios
                    if row.get('VACUNA_ADMINISTRADA', '').strip().upper() != 'SI':
                        continue
                    if row.get('REGISTRO_ELIMINADO', '').strip().upper() != 'NO':
                        continue
                    if row.get('CRITERIO_ELEGIBILIDAD', '').strip().upper() == 'EPRO':
                        continue
                    if row.get('DOSIS', '').strip().upper() == 'EPRO':
                        continue
                    
                    # RUN del paciente
                    run_raw = row.get('RUN', '').strip()
                    if not run_raw:
                        continue
                        
                    run_norm = normalizar_run(run_raw)
                    if not run_norm:
                        continue
                        
                    # Datos de vacuna
                    vacuna = row.get('NOMBRE_VACUNA', '').strip()
                    dosis = row.get('DOSIS', '').strip()
                    
                    if vacuna and dosis:
                        index[run_norm][vacuna].add(dosis)
        except Exception as e:
            print(f"Error procesando {filepath}: {e}")

    # Convertir a formato JSON-friendly
    # Dict[run] -> Dict[vacuna] -> string(dosis separadas por coma)
    print(f"\nConvirtiendo a formato final... (Total RUNs únicos: {len(index)})")
    
    final_data = {}
    for run, vacunas_dict in index.items():
        final_data[run] = {}
        for vac, dosis_set in vacunas_dict.items():
            # Ordenar dosis alfabéticamente para consistencia
            dosis_str = ", ".join(sorted(list(dosis_set)))
            final_data[run][vac] = dosis_str

    print(f"Escribiendo resultado en {OUT_FILE_JS}...")
    try:
        with open(OUT_FILE_JS, 'w', encoding='utf-8') as f:
            f.write("/**\n")
            f.write(f" * Índice de RUNs para Autoconsulta - Programáticas\n")
            f.write(f" * Generado el: {datetime.now().strftime('%d/%m/%Y %H:%M')}\n")
            f.write(f" * Total RUNs: {len(final_data)}\n")
            f.write(" */\n\n")
            f.write("window.PROGRAMATICAS_RUNS_INDEX = ")
            json.dump(final_data, f, ensure_ascii=False, separators=(',', ':'))
            f.write(";\n")
        print("¡Índice generado exitosamente!")
    except Exception as e:
        print(f"Error al escribir el archivo: {e}")

if __name__ == "__main__":
    generar_indice()
