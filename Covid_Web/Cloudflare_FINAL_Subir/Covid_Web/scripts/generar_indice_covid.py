# -*- coding: utf-8 -*-
"""
╔══════════════════════════════════════════════════════════════════╗
║   GENERADOR DE ÍNDICE DE RUNs - INFLUENZA RESIDENCIA 2026      ║
║   Para módulo Autoconsulta de Estado de Vacunación              ║
╚══════════════════════════════════════════════════════════════════╝

DESCRIPCIÓN:
    Lee el CSV de Covid_Residencia_2026.csv,
    aplica los 4 filtros obligatorios DEIS/MINSAL,
    normaliza los RUNs (sin DV, algoritmo módulo 11),
    y genera un archivo JS ligero con un Set de RUNs únicos.

FILTROS OBLIGATORIOS:
    1. VACUNA_ADMINISTRADA == "SI"
    2. REGISTRO_ELIMINADO != "SI"
    3. CRITERIO_ELEGIBILIDAD != "EPRO"
    4. DOSIS != "EPRO"

USO:
    python generar_indice_covid.py

SALIDA:
    ../covid_runs_index.js  (~1-2 MB)
"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import os
import time
import csv

# ══════════════════════════════════════════════════════════════════
#  CONFIGURACIÓN
# ══════════════════════════════════════════════════════════════════

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)  # Covid_Web/

CSV_PATH = os.path.join(
    os.path.dirname(PROJECT_DIR),  # WEB DEIS/
    "BASE DATOS MINSAL", "2026",
    "Covid_Residencia_2026.csv"
)

OUTPUT_JS = os.path.join(PROJECT_DIR, "covid_runs_index.js")

# ══════════════════════════════════════════════════════════════════
#  FUNCIONES DE NORMALIZACIÓN DE RUN
# ══════════════════════════════════════════════════════════════════

def calcular_dv_chile(cuerpo_numerico: str) -> str:
    """
    Calcula el dígito verificador (DV) oficial de un RUN chileno.
    Algoritmo módulo 11 con multiplicadores 2-7 en ciclo.
    """
    try:
        suma = 0
        multiplicador = 2
        for digito in reversed(cuerpo_numerico):
            suma += int(digito) * multiplicador
            multiplicador = multiplicador + 1 if multiplicador < 7 else 2
        resto = 11 - (suma % 11)
        if resto == 11:
            return '0'
        if resto == 10:
            return 'k'
        return str(resto)
    except Exception:
        return '?'


def normalizar_run_sin_dv(val) -> str:
    """
    Normaliza un RUN chileno extrayendo SIEMPRE el cuerpo sin DV.
    Maneja formatos: 12.345.678-9, 12345678-9, 123456789, 12345678, con K, etc.
    """
    if val is None or str(val).strip() == "":
        return ""

    s = str(val).strip().lower().replace(".", "").replace("-", "").replace(" ", "")

    if not s:
        return ""

    # Caso 1: termina en 'k' → definitivamente tiene DV
    if s.endswith('k'):
        return s[:-1]

    # Caso 2: todo numérico
    if s.isdigit():
        if len(s) <= 1:
            return s

        cuerpo_candidato = s[:-1]
        dv_candidato = s[-1]
        dv_esperado = calcular_dv_chile(cuerpo_candidato)

        if dv_candidato == dv_esperado:
            return cuerpo_candidato
        else:
            return s

    # Caso 3: caracteres no esperados
    return s


# ══════════════════════════════════════════════════════════════════
#  PROCESO PRINCIPAL
# ══════════════════════════════════════════════════════════════════

def main():
    print("=" * 65)
    print("  GENERADOR DE INDICE DE RUNs - INFLUENZA RESIDENCIA 2026")
    print("=" * 65)
    print(f"  CSV entrada : {os.path.basename(CSV_PATH)}")
    print(f"  JS salida   : {os.path.basename(OUTPUT_JS)}")
    print("=" * 65)

    if not os.path.exists(CSV_PATH):
        print(f"\n  ERROR: No se encontro el archivo CSV:")
        print(f"  {CSV_PATH}")
        sys.exit(1)

    # --- PASO 1: Detectar encoding y separador ---
    print("\n[1/3] Detectando encoding y separador...")
    encodings = ["latin-1", "cp1252", "utf-8-sig", "utf-8", "iso-8859-1"]
    used_encoding = "latin-1"
    primera_linea = ""
    for enc in encodings:
        try:
            with open(CSV_PATH, "r", encoding=enc) as f:
                primera_linea = f.readline()
            used_encoding = enc
            break
        except Exception:
            continue

    if "|" in primera_linea:
        sep = "|"
    elif ";" in primera_linea:
        sep = ";"
    else:
        sep = ","
    print(f"      Encoding : {used_encoding} | Separador: '{sep}'")

    # --- PASO 2: Leer CSV y extraer RUNs válidos ---
    print(f"\n[2/3] Procesando CSV con filtros DEIS/MINSAL...")
    t0 = time.time()

    runs_set = set()
    total_rows = 0
    filtered_out = 0
    empty_runs = 0

    with open(CSV_PATH, "r", encoding=used_encoding) as f:
        reader = csv.DictReader(f, delimiter=sep)

        for row in reader:
            total_rows += 1

            # ── Filtros obligatorios DEIS/MINSAL ──
            if row.get("VACUNA_ADMINISTRADA", "").strip().upper() != "SI":
                filtered_out += 1
                continue
            if row.get("REGISTRO_ELIMINADO", "").strip().upper() == "SI":
                filtered_out += 1
                continue
            if row.get("CRITERIO_ELEGIBILIDAD", "").strip().upper() == "EPRO":
                filtered_out += 1
                continue
            if row.get("DOSIS", "").strip().upper() == "EPRO":
                filtered_out += 1
                continue

            # Extraer y normalizar RUN
            run_raw = row.get("RUN", "").strip()
            if not run_raw:
                empty_runs += 1
                continue

            run_norm = normalizar_run_sin_dv(run_raw)
            if run_norm:
                runs_set.add(run_norm)

            # Progreso cada 100k filas
            if total_rows % 100000 == 0:
                print(f"      ... {total_rows:,} filas procesadas")

    elapsed = time.time() - t0
    print(f"      Filas totales      : {total_rows:,}")
    print(f"      Filtradas (excl.)  : {filtered_out:,}")
    print(f"      RUNs sin valor     : {empty_runs:,}")
    print(f"      RUNs unicos válidos: {len(runs_set):,}")
    print(f"      Tiempo             : {elapsed:.1f}s")

    # --- PASO 3: Generar archivo JS ---
    print(f"\n[3/3] Generando {os.path.basename(OUTPUT_JS)}...")

    # Ordenar para consistencia en diffs
    runs_sorted = sorted(runs_set)

    with open(OUTPUT_JS, "w", encoding="utf-8") as f:
        f.write("// ═══════════════════════════════════════════════════════════\n")
        f.write("// ÍNDICE DE RUNs VACUNADOS - INFLUENZA RESIDENCIA 2026\n")
        f.write("// Generado automáticamente por generar_indice_influenza.py\n")
        f.write(f"// Total RUNs únicos: {len(runs_sorted):,}\n")
        f.write(f"// Fecha generación: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write("// FILTROS APLICADOS: VACUNA_ADMINISTRADA=SI, REGISTRO_ELIMINADO!=SI,\n")
        f.write("//   CRITERIO_ELEGIBILIDAD!=EPRO, DOSIS!=EPRO\n")
        f.write("// ═══════════════════════════════════════════════════════════\n\n")

        # Escribir como array JSON que se convierte a Set
    list_runs = runs_sorted
    len_runs = len(runs_sorted)

    with open(OUTPUT_JS, 'w', encoding='utf-8') as f:
        f.write("window.COVID_RUNS_INDEX = new Set([\n")
        for i, run in enumerate(list_runs):
            f.write(f'"{run}"')
            if i < len_runs - 1:
                f.write(",\n")
            else:
                f.write("\n")
        f.write("]);\n")

    file_size_mb = os.path.getsize(OUTPUT_JS) / (1024 * 1024)
    print(f"      Archivo generado : {os.path.basename(OUTPUT_JS)}")
    print(f"      Tamaño           : {file_size_mb:.2f} MB")

    print(f"\n{'=' * 65}")
    print(f"  PROCESO COMPLETADO SIN ERRORES")
    print(f"{'=' * 65}")
    print(f"  RUNs únicos en el índice : {len(runs_sorted):,}")
    print(f"  Archivo de salida        : {OUTPUT_JS}")
    print(f"{'=' * 65}\n")


if __name__ == "__main__":
    main()
