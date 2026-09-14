import json

filepath = r"c:\Antigravity IDE\WEB DEIS\Programáticas_Web\programaticas_data_2026.json"
with open(filepath, 'r', encoding='utf-8') as f:
    data = json.load(f)

residencia = data['data_residencia']
metas = data['metas']

comunas_ssosorno = ["Osorno", "Puerto Octay", "Purranque", "Puyehue", "Río Negro", "San Juan de la Costa", "San Pablo"]

total_1_num = 0
total_1_den = 0
total_8_num = 0
total_8_den = 0

print("== 1º Básico ==")
for r in residencia:
    c = r['comuna']
    if c in comunas_ssosorno:
        num = r['datos'].get('dTpa_1', 0)
        total_1_num += num
        den = metas.get(c, {}).get('Criterios', {}).get('dTpa_1', 0)
        # Note: the JSON array groups by comuna AND criterio, so we have multiple entries per comuna
        # We should just sum them per comuna first
        
# Better logic:
comuna_totals = {}
for r in residencia:
    c = r['comuna']
    if c not in comuna_totals:
        comuna_totals[c] = {'dTpa_1': 0, 'dTpa_8': 0, 'dTpa_Embarazadas': 0, 'dTpa_Otros': 0}
    for vac in ['dTpa_1', 'dTpa_8', 'dTpa_Embarazadas', 'dTpa_Otros']:
        comuna_totals[c][vac] += r['datos'].get(vac, 0)

print("== 1º Básico ==")
for c in comunas_ssosorno:
    num = comuna_totals.get(c, {}).get('dTpa_1', 0)
    den = metas.get(c, {}).get('Criterios', {}).get('dTpa_1', 0)
    cov = (num / den * 100) if den else 0
    print(f"{c}: {num} / {den} ({cov:.1f}%)")
    total_1_num += num
    total_1_den += den
print(f"PROVINCIA 1º BÁSICO: {total_1_num} / {total_1_den} ({(total_1_num/total_1_den*100) if total_1_den else 0:.1f}%)")

print("\n== 8º Básico ==")
for c in comunas_ssosorno:
    num = comuna_totals.get(c, {}).get('dTpa_8', 0)
    den = metas.get(c, {}).get('Criterios', {}).get('dTpa_8', 0)
    cov = (num / den * 100) if den else 0
    print(f"{c}: {num} / {den} ({cov:.1f}%)")
    total_8_num += num
    total_8_den += den
print(f"PROVINCIA 8º BÁSICO: {total_8_num} / {total_8_den} ({(total_8_num/total_8_den*100) if total_8_den else 0:.1f}%)")

print("\n== Otros Criterios (Provincia) ==")
emb = sum(comuna_totals.get(c, {}).get('dTpa_Embarazadas', 0) for c in comunas_ssosorno)
otr = sum(comuna_totals.get(c, {}).get('dTpa_Otros', 0) for c in comunas_ssosorno)
print(f"Embarazadas: {emb}")
print(f"Otros / No clasificados: {otr}")
