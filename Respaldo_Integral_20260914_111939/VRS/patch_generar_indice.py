import os

TARGET_FILE = r'C:\Antigravity IDE\WEB DEIS\VRS\scripts\generar_indice_vrs.py'

with open(TARGET_FILE, 'r', encoding='utf-8') as f:
    content = f.read()

# Add PROGRAMATICAS_CSV_PATH
prog_path = """CSV_PATH = os.path.join(
    os.path.dirname(PROJECT_DIR),  # WEB DEIS/
    "BASE DATOS MINSAL", "2026",
    "VRS_Residencia_2026.csv"
)

PROG_CSV_PATH = os.path.join(
    os.path.dirname(PROJECT_DIR),  # WEB DEIS/
    "BASE DATOS MINSAL", "2026",
    "Programáticas_Residencia_2026.csv"
)"""
content = content.replace('CSV_PATH = os.path.join(\n    os.path.dirname(PROJECT_DIR),  # WEB DEIS/\n    "BASE DATOS MINSAL", "2026",\n    "VRS_Residencia_2026.csv"\n)', prog_path)

# Update main loop to process both files
main_loop_old = """    with open(CSV_PATH, "r", encoding=used_encoding) as f:
        reader = csv.DictReader(f, delimiter=sep)

        for row in reader:"""

main_loop_new = """    archivos_a_procesar = [
        (CSV_PATH, False),
        (PROG_CSV_PATH, True)
    ]

    for archivo, is_prog in archivos_a_procesar:
        if not os.path.exists(archivo):
            print(f"      ADVERTENCIA: No se encontró {archivo}")
            continue
            
        print(f"\\n      Procesando: {os.path.basename(archivo)}")
        with open(archivo, "r", encoding=used_encoding) as f:
            reader = csv.DictReader(f, delimiter=sep)

            for row in reader:
                if is_prog:
                    # Filtro específico para programáticas
                    vacuna = row.get("NOMBRE_VACUNA", "").strip()
                    if vacuna != "Nirsevimab_ maternidad":
                        continue
"""
content = content.replace(main_loop_old, main_loop_new)

# Add one indentation level to the inner loop block
inner_loop_old = """
            # ─── Filtros obligatorios DEIS/MINSAL ───
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
"""
inner_loop_new = """
                # ─── Filtros obligatorios DEIS/MINSAL ───
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

                total_rows += 1
                # Progreso cada 100k filas
                if total_rows % 100000 == 0:
                    print(f"      ... {total_rows:,} filas procesadas")
"""
content = content.replace("            total_rows += 1", "")
content = content.replace(inner_loop_old.replace('─', 'â”€'), inner_loop_new.replace('─', 'â”€'))

with open(TARGET_FILE, 'w', encoding='utf-8') as f:
    f.write(content)
print("generar_indice_vrs.py patched successfully")
