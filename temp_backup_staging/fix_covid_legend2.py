import codecs
import re

with codecs.open(r'c:\Antigravity IDE\WEB DEIS\Covid_Web\index.html', 'r', 'utf-8') as f:
    content = f.read()

new_legend = """                        <!-- Panel Táctico Flotante (Leyenda del Mapa) -->
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
                                <div style="font-size: 0.72rem; font-weight: 800; color: #312e81; margin-bottom: 8px; border-bottom: 1px solid rgba(49,46,129,0.12); padding-bottom: 4px; letter-spacing: 0.5px;">INTENSIDAD VACUNACIÓN</div>
                                <div class="map-legend" style="margin-bottom: 12px;">
                                    <div class="legend-item"><span class="dot" style="background:#10b981; width:10px; height:10px; border-radius:50%; display:inline-block; margin-right:8px;"></span> Alto (>80% del máx)</div>
                                    <div class="legend-item"><span class="dot" style="background:#f59e0b; width:10px; height:10px; border-radius:50%; display:inline-block; margin-right:8px;"></span> Medio (51-80%)</div>
                                    <div class="legend-item"><span class="dot" style="background:#ef4444; width:10px; height:10px; border-radius:50%; display:inline-block; margin-right:8px;"></span> Bajo (<50%)</div>
                                </div>
                                <div style="font-size: 0.72rem; font-weight: 800; color: #312e81; margin-bottom: 8px; border-bottom: 1px solid rgba(49,46,129,0.12); padding-bottom: 4px; letter-spacing: 0.5px;">RED ASISTENCIAL</div>
                                <div class="map-legend">
                                    <div class="legend-item" style="margin-bottom: 4px;"><span class="dot" style="background:#312e81; width:10px; height:10px; border-radius:50%; display:inline-block; margin-right:8px;"></span> Hospitales</div>
                                    <div class="legend-item" style="margin-bottom: 4px;"><span class="dot" style="background:#14b8a6; width:10px; height:10px; border-radius:50%; display:inline-block; margin-right:8px;"></span> CESFAM</div>
                                    <div class="legend-item" style="margin-bottom: 4px;"><span class="dot" style="background:#f59e0b; width:10px; height:10px; border-radius:50%; display:inline-block; margin-right:8px;"></span> Cecosf / Urgencia</div>
                                    <div class="legend-item" style="margin-bottom: 4px;"><span class="dot" style="background:#64748b; width:10px; height:10px; border-radius:50%; display:inline-block; margin-right:8px;"></span> Postas Rurales</div>
                                </div>
                                <div style="font-size: 0.65rem; color: #64748b; margin-top: 10px; border-top: 1px dashed rgba(0,0,0,0.08); padding-top: 6px; font-style: italic; line-height: 1.25;">
                                    * El color del polígono indica la intensidad relativa de vacunación comunal. Los íconos representan los centros de salud.
                                </div>
                            </div>
                        </div>"""

pattern = re.compile(r'(\s*<!-- Panel T.ctico Flotante \(Leyenda del Mapa\) -->\s*<div class="map-tactical-panel".*?Los .conos representan los centros de salud\.\s*</div>\s*</div>)', re.DOTALL)
match = pattern.search(content)
if match:
    new_content = content[:match.start()] + '\n' + new_legend + '\n' + content[match.end():]
    with codecs.open(r'c:\Antigravity IDE\WEB DEIS\Covid_Web\index.html', 'w', 'utf-8') as f:
        f.write(new_content)
    print("Replaced perfectly.")
else:
    print("Could not find the block.")
