"""
═══════════════════════════════════════════════════════════════════════════════
PROCESADOR DE BASE DE OCURRENCIA VPH — SERVICIO DE SALUD OSORNO
Genera las secciones de producción para dashboard_data_vph.js:
  - dosis_anuales
  - top_establecimientos
  - matriz_establecimientos
  - evolucion_vacunas
═══════════════════════════════════════════════════════════════════════════════
"""
import csv
import json
import os
import sys
from collections import defaultdict
from datetime import datetime

# ── Configuración ────────────────────────────────────────────────────────────

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BD_MINSAL_DIR = os.path.join(os.path.dirname(BASE_DIR), "BASE DATOS MINSAL")

def get_db_dir(year):
    if int(year) <= 2024:
        return os.path.join(BD_MINSAL_DIR, "2000-2024")
    else:
        return os.path.join(BD_MINSAL_DIR, str(year))

OUTPUT_JSON = os.path.join(BASE_DIR, "produccion_ocurrencia_vph.json")

COMUNAS_OSORNO = {
    "10301": "Osorno",
    "10302": "Puerto Octay",
    "10303": "Purranque",
    "10304": "Puyehue",
    "10305": "Río Negro",
    "10306": "San Juan de la Costa",
    "10307": "San Pablo",
}

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

# Mapeo de nombres de vacuna a nombre estandarizado para el dashboard
VACUNA_MAP = {
    "VPH Tetravalente": "VPH Tetravalente (Gardasil 4)",
    "VPH Tetravalente (sector privado)": "VPH Tetravalente (Gardasil 4)",
    "VPH Nonavalente": "VPH Nonavalente (Gardasil 9)",
    "VPH Nonavalente (sector privado)": "VPH Nonavalente (Gardasil 9)",
    "VPH Bivalente": "VPH Bivalente (Cervarix)",
    "VPH Bivalente (sector privado)": "VPH Bivalente (Cervarix)",
}

# Normalización de dosis
def normalizar_dosis(dosis_raw):
    """Normaliza el texto de dosis a categorías estándar"""
    d = dosis_raw.strip()
    d_upper = d.upper()
    if d_upper in ("ÚNICA", "UNICA", "DOSIS ÚNICA", "DOSIS UNICA"):
        return "Dosis Única"
    if "1" in d and ("DOSIS" in d_upper or "°" in d or "ª" in d):
        return "1ª Dosis"
    if "2" in d and ("DOSIS" in d_upper or "°" in d or "ª" in d):
        return "2ª Dosis"
    if "3" in d and ("DOSIS" in d_upper or "°" in d or "ª" in d):
        return "3ª Dosis"
    if d_upper == "REFUERZO":
        return "Refuerzo"
    return d  # devolver tal cual si no se reconoce

def normalizar_vacuna(nombre_vacuna):
    """Normaliza nombre de vacuna al estándar del dashboard"""
    nv = nombre_vacuna.strip()
    if nv in VACUNA_MAP:
        return VACUNA_MAP[nv]
    # Intentar match parcial
    nv_upper = nv.upper()
    if "NONAVALENTE" in nv_upper:
        return "VPH Nonavalente (Gardasil 9)"
    if "TETRAVALENTE" in nv_upper:
        return "VPH Tetravalente (Gardasil 4)"
    if "BIVALENTE" in nv_upper:
        return "VPH Bivalente (Cervarix)"
    return nv  # devolver tal cual

def detectar_encoding_sep(filepath):
    """Detectar encoding y separador"""
    for enc in ['utf-8', 'latin-1', 'cp1252']:
        try:
            with open(filepath, 'r', encoding=enc) as fh:
                sample = fh.read(5000)
                if sample.count('|') > sample.count(';') and sample.count('|') > sample.count(','):
                    sep = '|'
                elif sample.count(';') > sample.count(','):
                    sep = ';'
                else:
                    sep = ','
                # Verificar que podemos leer sin errores
                fh.seek(0)
                fh.read(50000)
                return enc, sep
        except (UnicodeDecodeError, UnicodeError):
            continue
    return 'latin-1', '|'

def normalizar_sexo(sexo_raw):
    s = (sexo_raw or "").strip()
    if s in ("Mujer", "Femenino", "F"):
        return "Mujer"
    if s in ("Hombre", "Masculino", "M"):
        return "Hombre"
    return "Total"  # Intersexual u otros van a Total


# ── Estructuras de acumulación ───────────────────────────────────────────────

# 1. dosis_anuales[ano][comuna_cod][sexo][tipo_dosis] -> count
dosis_anuales = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(int))))

# 2. top_establecimientos[nombre_estab][nombre_vacuna] -> count
top_estab = defaultdict(lambda: defaultdict(int))

# 3. matriz_establecimientos[nombre_estab] -> {...}
matriz_estab = defaultdict(lambda: {
    "comuna_cod": "",
    "comuna_nom": "",
    "total_historico": 0,
    "total_mujeres": 0,
    "total_hombres": 0,
    "total_tetra": 0,
    "total_nona": 0,
    "total_biv": 0,
    "total_otra_vac": 0,
    "total_dosis_unica": 0,
    "total_dosis_1": 0,
    "total_dosis_2": 0,
    "por_ano": defaultdict(lambda: {
        "total": 0, "mujeres": 0, "hombres": 0,
        "dosis_unica": 0, "dosis_1": 0, "dosis_2": 0, "dosis_otra": 0,
        "tetra": 0, "nona": 0, "biv": 0, "otra_vac": 0
    })
})

# 4. evolucion_vacunas[ano][nombre_vacuna_norm] -> count
evolucion_vacunas = defaultdict(lambda: defaultdict(int))

# ── Procesamiento ────────────────────────────────────────────────────────────

total_vph_global = 0
total_descartados = 0

for ano in sorted(ARCHIVOS_OCURRENCIA.keys()):
    filename = ARCHIVOS_OCURRENCIA[ano]
    filepath = os.path.join(get_db_dir(ano), filename)
    
    if not os.path.exists(filepath):
        print(f"  [!] Archivo no encontrado: {filename}", file=sys.stderr)
        continue
    
    enc, sep = detectar_encoding_sep(filepath)
    print(f"  [{ano}] Leyendo {filename} (enc={enc}, sep={sep!r})...", file=sys.stderr)
    
    vph_count = 0
    descartados = 0
    
    with open(filepath, 'r', encoding=enc, errors='replace') as fh:
        reader = csv.DictReader(fh, delimiter=sep)
        
        for row in reader:
            nombre_vacuna = (row.get("NOMBRE_VACUNA", "") or "").strip()
            
            # Solo VPH
            if "VPH" not in nombre_vacuna.upper():
                continue
            
            # ── Filtros MINSAL obligatorios ──
            if (row.get("VACUNA_ADMINISTRADA", "") or "").strip().upper() != "SI":
                descartados += 1
                continue
            if (row.get("REGISTRO_ELIMINADO", "") or "").strip().upper() == "SI":
                descartados += 1
                continue
            crit = (row.get("CRITERIO_ELEGIBILIDAD", "") or "").strip().upper()
            if crit == "EPRO":
                descartados += 1
                continue
            dosis_raw = (row.get("DOSIS", "") or "").strip()
            if dosis_raw.upper() == "EPRO":
                descartados += 1
                continue
            
            # Filtrar por comuna de ocurrencia en S.S. Osorno
            cod_comuna = (row.get("COD_COMUNA_OCURR", "") or "").strip()
            if cod_comuna not in COMUNAS_OSORNO:
                continue
            
            vph_count += 1
            
            # Datos normalizados
            sexo = normalizar_sexo(row.get("SEXO", ""))
            tipo_dosis = normalizar_dosis(dosis_raw)
            vacuna_norm = normalizar_vacuna(nombre_vacuna)
            estab = (row.get("ESTABLECIMIENTO", "") or "").strip() or "Sin Establecimiento"
            ano_str = str(ano)
            
            # 1. dosis_anuales
            dosis_anuales[ano_str][cod_comuna][sexo][tipo_dosis] += 1
            dosis_anuales[ano_str][cod_comuna]["Total"][tipo_dosis] += 1
            dosis_anuales[ano_str]["TOTAL"][sexo][tipo_dosis] += 1
            dosis_anuales[ano_str]["TOTAL"]["Total"][tipo_dosis] += 1
            
            # Sumar "Total" dentro de cada sexo
            dosis_anuales[ano_str][cod_comuna][sexo]["Total"] += 1
            dosis_anuales[ano_str][cod_comuna]["Total"]["Total"] += 1
            dosis_anuales[ano_str]["TOTAL"][sexo]["Total"] += 1
            dosis_anuales[ano_str]["TOTAL"]["Total"]["Total"] += 1
            
            # 2. top_establecimientos
            top_estab[estab][vacuna_norm] += 1
            
            # 3. matriz_establecimientos
            em = matriz_estab[estab]
            em["comuna_cod"] = cod_comuna
            em["comuna_nom"] = COMUNAS_OSORNO.get(cod_comuna, "Desconocida")
            em["total_historico"] += 1
            if sexo == "Mujer":
                em["total_mujeres"] += 1
            elif sexo == "Hombre":
                em["total_hombres"] += 1
            
            # Tipo de vacuna
            if "Tetravalente" in vacuna_norm:
                em["total_tetra"] += 1
            elif "Nonavalente" in vacuna_norm:
                em["total_nona"] += 1
            elif "Bivalente" in vacuna_norm:
                em["total_biv"] += 1
            else:
                em["total_otra_vac"] += 1
            
            # Tipo de dosis
            if tipo_dosis == "Dosis Única":
                em["total_dosis_unica"] += 1
            elif "1" in tipo_dosis:
                em["total_dosis_1"] += 1
            elif "2" in tipo_dosis:
                em["total_dosis_2"] += 1
            
            # Desglose por año
            pa = em["por_ano"][ano_str]
            pa["total"] += 1
            if sexo == "Mujer":
                pa["mujeres"] += 1
            elif sexo == "Hombre":
                pa["hombres"] += 1
            if tipo_dosis == "Dosis Única":
                pa["dosis_unica"] += 1
            elif "1" in tipo_dosis:
                pa["dosis_1"] += 1
            elif "2" in tipo_dosis:
                pa["dosis_2"] += 1
            else:
                pa["dosis_otra"] += 1
            if "Tetravalente" in vacuna_norm:
                pa["tetra"] += 1
            elif "Nonavalente" in vacuna_norm:
                pa["nona"] += 1
            elif "Bivalente" in vacuna_norm:
                pa["biv"] += 1
            else:
                pa["otra_vac"] += 1
            
            # 4. evolucion_vacunas
            evolucion_vacunas[ano_str][vacuna_norm] += 1
    
    total_vph_global += vph_count
    total_descartados += descartados
    print(f"        VPH filtrado: {vph_count:,} (descartados filtros: {descartados:,})", file=sys.stderr)

print(f"\n  TOTAL VPH Ocurrencia S.S. Osorno: {total_vph_global:,}", file=sys.stderr)
print(f"  Total descartados por filtros MINSAL: {total_descartados:,}", file=sys.stderr)


# ── Formatear salida ─────────────────────────────────────────────────────────

# dosis_anuales: convertir defaultdict a dict normal
dosis_out = {}
for ano_k in sorted(dosis_anuales.keys(), key=int):
    dosis_out[ano_k] = {}
    for com_k in sorted(dosis_anuales[ano_k].keys()):
        dosis_out[ano_k][com_k] = {}
        for sexo_k in sorted(dosis_anuales[ano_k][com_k].keys()):
            dosis_out[ano_k][com_k][sexo_k] = dict(dosis_anuales[ano_k][com_k][sexo_k])

# top_establecimientos: ordenar por total descendente
top_out = []
for est, vacs in sorted(top_estab.items(), key=lambda x: sum(x[1].values()), reverse=True):
    total = sum(vacs.values())
    top_out.append({
        "nombre": est,
        "vacunas": dict(vacs),
        "total": total
    })

# matriz_establecimientos: ordenar por total_historico descendente
matriz_out = []
for est, d in sorted(matriz_estab.items(), key=lambda x: x[1]["total_historico"], reverse=True):
    entry = {
        "establecimiento": est,
        "comuna_cod": d["comuna_cod"],
        "comuna_nom": d["comuna_nom"],
        "total_historico": d["total_historico"],
        "total_mujeres": d["total_mujeres"],
        "total_hombres": d["total_hombres"],
        "total_tetra": d["total_tetra"],
        "total_nona": d["total_nona"],
        "total_biv": d["total_biv"],
        "total_otra_vac": d["total_otra_vac"],
        "total_dosis_unica": d["total_dosis_unica"],
        "total_dosis_1": d["total_dosis_1"],
        "total_dosis_2": d["total_dosis_2"],
        "por_ano": {}
    }
    for ak in sorted(d["por_ano"].keys(), key=int):
        entry["por_ano"][ak] = dict(d["por_ano"][ak])
    matriz_out.append(entry)

# evolucion_vacunas: ordenar por año
evolucion_out = {}
for ano_k in sorted(evolucion_vacunas.keys(), key=int):
    evolucion_out[ano_k] = dict(evolucion_vacunas[ano_k])

# ── Resultado final ──────────────────────────────────────────────────────────
resultado = {
    "dosis_anuales": dosis_out,
    "top_establecimientos": top_out,
    "matriz_establecimientos": matriz_out,
    "evolucion_vacunas": evolucion_out,
}

with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
    json.dump(resultado, f, ensure_ascii=False, indent=2)

print(f"\n  Archivo generado: {OUTPUT_JSON}", file=sys.stderr)
print(f"  Establecimientos: {len(matriz_out)}", file=sys.stderr)
print(f"  Años con datos: {list(evolucion_out.keys())}", file=sys.stderr)

# Resumen final
print("\n  RESUMEN POR AÑO:", file=sys.stderr)
for ak in sorted(evolucion_out.keys(), key=int):
    total_ano = sum(evolucion_out[ak].values())
    vacs = ", ".join(f"{v}: {c:,}" for v, c in sorted(evolucion_out[ak].items(), key=lambda x: -x[1]))
    print(f"    {ak}: {total_ano:,} dosis ({vacs})", file=sys.stderr)
