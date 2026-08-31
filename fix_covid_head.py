import codecs

path = r'c:\Antigravity IDE\WEB DEIS\Covid_Web\index.html'
with codecs.open(path, 'r', 'utf-8') as f:
    lines = f.readlines()

# The file is damaged from line 3 onward (head was destroyed)
# Line 14 has </head>, line 15 starts <body>
# We need to find <body> and replace everything before it

body_line_idx = None
for i, line in enumerate(lines):
    if '<body>' in line:
        body_line_idx = i
        break

if body_line_idx is None:
    print("ERROR: Could not find <body> tag!")
    exit(1)

print(f"Found <body> at line {body_line_idx + 1}")

correct_head = """<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard COVID-19 2026 · Servicio de Salud Osorno</title>
    <meta name="description" content="Dashboard Analítico de Vacunación COVID-19 del Servicio de Salud Osorno.">

    <!-- Fonts & Icons -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" crossorigin="anonymous">

    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels"></script>
    <script src="https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js" integrity="sha384-OUW9euuUyxyHcAhTqbhI+Iyb8LMssXt/cpz0yXhs9UWG2/R/uaWdakx/4cfww7Vb" crossorigin="anonymous"></script>

    <!-- Leaflet.js -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>

    <!-- Styles -->
    <link rel="stylesheet" href="styles.css?v=5">

    <!-- Premium Features CSS -->
    <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css">
    <link rel="stylesheet" href="../shared/global_premium.css?v=2">

    <style>
        .kpi-grid.four-cols {
            grid-template-columns: repeat(4, 1fr);
        }
        @media (max-width: 1024px) {
            .kpi-grid.four-cols {
                grid-template-columns: repeat(2, 1fr);
            }
        }
        @media (max-width: 600px) {
            .kpi-grid.four-cols {
                grid-template-columns: 1fr;
            }
        }
        
        #map {
            width: 100%;
            height: 100%;
            min-height: 520px;
            border-radius: 0 0 20px 20px;
            z-index: 1;
        }
    </style>
    <script>
        window.addEventListener('error', function(e) {
            const errDiv = document.createElement('div');
            errDiv.style = "position:fixed;top:0;left:0;width:100%;background:red;color:white;z-index:999999;padding:20px;font-size:20px;";
            errDiv.innerHTML = "JS Error: " + e.message + " at " + e.filename + ":" + e.lineno;
            document.body.appendChild(errDiv);
        });
        window.addEventListener('unhandledrejection', function(e) {
            const errDiv = document.createElement('div');
            errDiv.style = "position:fixed;top:0;left:0;width:100%;background:red;color:white;z-index:999999;padding:20px;font-size:20px;";
            errDiv.innerHTML = "Promise Error: " + e.reason;
            document.body.appendChild(errDiv);
        });
    </script>
</head>
"""

# Rebuild: correct_head + everything from <body> onward
new_content = correct_head + ''.join(lines[body_line_idx:])

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(new_content)

print("COVID head restored successfully!")
