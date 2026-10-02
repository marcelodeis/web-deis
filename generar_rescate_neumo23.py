#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
=============================================================================
RESCATE NEUMOCÓCICA 23 — COHORTE 1961
Servicio de Salud Osorno — Provincia de Osorno (7 Comunas)
=============================================================================

Genera DOS reportes Excel de rescate para vacunación Neumocócica polisacárida
23V en personas nacidas en 1961:

  Reporte 1: AM Crónicos Respiratorios (universo focalizado)
  Reporte 2: Población Per Cápita inscrita (universo ampliado)

Lógica:
  1. Construir set de RUNs fallecidos (DEF 2014-2026)
  2. Construir set de RUNs con Neumo23 válida (Programáticas 2014-2026)
  3. Cruzar cada universo y generar Excel de rescate

Filtros MINSAL obligatorios (Programáticas):
  1. VACUNA_ADMINISTRADA == "SI"
  2. REGISTRO_ELIMINADO != "SI" (o == "NO")
  3. Excluir CRITERIO_ELEGIBILIDAD == "EPRO"
  4. Excluir DOSIS == "EPRO"

Autor: Generado por Antigravity para DEIS SS Osorno
Fecha: 2026-10-02
=============================================================================
"""

import csv
import os
import sys
import io
import time
from collections import Counter, defaultdict
from datetime import datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

try:
    import openpyxl
    from openpyxl.styles import Font, Alignment, PatternFill, Border, Side, numbers
    from openpyxl.utils import get_column_letter
except ImportError:
    print("ERROR: Se requiere openpyxl. Instale con: pip install openpyxl")
    sys.exit(1)

# =============================================================================
# CONFIGURACIÓN
# =============================================================================

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
BD_MINSAL_DIR = os.path.join(PROJECT_DIR, "BASE DATOS MINSAL")
BD_2000_2024 = os.path.join(BD_MINSAL_DIR, "2000-2024")
BD_2025 = os.path.join(BD_MINSAL_DIR, "2025")
BD_2026 = os.path.join(BD_MINSAL_DIR, "2026")

# Fuentes de universo
EXCEL_CRONICOS = os.path.join(PROJECT_DIR, "Vac. Influenza AM Crónicos Respiratorios 06.08.2026 .xlsx")
EXCEL_PERCAPITA = os.path.join(PROJECT_DIR, "Poblacion Percapita Junio 2026.xlsx")

# Salida
OUTPUT_DIR = PROJECT_DIR
OUTPUT_REPORTE1 = os.path.join(OUTPUT_DIR, "Rescate_Neumo23_Cronicos_Respiratorios_1961.xlsx")
OUTPUT_REPORTE2 = os.path.join(OUTPUT_DIR, "Rescate_Neumo23_PerCapita_1961.xlsx")

ANO_COHORTE = 1961

# Archivos de Programáticas Residencia (2014-2026)
# Incluimos desde 2014 por ser el año de incorporación de Neumo23 al PNI de adultos mayores
PROGRAMATICAS_FILES = {
    2014: os.path.join(BD_2000_2024, "Programáticas_Residencia_2014"),
    2015: os.path.join(BD_2000_2024, "Programáticas_Residencia_2015"),
    2016: os.path.join(BD_2000_2024, "Programáticas_Residencia_2016"),
    2017: os.path.join(BD_2000_2024, "Programáticas_Residencia_2017"),
    2018: os.path.join(BD_2000_2024, "Programáticas_Residencia_2018"),
    2019: os.path.join(BD_2000_2024, "Programáticas_Residencia_2019.csv"),
    2020: os.path.join(BD_2000_2024, "Programáticas_Residencia_2020.csv"),
    2021: os.path.join(BD_2000_2024, "Programáticas_Residencia_2021.csv"),
    2022: os.path.join(BD_2000_2024, "Programáticas_Residencia_2022.csv"),
    2023: os.path.join(BD_2000_2024, "Programáticas_Residencia_2023.csv"),
    2024: os.path.join(BD_2000_2024, "Programáticas_Residencia_2024.csv"),
    2025: os.path.join(BD_2025, "Programáticas_Residencia_2025.csv"),
    2026: os.path.join(BD_2026, "Programáticas_Residencia_2026.csv"),
}

# Archivos de Defunciones (2014-2026)
DEFUNCIONES_FILES = {
    2014: os.path.join(BD_2000_2024, "DEF2014.xlsx"),
    2015: os.path.join(BD_2000_2024, "DEF2015.xlsx"),
    2016: os.path.join(BD_2000_2024, "DEF2016.xlsx"),
    2017: os.path.join(BD_2000_2024, "DEF2017.xlsx"),
    2018: os.path.join(BD_2000_2024, "DEF2018.csv"),
    2019: os.path.join(BD_2000_2024, "DEF2019.csv"),
    2020: os.path.join(BD_2000_2024, "DEF2020.csv"),
    2021: os.path.join(BD_2000_2024, "DEF2021.csv"),
    2022: os.path.join(BD_2000_2024, "DEF2022.csv"),
    2023: os.path.join(BD_2000_2024, "DEF2023.csv"),
    2024: os.path.join(BD_2000_2024, "DEF2024.csv"),
    2025: os.path.join(BD_2025, "DEF2025.csv"),
    2026: os.path.join(BD_2026, "DEF2026.csv"),
}

# Keywords para identificar Neumocócica 23V
NEUMO23_KEYWORDS = ["NEUMOC", "PNEUMO"]


# =============================================================================
# UTILIDADES
# =============================================================================

def normalizar_run(run_raw):
    """
    Normaliza un RUN a solo la parte numérica (sin DV, sin puntos, sin guión).
    Retorna string numérico o None.
    """
    if run_raw is None:
        return None
    s = str(run_raw).strip().upper()
    # Quitar puntos y espacios
    s = s.replace(".", "").replace(" ", "")
    # Quitar guión y todo lo que sigue (DV)
    if "-" in s:
        s = s.split("-")[0]
    # Quitar DV si es solo 1 carácter al final y el resto es numérico
    # Pero si ya es numérico puro, dejarlo
    if s.isdigit():
        return s
    # Intentar quitar último carácter (posible DV pegado)
    if len(s) > 1 and s[:-1].isdigit():
        return s[:-1]
    # Intentar extraer solo dígitos
    digits = ''.join(c for c in s if c.isdigit())
    if digits:
        return digits
    return None


def detectar_separador(filepath):
    """Detecta el separador de un archivo CSV/texto."""
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        line = f.readline()
    if '|' in line:
        return '|'
    elif ';' in line:
        return ';'
    elif '\t' in line:
        return '\t'
    return ','


def es_neumo23(nombre_vacuna):
    """Identifica si es vacuna Neumocócica polisacárida 23V."""
    if not nombre_vacuna:
        return False
    n = str(nombre_vacuna).upper()
    # Debe contener alguna keyword de neumocócica Y contener "23"
    tiene_neumo = any(kw in n for kw in NEUMO23_KEYWORDS)
    tiene_23 = "23" in n
    return tiene_neumo and tiene_23


def formatear_tiempo(segundos):
    """Formatea segundos en formato legible."""
    if segundos < 60:
        return f"{segundos:.1f}s"
    mins = int(segundos // 60)
    secs = segundos % 60
    return f"{mins}m {secs:.0f}s"


# =============================================================================
# PASO 1: CONSTRUIR SET DE RUNS FALLECIDOS
# =============================================================================

def construir_set_fallecidos():
    """
    Recorre DEF 2016-2026 y construye un set con todos los RUNs fallecidos.
    """
    print("\n" + "=" * 70)
    print("PASO 1: Construir set de RUNs fallecidos (DEF 2014-2026)")
    print("=" * 70)

    fallecidos = set()
    t_total = time.time()

    for ano in sorted(DEFUNCIONES_FILES.keys()):
        filepath = DEFUNCIONES_FILES[ano]
        if not os.path.exists(filepath):
            print(f"  ⚠ {ano}: Archivo no encontrado: {os.path.basename(filepath)}")
            continue

        t0 = time.time()
        count = 0
        ext = os.path.splitext(filepath)[1].lower()

        if ext == '.xlsx':
            # Leer Excel
            wb = openpyxl.load_workbook(filepath, data_only=True, read_only=True)
            ws = wb[wb.sheetnames[0]]
            header_found = False
            col_run = 0  # Por defecto columna 0

            for row in ws.iter_rows(values_only=True):
                if not header_found:
                    # Buscar columna RUN en el header
                    for j, v in enumerate(row):
                        if v is not None and str(v).strip().upper() == "RUN":
                            col_run = j
                            break
                    header_found = True
                    continue

                if col_run < len(row) and row[col_run] is not None:
                    run = normalizar_run(row[col_run])
                    if run:
                        fallecidos.add(run)
                        count += 1

            wb.close()
        else:
            # Leer CSV
            sep = detectar_separador(filepath)
            with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
                reader = csv.DictReader(f, delimiter=sep)
                for row in reader:
                    run_raw = row.get('RUN', '').strip()
                    if run_raw:
                        run = normalizar_run(run_raw)
                        if run:
                            fallecidos.add(run)
                            count += 1

        elapsed = time.time() - t0
        print(f"  ✓ DEF {ano}: {count:>8,} registros ({formatear_tiempo(elapsed)})")

    elapsed_total = time.time() - t_total
    print(f"\n  TOTAL FALLECIDOS (RUNs únicos): {len(fallecidos):,}")
    print(f"  Tiempo total: {formatear_tiempo(elapsed_total)}")

    return fallecidos


# =============================================================================
# PASO 2: CONSTRUIR SET DE RUNS CON NEUMO23
# =============================================================================

def construir_set_vacunados_neumo23():
    """
    Recorre Programáticas Residencia 2016-2026 y construye un dict con
    RUNs que tienen al menos 1 dosis de Neumo23 válida.
    Retorna: dict { run: { 'fecha': fecha_inmunización, 'año': año_base } }
    """
    print("\n" + "=" * 70)
    print("PASO 2: Buscar vacunados Neumo23 en Programáticas (2014-2026)")
    print("=" * 70)

    # Dict: run → { 'fecha': str, 'ano': int, 'establecimiento': str }
    vacunados_neumo23 = {}
    t_total = time.time()

    for ano in sorted(PROGRAMATICAS_FILES.keys()):
        filepath = PROGRAMATICAS_FILES[ano]
        if not os.path.exists(filepath):
            print(f"  ⚠ {ano}: Archivo no encontrado: {os.path.basename(filepath)}")
            continue

        t0 = time.time()
        count_total = 0
        count_neumo23 = 0

        sep = detectar_separador(filepath)

        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            reader = csv.DictReader(f, delimiter=sep)

            for row in reader:
                count_total += 1

                # Filtros MINSAL obligatorios
                if row.get("VACUNA_ADMINISTRADA", "").strip().upper() != "SI":
                    continue
                if row.get("REGISTRO_ELIMINADO", "").strip().upper() != "NO":
                    continue
                if row.get("CRITERIO_ELEGIBILIDAD", "").strip().upper() == "EPRO":
                    continue
                if row.get("DOSIS", "").strip().upper() == "EPRO":
                    continue

                nombre_vacuna = row.get("NOMBRE_VACUNA", "").strip()
                if not es_neumo23(nombre_vacuna):
                    continue

                run = normalizar_run(row.get("RUN", ""))
                if not run:
                    continue

                count_neumo23 += 1

                # Guardar la vacunación más reciente
                fecha_inmu = row.get("FECHA_INMUNIZACION", "").strip()
                estab = row.get("ESTABLECIMIENTO", "").strip()

                if run not in vacunados_neumo23:
                    vacunados_neumo23[run] = {
                        'fecha': fecha_inmu,
                        'ano': ano,
                        'establecimiento': estab,
                        'vacuna': nombre_vacuna
                    }
                else:
                    # Mantener la más reciente
                    if ano > vacunados_neumo23[run]['ano']:
                        vacunados_neumo23[run] = {
                            'fecha': fecha_inmu,
                            'ano': ano,
                            'establecimiento': estab,
                            'vacuna': nombre_vacuna
                        }

        elapsed = time.time() - t0
        print(f"  ✓ Prog {ano}: {count_neumo23:>6,} Neumo23 de {count_total:>9,} registros ({formatear_tiempo(elapsed)})")

    elapsed_total = time.time() - t_total
    print(f"\n  TOTAL VACUNADOS NEUMO23 (RUNs únicos): {len(vacunados_neumo23):,}")
    print(f"  Tiempo total: {formatear_tiempo(elapsed_total)}")

    return vacunados_neumo23


# =============================================================================
# PASO 3: LEER UNIVERSO CRÓNICOS RESPIRATORIOS
# =============================================================================

def leer_universo_cronicos():
    """
    Lee el Excel de AM Crónicos Respiratorios y extrae nacidos en 1961.
    """
    print("\n" + "=" * 70)
    print("PASO 3A: Leer universo Crónicos Respiratorios (nacidos 1961)")
    print("=" * 70)

    if not os.path.exists(EXCEL_CRONICOS):
        print(f"  ERROR: No se encontró: {EXCEL_CRONICOS}")
        return []

    wb = openpyxl.load_workbook(EXCEL_CRONICOS, data_only=True, read_only=True)
    ws = wb["Hoja1"]

    personas = []
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i == 0:  # Header
            continue

        fecha_nac = row[4] if len(row) > 4 else None
        if fecha_nac is None or not hasattr(fecha_nac, 'year'):
            continue
        if fecha_nac.year != ANO_COHORTE:
            continue

        run = normalizar_run(row[3] if len(row) > 3 else None)
        if not run:
            continue

        persona = {
            'run': run,
            'nombres': str(row[0] or "").strip(),
            'apellido_paterno': str(row[1] or "").strip(),
            'apellido_materno': str(row[2] or "").strip(),
            'fecha_nacimiento': fecha_nac.strftime("%d/%m/%Y") if fecha_nac else "",
            'edad': int(row[19]) if len(row) > 19 and row[19] is not None else "",
            'sexo': "",  # No disponible en esta base
            'comuna': str(row[6] or "").strip(),
            'establecimiento': str(row[5] or "").strip(),
            'fecha_neumo_excel': row[18] if len(row) > 18 else None,  # FECHA_NEUMO del Excel
        }
        personas.append(persona)

    wb.close()
    print(f"  Total nacidos {ANO_COHORTE}: {len(personas):,}")
    return personas


# =============================================================================
# PASO 3B: LEER UNIVERSO PER CÁPITA
# =============================================================================

def leer_universo_percapita():
    """
    Lee el Excel de Población Per Cápita y extrae nacidos en 1961.
    Columnas: RUN(12/idx11), DV(13), NOMBRES(14), AP_PAT(15), AP_MAT(16),
              FECHA_NAC(17/idx16), EDAD(18/idx17), GENERO(20/idx19),
              COD_COMUNA(3/idx2), NOMBRE_COMUNA(4/idx3),
              COD_CENTRO(7/idx6), NOMBRE_CENTRO(8/idx7)
    """
    print("\n" + "=" * 70)
    print("PASO 3B: Leer universo Per Cápita (nacidos 1961)")
    print("=" * 70)

    if not os.path.exists(EXCEL_PERCAPITA):
        print(f"  ERROR: No se encontró: {EXCEL_PERCAPITA}")
        return []

    wb = openpyxl.load_workbook(EXCEL_PERCAPITA, data_only=True, read_only=True)
    ws = wb["SSO"]

    personas = []
    total = 0
    runs_vistos = set()

    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i == 0:  # Header
            continue
        total += 1

        # Fecha nacimiento (idx 16)
        fecha_nac_raw = row[16] if len(row) > 16 else None
        if fecha_nac_raw is None:
            continue

        # Parsear fecha
        ano_nac = None
        fecha_nac_str = ""
        if hasattr(fecha_nac_raw, 'year'):
            ano_nac = fecha_nac_raw.year
            fecha_nac_str = fecha_nac_raw.strftime("%d/%m/%Y")
        else:
            s = str(fecha_nac_raw).strip()
            # Formato "YYYY-MM-DD HH:MM:SS"
            try:
                dt = datetime.strptime(s[:10], "%Y-%m-%d")
                ano_nac = dt.year
                fecha_nac_str = dt.strftime("%d/%m/%Y")
            except:
                continue

        if ano_nac > ANO_COHORTE:
            continue

        run = normalizar_run(row[11] if len(row) > 11 else None)
        if not run:
            continue

        # Evitar duplicados por RUN
        if run in runs_vistos:
            continue
        runs_vistos.add(run)

        persona = {
            'run': run,
            'nombres': str(row[13] or "").strip() if len(row) > 13 else "",
            'apellido_paterno': str(row[14] or "").strip() if len(row) > 14 else "",
            'apellido_materno': str(row[15] or "").strip() if len(row) > 15 else "",
            'fecha_nacimiento': fecha_nac_str,
            'edad': row[17] if len(row) > 17 and row[17] is not None else "",
            'sexo': str(row[19] or "").strip() if len(row) > 19 else "",
            'comuna': str(row[3] or "").strip() if len(row) > 3 else "",
            'establecimiento': str(row[7] or "").strip() if len(row) > 7 else "",
            'fecha_neumo_excel': None,
            'ano_nac': ano_nac,
        }
        personas.append(persona)

        if total % 50000 == 0:
            print(f"  ... procesando fila {total:,} ({len(personas):,} nacidos <= {ANO_COHORTE})...")

    wb.close()
    
    # Separar en dos grupos
    grupo_65 = [p for p in personas if p['ano_nac'] == ANO_COHORTE]
    grupo_66_mas = [p for p in personas if p['ano_nac'] < ANO_COHORTE]

    print(f"  Total filas revisadas: {total:,}")
    print(f"  Total nacidos {ANO_COHORTE} (65 años): {len(grupo_65):,}")
    print(f"  Total nacidos <= {ANO_COHORTE-1} (66+ años): {len(grupo_66_mas):,}")

    return grupo_65, grupo_66_mas


# =============================================================================
# PASO 4: GENERAR REPORTE EXCEL
# =============================================================================

def generar_reporte_excel(personas, vacunados_neumo23, fallecidos, output_path, titulo_reporte):
    """
    Genera el Excel de rescate con 3 hojas:
    - Resumen: Por comuna y establecimiento
    - Pendientes: Solo los que necesitan vacunarse (vivos sin Neumo23)
    - Todos: Listado completo con estado
    """
    print(f"\n{'='*70}")
    print(f"GENERANDO: {titulo_reporte}")
    print(f"{'='*70}")

    # Clasificar cada persona
    resultados = []
    stats = {
        'total': len(personas),
        'vacunados': 0,
        'fallecidos': 0,
        'pendientes': 0,
    }

    for p in personas:
        run = p['run']
        estado = "PENDIENTE"
        ano_vacunacion = ""
        fecha_vacunacion = ""
        establecimiento_vac = ""
        vacuna_nombre = ""

        # ¿Fallecido?
        if run in fallecidos:
            estado = "FALLECIDO"
            stats['fallecidos'] += 1
        # ¿Vacunado en Programáticas?
        elif run in vacunados_neumo23:
            estado = "VACUNADO"
            info = vacunados_neumo23[run]
            ano_vacunacion = info['ano']
            fecha_vacunacion = info['fecha']
            establecimiento_vac = info['establecimiento']
            vacuna_nombre = info['vacuna']
            stats['vacunados'] += 1
        # ¿Tiene FECHA_NEUMO en el Excel original? (solo para crónicos)
        elif p.get('fecha_neumo_excel') is not None:
            estado = "VACUNADO (según Excel crónicos)"
            if hasattr(p['fecha_neumo_excel'], 'strftime'):
                fecha_vacunacion = p['fecha_neumo_excel'].strftime("%d/%m/%Y")
                ano_vacunacion = p['fecha_neumo_excel'].year
            else:
                fecha_vacunacion = str(p['fecha_neumo_excel'])
            stats['vacunados'] += 1
        else:
            stats['pendientes'] += 1

        resultados.append({
            **p,
            'estado': estado,
            'ano_vacunacion': ano_vacunacion,
            'fecha_vacunacion': fecha_vacunacion,
            'establecimiento_vacunacion': establecimiento_vac,
            'vacuna_nombre': vacuna_nombre,
        })

    print(f"\n  Total universo:    {stats['total']:,}")
    print(f"  Vacunados:         {stats['vacunados']:,} ({stats['vacunados']/stats['total']*100:.1f}%)")
    print(f"  Fallecidos:        {stats['fallecidos']:,}")
    print(f"  ★ PENDIENTES:      {stats['pendientes']:,} ({stats['pendientes']/stats['total']*100:.1f}%)")

    # =========================================================================
    # CREAR EXCEL
    # =========================================================================
    wb = openpyxl.Workbook()

    # Estilos
    header_fill = PatternFill(start_color="1F4E79", end_color="1F4E79", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)

    pendiente_fill = PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid")
    vacunado_fill = PatternFill(start_color="D5F5E3", end_color="D5F5E3", fill_type="solid")
    fallecido_fill = PatternFill(start_color="E8DAEF", end_color="E8DAEF", fill_type="solid")

    title_font = Font(name="Calibri", size=14, bold=True, color="1F4E79")
    subtitle_font = Font(name="Calibri", size=11, italic=True, color="555555")
    stat_font = Font(name="Calibri", size=12, bold=True)

    thin_border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )

    # =====================================================================
    # HOJA 1: RESUMEN
    # =====================================================================
    ws_resumen = wb.active
    ws_resumen.title = "Resumen"

    # Título
    ws_resumen.merge_cells('A1:G1')
    ws_resumen['A1'] = titulo_reporte
    ws_resumen['A1'].font = title_font

    ws_resumen.merge_cells('A2:G2')
    ws_resumen['A2'] = f"Cohorte nacidos {ANO_COHORTE} — Generado {datetime.now().strftime('%d/%m/%Y %H:%M')}"
    ws_resumen['A2'].font = subtitle_font

    # Estadísticas generales
    row_start = 4
    stats_data = [
        ("Total universo", stats['total']),
        ("Vacunados Neumo23", stats['vacunados']),
        ("Fallecidos (excluidos)", stats['fallecidos']),
        ("PENDIENTES DE VACUNAR", stats['pendientes']),
    ]
    for i, (label, value) in enumerate(stats_data):
        r = row_start + i
        ws_resumen[f'A{r}'] = label
        ws_resumen[f'A{r}'].font = Font(name="Calibri", size=11, bold=(i == 3))
        ws_resumen[f'B{r}'] = value
        ws_resumen[f'B{r}'].font = Font(name="Calibri", size=11, bold=(i == 3))
        ws_resumen[f'B{r}'].number_format = '#,##0'
        if stats['total'] > 0:
            ws_resumen[f'C{r}'] = value / stats['total']
            ws_resumen[f'C{r}'].number_format = '0.0%'

    # Tabla por comuna
    pendientes_list = [r for r in resultados if r['estado'] == 'PENDIENTE']
    pendientes_por_comuna = Counter(p['comuna'] for p in pendientes_list)
    vacunados_por_comuna = Counter(p['comuna'] for p in resultados if 'VACUNADO' in p['estado'])
    fallecidos_por_comuna = Counter(p['comuna'] for p in resultados if p['estado'] == 'FALLECIDO')

    r = row_start + len(stats_data) + 2
    ws_resumen[f'A{r}'] = "Detalle por Comuna"
    ws_resumen[f'A{r}'].font = Font(name="Calibri", size=12, bold=True, color="1F4E79")
    r += 1

    headers_comuna = ["Comuna", "Total", "Vacunados", "Fallecidos", "Pendientes", "% Cobertura"]
    for j, h in enumerate(headers_comuna):
        cell = ws_resumen.cell(row=r, column=j+1, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_align
        cell.border = thin_border

    todas_comunas = sorted(set(p['comuna'] for p in resultados))
    for comuna in todas_comunas:
        r += 1
        total_comuna = sum(1 for p in resultados if p['comuna'] == comuna)
        vac_comuna = vacunados_por_comuna.get(comuna, 0)
        fall_comuna = fallecidos_por_comuna.get(comuna, 0)
        pend_comuna = pendientes_por_comuna.get(comuna, 0)
        cob = vac_comuna / (vac_comuna + pend_comuna) if (vac_comuna + pend_comuna) > 0 else 0

        ws_resumen.cell(row=r, column=1, value=comuna).border = thin_border
        ws_resumen.cell(row=r, column=2, value=total_comuna).border = thin_border
        ws_resumen.cell(row=r, column=3, value=vac_comuna).border = thin_border
        ws_resumen.cell(row=r, column=4, value=fall_comuna).border = thin_border
        cell_pend = ws_resumen.cell(row=r, column=5, value=pend_comuna)
        cell_pend.border = thin_border
        cell_pend.font = Font(bold=True)
        cell_cob = ws_resumen.cell(row=r, column=6, value=cob)
        cell_cob.border = thin_border
        cell_cob.number_format = '0.0%'

    # Total
    r += 1
    total_vac = stats['vacunados']
    total_pend = stats['pendientes']
    cob_total = total_vac / (total_vac + total_pend) if (total_vac + total_pend) > 0 else 0
    for j, val in enumerate(["TOTAL", stats['total'], total_vac, stats['fallecidos'], total_pend, cob_total]):
        cell = ws_resumen.cell(row=r, column=j+1, value=val)
        cell.border = thin_border
        cell.font = Font(bold=True)
        if j == 5:
            cell.number_format = '0.0%'

    # Tabla por establecimiento (pendientes)
    r += 3
    ws_resumen[f'A{r}'] = "Pendientes por Establecimiento"
    ws_resumen[f'A{r}'].font = Font(name="Calibri", size=12, bold=True, color="1F4E79")
    r += 1

    pendientes_por_estab = Counter(p['establecimiento'] for p in pendientes_list)
    headers_estab = ["Establecimiento", "Comuna", "Pendientes"]
    for j, h in enumerate(headers_estab):
        cell = ws_resumen.cell(row=r, column=j+1, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_align
        cell.border = thin_border

    # Mapear establecimiento → comuna
    estab_comuna = {}
    for p in pendientes_list:
        estab_comuna[p['establecimiento']] = p['comuna']

    for estab, cnt in pendientes_por_estab.most_common():
        r += 1
        ws_resumen.cell(row=r, column=1, value=estab).border = thin_border
        ws_resumen.cell(row=r, column=2, value=estab_comuna.get(estab, "")).border = thin_border
        cell_cnt = ws_resumen.cell(row=r, column=3, value=cnt)
        cell_cnt.border = thin_border
        cell_cnt.font = Font(bold=True)

    # Ajustar anchos
    ws_resumen.column_dimensions['A'].width = 45
    ws_resumen.column_dimensions['B'].width = 15
    ws_resumen.column_dimensions['C'].width = 15
    ws_resumen.column_dimensions['D'].width = 15
    ws_resumen.column_dimensions['E'].width = 15
    ws_resumen.column_dimensions['F'].width = 15

    # =====================================================================
    # HOJA 2: PENDIENTES (listado para rescate)
    # =====================================================================
    ws_pend = wb.create_sheet("Pendientes Rescate")

    headers_pend = [
        "N°", "RUN", "Nombres", "Apellido Paterno", "Apellido Materno",
        "Fecha Nacimiento", "Edad", "Sexo", "Comuna", "Establecimiento"
    ]

    for j, h in enumerate(headers_pend):
        cell = ws_pend.cell(row=1, column=j+1, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_align
        cell.border = thin_border

    # Ordenar por establecimiento, luego por apellido
    pendientes_sorted = sorted(pendientes_list,
                                key=lambda p: (p['comuna'], p['establecimiento'],
                                               p['apellido_paterno'], p['apellido_materno']))

    for idx, p in enumerate(pendientes_sorted, 1):
        r = idx + 1
        valores = [
            idx,
            p['run'],
            p['nombres'],
            p['apellido_paterno'],
            p['apellido_materno'],
            p['fecha_nacimiento'],
            p['edad'],
            p['sexo'],
            p['comuna'],
            p['establecimiento'],
        ]
        for j, val in enumerate(valores):
            cell = ws_pend.cell(row=r, column=j+1, value=val)
            cell.border = thin_border
            cell.fill = pendiente_fill

    # Ajustar anchos
    anchos_pend = [5, 12, 25, 20, 20, 15, 8, 12, 25, 45]
    for j, ancho in enumerate(anchos_pend):
        ws_pend.column_dimensions[get_column_letter(j+1)].width = ancho

    # Filtro automático
    ws_pend.auto_filter.ref = f"A1:{get_column_letter(len(headers_pend))}{len(pendientes_sorted)+1}"

    # Guardar
    wb.save(output_path)
    print(f"\n  ✓ Reporte guardado: {output_path}")
    print(f"    Hoja 'Resumen': Estadísticas por comuna y establecimiento")
    print(f"    Hoja 'Pendientes Rescate': {len(pendientes_list):,} personas para rescatar")

    return stats


# =============================================================================
# MAIN
# =============================================================================

def main():
    print("=" * 70)
    print("RESCATE NEUMOCÓCICA 23V — COHORTE NACIDOS 1961")
    print("Servicio de Salud Osorno — Provincia de Osorno")
    print(f"Fecha de ejecución: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    print("=" * 70)

    t_inicio = time.time()

    # Paso 1: Fallecidos
    fallecidos = construir_set_fallecidos()

    # Paso 2: Vacunados Neumo23
    vacunados_neumo23 = construir_set_vacunados_neumo23()

    # Paso 3A: Universo Crónicos
    universo_cronicos = leer_universo_cronicos()

    # Paso 3B: Universo Per Cápita
    percapita_65, percapita_66_mas = leer_universo_percapita()

    # Paso 4A: Reporte 1 — Crónicos Respiratorios
    stats1 = generar_reporte_excel(
        universo_cronicos,
        vacunados_neumo23,
        fallecidos,
        OUTPUT_REPORTE1,
        "Rescate Neumo23 — Adultos Mayores Crónicos Respiratorios (Nacidos 1961)"
    )

    # Paso 4B: Reporte 2 — Per Cápita (65 años)
    stats2 = generar_reporte_excel(
        percapita_65,
        vacunados_neumo23,
        fallecidos,
        OUTPUT_REPORTE2,
        "Rescate Neumo23 — Población Per Cápita (Nacidos 1961)"
    )

    # Paso 4C: Reporte 3 — Per Cápita (66 años y más)
    output_reporte3 = os.path.join(OUTPUT_DIR, "Rescate_Neumo23_PerCapita_66_y_mas.xlsx")
    stats3 = generar_reporte_excel(
        percapita_66_mas,
        vacunados_neumo23,
        fallecidos,
        output_reporte3,
        "Rescate Neumo23 — Población Per Cápita Rezagados (<= 1960)"
    )

    # Resumen final
    elapsed = time.time() - t_inicio
    print("\n" + "=" * 70)
    print("RESUMEN FINAL")
    print("=" * 70)
    print(f"\n  Reporte 1 (Crónicos Respiratorios):")
    print(f"    Universo: {stats1['total']:,} | Pendientes: {stats1['pendientes']:,} | Vacunados: {stats1['vacunados']:,} | Fallecidos: {stats1['fallecidos']:,}")
    print(f"    → {OUTPUT_REPORTE1}")
    print(f"\n  Reporte 2 (Per Cápita 65 años):")
    print(f"    Universo: {stats2['total']:,} | Pendientes: {stats2['pendientes']:,} | Vacunados: {stats2['vacunados']:,} | Fallecidos: {stats2['fallecidos']:,}")
    print(f"    → {OUTPUT_REPORTE2}")
    print(f"\n  Reporte 3 (Per Cápita 66+ años):")
    print(f"    Universo: {stats3['total']:,} | Pendientes: {stats3['pendientes']:,} | Vacunados: {stats3['vacunados']:,} | Fallecidos: {stats3['fallecidos']:,}")
    print(f"    → {output_reporte3}")
    print(f"\n  Tiempo total: {formatear_tiempo(elapsed)}")
    print("=" * 70)


if __name__ == "__main__":
    main()
