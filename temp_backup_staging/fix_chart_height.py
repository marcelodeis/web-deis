import os

files = [
    r'c:\Antigravity IDE\WEB DEIS\Influenza_Web\autoconsulta.js',
    r'c:\Antigravity IDE\WEB DEIS\Covid_Web\autoconsulta.js',
    r'c:\Antigravity IDE\WEB DEIS\VRS\autoconsulta.js',
    r'c:\Antigravity IDE\WEB DEIS\VPH_Web\autoconsulta.js'
]

for fp in files:
    with open(fp, 'r', encoding='utf-8') as f:
        c = f.read()
    
    # Fix 1: Wrap chartBarComunas canvas in a fixed-height container
    c = c.replace(
        '<canvas id="chartBarComunas" height="220"></canvas>',
        '<div style="position: relative; height: 280px;"><canvas id="chartBarComunas"></canvas></div>'
    )
    
    # Fix 2: Wrap chartPareto canvas in a fixed-height container
    c = c.replace(
        '<canvas id="chartPareto" height="220"></canvas>',
        '<div style="position: relative; height: 280px;"><canvas id="chartPareto"></canvas></div>'
    )
    
    with open(fp, 'w', encoding='utf-8') as f:
        f.write(c)
    print(f"Fixed {fp}")
