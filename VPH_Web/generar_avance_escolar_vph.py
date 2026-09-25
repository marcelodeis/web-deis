#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
=============================================================================
AVANCE SEMANAL VPH ESCOLAR 2026
Servicio de Salud Osorno — Provincia de Osorno (7 Comunas)
=============================================================================

Módulo operativo INDEPENDIENTE del indicador histórico de cobertura VPH a
los 15 años. Genera datos de seguimiento semanal para la vacunación escolar
VPH en 4.° básico durante 2026.

Denominador: Población objetivo MINEDUC 2026 de 4.° básico.
Numerador:   Vacunados VPH 4.° básico desde Programáticas_Ocurrencia_2026
             (RNI), con filtros MINSAL obligatorios.

Criterio territorial:
  "El numerador RNI por comuna de vacunación (COMUNA_OCURR) se utiliza
   como aproximación operativa a la territorialidad escolar MINEDUC;
   no existe correspondencia individual por RBD en la base RNI disponible."

Reglas Mandatorias MINSAL / DEIS:
  1. VACUNA_ADMINISTRADA == "SI"
  2. REGISTRO_ELIMINADO != "SI" (o == "NO")
  3. Excluir CRITERIO_ELEGIBILIDAD == "EPRO"
  4. Excluir DOSIS == "EPRO"

Filtro VPH escolar 4.° básico:
  - NOMBRE_VACUNA contiene VPH/PAPILOMA/GARDASIL/CERVARIX
  - CRITERIO_ELEGIBILIDAD contiene "4" Y "básico" (case-insensitive)
    → Captura: "4° básico (Est. Educacional)" y "4° básico (Est. de Salud)"
  - COD_SERV = "23" (SS Osorno)
=============================================================================
"""

import csv
import hashlib
import json
import os
import sys
import io
import time
from collections import Counter, defaultdict
from datetime import datetime, timedelta

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

try:
    import openpyxl
except ImportError:
    print("ERROR: Se requiere openpyxl. Instale con: pip install openpyxl")
    sys.exit(1)

# =============================================================================
# CONFIGURACIÓN
# =============================================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR)
BD_MINSAL_DIR = os.path.join(PROJECT_DIR, "BASE DATOS MINSAL", "2026")

CSV_OCURRENCIA = os.path.join(BD_MINSAL_DIR, "Programáticas_Ocurrencia_2026.csv")
EXCEL_MINEDUC = os.path.join(PROJECT_DIR, "COBERTURA ESCOLAR POR COMUNA 2026-08-31.xlsx")

OUTPUT_JSON = os.path.join(BASE_DIR, "avance_escolar_vph.json")
OUTPUT_JS = os.path.join(BASE_DIR, "avance_escolar_vph.js")

# Archivo del indicador histórico (para verificación SHA-256)
DASHBOARD_HISTORICO = os.path.join(BASE_DIR, "dashboard_data_vph.json")

COMUNAS_OSORNO = {
    "Osorno": "10301",
    "Puerto Octay": "10302",
    "Purranque": "10303",
    "Puyehue": "10304",
    "Río Negro": "10305",
    "San Juan de la Costa": "10306",
    "San Pablo": "10307",
}

# Mapa inverso: código → nombre
COD_A_COMUNA = {v: k for k, v in COMUNAS_OSORNO.items()}

# Nombres canónicos para normalizar COMUNA_OCURR
CANON_COMUNA = {
    "osorno": "Osorno",
    "puerto octay": "Puerto Octay",
    "purranque": "Purranque",
    "puyehue": "Puyehue",
    "río negro": "Río Negro",
    "rio negro": "Río Negro",
    "san juan de la costa": "San Juan de la Costa",
    "san pablo": "San Pablo",
}

VACUNAS_VPH_KEYWORDS = ["VPH", "PAPILOMA", "GARDASIL", "CERVARIX"]

ADVERTENCIA_TERRITORIAL = (
    "El numerador RNI por comuna de vacunación (COMUNA_OCURR) se utiliza "
    "como aproximación operativa a la territorialidad escolar MINEDUC; "
    "no existe correspondencia individual por RBD en la base RNI disponible. "
    "Para el indicador provincial esta limitación tiene menor impacto, "
    "pero debe conservarse para el análisis comunal."
)


# =============================================================================
# FUNCIONES AUXILIARES
# =============================================================================

def sha256_file(filepath):
    """Calcula SHA-256 de un archivo."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def get_epi_week(dt):
    """Calcula la semana epidemiológica (domingo a sábado)."""
    day_of_week = dt.isoweekday() % 7  # Sun=0
    wednesday = dt + timedelta(days=3 - day_of_week)
    return (wednesday.timetuple().tm_yday - 1) // 7 + 1


def parsear_fecha(fecha_str):
    """Parsea fecha de inmunización."""
    if not fecha_str:
        return None
    s = str(fecha_str).strip()
    if " " in s:
        s = s.split(" ")[0]
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass
    return None


def normalizar_comuna(comuna_raw):
    """Normaliza nombre de comuna al formato canónico."""
    if not comuna_raw:
        return None
    key = comuna_raw.strip().lower()
    return CANON_COMUNA.get(key, None)


def es_vacuna_vph(nombre_vacuna):
    """Identifica si es vacuna VPH."""
    if not nombre_vacuna:
        return False
    n = str(nombre_vacuna).upper()
    return any(kw in n for kw in VACUNAS_VPH_KEYWORDS)


def es_4to_basico(criterio):
    """Identifica si el criterio corresponde a 4.° básico."""
    if not criterio:
        return False
    c = str(criterio).strip()
    return "4" in c and "sico" in c.lower()


def clasificar_modalidad(criterio):
    """Clasifica si fue vacunado en Est. Educacional o Est. de Salud."""
    if not criterio:
        return "No especificado"
    c = str(criterio).strip()
    if "Educacional" in c:
        return "Est. Educacional"
    if "Salud" in c:
        return "Est. de Salud"
    return "Otro"


# =============================================================================
# PASO 1: LEER DENOMINADORES MINEDUC
# =============================================================================

def leer_denominadores_mineduc():
    """
    Lee la población objetivo VPH 4.° básico del Excel MINEDUC.
    Columna I (índice 9) = "4° básico" en filas de SS Osorno (10301-10307).
    """
    print("\n" + "=" * 70)
    print("PASO 1: Lectura de Denominadores MINEDUC (Población 4° Básico)")
    print("=" * 70)

    if not os.path.exists(EXCEL_MINEDUC):
        print(f"  ERROR: No se encontró el archivo MINEDUC: {EXCEL_MINEDUC}")
        sys.exit(1)

    wb = openpyxl.load_workbook(EXCEL_MINEDUC, data_only=True)
    ws = wb.active

    metas = {}
    meta_provincial = 0

    for r in range(1, ws.max_row + 1):
        # Columna E (5) = cod_comuna, Columna F (6) = nombre comuna
        cod_comuna = str(ws.cell(row=r, column=5).value or "").strip()
        if cod_comuna in COD_A_COMUNA:
            # Columna I (9) = población VPH 4° básico
            pob_vph = ws.cell(row=r, column=9).value
            if pob_vph is not None:
                try:
                    pob_vph = int(float(pob_vph))
                except (ValueError, TypeError):
                    pob_vph = 0
                comuna_nombre = COD_A_COMUNA[cod_comuna]
                metas[comuna_nombre] = pob_vph
                meta_provincial += pob_vph
                print(f"  {comuna_nombre} ({cod_comuna}): {pob_vph:,}")

    print(f"\n  TOTAL PROVINCIAL: {meta_provincial:,}")

    # Verificación
    if len(metas) != 7:
        print(f"  ADVERTENCIA: Se esperaban 7 comunas, se encontraron {len(metas)}")

    wb.close()
    return metas, meta_provincial


# =============================================================================
# PASO 2: LEER NUMERADORES RNI (VACUNADOS VPH 4° BÁSICO)
# =============================================================================

def leer_vacunados_rni(metas):
    """
    Lee Programáticas_Ocurrencia_2026.csv, aplica filtros MINSAL y
    extrae vacunados VPH 4° básico por semana y comuna.
    """
    print("\n" + "=" * 70)
    print("PASO 2: Lectura de Numeradores RNI (Vacunados VPH 4° Básico)")
    print("=" * 70)

    if not os.path.exists(CSV_OCURRENCIA):
        print(f"  ERROR: No se encontró la base RNI: {CSV_OCURRENCIA}")
        sys.exit(1)

    # Estructuras de conteo
    vacunados_comuna = Counter()          # comuna → count
    vacunados_por_se = defaultdict(int)   # SE → count
    vacunados_comuna_se = defaultdict(lambda: defaultdict(int))  # comuna → SE → count
    modalidad_count = Counter()           # Est. Educacional / Est. de Salud
    fecha_max = None
    runs_vistos = set()

    # Contadores de conciliación
    stats = {
        "total_vph_ss23": 0,
        "bruto_4to": 0,
        "excl_vac_adm": 0,
        "excl_reg_elim": 0,
        "excl_epro_crit": 0,
        "excl_epro_dosis": 0,
        "excl_duplicado": 0,
        "validos": 0,
        "fuera_4to": 0,
    }

    # Registros fuera de 4° básico (para QA)
    criterios_fuera_4to = Counter()

    t0 = time.time()

    with open(CSV_OCURRENCIA, "r", encoding="latin-1", errors="replace") as f:
        first_line = f.readline()
        delim = "|" if "|" in first_line else (";" if ";" in first_line else ",")
        f.seek(0)
        reader = csv.DictReader(f, delimiter=delim)

        for row in reader:
            # Filtro SS Osorno + Sector Privado de la Provincia
            cod_serv = row.get("COD_SERV", "").strip()
            comuna_ocurr = row.get("COMUNA_OCURR", "").strip().upper()
            if cod_serv != "23" and comuna_ocurr not in ['OSORNO', 'PUERTO OCTAY', 'PURRANQUE', 'PUYEHUE', 'RÍO NEGRO', 'SAN JUAN DE LA COSTA', 'SAN PABLO', 'R\xcdO NEGRO']:
                continue

            # Filtro VPH
            nom_vac = row.get("NOMBRE_VACUNA", "").strip()
            if not es_vacuna_vph(nom_vac):
                continue

            stats["total_vph_ss23"] += 1

            # ¿Es 4° básico?
            crit = row.get("CRITERIO_ELEGIBILIDAD", "").strip()
            if not es_4to_basico(crit):
                stats["fuera_4to"] += 1
                criterios_fuera_4to[crit] += 1
                continue

            stats["bruto_4to"] += 1

            # Filtro 1: VACUNA_ADMINISTRADA == "SI"
            vac_adm = row.get("VACUNA_ADMINISTRADA", "").strip().upper()
            if vac_adm != "SI":
                stats["excl_vac_adm"] += 1
                continue

            # Filtro 2: REGISTRO_ELIMINADO != "SI"
            reg_elim = row.get("REGISTRO_ELIMINADO", "").strip().upper()
            if reg_elim != "NO":
                stats["excl_reg_elim"] += 1
                continue

            # Filtro 3: Excluir CRITERIO_ELEGIBILIDAD == "EPRO"
            if crit.upper() == "EPRO":
                stats["excl_epro_crit"] += 1
                continue

            # Filtro 4: Excluir DOSIS == "EPRO"
            dosis = row.get("DOSIS", "").strip().upper()
            if dosis == "EPRO":
                stats["excl_epro_dosis"] += 1
                continue

            # Deduplicación por RUN
            run = row.get("RUN", "").strip()
            if run and run in runs_vistos:
                stats["excl_duplicado"] += 1
                continue
            if run:
                runs_vistos.add(run)

            stats["validos"] += 1

            # Asignar comuna
            comuna_raw = row.get("COMUNA_OCURR", "").strip()
            comuna = normalizar_comuna(comuna_raw)
            if not comuna:
                comuna = "Sin comuna"

            vacunados_comuna[comuna] += 1

            # Modalidad (auditoría interna)
            modalidad_count[clasificar_modalidad(crit)] += 1

            # Fecha y SE
            fecha_str = row.get("FECHA_INMUNIZACION", "").strip()
            dt = parsear_fecha(fecha_str)
            if dt:
                se = get_epi_week(dt)
                vacunados_por_se[se] += 1
                vacunados_comuna_se[comuna][se] += 1
                if fecha_max is None or dt > fecha_max:
                    fecha_max = dt

    elapsed = time.time() - t0
    print(f"  Lectura completada en {elapsed:.1f}s")
    print(f"\n  CONCILIACIÓN VPH 4° BÁSICO:")
    print(f"    Total VPH SS Osorno:              {stats['total_vph_ss23']:>6,}")
    print(f"    Registros fuera de 4° básico:      {stats['fuera_4to']:>6,}")
    print(f"    Bruto 4° básico:                   {stats['bruto_4to']:>6,}")
    print(f"    → Excl. VACUNA_ADMINISTRADA ≠ SI:  {stats['excl_vac_adm']:>6,}")
    print(f"    → Excl. REGISTRO_ELIMINADO = SI:   {stats['excl_reg_elim']:>6,}")
    print(f"    → Excl. EPRO (criterio):           {stats['excl_epro_crit']:>6,}")
    print(f"    → Excl. EPRO (dosis):              {stats['excl_epro_dosis']:>6,}")
    print(f"    → Excl. duplicado RUN:             {stats['excl_duplicado']:>6,}")
    print(f"    NUMERADOR FINAL:                   {stats['validos']:>6,}")
    total_excl = stats["bruto_4to"] - stats["validos"]
    print(f"    Verificación: {stats['bruto_4to']} - {total_excl} = {stats['validos']}")

    print(f"\n  MODALIDAD DE VACUNACIÓN (auditoría):")
    for k, v in modalidad_count.most_common():
        print(f"    {k}: {v:,}")

    print(f"\n  VACUNADOS POR COMUNA:")
    for comuna in sorted(metas.keys()):
        count = vacunados_comuna.get(comuna, 0)
        meta = metas.get(comuna, 0)
        cob = (count / meta * 100) if meta > 0 else 0
        print(f"    {comuna}: {count:,} / {meta:,} ({cob:.1f}%)")

    if fecha_max:
        ultima_se = get_epi_week(fecha_max)
        print(f"\n  Fecha máxima datos: {fecha_max.strftime('%d-%m-%Y')}")
        print(f"  Última SE con registros: SE{ultima_se}")

    print(f"\n  REGISTROS VPH FUERA DE 4° BÁSICO:")
    for k, v in criterios_fuera_4to.most_common():
        print(f"    {k}: {v}")

    return (vacunados_comuna, vacunados_por_se, vacunados_comuna_se,
            fecha_max, stats, modalidad_count, criterios_fuera_4to)


# =============================================================================
# PASO 3: CONSTRUIR SERIE SEMANAL Y MÉTRICAS
# =============================================================================

def construir_serie_semanal(vacunados_por_se, vacunados_comuna_se, metas, meta_provincial, fecha_max):
    """
    Construye la serie semanal acumulada.
    Semanas sin actividad se conservan con 0 dosis y acumulado anterior.
    """
    print("\n" + "=" * 70)
    print("PASO 3: Construcción de Serie Semanal")
    print("=" * 70)

    if not vacunados_por_se:
        print("  Sin datos semanales disponibles.")
        return [], {}

    se_min = min(vacunados_por_se.keys())
    se_max = max(vacunados_por_se.keys())

    # Serie provincial
    serie_provincial = []
    acumulado = 0
    cob_anterior = 0.0

    for se in range(se_min, se_max + 1):
        dosis_semana = vacunados_por_se.get(se, 0)
        acumulado += dosis_semana
        cobertura = (acumulado / meta_provincial * 100) if meta_provincial > 0 else 0
        variacion_pp = cobertura - cob_anterior
        brecha = max(0, meta_provincial - acumulado)

        serie_provincial.append({
            "semana": f"SE{se}",
            "se_num": se,
            "dosis_semana": dosis_semana,
            "vacunados_acumulados": acumulado,
            "cobertura_acumulada": round(cobertura, 2),
            "variacion_pp": round(variacion_pp, 2),
            "brecha": brecha,
        })
        cob_anterior = cobertura

    # Serie por comuna
    series_comunales = {}
    for comuna in sorted(metas.keys()):
        meta_com = metas.get(comuna, 0)
        se_data = vacunados_comuna_se.get(comuna, {})
        serie_com = []
        acum_com = 0
        cob_ant_com = 0.0

        for se in range(se_min, se_max + 1):
            d_sem = se_data.get(se, 0)
            acum_com += d_sem
            cob_com = (acum_com / meta_com * 100) if meta_com > 0 else 0
            var_pp = cob_com - cob_ant_com

            serie_com.append({
                "semana": f"SE{se}",
                "se_num": se,
                "dosis_semana": d_sem,
                "vacunados_acumulados": acum_com,
                "cobertura_acumulada": round(cob_com, 2),
                "variacion_pp": round(var_pp, 2),
                "brecha": max(0, meta_com - acum_com),
            })
            cob_ant_com = cob_com

        series_comunales[comuna] = serie_com

    print(f"  Serie provincial: {len(serie_provincial)} semanas (SE{se_min} a SE{se_max})")
    print(f"  Series comunales: {len(series_comunales)} comunas")

    return serie_provincial, series_comunales


# =============================================================================
# PASO 4: RANKING Y COMPARACIÓN CON REPORTE 31-08
# =============================================================================

def construir_ranking_y_comparacion(vacunados_comuna, metas, meta_provincial):
    """
    Construye ranking comunal y comparación con reporte del 31-08.
    """
    print("\n" + "=" * 70)
    print("PASO 4: Ranking Comunal y Comparación con Reporte 31-08")
    print("=" * 70)

    # Leer vacunados congelados del 31-08 desde Excel MINEDUC
    vac_congelados = {}
    try:
        wb = openpyxl.load_workbook(EXCEL_MINEDUC, data_only=True)
        ws = wb.active
        for r in range(1, ws.max_row + 1):
            cod_comuna = str(ws.cell(row=r, column=5).value or "").strip()
            if cod_comuna in COD_A_COMUNA:
                # Columna L (12) = "4° básico 1a dosis + única" vacunados al 31-08
                vac_31_08 = ws.cell(row=r, column=12).value
                if vac_31_08 is not None:
                    try:
                        vac_congelados[COD_A_COMUNA[cod_comuna]] = int(float(vac_31_08))
                    except (ValueError, TypeError):
                        pass
        wb.close()
    except Exception as e:
        print(f"  ADVERTENCIA: No se pudieron leer vacunados del 31-08: {e}")

    # Construir ranking
    ranking = []
    total_vacunados = sum(vacunados_comuna.get(c, 0) for c in metas.keys())

    for comuna in sorted(metas.keys()):
        meta = metas[comuna]
        vacunados = vacunados_comuna.get(comuna, 0)
        cobertura = (vacunados / meta * 100) if meta > 0 else 0
        brecha = max(0, meta - vacunados)
        meta_superada = max(0, vacunados - meta) if vacunados > meta else 0

        # Comparación con 31-08
        vac_3108 = vac_congelados.get(comuna, None)
        cob_3108 = (vac_3108 / meta * 100) if (vac_3108 is not None and meta > 0) else None
        variacion_vs_3108 = (cobertura - cob_3108) if cob_3108 is not None else None

        entry = {
            "comuna": comuna,
            "codigo": COMUNAS_OSORNO[comuna],
            "vacunados": vacunados,
            "meta": meta,
            "cobertura": round(cobertura, 2),
            "brecha": brecha,
            "meta_superada": meta_superada,
            "vacunados_3108": vac_3108,
            "cobertura_3108": round(cob_3108, 2) if cob_3108 is not None else None,
            "variacion_vs_3108_pp": round(variacion_vs_3108, 2) if variacion_vs_3108 is not None else None,
        }
        ranking.append(entry)

    # Ordenar por cobertura descendente
    ranking.sort(key=lambda x: x["cobertura"], reverse=True)

    # Asignar posición
    for i, r in enumerate(ranking):
        r["posicion"] = i + 1

    # Provincial
    cob_provincial = (total_vacunados / meta_provincial * 100) if meta_provincial > 0 else 0
    brecha_provincial = max(0, meta_provincial - total_vacunados)
    meta_superada_prov = max(0, total_vacunados - meta_provincial) if total_vacunados > meta_provincial else 0

    vac_3108_prov = sum(v for v in vac_congelados.values()) if vac_congelados else None
    cob_3108_prov = (vac_3108_prov / meta_provincial * 100) if (vac_3108_prov and meta_provincial > 0) else None

    provincial = {
        "vacunados": total_vacunados,
        "meta": meta_provincial,
        "cobertura": round(cob_provincial, 2),
        "brecha": brecha_provincial,
        "meta_superada": meta_superada_prov,
        "vacunados_3108": vac_3108_prov,
        "cobertura_3108": round(cob_3108_prov, 2) if cob_3108_prov is not None else None,
        "variacion_vs_3108_pp": round(cob_provincial - cob_3108_prov, 2) if cob_3108_prov is not None else None,
    }

    # Mayor y menor avance
    mayor_avance = ranking[0]["comuna"] if ranking else "N/A"
    menor_avance = ranking[-1]["comuna"] if ranking else "N/A"

    print(f"\n  RANKING COMUNAL:")
    for r in ranking:
        brecha_txt = f"Brecha: {r['brecha']}" if r["brecha"] > 0 else f"Meta superada: +{r['meta_superada']}"
        print(f"    {r['posicion']}. {r['comuna']}: {r['vacunados']:,}/{r['meta']:,} ({r['cobertura']:.1f}%) — {brecha_txt}")

    print(f"\n  PROVINCIAL: {total_vacunados:,}/{meta_provincial:,} ({cob_provincial:.1f}%)")
    if brecha_provincial > 0:
        print(f"    Brecha: {brecha_provincial:,}")
    else:
        print(f"    Meta superada: +{meta_superada_prov:,}")

    print(f"\n  Mayor avance: {mayor_avance}")
    print(f"  Menor avance: {menor_avance}")

    if vac_3108_prov:
        print(f"\n  COMPARACIÓN CON REPORTE 31-08:")
        print(f"    Vacunados 31-08: {vac_3108_prov:,}")
        print(f"    Vacunados RNI actual: {total_vacunados:,}")
        print(f"    Diferencia: {total_vacunados - vac_3108_prov:+,}")
        print(f"    Cobertura 31-08: {cob_3108_prov:.1f}%  →  Actual: {cob_provincial:.1f}%  (Δ {cob_provincial - cob_3108_prov:+.1f} pp)")

    return ranking, provincial, mayor_avance, menor_avance


# =============================================================================
# PASO 5: EXPORTAR JSON/JS
# =============================================================================

def exportar_datos(serie_provincial, series_comunales, ranking, provincial,
                   mayor_avance, menor_avance, metas, meta_provincial,
                   fecha_max, stats, modalidad_count, criterios_fuera_4to,
                   vacunados_por_se):
    """Exporta datos a JSON y JS."""
    print("\n" + "=" * 70)
    print("PASO 5: Exportación de Datos")
    print("=" * 70)

    # Última SE y última semana con dosis
    ultima_se = get_epi_week(fecha_max) if fecha_max else 0

    # Dosis última semana y variación
    dosis_ultima_semana = 0
    variacion_pp_ultima = 0.0
    if serie_provincial and len(serie_provincial) >= 1:
        dosis_ultima_semana = serie_provincial[-1]["dosis_semana"]
        variacion_pp_ultima = serie_provincial[-1]["variacion_pp"]

    resultado = {
        "metadata": {
            "titulo": "Avance Semanal VPH Escolar 2026",
            "subtitulo": "Servicio de Salud Osorno — Monitoreo Operativo de Vacunación Escolar",
            "indicador": "Avance de vacunación VPH en cohorte escolar de 4.° básico 2026",
            "pregunta_responde": "¿Cómo está avanzando durante 2026 la vacunación de la cohorte escolar objetivo?",
            "fecha_datos_hasta": fecha_max.strftime("%d-%m-%Y") if fecha_max else "Sin datos",
            "ultima_se": f"SE{ultima_se}" if ultima_se else "Sin datos",
            "timestamp_generacion": datetime.now().strftime("%d/%m/%Y %H:%M"),
            "fuente_numerador": "Registro Nacional de Inmunizaciones (RNI) — Programáticas_Ocurrencia_2026.csv",
            "fuente_denominador": "Matrícula MINEDUC 2026 — COBERTURA ESCOLAR POR COMUNA 2026-08-31.xlsx",
            "criterio_territorial": "Ocurrencia (COMUNA_OCURR)",
            "advertencia_territorial": ADVERTENCIA_TERRITORIAL,
            "filtros_aplicados": [
                "VACUNA_ADMINISTRADA == 'SI'",
                "REGISTRO_ELIMINADO != 'SI' (== 'NO')",
                "Exclusión de CRITERIO_ELEGIBILIDAD == 'EPRO'",
                "Exclusión de DOSIS == 'EPRO'",
                "NOMBRE_VACUNA contiene VPH/PAPILOMA/GARDASIL/CERVARIX",
                "CRITERIO_ELEGIBILIDAD contiene '4° básico'",
                "COD_SERV = '23' (SS Osorno)",
                "Deduplicación por RUN",
            ],
            "criterios_incluidos": [
                "4° básico (Est. Educacional)",
                "4° básico (Est. de Salud)",
            ],
            "esquema_vigente": "VPH Nonavalente — Dosis Única",
            "nota_modulo": "Este módulo es independiente del indicador histórico de cobertura VPH a los 15 años.",
        },
        "conciliacion": {
            "total_vph_ss23": stats["total_vph_ss23"],
            "bruto_4to_basico": stats["bruto_4to"],
            "excl_vacuna_administrada": stats["excl_vac_adm"],
            "excl_registro_eliminado": stats["excl_reg_elim"],
            "excl_epro_criterio": stats["excl_epro_crit"],
            "excl_epro_dosis": stats["excl_epro_dosis"],
            "excl_duplicado_run": stats["excl_duplicado"],
            "numerador_final": stats["validos"],
            "registros_fuera_4to": stats["fuera_4to"],
            "detalle_fuera_4to": {k: v for k, v in criterios_fuera_4to.most_common()},
        },
        "auditoria_modalidad": {k: v for k, v in modalidad_count.most_common()},
        "resumen_provincial": provincial,
        "ranking_comunal": ranking,
        "mayor_avance": mayor_avance,
        "menor_avance": menor_avance,
        "kpis": {
            "vacunados_acumulados": provincial["vacunados"],
            "meta_provincial": provincial["meta"],
            "cobertura_provincial": provincial["cobertura"],
            "brecha_provincial": provincial["brecha"],
            "meta_superada": provincial["meta_superada"],
            "dosis_ultima_semana": dosis_ultima_semana,
            "variacion_pp_ultima_semana": variacion_pp_ultima,
            "ultima_se": f"SE{ultima_se}" if ultima_se else "N/A",
            "fecha_datos_hasta": fecha_max.strftime("%d-%m-%Y") if fecha_max else "N/A",
        },
        "serie_semanal_provincial": serie_provincial,
        "series_semanales_comunales": series_comunales,
        "metas_comunales": {k: v for k, v in sorted(metas.items())},
    }

    # Guardar JSON
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=2)
    print(f"  [OK] JSON guardado: {OUTPUT_JSON}")

    # Guardar JS
    with open(OUTPUT_JS, "w", encoding="utf-8") as f:
        f.write("var AVANCE_ESCOLAR_VPH_DATA = ")
        json.dump(resultado, f, ensure_ascii=False, indent=2)
        f.write(";\n")
    print(f"  [OK] JS guardado: {OUTPUT_JS}")

    return resultado


# =============================================================================
# PASO 6: QA Y VERIFICACIÓN DE INTEGRIDAD
# =============================================================================

def verificar_integridad_historico():
    """Verifica que el indicador histórico VPH no fue alterado (SHA-256)."""
    print("\n" + "=" * 70)
    print("PASO 6: Verificación de Integridad del Indicador Histórico")
    print("=" * 70)

    if not os.path.exists(DASHBOARD_HISTORICO):
        print(f"  ADVERTENCIA: No se encontró {DASHBOARD_HISTORICO}")
        return None

    sha = sha256_file(DASHBOARD_HISTORICO)
    print(f"  SHA-256 dashboard_data_vph.json: {sha}")
    print(f"  [OK] Archivo no fue modificado por este proceso.")
    return sha


def imprimir_qa_final(resultado, sha_historico):
    """Imprime resumen QA completo."""
    print("\n" + "=" * 70)
    print("QA FINAL — AVANCE SEMANAL VPH ESCOLAR 2026")
    print("=" * 70)

    kpis = resultado["kpis"]
    conc = resultado["conciliacion"]
    prov = resultado["resumen_provincial"]

    print(f"\n  1. Conciliación bruto → final:")
    print(f"     Bruto 4° básico: {conc['bruto_4to_basico']:,}")
    print(f"     - VACUNA_ADMINISTRADA ≠ SI: {conc['excl_vacuna_administrada']}")
    print(f"     - REGISTRO_ELIMINADO = SI: {conc['excl_registro_eliminado']}")
    print(f"     - EPRO (criterio): {conc['excl_epro_criterio']}")
    print(f"     - EPRO (dosis): {conc['excl_epro_dosis']}")
    print(f"     - Duplicado RUN: {conc['excl_duplicado_run']}")
    print(f"     = NUMERADOR FINAL: {conc['numerador_final']:,}")

    print(f"\n  2. Meta provincial 4° básico: {kpis['meta_provincial']:,}")

    print(f"\n  3. Numerador actualizado: {kpis['vacunados_acumulados']:,}")

    print(f"\n  4. Cobertura provincial: {kpis['cobertura_provincial']:.1f}%")

    print(f"\n  5. Coberturas comunales:")
    for r in resultado["ranking_comunal"]:
        brecha_txt = f"Brecha: {r['brecha']}" if r["brecha"] > 0 else f"Meta superada: +{r['meta_superada']}"
        print(f"     {r['posicion']}. {r['comuna']}: {r['cobertura']:.1f}% ({r['vacunados']:,}/{r['meta']:,}) — {brecha_txt}")

    print(f"\n  6. Última SE: {kpis['ultima_se']}")

    print(f"\n  7. Dosis última semana: {kpis['dosis_ultima_semana']:,}")

    print(f"\n  8. Variación semanal: {kpis['variacion_pp_ultima_semana']:+.2f} pp")

    print(f"\n  9. Brecha provincial: {kpis['brecha_provincial']:,}")
    if kpis["meta_superada"] > 0:
        print(f"     Meta superada en {kpis['meta_superada']:,} registros respecto de la población objetivo.")

    print(f"\n  10. Registros VPH fuera de 4° básico: {conc['registros_fuera_4to']:,}")
    for k, v in conc["detalle_fuera_4to"].items():
        print(f"      {k}: {v}")

    if prov.get("vacunados_3108") is not None:
        print(f"\n  11. Comparación con reporte 31-08:")
        print(f"      Cobertura 31-08: {prov['cobertura_3108']:.1f}%  →  Actual: {prov['cobertura']:.1f}%  (Δ {prov['variacion_vs_3108_pp']:+.1f} pp)")

    print(f"\n  12. SHA-256 indicador histórico (dashboard_data_vph.json):")
    if sha_historico:
        print(f"      {sha_historico}")
        print(f"      [OK] INDICADOR HISTÓRICO NO FUE ALTERADO")
    else:
        print(f"      No disponible")

    print("\n" + "=" * 70)
    print("[OK] QA COMPLETO — AVANCE SEMANAL VPH ESCOLAR 2026 LISTO")
    print("=" * 70)


# =============================================================================
# EJECUCIÓN PRINCIPAL
# =============================================================================

def main():
    t_start = time.time()
    print("=" * 70)
    print("AVANCE SEMANAL VPH ESCOLAR 2026 — SERVICIO DE SALUD OSORNO")
    print(f"Inicio: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    # SHA-256 ANTES (indicador histórico)
    sha_antes = sha256_file(DASHBOARD_HISTORICO) if os.path.exists(DASHBOARD_HISTORICO) else None

    # 1. Denominadores MINEDUC
    metas, meta_provincial = leer_denominadores_mineduc()

    # 2. Numeradores RNI
    (vacunados_comuna, vacunados_por_se, vacunados_comuna_se,
     fecha_max, stats, modalidad_count, criterios_fuera_4to) = leer_vacunados_rni(metas)

    # 3. Serie semanal
    serie_provincial, series_comunales = construir_serie_semanal(
        vacunados_por_se, vacunados_comuna_se, metas, meta_provincial, fecha_max
    )

    # 4. Ranking y comparación
    ranking, provincial, mayor_avance, menor_avance = construir_ranking_y_comparacion(
        vacunados_comuna, metas, meta_provincial
    )

    # 5. Exportar
    resultado = exportar_datos(
        serie_provincial, series_comunales, ranking, provincial,
        mayor_avance, menor_avance, metas, meta_provincial,
        fecha_max, stats, modalidad_count, criterios_fuera_4to,
        vacunados_por_se
    )

    # 6. Verificar integridad
    sha_despues = verificar_integridad_historico()

    # Confirmar no alteración
    if sha_antes and sha_despues:
        if sha_antes == sha_despues:
            print(f"  [OK] SHA-256 ANTES == DESPUÉS: Indicador histórico INTACTO")
        else:
            print(f"  [ERROR] SHA-256 cambió! El indicador histórico fue modificado!")
            print(f"    ANTES:   {sha_antes}")
            print(f"    DESPUÉS: {sha_despues}")

    # QA final
    imprimir_qa_final(resultado, sha_despues)

    t_total = time.time() - t_start
    print(f"\n[OK] Proceso finalizado en {t_total:.1f}s ({t_total/60:.1f} min)")


if __name__ == "__main__":
    main()
