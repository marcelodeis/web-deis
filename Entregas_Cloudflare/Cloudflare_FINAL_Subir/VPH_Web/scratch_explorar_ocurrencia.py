"""
Explorador rápido de bases de ocurrencia VPH — Servicio de Salud Osorno
"""
import csv, os, json
from collections import defaultdict

BASE_DIR = r"c:\Antigravity IDE\VPH\Base Datos Minsal\Programáticas Por Ocurrencia"

COMUNAS_OSORNO = {
    "10301": "Osorno", "10302": "Puerto Octay", "10303": "Purranque",
    "10304": "Puyehue", "10305": "Río Negro", "10306": "San Juan de la Costa",
    "10307": "San Pablo",
}

ARCHIVOS = {
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

def detectar_encoding_sep(filepath):
    """Detectar encoding y separador de archivo"""
    for enc in ['utf-8', 'latin-1', 'cp1252']:
        try:
            with open(filepath, 'r', encoding=enc) as fh:
                sample = fh.read(3000)
                if sample.count('|') > sample.count(';') and sample.count('|') > sample.count(','):
                    sep = '|'
                elif sample.count(';') > sample.count(','):
                    sep = ';'
                else:
                    sep = ','
                return enc, sep
        except:
            continue
    return 'latin-1', '|'

def explorar_archivo(ano, filename):
    """Explorar un archivo de ocurrencia buscando registros VPH del S.S. Osorno"""
    filepath = os.path.join(BASE_DIR, filename)
    if not os.path.exists(filepath):
        print(f"  [!] Archivo no encontrado: {filepath}")
        return None
    
    enc, sep = detectar_encoding_sep(filepath)
    
    stats = {
        "total_registros": 0,
        "vph_total": 0,
        "vph_filtrado": 0,  # Después de filtros MINSAL
        "vacunas_vph": defaultdict(int),
        "dosis_vph": defaultdict(int),
        "establecimientos": defaultdict(int),
        "comunas_ocurr": defaultdict(int),
        "sexo": defaultdict(int),
    }
    
    with open(filepath, 'r', encoding=enc) as fh:
        reader = csv.DictReader(fh, delimiter=sep)
        for row in reader:
            stats["total_registros"] += 1
            
            vac = (row.get("NOMBRE_VACUNA", "") or "").strip()
            if "VPH" not in vac.upper():
                continue
            
            stats["vph_total"] += 1
            
            # Filtros MINSAL obligatorios
            if (row.get("VACUNA_ADMINISTRADA", "") or "").strip().upper() != "SI":
                continue
            if (row.get("REGISTRO_ELIMINADO", "") or "").strip().upper() == "SI":
                continue
            crit = (row.get("CRITERIO_ELEGIBILIDAD", "") or "").strip().upper()
            if crit == "EPRO":
                continue
            dosis = (row.get("DOSIS", "") or "").strip().upper()
            if dosis == "EPRO":
                continue
            
            # Filtrar por S.S. Osorno (comuna de ocurrencia)
            cod_comuna_ocurr = (row.get("COD_COMUNA_OCURR", "") or "").strip()
            if cod_comuna_ocurr not in COMUNAS_OSORNO:
                continue
            
            stats["vph_filtrado"] += 1
            stats["vacunas_vph"][vac] += 1
            stats["dosis_vph"][(row.get("DOSIS", "") or "").strip()] += 1
            stats["establecimientos"][(row.get("ESTABLECIMIENTO", "") or "").strip()] += 1
            stats["comunas_ocurr"][cod_comuna_ocurr] += 1
            stats["sexo"][(row.get("SEXO", "") or "").strip()] += 1
    
    return stats

# Solo explorar 2025 y 2026 para diagnóstico rápido
print("=" * 70)
print("EXPLORACIÓN DE BASES DE OCURRENCIA VPH — S.S. OSORNO")
print("=" * 70)

for ano in [2024, 2025, 2026]:
    print(f"\n{'─' * 50}")
    print(f"AÑO {ano}")
    print(f"{'─' * 50}")
    
    filename = ARCHIVOS.get(ano)
    if not filename:
        print("  Sin archivo configurado")
        continue
    
    result = explorar_archivo(ano, filename)
    if result is None:
        continue
    
    print(f"  Registros totales en archivo: {result['total_registros']:,}")
    print(f"  Registros VPH (sin filtro):   {result['vph_total']:,}")
    print(f"  Registros VPH (con filtros):  {result['vph_filtrado']:,}")
    
    if result['vph_filtrado'] > 0:
        print(f"\n  Vacunas:")
        for v, c in sorted(result['vacunas_vph'].items(), key=lambda x: -x[1]):
            print(f"    {v}: {c:,}")
        
        print(f"\n  Dosis:")
        for d, c in sorted(result['dosis_vph'].items(), key=lambda x: -x[1]):
            print(f"    {d}: {c:,}")
        
        print(f"\n  Comunas de ocurrencia:")
        for cod, c in sorted(result['comunas_ocurr'].items(), key=lambda x: -x[1]):
            nom = COMUNAS_OSORNO.get(cod, cod)
            print(f"    {nom} ({cod}): {c:,}")
        
        print(f"\n  Sexo:")
        for s, c in sorted(result['sexo'].items(), key=lambda x: -x[1]):
            print(f"    {s}: {c:,}")
        
        print(f"\n  Top 10 Establecimientos:")
        for est, c in sorted(result['establecimientos'].items(), key=lambda x: -x[1])[:10]:
            print(f"    {est}: {c:,}")
