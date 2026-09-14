"""
Genera programaticas_data_2025.js con la MISMA estructura que programaticas_data_2026.js.

Estructura esperada:
- data_ocurrencia: [{comuna, establecimiento, datos: {VACUNA: {"mes": count}}}]
- data_residencia: [{comuna, datos: {VACUNA: total}, total: N}]  (sin desglose por mes)
- metas: se copian desde 2026 (mismas metas)
"""
import csv
import json
import os
import re
from collections import defaultdict

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

HEADERS = [
    "BCG", "BEXSERO1D", "BEXSERO1R", "BEXSERO2D",
    "HEXA1D", "HEXA1R", "HEXA2D", "HEXA3D",
    "HepA", "HepB", "MENINGO",
    "NEUMO1D", "NEUMO1R", "NEUMO23", "NEUMO2D",
    "SRP1D", "SRP2D",
    "VARICELA1D", "VARICELA2D",
    "VPH", "dTpa"
]

BASE_DIR = r"C:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL"

def process_ocurrencia(filepath):
    """Returns dict[comuna][establecimiento][criterio][vacuna][mes_str] = count"""
    data = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(int)))))
    print(f"  Processing {os.path.basename(filepath)}...")
    with open(filepath, encoding='latin1') as f:
        reader = csv.DictReader(f, delimiter='|')
        for row in reader:
            if row.get('COD_SERV') != '23':
                continue
                
            # Filtros obligatorios para base de vacunas
            if row.get('VACUNA_ADMINISTRADA', '').strip().upper() != 'SI':
                continue
            if row.get('REGISTRO_ELIMINADO', '').strip().upper() != 'NO':
                continue
            if row.get('CRITERIO_ELEGIBILIDAD', '').strip().upper() == 'EPRO':
                continue
            if row.get('DOSIS', '').strip().upper() == 'EPRO':
                continue
                
            comuna = row.get('COMUNA_OCURR', '').strip()
            estab = row.get('ESTABLECIMIENTO', '').strip()
            vacuna_raw = row.get('NOMBRE_VACUNA', '').strip()
            dosis_raw = row.get('DOSIS', '').strip()
            criterio = row.get('CRITERIO_ELEGIBILIDAD', '').strip()
            if not criterio:
                criterio = "Sin Criterio Especificado"
            fecha = row.get('FECHA_INMUNIZACION', '').strip()
            
            key = f"{vacuna_raw} | {dosis_raw}"
            if key not in MAPPING:
                continue
            vac_header = MAPPING[key]
            try:
                mes = str(int(fecha.split('-')[1]))
                data[comuna][estab][criterio][vac_header][mes] += 1
            except (ValueError, IndexError):
                pass
    return data

def process_residencia(filepath):
    """Returns dict[comuna][criterio][vacuna] = total (flat, no month breakdown)"""
    data = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    print(f"  Processing {os.path.basename(filepath)}...")
    with open(filepath, encoding='latin1') as f:
        reader = csv.DictReader(f, delimiter='|')
        for row in reader:
            if row.get('COD_SERV') != '23':
                continue
                
            # Filtros obligatorios para base de vacunas
            if row.get('VACUNA_ADMINISTRADA', '').strip().upper() != 'SI':
                continue
            if row.get('REGISTRO_ELIMINADO', '').strip().upper() != 'NO':
                continue
            if row.get('CRITERIO_ELEGIBILIDAD', '').strip().upper() == 'EPRO':
                continue
            if row.get('DOSIS', '').strip().upper() == 'EPRO':
                continue
                
            comuna = row.get('COMUNA_RESIDENCIA', '').strip()
            vacuna_raw = row.get('NOMBRE_VACUNA', '').strip()
            dosis_raw = row.get('DOSIS', '').strip()
            criterio = row.get('CRITERIO_ELEGIBILIDAD', '').strip()
            if not criterio:
                criterio = "Sin Criterio Especificado"
            
            key = f"{vacuna_raw} | {dosis_raw}"
            if key not in MAPPING:
                continue
            vac_header = MAPPING[key]
            data[comuna][criterio][vac_header] += 1
    return data

def format_ocurrencia(raw):
    """Format like original: [{comuna, establecimiento, criterio, datos: {VAC: {"1": N, ...}}}]"""
    result = []
    for comuna in sorted(raw.keys()):
        for estab in sorted(raw[comuna].keys()):
            for criterio in sorted(raw[comuna][estab].keys()):
                entry = {
                    "comuna": comuna,
                    "establecimiento": estab,
                    "criterio": criterio,
                    "datos": {}
                }
                for vac in HEADERS:
                    meses = raw[comuna][estab][criterio].get(vac, {})
                    if meses:
                        entry["datos"][vac] = dict(meses)
                if entry["datos"]:
                    entry["total"] = sum(sum(m.values()) for m in entry["datos"].values())
                    result.append(entry)
    return result

def format_residencia(raw):
    """Format like original: [{comuna, criterio, datos: {VAC: total}, total: N}]"""
    result = []
    for comuna in sorted(raw.keys()):
        for criterio in sorted(raw[comuna].keys()):
            entry = {
                "comuna": comuna,
                "criterio": criterio,
                "datos": {},
                "total": 0
            }
            for vac in HEADERS:
                val = raw[comuna][criterio].get(vac, 0)
                if val > 0:
                    entry["datos"][vac] = val
                    entry["total"] += val
            if entry["datos"]:
                result.append(entry)
    return result

def extract_metas_from_2026():
    """Extract metas from the original 2026 data file"""
    with open(r"c:\Antigravity IDE\WEB DEIS\Programáticas_Web\programaticas_data_2026_v3.js", 'r', encoding='utf-8') as f:
        text = f.read()
    # Remove the var assignment prefix and trailing semicolon
    json_str = text.replace('var PROGRAMATICAS_DATA_2026 = ', '', 1).rstrip().rstrip(';')
    data = json.loads(json_str)
    return data.get('metas', {})

# ═══════════════════════════════════════════════════════════════════
print("=== Generating programaticas_data_2025.js ===")

oc_path = os.path.join(BASE_DIR, "2025", "Programáticas_Ocurrencia_2025.csv")
re_path = os.path.join(BASE_DIR, "2025", "Programáticas_Residencia_2025.csv")

oc_raw = process_ocurrencia(oc_path)
re_raw = process_residencia(re_path)

metas = extract_metas_from_2026()

output = {
    "fecha_actualizacion": "03/07/2026 (Datos 2025)",
    "fuente": "Programáticas (Ocurrencia + Residencia)",
    "headers": HEADERS,
    "meses_base": list(range(1, 13)),  # all 12 months for 2025
    "data_ocurrencia": format_ocurrencia(oc_raw),
    "data_residencia": format_residencia(re_raw),
    "metas": metas
}

out_file = r"c:\Antigravity IDE\WEB DEIS\Programáticas_Web\programaticas_data_2025_v4.js"
with open(out_file, 'w', encoding='utf-8') as f:
    f.write('var PROGRAMATICAS_DATA_2025 = ')
    json.dump(output, f, ensure_ascii=False, indent=2)
    f.write(';\n')

# Quick validation
n_oc = len(output["data_ocurrencia"])
n_re = len(output["data_residencia"])
total_re = sum(e["total"] for e in output["data_residencia"])
print(f"\nResults:")
print(f"  Ocurrencia entries: {n_oc}")
print(f"  Residencia comunas: {n_re}")
print(f"  Residencia total dosis: {total_re:,}")
print(f"  Output: {out_file}")
print("Done!")
