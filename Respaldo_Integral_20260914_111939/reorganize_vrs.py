import os
import re

path = r"C:\Antigravity IDE\WEB DEIS\VRS\index.html"

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove the button from the header
btn_pattern = r'<a href="Rescates_VRS_Pendientes_2026\.xlsx" id="btnDescargaRescates".*?</a>'
content = re.sub(btn_pattern, '', content, flags=re.DOTALL)

# 2. Replace the autoconsulta section
old_section_pattern = r'<section class="autoconsulta-section">.*?</section>'

new_section = '''<section class="autoconsulta-section">
                    <div class="autoconsulta-header" style="margin-bottom: 25px;">
                        <div class="autoconsulta-header-icon">
                            <i class="fas fa-search-plus"></i>
                        </div>
                        <div>
                            <h2 class="autoconsulta-title">Herramientas Operativas de Inmunización</h2>
                            <p class="autoconsulta-subtitle">Gestión y búsqueda de población objetivo para la campaña <strong>VRS 2026</strong>.</p>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 2.5fr; gap: 20px; align-items: start;">
                        
                        <!-- Columna Izquierda: Descarga Rescates -->
                        <div class="autoconsulta-drop-zone" style="text-align: center; padding: 30px 20px; background: rgba(239, 68, 68, 0.03); border: 2px dashed rgba(239, 68, 68, 0.3);">
                            <div class="autoconsulta-drop-icon" style="color: #ef4444; background: rgba(239, 68, 68, 0.1);">
                                <i class="fas fa-file-download"></i>
                            </div>
                            <h3 style="color: #0f172a; margin-bottom: 10px; font-size: 1.1rem;">Descarga Masiva</h3>
                            <p style="color: #64748b; font-size: 0.85rem; margin-bottom: 25px; line-height: 1.5;">
                                Descargue la nómina consolidada de todos los menores pendientes de inmunización a nivel provincial.
                            </p>
                            <a href="Rescates_VRS_Pendientes_2026.xlsx" download style="background: #ef4444; color: white; border: none; padding: 12px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.3); width: 100%; transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                                <i class="fas fa-file-excel"></i> Descargar Nómina VRS
                            </a>
                        </div>

                        <!-- Columna Derecha: Autoconsulta Excel -->
                        <div style="display: flex; flex-direction: column; gap: 20px;">
                            <div class="autoconsulta-info-banner glass" style="margin-bottom: 0;">
                                <div class="autoconsulta-info-item">
                                    <i class="fas fa-shield-alt"></i>
                                    <span><strong>Privacidad:</strong> El procesamiento se realiza 100% en su navegador. Sus datos no salen de este computador.</span>
                                </div>
                                <div class="autoconsulta-info-item">
                                    <i class="fas fa-file-excel"></i>
                                    <span><strong>Formato:</strong> Archivo Excel (.xlsx, .xls) con una columna que contenga RUNs (con o sin dígito verificador).</span>
                                </div>
                                <div class="autoconsulta-info-item">
                                    <i class="fas fa-database"></i>
                                    <span><strong>Base de datos:</strong> Nirsevimab VRS por Residencia 2026 — DEIS MINSAL.</span>
                                </div>
                            </div>

                            <!-- Zona de Drop -->
                            <div class="autoconsulta-drop-zone" id="autoconsultaDropZone" style="margin-top: 0;">
                                <input type="file" id="autoconsultaFileInput" accept=".xlsx,.xls,.xlsm" style="display: none;" />
                                <div class="autoconsulta-drop-icon">
                                    <i class="fas fa-cloud-upload-alt"></i>
                                </div>
                                <h3>Autoconsulta Rutificada</h3>
                                <p>Arrastre su archivo Excel aquí o haga clic para seleccionar</p>
                                <div class="autoconsulta-drop-formats">
                                    <span class="format-badge">.xlsx</span>
                                    <span class="format-badge">.xls</span>
                                    <span class="format-badge">.xlsm</span>
                                </div>
                            </div>

                            <!-- Progreso -->
                            <div class="autoconsulta-progress-area" id="autoconsultaProgress" style="display: none;"></div>
                            
                            <!-- Resultados -->
                            <div class="autoconsulta-results-area" id="autoconsultaResults" style="display: none;"></div>
                            
                            <!-- Error -->
                            <div class="autoconsulta-error-area" id="autoconsultaError" style="display: none;"></div>
                        </div>

                    </div>
                </section>'''

content = re.sub(old_section_pattern, new_section, content, flags=re.DOTALL)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("VRS index.html reorganized successfully.")
