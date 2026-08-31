import re

path = r"c:\Antigravity IDE\WEB DEIS\Covid_Web\index.html"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. We want to find the <div class="map-tactical-panel" style="..."> block.
# And replace it with the <style> + <div class="map-tactical-panel"> + <div class="map-tactical-panel-header"> + <div class="map-tactical-panel-content"> + ...

# Pattern to find:
# <!-- Panel T?ctico Flotante (Leyenda del Mapa) -->
# <div class="map-tactical-panel" style="...">
# ... 
# </div>
# </div>
# </div>
# 
# <div class="trend-col">

pattern = re.compile(
    r'(<!-- Panel T.ctico Flotante \(Leyenda del Mapa\) -->\s*)'
    r'<div class="map-tactical-panel" style="[^"]*">\s*'
    r'(<div style="font-size: 0\.72rem; font-weight: 800; color: #312e81;[\s\S]*?)'
    r'(\s*</div>\s*'
    r'</div>\s*'
    r'</div>\s*'
    r'<div class="trend-col">)',
    re.IGNORECASE | re.MULTILINE
)

# The new structure:
new_legend = r'''\1
                        <style>
                            .map-tactical-panel {
                                position: absolute;
                                top: auto !important;
                                bottom: 35px !important;
                                right: auto !important;
                                left: 20px !important;
                                z-index: 1000;
                                width: 250px;
                                padding: 0 !important;
                                box-sizing: border-box;
                                background: rgba(255,255,255,0.95);
                                backdrop-filter: blur(10px);
                                border-radius: 12px;
                                border: 1px solid rgba(49,46,129,0.15);
                                box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                                max-height: 48px;
                                overflow: hidden;
                                transition: max-height 0.4s ease, box-shadow 0.3s ease;
                            }
                            .map-tactical-panel:hover {
                                max-height: 600px;
                                box-shadow: 0 8px 30px rgba(0,0,0,0.15);
                            }
                            .map-tactical-panel-header {
                                height: 48px;
                                padding: 0 16px;
                                font-size: 0.75rem;
                                font-weight: 800;
                                color: #312e81;
                                cursor: default;
                                display: flex;
                                justify-content: space-between;
                                align-items: center;
                                letter-spacing: 0.5px;
                            }
                            .map-tactical-panel:hover .map-tactical-panel-header i {
                                transform: rotate(180deg);
                            }
                            .map-tactical-panel-header i {
                                transition: transform 0.3s ease;
                            }
                            .map-tactical-panel-content {
                                padding: 0 12px 12px 12px;
                                opacity: 0;
                                transition: opacity 0.3s ease 0.1s;
                            }
                            .map-tactical-panel:hover .map-tactical-panel-content {
                                opacity: 1;
                            }
                        </style>
                        <div class="map-tactical-panel">
                            <div class="map-tactical-panel-header">
                                <span><i class="fa-solid fa-map" style="margin-right: 6px;"></i> LEYENDA DEL MAPA</span>
                                <i class="fa-solid fa-chevron-down"></i>
                            </div>
                            <div class="map-tactical-panel-content">
                                \2\3'''

new_content, count = pattern.subn(new_legend, content)

print(f"Replaced {count} instances.")

with open(path, "w", encoding="utf-8") as f:
    f.write(new_content)
