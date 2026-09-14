import codecs

path = r'c:\Antigravity IDE\WEB DEIS\Covid_Web\index.html'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

tab_btn_insert = """                <button class="tab-btn" data-tab="autoconsulta">
                    <i class="fas fa-search"></i> Autoconsulta de Vacunación
                </button>
            </div>"""

if 'data-tab="autoconsulta"' not in content:
    content = content.replace('            </div>\n        </header>', tab_btn_insert + '\n        </header>')

tab_content_insert = """            </section>
            </div>
            
            <!-- ── TAB 3: AUTOCONSULTA ── -->
            <div class="tab-content" id="tab-autoconsulta">
                <section class="autoconsulta-section">
                    <div class="autoconsulta-header">
                        <div class="autoconsulta-header-icon">
                            <i class="fas fa-search-plus"></i>
                        </div>
                        <div>
                            <h2 class="autoconsulta-title">Autoconsulta de Estado de Vacunación</h2>
                            <p class="autoconsulta-subtitle">Suba un archivo Excel con RUNs para verificar el estado de vacunación contra <strong>COVID-19</strong> en base de residencia 2026.</p>
                        </div>
                    </div>

                    <div class="autoconsulta-info-banner glass">
                        <div class="autoconsulta-info-item">
                            <i class="fas fa-shield-alt"></i>
                            <span><strong>Privacidad:</strong> El procesamiento se realiza 100% en su navegador. Sus datos no salen de este computador.</span>
                        </div>
                        <div class="autoconsulta-info-item">
                            <i class="fas fa-file-excel"></i>
                            <span><strong>Formato:</strong> Archivo Excel (.xlsx, .xls) con una columna que contenga RUNs (puede ser con o sin puntos, con o sin guión, con o sin dígito verificador).</span>
                        </div>
                        <div class="autoconsulta-info-item">
                            <i class="fas fa-database"></i>
                            <span><strong>Base de datos:</strong> COVID-19 por Residencia 2026 — DEIS MINSAL.</span>
                        </div>
                    </div>

                    <!-- Zona de Drop -->
                    <div class="autoconsulta-drop-zone" id="autoconsultaDropZone">
                        <input type="file" id="autoconsultaFileInput" accept=".xlsx,.xls,.xlsm" style="display: none;" />
                        <div class="autoconsulta-drop-icon">
                            <i class="fas fa-cloud-upload-alt"></i>
                        </div>
                        <h3>Arrastre su archivo Excel aquí</h3>
                        <p>o haga clic para seleccionar</p>
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

                </section>
            </div>
        </main>"""

if 'id="tab-autoconsulta"' not in content:
    content = content.replace('            </div>\n        </main>', tab_content_insert)
    
scripts_insert = """    <script src="data/comunas_osorno.js"></script>
    <script src="data/data_establecimientos.js"></script>
    <script src="bundle.js?v=43"></script>
    <script src="covid_runs_index.js?v=2"></script>
    <script src="autoconsulta.js?v=60"></script>
    <script src="https://cdn.jsdelivr.net/npm/toastify-js"></script>"""

if 'autoconsulta.js' not in content:
    content = content.replace('    <script src="data/comunas_osorno.js"></script>\n    <script src="data/data_establecimientos.js"></script>\n    <script src="bundle.js?v=43"></script>', scripts_insert)

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)

print("Restored Autoconsulta to Covid_Web!")
