import re
import codecs
import os

modules = [
    {"folder": "Influenza_Web", "vacuna": "Influenza", "year": "2026"},
    {"folder": "Covid_Web", "vacuna": "COVID-19", "year": "2026"},
    {"folder": "VRS", "vacuna": "VRS (Nirsevimab)", "year": "2026"},
    {"folder": "VPH", "vacuna": "VPH", "year": "2026"},
]

base_dir = r"c:\Antigravity IDE\WEB DEIS"

new_html_template = """                <section class="autoconsulta-section">
                    <div class="autoconsulta-header">
                        <div class="autoconsulta-header-icon">
                            <i class="fas fa-search-plus"></i>
                        </div>
                        <div>
                            <h2 class="autoconsulta-title">Consultar estado de vacunación desde archivo Excel</h2>
                            <p class="autoconsulta-subtitle">Suba un archivo con una columna de RUT y obtenga automáticamente el estado de vacunación contra <strong>{vacuna}</strong>, junto con un resumen estadístico y resultados exportables.</p>
                        </div>
                    </div>

                    <!-- 3 Steps -->
                    <div class="autoconsulta-steps-container">
                        <div class="autoconsulta-step">
                            <div class="step-number">1</div>
                            <div class="step-title"><i class="fas fa-file-excel" style="color: #10b981;"></i> Prepare su archivo Excel</div>
                            <div class="step-desc">Debe contener una columna con RUT.</div>
                        </div>
                        <div class="autoconsulta-step">
                            <div class="step-number">2</div>
                            <div class="step-title"><i class="fas fa-upload" style="color: var(--minsal-blue, #0f69b4);"></i> Súbalo en esta sección</div>
                            <div class="step-desc">Arrástrelo o selecciónelo desde su equipo.</div>
                        </div>
                        <div class="autoconsulta-step">
                            <div class="step-number">3</div>
                            <div class="step-title"><i class="fas fa-chart-line" style="color: #a78bfa;"></i> Revise y exporte los resultados</div>
                            <div class="step-desc">Obtendrá un resumen del estado de vacunación y resultados descargables.</div>
                        </div>
                    </div>

                    <!-- Zona de Drop Principal -->
                    <div class="autoconsulta-drop-zone" id="autoconsultaDropZone" onclick="document.getElementById('autoconsultaFileInput').click()">
                        <input type="file" id="autoconsultaFileInput" accept=".xlsx,.xls,.xlsm" style="display: none;" />
                        <div class="autoconsulta-drop-icon">
                            <i class="fas fa-cloud-upload-alt"></i>
                        </div>
                        <h3 class="autoconsulta-drop-title">Suba su archivo para comenzar</h3>
                        <p class="autoconsulta-drop-subtitle">Arrastre aquí su archivo Excel o haga clic para seleccionarlo.<br>Debe contener una columna con RUT.</p>
                        <div class="autoconsulta-drop-formats">
                            <span class="format-badge">.xlsx</span>
                            <span class="format-badge">.xls</span>
                            <span class="format-badge">.xlsm</span>
                        </div>
                        <div class="autoconsulta-actions">
                            <button class="btn-primary-action" onclick="event.stopPropagation(); document.getElementById('autoconsultaFileInput').click()">
                                <i class="fas fa-folder-open"></i> Seleccionar archivo
                            </button>
                            <button class="btn-secondary-action" onclick="event.stopPropagation(); window.downloadTemplate()">
                                <i class="fas fa-download"></i> Descargar plantilla Excel
                            </button>
                        </div>
                    </div>

                    <!-- Info banner moved to the bottom -->
                    <div class="autoconsulta-info-compact">
                        <div class="info-compact-item">
                            <div class="info-compact-icon"><i class="fas fa-shield-alt"></i></div>
                            <div class="info-compact-text">
                                <strong>Procesamiento Local</strong>
                                El procesamiento se realiza localmente en su navegador. Los datos del archivo no se envían fuera de su equipo.
                            </div>
                        </div>
                        <div class="info-compact-item">
                            <div class="info-compact-icon"><i class="fas fa-file-excel"></i></div>
                            <div class="info-compact-text">
                                <strong>Formatos Aceptados</strong>
                                Excel (.xlsx, .xls). Se aceptan RUTs con o sin puntos, con o sin guión, y con o sin dígito verificador.
                            </div>
                        </div>
                        <div class="info-compact-item">
                            <div class="info-compact-icon"><i class="fas fa-database"></i></div>
                            <div class="info-compact-text">
                                <strong>Fuente de Datos</strong>
                                {vacuna} por Residencia {year} — DEIS MINSAL.
                            </div>
                        </div>
                    </div>

                    <!-- Progreso -->
                    <div class="autoconsulta-progress-area" id="autoconsultaProgress" style="display: none;"></div>

                    <!-- Resultados -->
                    <div class="autoconsulta-results-area" id="autoconsultaResults" style="display: none;"></div>

                    <!-- Error -->
                    <div class="autoconsulta-error-area" id="autoconsultaError" style="display: none;"></div>

                </section>"""

pattern = re.compile(r'(<section class="autoconsulta-section">.*?</section>)', re.DOTALL)

for mod in modules:
    file_path = os.path.join(base_dir, mod["folder"], "index.html")
    if os.path.exists(file_path):
        with codecs.open(file_path, "r", "utf-8") as f:
            content = f.read()
            
        new_html = new_html_template.format(vacuna=mod["vacuna"], year=mod["year"])
        
        # Replace
        new_content = pattern.sub(new_html, content, count=1)
        
        with codecs.open(file_path, "w", "utf-8") as f:
            f.write(new_content)
        print(f"Updated {mod['folder']}/index.html")
    else:
        print(f"File not found: {file_path}")
