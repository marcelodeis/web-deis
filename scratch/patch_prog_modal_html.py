import io

html_path = r'C:\Antigravity IDE\WEB DEIS\Programáticas_Web\index.html'

with io.open(html_path, 'r', encoding='utf-8') as f:
    html_content = f.read()

prog_modal_html = """
        <!-- Modal Analítico Programaticas -->
        <div id="progModalBackdrop" class="help-modal-backdrop" onclick="cerrarReporteProgramaticas()" style="display: none; z-index: 10000; background: rgba(15, 23, 42, 0.75); position: fixed; inset: 0;"></div>
        
        <div id="progModalWindow" class="help-modal-window fade-in" style="display: none; max-width: 1000px; width: 95%; max-height: 90vh; overflow-y: auto; z-index: 10001; position: fixed; top: 5vh; left: 50%; transform: translateX(-50%); background: white; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
            <button class="help-modal-close" onclick="cerrarReporteProgramaticas()" style="position: absolute; top: 15px; right: 15px; background: rgba(255,255,255,0.2); border: none; color: white; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-times"></i>
            </button>
            <div class="help-modal-header" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 25px; border-radius: 16px 16px 0 0; color: white;">
                <h2 id="progModalTitle" style="margin: 0; font-size: 1.5rem; font-weight: 700; color: #ffffff;">Reporte de Seguimiento</h2>
                <div class="help-modal-context" style="margin-top: 8px; font-size: 0.9rem; color: #cbd5e1;">
                    <i class="far fa-calendar-alt"></i> Corte: <span id="progModalCorte">20/08/2026</span> – Residencia SSO
                </div>
            </div>
            
            <div class="help-modal-body" style="padding: 25px; background: #f8fafc;">
                
                <!-- 1. Resumen Ejecutivo -->
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
                    <h3 style="margin-top: 0; margin-bottom: 15px; color: #334155; font-size: 1.1rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">1. Resumen ejecutivo</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 15px;">
                        <div style="background: #f1f5f9; padding: 12px; border-radius: 8px;">
                            <div style="font-size: 0.8rem; color: #64748b; text-transform: uppercase; font-weight: 600;">Universo Total</div>
                            <div id="progModalKpiNacidos" style="font-size: 1.5rem; font-weight: 700; color: #0f172a;">--</div>
                        </div>
                        <div style="background: #f1f5f9; padding: 12px; border-radius: 8px;">
                            <div style="font-size: 0.8rem; color: #64748b; text-transform: uppercase; font-weight: 600;">Universo elegible</div>
                            <div id="progModalKpiElegibles" style="font-size: 1.5rem; font-weight: 700; color: #0f172a;">--</div>
                        </div>
                        <div style="background: #ecfdf5; padding: 12px; border-radius: 8px; border: 1px solid #a7f3d0;">
                            <div style="font-size: 0.8rem; color: #059669; text-transform: uppercase; font-weight: 600;">Con registro</div>
                            <div id="progModalKpiCon" style="font-size: 1.5rem; font-weight: 700; color: #065f46;">--</div>
                        </div>
                        <div style="background: #fff7ed; padding: 12px; border-radius: 8px; border: 1px solid #fed7aa;">
                            <div style="font-size: 0.8rem; color: #c2410c; text-transform: uppercase; font-weight: 600;">Sin registro (Rescate)</div>
                            <div id="progModalKpiSin" style="font-size: 1.5rem; font-weight: 700; color: #9a3412;">--</div>
                        </div>
                    </div>
                    <div style="background: #f8fafc; padding: 12px; border-left: 4px solid #3b82f6; font-size: 0.95rem; color: #334155; line-height: 1.5;">
                        <strong style="color: #1e293b;">Interpretación:</strong> <span id="progModalResumenTexto">...</span>
                    </div>
                </div>

                <!-- 2. Flujo -->
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 25px; text-align: center;">
                    <h3 style="margin-top: 0; margin-bottom: 15px; color: #334155; font-size: 1.1rem; text-align: left; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">2. Flujo de construcción del indicador</h3>
                    
                    <div style="display: inline-block; background: #e2e8f0; padding: 8px 16px; border-radius: 20px; font-weight: 600; color: #334155;" id="progModalFlujoNacidos">...</div>
                    <div style="margin: 8px 0; color: #94a3b8;"><i class="fas fa-arrow-down"></i></div>
                    <div style="display: inline-block; background: #fef2f2; border: 1px solid #fecaca; padding: 8px 16px; border-radius: 20px; font-weight: 600; color: #991b1b;" id="progModalFlujoExcluidos">...</div>
                    <div style="margin: 8px 0; color: #94a3b8;"><i class="fas fa-arrow-down"></i></div>
                    <div style="display: inline-block; background: #e0f2fe; border: 1px solid #bae6fd; padding: 8px 16px; border-radius: 20px; font-weight: 600; color: #0369a1;" id="progModalFlujoElegibles">...</div>
                    <div style="margin: 8px 0; color: #94a3b8;"><i class="fas fa-arrow-down"></i></div>
                    <div style="display: inline-block; background: white; border: 2px solid #e2e8f0; padding: 10px 20px; border-radius: 20px; font-weight: 700; font-size: 1.1rem;" id="progModalFlujoFinal">...</div>
                </div>

                <!-- 3. Distribución -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
                    <!-- Distribución Comuna -->
                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
                        <h3 style="margin-top: 0; margin-bottom: 15px; color: #334155; font-size: 1.1rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">3. Casos sin registro por Comuna de Residencia</h3>
                        
                        <div class="table-responsive" style="max-height: 250px; overflow-y: auto;">
                            <table class="matriz-table" style="font-size: 0.85rem;">
                                <thead><tr><th>Comuna</th><th style="text-align:right;">Elegibles</th><th style="text-align:right;">Sin registro</th><th style="text-align:right;">% sin registro</th></tr></thead>
                                <tbody id="progModalTbodyComuna"></tbody>
                            </table>
                        </div>
                    </div>
                    
                    <!-- Distribución Establecimiento -->
                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
                        <h3 style="margin-top: 0; margin-bottom: 15px; color: #334155; font-size: 1.1rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">4. Top 10 Establecimientos (Rescates)</h3>
                        
                        <div class="table-responsive" style="max-height: 250px; overflow-y: auto;">
                            <table class="matriz-table" style="font-size: 0.85rem;">
                                <thead><tr><th>Establecimiento</th><th style="text-align:right;">Comuna</th><th style="text-align:right;">Casos sin registro</th></tr></thead>
                                <tbody id="progModalTbodyHospital"></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- 5. Excluidos -->
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
                    <h3 style="margin-top: 0; margin-bottom: 15px; color: #334155; font-size: 1.1rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">5. Excluidos del seguimiento</h3>
                    <div class="table-responsive">
                        <table class="matriz-table" style="font-size: 0.9rem;">
                            <thead><tr><th>Causal de exclusión</th><th style="text-align:right;">Casos</th></tr></thead>
                            <tbody id="progModalTbodyExclusiones"></tbody>
                        </table>
                    </div>
                </div>
                
                <!-- 6. Metodología -->
                <div style="background: #f1f5f9; border-radius: 8px; padding: 15px; font-size: 0.85rem; color: #475569; margin-bottom: 20px;">
                    <strong style="color: #334155;">Tipo de indicador:</strong> Seguimiento de Esquema Programático por residencia.<br>
                    <strong style="color: #334155;">Denominador:</strong> Menores elegibles residentes en la jurisdicción del SSO.<br>
                    <strong style="color: #334155;">Numerador:</strong> Menores elegibles con registro de vacunación identificado.<br>
                    <strong style="color: #334155;">Brecha (Rescate):</strong> Universo elegible − registros de vacunación identificados.<br>
                    <span style="color: #991b1b;"><i class="fas fa-exclamation-triangle"></i> Importante: “Sin registro identificado” no equivale necesariamente a “no vacunado”.</span>
                </div>
                
                <!-- Botón de descarga final -->
                <div style="text-align: center;">
                    <a id="progModalDownloadBtn" href="#" download style="background: #10b981; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; text-decoration: none; display: inline-block; transition: background 0.2s; font-size: 1.1rem; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);" onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'"><i class="fas fa-file-excel" style="margin-right: 8px;"></i> <span id="progModalDownloadTxt">Descargar nómina</span></a>
                </div>

            </div>
        </div>
"""

# Insert the HTML just before <div id="helpModalBackdrop"
if 'progModalBackdrop' not in html_content:
    html_content = html_content.replace('<!-- Ayuda Interpretativa Modal Backdrop -->', prog_modal_html + '\n        <!-- Ayuda Interpretativa Modal Backdrop -->')

with io.open(html_path, 'w', encoding='utf-8') as f:
    f.write(html_content)

print('HTML modal injected successfully!')
