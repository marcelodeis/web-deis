import csv
import collections

filepath = r"C:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL\2026\Programáticas_Ocurrencia_2026.csv"
criteria = collections.Counter()
with open(filepath, encoding='latin1') as f:
    reader = csv.DictReader(f, delimiter='|')
    for row in reader:
        if row.get('COD_SERV') != '23':
            continue
        if row.get('VACUNA_ADMINISTRADA', '').strip().upper() != 'SI':
            continue
        if row.get('NOMBRE_VACUNA', '').strip() == 'Vacuna dTpa':
            criteria[row.get('CRITERIO_ELEGIBILIDAD', '').strip()] += 1

print(criteria.most_common())
