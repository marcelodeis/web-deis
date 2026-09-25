import io, re

html_path = r'C:\Antigravity IDE\WEB DEIS\Programáticas_Web\index.html'

with io.open(html_path, 'r', encoding='utf-8') as f:
    html_content = f.read()

# 1. Inject CSS for the tooltip
css_tooltip = """
    <style>
        .info-tooltip-container {
            position: relative;
            display: inline-block;
            margin-left: 4px;
        }
        .info-tooltip-text {
            visibility: hidden;
            width: 260px;
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            color: #f8fafc;
            text-align: left;
            border-radius: 8px;
            padding: 12px;
            position: absolute;
            z-index: 1000;
            bottom: 150%;
            left: 50%;
            margin-left: -130px;
            opacity: 0;
            transform: translateY(10px);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            font-size: 0.8rem;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
            line-height: 1.5;
            pointer-events: none;
            border: 1px solid #334155;
        }
        .info-tooltip-text::after {
            content: "";
            position: absolute;
            top: 100%;
            left: 50%;
            margin-left: -6px;
            border-width: 6px;
            border-style: solid;
            border-color: #1e293b transparent transparent transparent;
        }
        .info-tooltip-container:hover .info-tooltip-text {
            visibility: visible;
            opacity: 1;
            transform: translateY(0);
        }
        .info-tooltip-text strong {
            color: #38bdf8;
            font-size: 0.85rem;
            display: block;
            margin-bottom: 6px;
            border-bottom: 1px solid #334155;
            padding-bottom: 4px;
        }
        .info-tooltip-text ul {
            margin: 0;
            padding-left: 18px;
            margin-bottom: 6px;
        }
        .info-tooltip-text li {
            margin-bottom: 3px;
        }
    </style>
"""

if '.info-tooltip-container' not in html_content:
    html_content = html_content.replace('</head>', css_tooltip + '</head>')

# 2. Replace the old i tags with the new tooltip
replacement_neo = """<span class="info-tooltip-container"><i class="fas fa-info-circle" style="color:#3b82f6; cursor:help;"></i><div class="info-tooltip-text"><strong>Causales de Exclusión</strong><ul><li>Fallecidos</li><li>Registros Anómalos (Rechazados por calidad)</li></ul><span style="color:#cbd5e1; font-size:0.75rem;">Estos menores son restados del padrón original y no componen el universo elegible de vacunación.</span></div></span>"""

replacement_prog = """<span class="info-tooltip-container"><i class="fas fa-info-circle" style="color:#3b82f6; cursor:help;"></i><div class="info-tooltip-text"><strong>Causales de Exclusión</strong><ul><li>Fallecidos</li><li>Fuera de Cohorte (Edad incorrecta)</li><li>Sin evidencia de Residencia (Casos no atribuibles al territorio)</li></ul><span style="color:#cbd5e1; font-size:0.75rem;">Estos registros se descartan metodológicamente y no se contabilizan como brecha activa.</span></div></span>"""

# We have 2 for neo and 6 for prog.
# But they all have slightly different titles right now.
# We will use regex to find <i class="fas fa-info-circle" title=".*?"></i>
import re

# For neonatal (lines 800-850 approx)
def replacer(match):
    full_match = match.group(0)
    # Check if it's the specific title for neo or prog, or just replace based on where we are.
    if 'para conocer las causales' in full_match:
        return replacement_neo
    else:
        return replacement_prog

# This regex matches the old i tags.
html_content = re.sub(r'<i class="fas fa-info-circle" title="Registros excluidos[^"]*?" style="color:#64748b; cursor:help;"></i>', replacer, html_content)

with io.open(html_path, 'w', encoding='utf-8') as f:
    f.write(html_content)

print('Tooltip injected successfully!')
