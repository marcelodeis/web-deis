import csv
import collections

res_file = r"C:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL\2026\Programáticas_Residencia_2026.csv"
ocu_file = r"C:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL\2026\Programáticas_Ocurrencia_2026.csv"

def analyze_otros(filepath):
    otros_criterios = collections.Counter()
    with open(filepath, 'r', encoding='latin1') as f:
        reader = csv.DictReader(f, delimiter='|')
        total_otros = 0
        for row in reader:
            # Mandatory filters
            if row.get("VACUNA_ADMINISTRADA", "").strip().upper() != "SI":
                continue
            if row.get("REGISTRO_ELIMINADO", "").strip().upper() != "NO":
                continue
            if row.get("CRITERIO_ELEGIBILIDAD", "").strip().upper() == "EPRO":
                continue
            if row.get("DOSIS", "").strip().upper() == "EPRO":
                continue
            vac = row.get("VACUNA", "").strip().upper()
            if vac != "DIFTERIA, TÉTANOS Y TOS CONVULSIVA (ACELULAR)":
                continue
            crit = row.get("CRITERIO_ELEGIBILIDAD", "").strip()
            crit_upper = crit.upper()
            is_1 = ("1" in crit_upper and "SICO" in crit_upper) or ("PRIMERO" in crit_upper and "SICO" in crit_upper)
            is_8 = ("8" in crit_upper and "SICO" in crit_upper) or ("OCTAVO" in crit_upper and "SICO" in crit_upper)
            is_gestante = ("EMBARAZO" in crit_upper) or ("EMBARAZADA" in crit_upper) or ("GESTANTE" in crit_upper)
            if not (is_1 or is_8 or is_gestante):
                total_otros += 1
                otros_criterios[crit] += 1
    return otros_criterios, total_otros

print("=== Base Residencia ===")
res_otros, res_total = analyze_otros(res_file)
for crit, count in res_otros.most_common():
    print(f"{crit}: {count}")
print(f"Total Otros: {res_total}")

print("\n=== Base Ocurrencia ===")
ocu_otros, ocu_total = analyze_otros(ocu_file)
for crit, count in ocu_otros.most_common():
    print(f"{crit}: {count}")
print(f"Total Otros: {ocu_total}")
