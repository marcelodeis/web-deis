/**
 * =============================================================================
 * OBSERVATORIO EPIDEMIOLÓGICO VPH (2014-2026) — SERVICIO DE SALUD OSORNO
 * LÓGICA INTERACTIVA, GESTIÓN DE ESTADO, GRÁFICOS Y ANÁLISIS DINÁMICO
 * Homologado a Estándares Institucionales MINSAL / DEIS
 * =============================================================================
 */
// Funciones Globales para el Modal de Metodología e Hitos
window.openMethodologyModal = function() {
    const modal = document.getElementById('modalFichaMetodologica');
    if (modal) {
        modal.style.setProperty('display', 'flex', 'important');
        document.body.style.overflow = 'hidden';
    }
};

window.closeMethodologyModal = function() {
    const modal = document.getElementById('modalFichaMetodologica');
    if (modal) {
        modal.style.setProperty('display', 'none', 'important');
        document.body.style.overflow = 'auto';
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    // Estado Global de la Aplicación
    const state = {
        data: null,
        currentTab: 'tab-cobertura',
        selectedAno: '2026',
        selectedComuna: 'TOTAL',
        selectedSexo: 'Total',
        charts: {},
        isDark: false
    };

    // Referencias al DOM
    const dom = {
        selectAno: document.getElementById('selectAnoMedicion'),
        selectComuna: document.getElementById('selectComuna'),
        selectSexo: document.getElementById('selectSexo'),
        filterSummary: document.getElementById('filterSummaryText'),
        tagFechaCorte: document.getElementById('tagFechaCorte'),
        tabBtns: document.querySelectorAll('.tab-btn'),
        tabPanels: document.querySelectorAll('.tab-content, .tab-panel'),
        btnExportExcel: document.getElementById('btnExportExcel'),
        btnPrintReport: document.getElementById('btnPrintReport'),
        btnToggleTheme: document.getElementById('btnToggleTheme')
    };

    // Helper: Colores según Tema
    function getThemeColors() {
        return {
            textMuted: state.isDark ? '#94a3b8' : '#475569',
            textPrimary: state.isDark ? '#f8fafc' : '#0f172a',
            gridColor: state.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,105,180,0.08)',
            blue: '#0f69b4',
            blueLight: '#38bdf8',
            purple: '#9333ea',
            purpleLight: '#c084fc',
            cyan: '#0284c7',
            cyanLight: '#38bdf8',
            green: '#10b981',
            amber: '#f59e0b',
            red: '#ef4444'
        };
    }

    // 1. Cargar Datos (Global JS o JSON Fetch)
    async function loadData() {
        if (window.VPH_DASHBOARD_DATA) {
            state.data = window.VPH_DASHBOARD_DATA;
        } else {
            try {
                const res = await fetch('dashboard_data_vph.json');
                state.data = await res.json();
            } catch (err) {
                console.error('Error al cargar datos del dashboard:', err);
                alert('No se pudieron cargar los datos del Observatorio VPH. Asegúrese de haber ejecutado el motor de procesamiento.');
                return;
            }
        }

        if (state.data) {
            updateHeaderFechaCorte();
            initFilters();
            initTabs();
            initTheme();
            initTimeline();
            initProduccionControls();
            updateDashboard();
            renderMatrizProduccionEstablecimientos();
        }
    }

    // Actualizar Fecha de Corte Oficial Dinámica
    function updateHeaderFechaCorte() {
        const fcEl = document.getElementById('headerFechaCorte');
        if (!fcEl) return;
        let fechaStr = state.data?.metadatos?.fecha_corte || state.data?.metadata?.fecha_corte || '04-08-2026 18:41';
        if (state.currentTab === 'tab-produccion' && state.data?.metadata?.fecha_corte_ocurrencia) {
            fechaStr = state.data.metadata.fecha_corte_ocurrencia;
        }
        
        // Formatear fecha: si viene como "2026-08-11 16:21:47" -> "11/08/2026 16:21"
        if (fechaStr.match(/^\d{4}-\d{2}-\d{2}/)) {
            const [datePart, timePart] = fechaStr.split(' ');
            if (datePart && timePart) {
                const [y, m, d] = datePart.split('-');
                const [h, min] = timePart.split(':');
                fechaStr = `${d}/${m}/${y} ${h}:${min}`;
            }
        } else if (fechaStr.includes('-')) {
            fechaStr = fechaStr.replace(/-/g, '/');
            const parts = fechaStr.split(':');
            if (parts.length === 3) fechaStr = parts[0] + ':' + parts[1];
        }
        
        const fechaFormateada = fechaStr.replace(/\//g, '-');
        fcEl.textContent = `Datos disponibles hasta: ${fechaFormateada}`;
    }

    // Obtener la fecha de corte formateada como DD/MM/YYYY para los selectores
    function getFechaCorteFormateada(isProduccion = false) {
        let raw = state.data?.metadatos?.fecha_corte || state.data?.metadata?.fecha_corte || '';
        if (isProduccion && state.data?.metadata?.fecha_corte_ocurrencia) {
            raw = state.data.metadata.fecha_corte_ocurrencia;
        }
        if (!raw) return 'En Curso';
        document.querySelectorAll(".vph-dynamic-cutoff").forEach(el => el.textContent = state.data?.fecha_max_residencia || "Desconocida");
        // raw puede ser "2026-08-05 12:18:08" o "05-08-2026 12:18"
        const parts = raw.split(' ')[0]; // tomar solo la fecha
        const segments = parts.split('-');
        if (segments[0].length === 4) {
            // Formato YYYY-MM-DD → DD/MM/YYYY
            return `${segments[2]}/${segments[1]}/${segments[0]}`;
        } else {
            // Formato DD-MM-YYYY → DD/MM/YYYY
            return segments.join('/');
        }
    }

    // 2. Sincronización y Gestión de Filtros Contextuales en Cabecera
    function syncHeaderControls(tab) {
        state.currentTab = tab || state.currentTab || 'tab-cobertura';
        const labelAno = document.getElementById('labelAnoFilter');
        const labelComuna = document.getElementById('labelComunaFilter');
        const wrapperSexo = document.getElementById('wrapperFilterSexo');
        const wrapperSearchEstab = document.getElementById('wrapperFilterSearchEstab');
        const btnMethodology = document.getElementById('btnFichaMetodologica');

        if (state.currentTab === 'tab-cobertura') {
            if (labelAno) labelAno.textContent = 'AÑO EVALUACIÓN (15 AÑOS)';
            if (labelComuna) labelComuna.textContent = 'COMUNA RESIDENCIA';
            if (wrapperSexo) wrapperSexo.style.display = 'flex';
            if (wrapperSearchEstab) wrapperSearchEstab.style.display = 'none';
            if (btnMethodology) btnMethodology.style.display = 'inline-flex';

            // Poblar Selector de Años para Cobertura (2026 primero, ..., 2015, ALL al final)
            if (state.data?.indicadores_anuales && dom.selectAno) {
                const anos = Object.keys(state.data.indicadores_anuales).map(Number).sort((a, b) => b - a);
                dom.selectAno.innerHTML = '';
                anos.forEach(ano => {
                    const opt = document.createElement('option');
                    opt.value = String(ano);
                    const coh = state.data.indicadores_anuales[ano].cohorte;
                    opt.textContent = `Año ${ano} (Cohorte ${coh} - 15 años)`;
                    if (String(ano) === String(state.selectedAno)) opt.selected = true;
                    dom.selectAno.appendChild(opt);
                });
                const optHistorico = document.createElement('option');
                optHistorico.value = 'ALL';
                optHistorico.textContent = 'Todo el Histórico (2015 - 2026)';
                if (state.selectedAno === 'ALL') optHistorico.selected = true;
                dom.selectAno.appendChild(optHistorico);

                dom.selectAno.value = state.selectedAno || '2026';
            }

            // Poblar Selector de Comunas para Cobertura (TOTAL para Toda la Provincia)
            if (dom.selectComuna) {
                dom.selectComuna.innerHTML = '<option value="TOTAL">Toda la Provincia de Osorno (7 Comunas)</option>';
                if (state.data?.metadata?.comunas) {
                    Object.entries(state.data.metadata.comunas).forEach(([cod, nom]) => {
                        const opt = document.createElement('option');
                        opt.value = cod;
                        opt.textContent = `${nom} (Cód. ${cod})`;
                        if (cod === state.selectedComuna) opt.selected = true;
                        dom.selectComuna.appendChild(opt);
                    });
                }
                dom.selectComuna.value = state.selectedComuna || 'TOTAL';
            }

        } else if (state.currentTab === 'tab-produccion') {
            if (labelAno) labelAno.textContent = 'AÑO DE ADMINISTRACIÓN';
            if (labelComuna) labelComuna.textContent = 'COMUNA ESTABLECIMIENTO';
            if (wrapperSexo) wrapperSexo.style.display = 'none';
            if (wrapperSearchEstab) wrapperSearchEstab.style.display = 'flex';
            if (btnMethodology) btnMethodology.style.display = 'none';

            // Poblar Selector de Años para Producción (2026 primero, ..., 2014, ALL al final)
            if (dom.selectAno) {
                dom.selectAno.innerHTML = '';
                const anos = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014];
                anos.forEach(ano => {
                    const opt = document.createElement('option');
                    opt.value = String(ano);
                    opt.textContent = `Año ${ano}${ano === 2026 ? ` — Corte: ${getFechaCorteFormateada(true)}` : ''}`;
                    if (String(ano) === String(estabState.ano)) opt.selected = true;
                    dom.selectAno.appendChild(opt);
                });
                const optHistorico = document.createElement('option');
                optHistorico.value = 'ALL';
                optHistorico.textContent = 'Todo el Histórico (2014–2026)';
                if (estabState.ano === 'ALL') optHistorico.selected = true;
                dom.selectAno.appendChild(optHistorico);

                dom.selectAno.value = estabState.ano || '2026';
            }

            // Poblar Selector de Comunas para Producción (ALL para Todas las Comunas)
            if (dom.selectComuna) {
                dom.selectComuna.innerHTML = '<option value="ALL">Todas las Comunas (Provincia de Osorno)</option>';
                if (state.data?.metadata?.comunas) {
                    Object.entries(state.data.metadata.comunas).forEach(([cod, nom]) => {
                        const opt = document.createElement('option');
                        opt.value = cod;
                        opt.textContent = `${nom} (Cód. ${cod})`;
                        if (cod === estabState.comuna) opt.selected = true;
                        dom.selectComuna.appendChild(opt);
                    });
                }
                dom.selectComuna.value = estabState.comuna || 'ALL';
            }
        }
    }

    // 3. Inicializar Filtros
    function initFilters() {
        syncHeaderControls('tab-cobertura');

        // Eventos de Cambio de Filtro
        if (dom.selectAno) {
            dom.selectAno.addEventListener('change', (e) => {
                if (state.currentTab === 'tab-produccion') {
                    estabState.ano = e.target.value;
                    renderMatrizProduccionEstablecimientos();
                } else {
                    state.selectedAno = e.target.value;
                    updateDashboard();
                }
            });
        }
        
        const globalTipoFilter = document.getElementById('globalTipoFilter');
        if (globalTipoFilter) {
            globalTipoFilter.addEventListener('change', (e) => {
                if (state.currentTab === 'tab-produccion') {
                    renderMatrizProduccionEstablecimientos();
                } else {
                    // Update Cobertura
                    updateDashboard();
                }
            });
        }

        if (dom.selectComuna) {
            dom.selectComuna.addEventListener('change', (e) => {
                if (state.currentTab === 'tab-produccion') {
                    estabState.comuna = e.target.value;
                    renderMatrizProduccionEstablecimientos();
                } else {
                    state.selectedComuna = e.target.value;
                    updateDashboard();
                }
            });
        }

        if (dom.selectSexo) {
            dom.selectSexo.addEventListener('change', (e) => {
                state.selectedSexo = e.target.value;
                updateDashboard();
            });
        }

        // Buscador de Establecimiento en Cabecera
        const inputEstabSearch = document.getElementById('inputEstabSearch');
        const btnClearEstabSearch = document.getElementById('btnClearEstabSearch');
        if (inputEstabSearch) {
            inputEstabSearch.addEventListener('input', (e) => {
                estabState.search = e.target.value.trim().toLowerCase();
                if (btnClearEstabSearch) {
                    btnClearEstabSearch.style.display = estabState.search ? 'flex' : 'none';
                }
                renderMatrizProduccionEstablecimientos();
            });
        }

        if (btnClearEstabSearch) {
            btnClearEstabSearch.addEventListener('click', () => {
                if (inputEstabSearch) inputEstabSearch.value = '';
                estabState.search = '';
                btnClearEstabSearch.style.display = 'none';
                renderMatrizProduccionEstablecimientos();
            });
        }

        // Botones de Acción
        const btnMet = document.getElementById('btnFichaMetodologica');
        if (btnMet) {
            btnMet.addEventListener('click', () => {
                if (typeof window.openMethodologyModal === 'function') {
                    window.openMethodologyModal();
                }
            });
        }

        if (dom.btnExportExcel) {
            dom.btnExportExcel.addEventListener('click', () => {
                if (state.currentTab === 'tab-produccion') {
                    if (typeof window.exportarMatrizEstablecimientosExcel === 'function') {
                        window.exportarMatrizEstablecimientosExcel();
                    }
                } else {
                    window.location.href = 'Reporte_Master_Observatorio_VPH_Osorno.xlsx';
                }
            });
        }

        if (dom.btnPrintReport) {
            dom.btnPrintReport.addEventListener('click', () => {
                window.print();
            });
        }
    }

    // 4. Gestión de Pestañas (Tabs)
    window.switchTab = function(targetTab) {
        state.currentTab = targetTab;
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabPanels = document.querySelectorAll('.tab-content, .tab-panel');

        tabBtns.forEach(b => {
            if (b.getAttribute('data-tab') === targetTab) {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });

        tabPanels.forEach(p => {
            if (p.id === targetTab) {
                p.classList.add('active');
            } else {
                p.classList.remove('active');
            }
        });

        // Sincronizar filtros superiores según la pestaña activa
        syncHeaderControls(targetTab);
        updateHeaderFechaCorte();
        
        // Actualizar notas metodológicas dinámicas
        updateMethodologyTexts(targetTab);

        // Si entra al tab de producción, renderizar la matriz
        if (targetTab === 'tab-produccion') {
            renderMatrizProduccionEstablecimientos();
        } else if (targetTab === 'tab-avance-escolar') {
            renderAvanceEscolar();
        } else {
            updateDashboard();
        }

        // Redimensionar gráficos al cambiar de tab
        setTimeout(() => {
            Object.values(state.charts).forEach(c => {
                if (c) c.resize();
            });
        }, 100);
    };

    function initTabs() {
        dom.tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetTab = btn.getAttribute('data-tab');
                window.switchTab(targetTab);
            });
        });
        
        // Inicializar con la pestaña activa por defecto
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab) {
            updateMethodologyTexts(activeTab.getAttribute('data-tab'));
        }
    }
    
    function updateMethodologyTexts(targetTab) {
        const methodBox = document.getElementById('methodologyBoxContent');
        const modalBody = document.getElementById('methodologyModalBody');
        
        let html = '';
        let modalHtml = '';
        
        if (targetTab === 'tab-avance-escolar') {
            html = `
                <p>
                    <strong>Fuente Oficial:</strong> Registro Nacional de Inmunizaciones (RNI) – Programáticas + Población Objetivo MINEDUC 2026.
                </p>
                <p>
                    <strong>Criterio Territorial (Base Ocurrencia como proxy):</strong> MINEDUC informa la población objetivo según la comuna del colegio. RNI informa dónde vive la persona (Residencia) y dónde recibió la vacuna (Ocurrencia), pero no identifica su colegio o RBD. Por este motivo, para este seguimiento utilizamos la comuna de Ocurrencia como aproximación.
                </p>
                <p>
                    <strong>Conceptos Territoriales:</strong> <em>Residencia:</em> Comuna donde vive la persona. <em>Ocurrencia:</em> Comuna donde se administró la vacuna. <strong>Ejemplo:</strong> Si un estudiante vive en Purranque y recibe la vacuna en Osorno, en Base Residencia se cuenta en Purranque y en Base Ocurrencia se cuenta en Osorno.
                </p>
                <p>
                    <strong>Filtros de Calidad:</strong> Vacuna administrada = "SI", registros vigentes (eliminados = "NO"), exclusión de registros EPRO.
                </p>
            `;
            modalHtml = `
                <div class="methodology-grid">
                    <div class="method-box" style="grid-column: 1 / -1;">
                        <h3><i class="fas fa-school"></i> Monitoreo Operativo VPH Escolar 2026</h3>
                        <p><strong>Indicador:</strong> Avance de vacunación VPH en cohorte escolar de 4.º básico durante 2026.</p>
                        <p>Este módulo es un proxy operativo para evaluar la velocidad de cobertura durante el año escolar, utilizando como denominador la matrícula MINEDUC y como numerador los registros del Registro Nacional de Inmunizaciones (RNI) administrados durante el periodo.</p>
                    </div>
                    <div class="method-box">
                        <h3><i class="fas fa-users"></i> Definiciones</h3>
                        <ul>
                            <li><strong>Numerador:</strong> Estudiantes de la cohorte objetivo con vacuna administrada durante 2026.</li>
                            <li><strong>Denominador:</strong> Matrícula MINEDUC vigente para 4.º básico en 2026.</li>
                            <li><strong>Ocurrencia vs Residencia:</strong> MINEDUC informa la población según el colegio. RNI informa la dirección de la persona (Residencia) y el lugar de vacunación (Ocurrencia). Como RNI no contiene el RBD del colegio, usamos Ocurrencia como proxy.</li>
                        </ul>
                    </div>
                    <div class="method-box">
                        <h3><i class="fas fa-filter"></i> Criterios de Inclusión</h3>
                        <ul>
                            <li><strong>Vacuna:</strong> Nonavalente (Dosis única).</li>
                            <li><strong>Calidad:</strong> Registros válidos (No eliminados, no EPRO).</li>
                        </ul>
                    </div>
                </div>
            `;
        } else {
            html = `
                <p>
                    <strong>Fuente Oficial:</strong> Departamento de Estadísticas e Información de Salud (DEIS) y Registro Nacional de Inmunizaciones (RNI) – Ministerio de Salud de Chile.
                </p>
                <p>
                    <strong>Criterio Territorial (Base Residencia):</strong> Las coberturas corresponden a personas residentes en la Provincia de Osorno. <em>Residencia:</em> Comuna donde vive la persona.
                </p>
                <p>
                    <strong>Denominador Vital Ajustado:</strong> Población objetivo calculada a partir de los nacidos vivos oficiales DEIS de la cohorte correspondiente menos las defunciones acumuladas antes de los 15 años de edad.
                </p>
                <p>
                    <strong>Filtros de Calidad Mandatorios:</strong> Vacuna administrada = "SI", registros vigentes (eliminados = "NO"), exclusión de registros EPRO.
                </p>
                <p>
                    <strong>Criterio de Esquema Completo:</strong> 2 o más dosis (o dosis única) para cohortes 2015-2024; 1 dosis única de vacuna Nonavalente (Gardasil 9) a partir del año escolar 2024.
                </p>
            `;
            modalHtml = `
                <div class="methodology-grid">
                    <div class="method-box">
                        <h3><i class="fas fa-calculator"></i> 1. Definición y Fórmula del Indicador</h3>
                        <p><strong>Indicador:</strong> Cobertura de vacunación contra el Virus del Papiloma Humano (VPH) en personas de 15 años cumplidos.</p>
                        <div class="formula-box">
                            <div class="formula-container">
                                <span class="formula-title-text">Cobertura (%) =</span>
                                <div class="formula-fraction">
                                    <div class="fraction-num">Personas de 15 años con Esquema Completo (RNI)</div>
                                    <div class="fraction-bar"></div>
                                    <div class="fraction-den">Nacidos Vivos (DEIS) &minus; Defunciones menores de 15 años (DEIS)</div>
                                </div>
                                <span class="formula-multiply">&times; 100</span>
                            </div>
                        </div>
                    </div>

                    <div class="method-box">
                        <h3><i class="fas fa-users"></i> 2. Definición de Numerador y Denominador</h3>
                        <ul>
                            <li><strong>Numerador (RNI):</strong> Total de personas de la cohorte que han recibido su esquema completo de vacunación VPH antes de cumplir los 16 años, contabilizadas según su comuna de <em>Residencia</em>.</li>
                            <li><strong>Denominador Vital (DEIS):</strong> Cohorte de nacidos vivos del año correspondiente (ej. 2008 para los que cumplen 15 en 2023), menos las defunciones de esa misma cohorte acumuladas hasta antes de cumplir los 15 años.</li>
                        </ul>
                    </div>

                    <div class="method-box">
                        <h3><i class="fas fa-shield-virus"></i> 3. Criterio de Esquema Completo</h3>
                        <ul>
                            <li><strong>Cohortes hasta 2014 (Vacuna Bivalente/Tetravalente):</strong> Se exige un esquema de al menos 2 dosis para considerar la protección completa.</li>
                            <li><strong>Cohorte 2015 en adelante (Vacuna Nonavalente):</strong> A partir del año 2024, el Programa Nacional de Inmunizaciones actualizó el esquema a <strong>Dosis Única</strong> con la vacuna Nonavalente (Gardasil 9).</li>
                        </ul>
                    </div>

                    <div class="method-box">
                        <h3><i class="fas fa-filter"></i> 4. Control de Calidad y Criterios de Exclusión</h3>
                        <ul>
                            <li><strong>Vacuna Administrada = "SI":</strong> Solo se contabilizan eventos reales de administración.</li>
                            <li><strong>Registro Eliminado = "NO":</strong> Se excluyen registros anulados o corregidos por los vacunatorios.</li>
                            <li><strong>Exclusión EPRO:</strong> Se eliminan estrictamente los registros marcados como Error Programático (EPRO) tanto en el criterio de elegibilidad como en el tipo de dosis.</li>
                        </ul>
                    </div>
                </div>
            `;
        }
        
        if (methodBox) methodBox.innerHTML = html;
        if (modalBody) modalBody.innerHTML = modalHtml;
    }

    // 4. Modo Oscuro / Claro
    function initTheme() {
        // Inicializar en tema institucional claro o guardado
        document.documentElement.setAttribute('data-theme', state.isDark ? 'dark' : 'light');
        document.body.classList.toggle('theme-dark', state.isDark);
        document.body.classList.toggle('theme-light', !state.isDark);
        dom.btnToggleTheme.innerHTML = state.isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';

        dom.btnToggleTheme.addEventListener('click', () => {
            state.isDark = !state.isDark;
            document.documentElement.setAttribute('data-theme', state.isDark ? 'dark' : 'light');
            document.body.classList.toggle('theme-dark', state.isDark);
            document.body.classList.toggle('theme-light', !state.isDark);
            dom.btnToggleTheme.innerHTML = state.isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
            updateDashboard();
        });
    }

    // 5. Renderizar Línea de Tiempo de Hitos con Citas Bibliográficas Oficiales
    function initTimeline() {
        const container = document.getElementById('timelineContainer');
        if (!container || !state.data.hitos_normativos) return;

        container.innerHTML = '';
        state.data.hitos_normativos.forEach(hito => {
            const item = document.createElement('div');
            item.className = 'timeline-item';
            
            let fuenteHtml = '';
            if (hito.fuente_bibliografica) {
                fuenteHtml = `
                    <div class="milestone-source-box">
                        <div class="milestone-source-header">
                            <span><i class="fas fa-book-bookmark"></i> Respaldo Oficial</span>
                            <span class="milestone-citation-pill">${hito.tipo_fuente || 'Normativa PNI'}</span>
                        </div>
                        <div class="milestone-source-text">${hito.fuente_bibliografica}</div>
                    </div>
                `;
            }

            item.innerHTML = `
                <div class="timeline-year-badge"><i class="fas fa-calendar-check"></i> ${hito.ano}</div>
                <div class="timeline-item-title">${hito.titulo}</div>
                <div class="timeline-item-desc">${hito.descripcion}</div>
                <div class="timeline-meta-box">
                    <div><strong>Población:</strong> ${hito.poblacion}</div>
                    <div><strong>Esquema:</strong> ${hito.esquema}</div>
                    <div><strong>Vacuna:</strong> ${hito.vacuna}</div>
                    ${fuenteHtml}
                </div>
            `;
            container.appendChild(item);
        });
    }

    // Modal Global de Metodología & Hitos
    window.openMethodologyModal = function() {
        const modal = document.getElementById('modalFichaMetodologica');
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    };

    window.closeMethodologyModal = function() {
        const modal = document.getElementById('modalFichaMetodologica');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    };

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (typeof window.closeMethodologyModal === 'function') {
                window.closeMethodologyModal();
            }
            if (typeof window.closeKpiHelpModal === 'function') {
                window.closeKpiHelpModal();
            }
        }
    });

    // ══════════════════════════════════════════════════════════════════════════════
    // GESTIÓN Y FILTRADO DE MATRIZ DE PRODUCCIÓN POR ESTABLECIMIENTO (OCURRENCIA)
    // ══════════════════════════════════════════════════════════════════════════════
    const estabState = {
        comuna: 'ALL',
        ano: '2026',
        search: '',
        sortBy: 'total',
        sortAsc: false
    };

    function initProduccionControls() {
        const thSortDosis = document.getElementById('thSortDosis');
        if (thSortDosis) {
            thSortDosis.addEventListener('click', () => {
                estabState.sortAsc = !estabState.sortAsc;
                renderMatrizProduccionEstablecimientos();
            });
        }
    }

    function getFilteredMatrizEstablecimientos() {
        if (!state.data?.matriz_establecimientos) return [];

        const list = [];
        const isAllYears = estabState.ano === 'ALL';
        const targetYear = estabState.ano;
        
        const filterTipo = document.getElementById('globalTipoFilter')?.value || 'all';

        state.data.matriz_establecimientos.forEach(item => {
            // Determine tipo
            const privPattern = /clinica|mutual|achs|particular|privad|isapre|mutualidad|vaxplus|cochrane/i;
            const isPrivado = privPattern.test(item.establecimiento) || (typeof window.rawData !== 'undefined' && window.rawData.estab_privados && window.rawData.estab_privados.includes(item.establecimiento));
            const tipo = isPrivado ? 'privado' : 'publico';
            
            if (filterTipo !== 'all' && tipo !== filterTipo) {
                return;
            }

            // Filtro por comuna
            if (estabState.comuna !== 'ALL' && item.comuna_cod !== estabState.comuna) {
                return;
            }

            // Filtro por búsqueda textual
            if (estabState.search && !item.establecimiento.toLowerCase().includes(estabState.search)) {
                return;
            }

            let total = 0, mujeres = 0, hombres = 0, dosis_unica = 0, dosis_1 = 0, dosis_2 = 0, tetra = 0, nona = 0, otras = 0;

            if (isAllYears) {
                total = item.total_historico || 0;
                mujeres = item.total_mujeres || 0;
                hombres = item.total_hombres || 0;
                dosis_unica = item.total_dosis_unica || 0;
                dosis_1 = item.total_dosis_1 || 0;
                dosis_2 = item.total_dosis_2 || 0;
                tetra = item.total_tetra || 0;
                nona = item.total_nona || 0;
                otras = (item.total_biv || 0) + (item.total_otra_vac || 0);
            } else {
                const yearData = item.por_ano?.[targetYear];
                if (!yearData) return; // No tiene registros este año

                total = yearData.total || 0;
                mujeres = yearData.mujeres || 0;
                hombres = yearData.hombres || 0;
                dosis_unica = yearData.dosis_unica || 0;
                dosis_1 = yearData.dosis_1 || 0;
                dosis_2 = yearData.dosis_2 || 0;
                tetra = yearData.tetra || 0;
                nona = yearData.nona || 0;
                otras = (yearData.biv || 0) + (yearData.otra_vac || 0);
            }

            if (total > 0) {
                list.push({
                    establecimiento: item.establecimiento,
                    comuna_cod: item.comuna_cod,
                    comuna_nom: item.comuna_nom,
                    total,
                    mujeres,
                    hombres,
                    dosis_unica,
                    dosis_1,
                    dosis_2,
                    tetra,
                    nona,
                    otras
                });
            }
        });

        // Ordenamiento
        list.sort((a, b) => {
            return estabState.sortAsc ? a.total - b.total : b.total - a.total;
        });

        return list;
    }

    function renderMatrizProduccionEstablecimientos() {
        const tbody = document.getElementById('tbodyMatrizEstablecimientos');
        const kpiTotal = document.getElementById('kpiEstabTotalDosis');
        const kpiPct = document.getElementById('kpiEstabDosisPct');
        const kpiCentros = document.getElementById('kpiEstabCentrosActivos');
        const kpiCentrosDetalle = document.getElementById('kpiEstabCentrosDetalle');
        const kpiLiderNombre = document.getElementById('kpiEstabLiderNombre');
        const kpiLiderDosis = document.getElementById('kpiEstabLiderDosis');
        const kpiMujeres = document.getElementById('kpiEstabMujeresDosis');
        const kpiHombres = document.getElementById('kpiEstabHombresDosis');
        const kpiSexoRatio = document.getElementById('kpiEstabSexoRatio');
        const badgeCentros = document.getElementById('badgeTotalCentros');
        const subtitulo = document.getElementById('matrizEstabSubtitulo');

        if (!tbody) return;

        const rows = getFilteredMatrizEstablecimientos();

        // Calcular Totales
        let sumTotal = 0, sumFem = 0, sumMasc = 0, sumUnica = 0, sumD1 = 0, sumD2 = 0, sumNona = 0, sumTetra = 0, sumOtras = 0;
        rows.forEach(r => {
            sumTotal += r.total;
            sumFem += r.mujeres;
            sumMasc += r.hombres;
            sumUnica += r.dosis_unica;
            sumD1 += r.dosis_1;
            sumD2 += r.dosis_2;
            sumNona += r.nona;
            sumTetra += r.tetra;
            sumOtras += r.otras;
        });

        // Actualizar KPIs
        if (kpiTotal) kpiTotal.textContent = sumTotal.toLocaleString('es-CL');
        if (kpiCentros) kpiCentros.textContent = rows.length.toLocaleString('es-CL');
        if (kpiCentrosDetalle) {
            const comLabel = estabState.comuna === 'ALL' ? 'Provincia de Osorno' : (state.data?.metadata?.comunas?.[estabState.comuna] || '');
            kpiCentrosDetalle.textContent = `Centros con registros en ${comLabel}`;
        }

        if (rows.length > 0) {
            const lider = rows[0];
            if (kpiLiderNombre) kpiLiderNombre.textContent = lider.establecimiento;
            if (kpiLiderDosis) {
                const partLider = sumTotal > 0 ? ((lider.total / sumTotal) * 100).toFixed(1) : '0.0';
                kpiLiderDosis.textContent = `${lider.total.toLocaleString('es-CL')} dosis (${partLider}% de la selección)`;
            }
        } else {
            if (kpiLiderNombre) kpiLiderNombre.textContent = 'Sin registros';
            if (kpiLiderDosis) kpiLiderDosis.textContent = '0 dosis';
        }

        if (kpiMujeres) kpiMujeres.textContent = sumFem.toLocaleString('es-CL');
        if (kpiHombres) kpiHombres.textContent = sumMasc.toLocaleString('es-CL');
        if (kpiSexoRatio) {
            const pctFem = sumTotal > 0 ? ((sumFem / sumTotal) * 100).toFixed(1) : '0.0';
            const pctMasc = sumTotal > 0 ? ((sumMasc / sumTotal) * 100).toFixed(1) : '0.0';
            kpiSexoRatio.textContent = `Mujeres: ${pctFem}% • Hombres: ${pctMasc}%`;
        }

        if (badgeCentros) {
            badgeCentros.textContent = `Mostrando ${rows.length} establecimientos (${sumTotal.toLocaleString('es-CL')} dosis)`;
        }

        if (subtitulo) {
            const anoLabel = estabState.ano === 'ALL' ? 'Serie Histórica (2014–2026)' : `Año ${estabState.ano}`;
            const comLabel = estabState.comuna === 'ALL' ? 'Provincia de Osorno' : (state.data?.metadata?.comunas?.[estabState.comuna] || '');
            subtitulo.textContent = `Detalle de ocurrencia en ${comLabel} • ${anoLabel}`;
        }

        // Renderizar Filas de Tabla
        if (rows.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="13" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                        <i class="fas fa-magnifying-glass" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block;"></i>
                        No se encontraron registros de establecimientos para los filtros seleccionados.
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        rows.forEach((r, idx) => {
            const pct = sumTotal > 0 ? ((r.total / sumTotal) * 100).toFixed(1) : '0.0';
            html += `
                <tr>
                    <td>${idx + 1}</td>
                    <td><strong>${r.establecimiento}</strong></td>
                    <td>${r.comuna_nom}</td>
                    <td class="cell-total">${r.total.toLocaleString('es-CL')}</td>
                    <td>${r.mujeres.toLocaleString('es-CL')}</td>
                    <td>${r.hombres.toLocaleString('es-CL')}</td>
                    <td>${r.dosis_unica.toLocaleString('es-CL')}</td>
                    <td>${r.dosis_1.toLocaleString('es-CL')}</td>
                    <td>${r.dosis_2.toLocaleString('es-CL')}</td>
                    <td>${r.nona.toLocaleString('es-CL')}</td>
                    <td>${r.tetra.toLocaleString('es-CL')}</td>
                    <td>${r.otras.toLocaleString('es-CL')}</td>
                    <td><span class="badge-pill badge-green">${pct}%</span></td>
                </tr>
            `;
        });

        // Fila Total
        html += `
            <tr class="row-total">
                <td>&Sigma;</td>
                <td><strong>TOTAL GENERAL DE LA SELECCIÓN</strong></td>
                <td><strong>${estabState.comuna === 'ALL' ? '7 Comunas' : rows[0]?.comuna_nom}</strong></td>
                <td class="cell-total">${sumTotal.toLocaleString('es-CL')}</td>
                <td>${sumFem.toLocaleString('es-CL')}</td>
                <td>${sumMasc.toLocaleString('es-CL')}</td>
                <td>${sumUnica.toLocaleString('es-CL')}</td>
                <td>${sumD1.toLocaleString('es-CL')}</td>
                <td>${sumD2.toLocaleString('es-CL')}</td>
                <td>${sumNona.toLocaleString('es-CL')}</td>
                <td>${sumTetra.toLocaleString('es-CL')}</td>
                <td>${sumOtras.toLocaleString('es-CL')}</td>
                <td><span class="badge-pill badge-green">100%</span></td>
            </tr>
        `;

        tbody.innerHTML = html;
    }

    window.exportarMatrizEstablecimientosExcel = function() {
        if (!state.data?.matriz_establecimientos || typeof XLSX === 'undefined') {
            alert('No se puede generar la exportación en este momento. Verifique que la librería XLSX esté disponible.');
            return;
        }

        const dataRows = getFilteredMatrizEstablecimientos();
        const anoStr = estabState.ano === 'ALL' ? 'Historico_2014_2026' : estabState.ano;
        const comStr = estabState.comuna === 'ALL' ? 'all' : (state.data?.metadata?.comunas?.[estabState.comuna] || estabState.comuna).replace(/\s+/g, '_');
        const fileName = `Reporte_Epidemiologico_VPH_${anoStr}_${comStr}.xlsx`;

        const fechaCorteVal = state.data?.fecha_max_residencia || state.data?.metadatos?.fecha_corte || 'Desconocida';
        const comNombre = estabState.comuna === 'ALL' ? 'Todos' : (state.data?.metadata?.comunas?.[estabState.comuna] || estabState.comuna);
        const periodoText = estabState.ano === 'ALL' ? 'Histórico (2014-2026)' : `Año ${estabState.ano}`;
        const campaignTitle = estabState.ano === 'ALL' ? 'CAMPAÑA VACUNACIÓN VPH (HISTÓRICO 2014-2026)' : `CAMPAÑA VACUNACIÓN VPH ${estabState.ano}`;

        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const fechaActualizacionVal = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

        // 1. Estructura de Filas de Metadatos (Exacto a Formato Institucional Influenza)
        const ws_data = [];
        ws_data.push([]); // Fila 1 (Índice 0)
        ws_data.push([campaignTitle]); // Fila 2 (Índice 1)
        ws_data.push(["Servicio de Salud Osorno"]); // Fila 3 (Índice 2)
        ws_data.push(["Reporte por Ocurrencia"]); // Fila 4 (Índice 3)
        ws_data.push([]); // Fila 5 (Índice 4)
        ws_data.push(["INFORMACIÓN DEL REPORTE"]); // Fila 6 (Índice 5)
        ws_data.push(["- Criterio:", comNombre]); // Fila 7 (Índice 6)
        ws_data.push(["- Periodo Informado:", periodoText]); // Fila 8 (Índice 7)
        ws_data.push(["- Fecha de Corte:", fechaCorteVal]); // Fila 9 (Índice 8)
        ws_data.push(["- Fuente", "DEIS - MINSAL"]); // Fila 10 (Índice 9)
        ws_data.push(["- Fecha de Actualización:", fechaActualizacionVal]); // Fila 11 (Índice 10)
        ws_data.push([]); // Fila 12 (Índice 11)

        // 2. Fila de Encabezados de Tabla (Fila 13, Índice 12)
        const headers = [
            "Comuna",
            "Establecimiento",
            "Mujeres",
            "Hombres",
            "Dosis Única",
            "1ª Dosis",
            "2ª Dosis",
            "Gardasil 9 (Nonavalente)",
            "Gardasil 4 (Tetravalente)",
            "Cervarix / Otra",
            "Total",
            "% Aporte Red"
        ];
        ws_data.push(headers);

        // 3. Ordenar y Agrupar Datos por Comuna y Establecimiento
        const sortedData = [...dataRows].sort((a, b) => 
            a.comuna_nom.localeCompare(b.comuna_nom) || a.establecimiento.localeCompare(b.establecimiento)
        );

        let totDosis = 0, totFem = 0, totMasc = 0, totUnica = 0, totD1 = 0, totD2 = 0, totNona = 0, totTetra = 0, totOtras = 0;
        const totalProvDosis = sortedData.reduce((sum, r) => sum + r.total, 0);

        sortedData.forEach(r => {
            totDosis += r.total;
            totFem += r.mujeres;
            totMasc += r.hombres;
            totUnica += r.dosis_unica;
            totD1 += r.dosis_1;
            totD2 += r.dosis_2;
            totNona += r.nona;
            totTetra += r.tetra;
            totOtras += r.otras;
            const pct = totalProvDosis > 0 ? ((r.total / totalProvDosis) * 100).toFixed(2) + '%' : '0.00%';

            ws_data.push([
                r.comuna_nom,
                r.establecimiento,
                r.mujeres,
                r.hombres,
                r.dosis_unica,
                r.dosis_1,
                r.dosis_2,
                r.nona,
                r.tetra,
                r.otras,
                r.total,
                pct
            ]);
        });

        // 4. Fila de Totales
        const totalsRow = [
            "TOTALES",
            "",
            totFem,
            totMasc,
            totUnica,
            totD1,
            totD2,
            totNona,
            totTetra,
            totOtras,
            totDosis,
            "100.00%"
        ];
        ws_data.push(totalsRow);

        // 5. Rellenar celdas alrededor de la tabla para ocultar cuadrícula gris de Excel
        const dataRowCount = ws_data.length;
        const tableColCount = headers.length;
        const MAX_ROWS = Math.max(150, dataRowCount + 50);
        const MAX_COLS = Math.max(26, tableColCount + 10);

        for (let i = 0; i < ws_data.length; i++) {
            while (ws_data[i].length < MAX_COLS) {
                ws_data[i].push("");
            }
        }
        while (ws_data.length < MAX_ROWS) {
            ws_data.push(Array(MAX_COLS).fill(""));
        }

        const ws = XLSX.utils.aoa_to_sheet(ws_data);

        // 6. Combinaciones de Celdas (Merges)
        ws['!merges'] = [
            { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }, // Merge A2:E2 (Título)
            { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } }, // Merge A3:E3 (Servicio)
            { s: { r: 3, c: 0 }, e: { r: 3, c: 4 } }, // Merge A4:E4 (Tipo Reporte)
            { s: { r: 5, c: 0 }, e: { r: 5, c: 2 } }, // Merge A6:C6 (INFORMACIÓN DEL REPORTE)
            { s: { r: dataRowCount - 1, c: 0 }, e: { r: dataRowCount - 1, c: 1 } } // Merge TOTALES A:B
        ];

        ws['!views'] = [{ zoomScale: 80, zoomScaleNormal: 80, showGridLines: false }];

        // 7. Aplicación de Estilos Institucionales (xlsx-js-style)
        let currentComuna = '';
        let comunaColorIndex = 0;
        const range = XLSX.utils.decode_range(ws['!ref']);

        for (let R = range.s.r; R <= range.e.r; ++R) {
            if (R >= 13 && R < dataRowCount - 1) {
                const rowComuna = ws_data[R][0];
                if (rowComuna && rowComuna !== currentComuna) {
                    currentComuna = rowComuna;
                    comunaColorIndex = 1 - comunaColorIndex;
                }
            }

            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
                if (!ws[cellRef]) continue;

                let cellStyle = { 
                    font: { name: "Calibri", sz: 10, color: { rgb: "000000" } }, 
                    border: {}, 
                    alignment: { vertical: "center" } 
                };

                const isOutsideTable = (R >= dataRowCount || C >= tableColCount);

                if (isOutsideTable) {
                    cellStyle.fill = { fgColor: { rgb: "FFFFFF" } };
                } else if (R < 12) { // Bloque superior de metadatos
                    cellStyle.fill = { fgColor: { rgb: "FFFFFF" } };
                    if (R === 1 && C === 0) {
                        cellStyle.font = { name: "Aptos", sz: 14, bold: true, color: { rgb: "000000" } };
                    } else if (R === 2 && C === 0) {
                        cellStyle.font = { name: "Aptos", sz: 12, bold: true, color: { rgb: "000000" } };
                    } else if (R === 3 && C === 0) {
                        cellStyle.font = { name: "Aptos", sz: 11, bold: false, color: { rgb: "000000" } };
                    } else if (R === 5 && C === 0) {
                        cellStyle.font = { name: "Aptos", sz: 10, bold: true, color: { rgb: "000000" } };
                    } else if (R >= 6 && R <= 10 && C < 2) {
                        cellStyle.font = { name: "Aptos", sz: 10, bold: (C === 0), color: { rgb: "333333" } };
                    }
                } else if (R === 12) { // Fila de Cabeceras de Tabla (Fila 13)
                    cellStyle.fill = { fgColor: { rgb: "1A3B66" } };
                    cellStyle.font = { name: "Calibri", sz: 10, color: { rgb: "FFFFFF" }, bold: true };
                    cellStyle.alignment = { vertical: "center", horizontal: "center", wrapText: true };
                    cellStyle.border = { 
                        top: { style: "thin", color: { rgb: "D9D9D9" } }, 
                        bottom: { style: "thin", color: { rgb: "D9D9D9" } }, 
                        left: { style: "thin", color: { rgb: "D9D9D9" } }, 
                        right: { style: "thin", color: { rgb: "D9D9D9" } } 
                    };
                } else if (R >= 13 && R < dataRowCount - 1) { // Filas de Datos
                    const isTotalCol = (C === 10); // Columna Total
                    const isTextCol = (C === 0 || C === 1);
                    cellStyle.fill = { fgColor: { rgb: comunaColorIndex === 0 ? "FFFFFF" : "F2F5F9" } };
                    cellStyle.alignment = { vertical: "center", horizontal: isTextCol ? "left" : "center", wrapText: true };
                    cellStyle.border = { 
                        top: { style: "thin", color: { rgb: "D9D9D9" } }, 
                        bottom: { style: "thin", color: { rgb: "D9D9D9" } }, 
                        left: { style: "thin", color: { rgb: "D9D9D9" } }, 
                        right: { style: "thin", color: { rgb: "D9D9D9" } } 
                    };
                    if (isTotalCol) {
                        cellStyle.fill = { fgColor: { rgb: "1A3B66" } };
                        cellStyle.font = { name: "Calibri", sz: 10, color: { rgb: "FFFFFF" }, bold: true };
                    }
                } else if (R === dataRowCount - 1) { // Fila de TOTALES
                    cellStyle.fill = { fgColor: { rgb: "1A3B66" } };
                    cellStyle.font = { name: "Calibri", sz: 10, color: { rgb: "FFFFFF" }, bold: true };
                    cellStyle.alignment = { vertical: "center", horizontal: (C === 0 ? "right" : "center"), wrapText: true };
                    cellStyle.border = { 
                        top: { style: "thin", color: { rgb: "D9D9D9" } }, 
                        bottom: { style: "thin", color: { rgb: "D9D9D9" } }, 
                        left: { style: "thin", color: { rgb: "D9D9D9" } }, 
                        right: { style: "thin", color: { rgb: "D9D9D9" } } 
                    };
                }

                ws[cellRef].s = cellStyle;

                // Formato numérico con separador de miles para cantidades enteras
                if (R >= 13 && C >= 2 && C <= 10 && typeof ws_data[R][C] === 'number') {
                    ws[cellRef].z = '#,##0';
                }
            }
        }

        // 8. Alturas de Fila
        ws['!rows'] = [];
        ws['!rows'][0] = { hpt: 9.0 };
        ws['!rows'][1] = { hpt: 18.75 };
        ws['!rows'][2] = { hpt: 15.75 };
        ws['!rows'][4] = { hpt: 18.0 };
        ws['!rows'][5] = { hpt: 18.75 };
        for (let i = 6; i <= 11; i++) {
            ws['!rows'][i] = { hpt: 11.25 };
        }
        ws['!rows'][12] = { hpt: 55.0 }; // Altura para encabezado con wrapText
        for (let i = 13; i < dataRowCount; i++) {
            ws['!rows'][i] = { hpt: 24.0 };
        }

        // 9. Anchos de Columna
        ws['!cols'] = [
            { wch: 22 }, // Comuna
            { wch: 46 }, // Establecimiento
            { wch: 12 }, // Mujeres
            { wch: 12 }, // Hombres
            { wch: 14 }, // Dosis Única
            { wch: 12 }, // 1ª Dosis
            { wch: 12 }, // 2ª Dosis
            { wch: 24 }, // Gardasil 9 (Nonavalente)
            { wch: 24 }, // Gardasil 4 (Tetravalente)
            { wch: 16 }, // Cervarix / Otra
            { wch: 15 }, // Total
            { wch: 14 }  // % Aporte Red
        ];

        // 10. Configuración de Impresión
        ws['!pageSetup'] = {
            orientation: 'landscape',
            paperSize: 9, // A4
            scale: 50
        };

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Matriz Técnica");
        XLSX.writeFile(wb, fileName);
    };

    // 6. Actualización Central del Dashboard
    function updateDashboard() {
        updateHeaderFechaCorte();
        updateFilterSummary();
        updateKPIs();
        renderChartEvolucion();
        renderRankingComunas();
        renderTablaResumen();
        renderChartDosisPorTipo();
        renderChartDosisPorSexo();
        renderChartComparativaComunal();
        renderChartRadarComunal();
        renderTablaDetalleComunal();
        renderChartDropout();
        renderChartVacunasTransicion();
        renderTablaTopEstablecimientos();
    }

    // Helper: Obtener Indicadores (Anual o Consolidado Histórico Multianual)
    function getIndicadorData(ano, comCod) {
        if (ano === 'ALL') {
            const ind = state.data.indicadores_anuales;
            const res = {
                Total: { num: 0, den: 0, cob: 0, nac: 0, def: 0, iniciados: 0, dropout: 0 },
                Mujer: { num: 0, den: 0, cob: 0, nac: 0, def: 0, iniciados: 0, dropout: 0 },
                Hombre: { num: 0, den: 0, cob: 0, nac: 0, def: 0, iniciados: 0, dropout: 0 }
            };

            Object.values(ind).forEach(anoData => {
                const src = comCod === 'TOTAL' ? anoData.provincial : anoData.comunas?.[comCod];
                if (src) {
                    ['Total', 'Mujer', 'Hombre'].forEach(sexo => {
                        if (src[sexo]) {
                            res[sexo].num += src[sexo].num || 0;
                            res[sexo].den += src[sexo].den || 0;
                            res[sexo].nac += src[sexo].nac || 0;
                            res[sexo].def += src[sexo].def || 0;
                            res[sexo].iniciados += src[sexo].iniciados || 0;
                        }
                    });
                }
            });

            ['Total', 'Mujer', 'Hombre'].forEach(sexo => {
                res[sexo].cob = res[sexo].den > 0 ? (res[sexo].num / res[sexo].den) * 100 : 0;
                res[sexo].dropout = res[sexo].iniciados > 0 ? ((res[sexo].iniciados - res[sexo].num) / res[sexo].iniciados) * 100 : 0;
            });

            return res;
        } else {
            const anoData = state.data.indicadores_anuales?.[Number(ano)];
            if (!anoData) return null;
            return comCod === 'TOTAL' ? anoData.provincial : anoData.comunas?.[comCod];
        }
    }

    // Texto Resumen de Filtros
    function updateFilterSummary() {
        const anoText = state.selectedAno === 'ALL' ? 'Serie Histórica Consolidada (2015-2026)' : `Año de Evaluación ${state.selectedAno}`;
        const comText = state.selectedComuna === 'TOTAL' ? 'Provincia de Osorno' : state.data.metadata.comunas[state.selectedComuna];
        const sexText = state.selectedSexo === 'Total' ? 'Ambos Sexos' : (state.selectedSexo === 'Mujer' ? 'Mujeres' : 'Hombres');
        dom.filterSummary.innerHTML = `<i class="fas fa-circle-info icon-info"></i> Mostrando: <strong>${anoText}</strong> • <strong>${comText}</strong> • <strong>${sexText}</strong>`;
    }

    // 7. KPIs Estratégicos
    function updateKPIs() {
        const comCod = state.selectedComuna;
        const sexoKey = state.selectedSexo;
        const anoVal = state.selectedAno;

        const curData = getIndicadorData(anoVal, comCod);
        if (!curData) return;

        const info = curData[sexoKey];
        const infoFem = curData['Mujer'];
        const infoMasc = curData['Hombre'];

        // KPI 1: Cobertura
        document.getElementById('kpiCobActual').textContent = `${info.cob.toFixed(1)}%`;
        document.getElementById('kpiNumActual').textContent = `${info.num.toLocaleString('es-CL')}`;
        document.getElementById('kpiDenActual').textContent = `${info.den.toLocaleString('es-CL')}`;

        const badgeMeta = document.getElementById('kpiMetaStatus');
        if (info.cob >= 80) {
            badgeMeta.className = 'kpi-sub-badge badge-green';
            badgeMeta.innerHTML = '<i class="fas fa-circle-check"></i> Cumple Meta (≥80%)';
        } else if (info.cob >= 60) {
            badgeMeta.className = 'kpi-sub-badge badge-yellow';
            badgeMeta.innerHTML = '<i class="fas fa-triangle-exclamation"></i> En Alerta (60-79%)';
        } else {
            badgeMeta.className = 'kpi-sub-badge badge-red';
            badgeMeta.innerHTML = '<i class="fas fa-circle-xmark"></i> Crítico (<60%)';
        }

        // KPI 2: Mujeres vs Hombres
        document.getElementById('kpiCobFem').textContent = `${infoFem.cob.toFixed(1)}%`;
        document.getElementById('kpiCobMasc').textContent = `${infoMasc.cob.toFixed(1)}%`;
        const gpi = infoMasc.cob > 0 ? (infoFem.cob / infoMasc.cob).toFixed(2) : '-';
        document.getElementById('kpiGPI').textContent = gpi;
        const diff = (infoFem.cob - infoMasc.cob).toFixed(1);
        document.getElementById('kpiDiffSex').textContent = `${diff > 0 ? '+' : ''}${diff} pts`;

        // KPI 3: Total Dosis (Residencia)
        let totalDosis = 0;
        let d1 = 0, d2 = 0, du = 0;
        const subDosisEl = document.querySelector('#tab-cobertura .kpi-card:nth-child(3) .kpi-sub-text');

        if (anoVal === 'ALL') {
            Object.entries(state.data.dosis_anuales).forEach(([anoAdm, comData]) => {
                const entry = comCod === 'TOTAL' ? comData['TOTAL']['Total'] : comData[comCod]?.['Total'];
                if (entry) {
                    totalDosis += entry['Total'] || 0;
                    d1 += entry['1ª Dosis'] || 0;
                    d2 += entry['2ª Dosis'] || 0;
                    du += entry['Dosis Única'] || 0;
                }
            });
            if (subDosisEl) subDosisEl.textContent = 'Producción acumulada RNI (2014–2026) en residentes';
        } else {
            const comData = state.data.dosis_anuales?.[Number(anoVal)];
            if (comData) {
                const entry = comCod === 'TOTAL' ? comData['TOTAL']['Total'] : comData[comCod]?.['Total'];
                if (entry) {
                    totalDosis = entry['Total'] || 0;
                    d1 = entry['1ª Dosis'] || 0;
                    d2 = entry['2ª Dosis'] || 0;
                    du = entry['Dosis Única'] || 0;
                }
            }
            if (subDosisEl) subDosisEl.textContent = `Producción RNI año ${anoVal} en residentes`;
        }

        document.getElementById('kpiTotalDosisHistoricas').textContent = totalDosis.toLocaleString('es-CL');
        document.getElementById('kpiDosis1').textContent = d1.toLocaleString('es-CL');
        document.getElementById('kpiDosis2').textContent = d2.toLocaleString('es-CL');
        document.getElementById('kpiDosisUnica').textContent = du.toLocaleString('es-CL');

        // KPI 4: Dispersión Territorial
        let maxC = { nom: '', cob: -1 };
        let minC = { nom: '', cob: 999 };
        Object.entries(state.data.metadata.comunas).forEach(([cCod, cNom]) => {
            const cInd = getIndicadorData(anoVal, cCod);
            if (cInd && cInd.Total) {
                const cob = cInd.Total.cob;
                if (cob > maxC.cob) maxC = { nom: cNom, cob };
                if (cob < minC.cob) minC = { nom: cNom, cob };
            }
        });
        const brechaTerr = (maxC.cob >= 0 && minC.cob <= 100) ? (maxC.cob - minC.cob).toFixed(1) : '0.0';
        document.getElementById('kpiBrechaComunal').textContent = `${brechaTerr} pts`;
        document.getElementById('kpiComunaMax').textContent = `${maxC.nom} (${maxC.cob.toFixed(1)}%)`;
        document.getElementById('kpiComunaMin').textContent = `${minC.nom} (${minC.cob.toFixed(1)}%)`;
    }

    // 8. Gráfico 1: Evolución Temporal Cobertura a los 15 Años
    function renderChartEvolucion() {
        const ctx = document.getElementById('chartEvolucionCobertura');
        if (!ctx) return;

        const tc = getThemeColors();
        const anos = Object.keys(state.data.indicadores_anuales).map(Number).sort((a, b) => a - b);
        const labels = anos.map(a => `${a} (Coh.${state.data.indicadores_anuales[a].cohorte})`);

        const comCod = state.selectedComuna;
        const dataFem = anos.map(a => (comCod === 'TOTAL' ? state.data.indicadores_anuales[a].provincial.Mujer.cob : state.data.indicadores_anuales[a].comunas[comCod].Mujer.cob));
        const dataMasc = anos.map(a => (comCod === 'TOTAL' ? state.data.indicadores_anuales[a].provincial.Hombre.cob : state.data.indicadores_anuales[a].comunas[comCod].Hombre.cob));

        if (state.charts.evolucion) state.charts.evolucion.destroy();

        state.charts.evolucion = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Mujeres',
                        data: dataFem,
                        borderColor: tc.purple,
                        backgroundColor: 'rgba(142, 68, 173, 0.10)',
                        borderWidth: 3,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        tension: 0.25,
                        fill: true
                    },
                    {
                        label: 'Hombres',
                        data: dataMasc,
                        borderColor: tc.cyan,
                        backgroundColor: 'rgba(0, 188, 212, 0.08)',
                        borderWidth: 3,
                        borderDash: [6, 4],
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        tension: 0.25,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`
                        }
                    }
                },
                scales: {
                    y: {
                        min: 0,
                        max: 105,
                        ticks: { callback: v => `${v}%`, color: tc.textMuted },
                        grid: { color: tc.gridColor }
                    },
                    x: {
                        ticks: { color: tc.textMuted },
                        grid: { color: tc.gridColor }
                    }
                }
            }
        });
    }

    // 9. Ranking Comunal y Semáforo
    function renderRankingComunas() {
        const container = document.getElementById('rankingComunasContainer');
        if (!container) return;

        const anoVal = state.selectedAno;
        const sexoKey = state.selectedSexo;

        const list = Object.entries(state.data.metadata.comunas).map(([cCod, cNom]) => {
            const cInd = getIndicadorData(anoVal, cCod);
            const dataObj = cInd?.[sexoKey] || { cob: 0, num: 0, den: 0 };
            return {
                cod: cCod,
                nom: cNom,
                cob: dataObj.cob,
                num: dataObj.num,
                den: dataObj.den
            };
        }).sort((a, b) => b.cob - a.cob);

        container.innerHTML = '';
        list.forEach(item => {
            const statusClass = item.cob >= 80 ? 'status-green' : (item.cob >= 60 ? 'status-yellow' : 'status-red');
            const el = document.createElement('div');
            el.className = 'ranking-item';
            el.innerHTML = `
                <div class="ranking-header">
                    <span>${item.nom}</span>
                    <span><strong>${item.cob.toFixed(1)}%</strong> <small>(${item.num.toLocaleString('es-CL')}/${item.den.toLocaleString('es-CL')})</small></span>
                </div>
                <div class="ranking-bar-bg">
                    <div class="ranking-bar-fill ${statusClass}" style="width: ${Math.min(item.cob, 100)}%"></div>
                </div>
            `;
            container.appendChild(el);
        });
    }

    // 10. Matriz Resumen de Cobertura
    function renderTablaResumen() {
        const tbody = document.querySelector('#tablaResumenEjecutivo tbody');
        if (!tbody) return;

        const ind = state.data.indicadores_anuales;
        const anos = Object.keys(ind).map(Number).sort((a, b) => a - b);
        const sexoKey = state.selectedSexo;

        let html = '';

        // Filas por Comuna
        Object.entries(state.data.metadata.comunas).forEach(([cod, nom]) => {
            html += `<tr><td><strong>${nom}</strong></td>`;
            let sumCob = 0;
            anos.forEach(ano => {
                const cob = ind[ano].comunas[cod][sexoKey].cob;
                sumCob += cob;
                const badge = cob >= 80 ? 'badge-green' : (cob >= 60 ? 'badge-yellow' : 'badge-red');
                html += `<td><span class="badge-pill ${badge}">${cob.toFixed(1)}%</span></td>`;
            });
            const avg = sumCob / anos.length;
            html += `<td><strong>${avg.toFixed(1)}%</strong></td></tr>`;
        });

        // Fila Total Provincial
        html += `<tr class="row-total"><td><strong>TOTAL S.S. OSORNO</strong></td>`;
        let sumTot = 0;
        anos.forEach(ano => {
            const cob = ind[ano].provincial[sexoKey].cob;
            sumTot += cob;
            const badge = cob >= 80 ? 'badge-green' : (cob >= 60 ? 'badge-yellow' : 'badge-red');
            html += `<td><span class="badge-pill ${badge}">${cob.toFixed(1)}%</span></td>`;
        });
        const avgTot = sumTot / anos.length;
        html += `<td><strong>${avgTot.toFixed(1)}%</strong></td></tr>`;

        tbody.innerHTML = html;
    }

    // 11. Gráfico Producción de Dosis por Tipo
    function renderChartDosisPorTipo() {
        const ctx = document.getElementById('chartDosisPorTipo');
        if (!ctx) return;

        const tc = getThemeColors();
        const anos = Object.keys(state.data.dosis_anuales).map(Number).sort((a, b) => a - b);
        const comCod = state.selectedComuna;

        const d1 = anos.map(a => (comCod === 'TOTAL' ? state.data.dosis_anuales[a]['TOTAL']['Total']['1ª Dosis'] : state.data.dosis_anuales[a][comCod]['Total']['1ª Dosis']) || 0);
        const d2 = anos.map(a => (comCod === 'TOTAL' ? state.data.dosis_anuales[a]['TOTAL']['Total']['2ª Dosis'] : state.data.dosis_anuales[a][comCod]['Total']['2ª Dosis']) || 0);
        const du = anos.map(a => (comCod === 'TOTAL' ? state.data.dosis_anuales[a]['TOTAL']['Total']['Dosis Única'] : state.data.dosis_anuales[a][comCod]['Total']['Dosis Única']) || 0);

        if (state.charts.dosisTipo) state.charts.dosisTipo.destroy();

        state.charts.dosisTipo = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: anos,
                datasets: [
                    { label: '1ª Dosis', data: d1, backgroundColor: tc.blue },
                    { label: '2ª Dosis', data: d2, backgroundColor: tc.purple },
                    { label: 'Dosis Única', data: du, backgroundColor: tc.green }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { stacked: true, ticks: { color: tc.textMuted }, grid: { color: tc.gridColor } },
                    y: { stacked: true, ticks: { color: tc.textMuted }, grid: { color: tc.gridColor } }
                }
            }
        });
    }

    // 12. Gráfico Dosis por Sexo
    function renderChartDosisPorSexo() {
        const ctx = document.getElementById('chartDosisPorSexo');
        if (!ctx) return;

        const tc = getThemeColors();
        const anos = Object.keys(state.data.dosis_anuales).map(Number).sort((a, b) => a - b);
        const comCod = state.selectedComuna;

        const fem = anos.map(a => (comCod === 'TOTAL' ? state.data.dosis_anuales[a]['TOTAL']['Mujer']['Total'] : state.data.dosis_anuales[a][comCod]['Mujer']['Total']) || 0);
        const masc = anos.map(a => (comCod === 'TOTAL' ? state.data.dosis_anuales[a]['TOTAL']['Hombre']['Total'] : state.data.dosis_anuales[a][comCod]['Hombre']['Total']) || 0);

        if (state.charts.dosisSexo) state.charts.dosisSexo.destroy();

        state.charts.dosisSexo = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: anos,
                datasets: [
                    { label: 'Mujeres', data: fem, backgroundColor: tc.purple },
                    { label: 'Hombres', data: masc, backgroundColor: tc.cyan }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { ticks: { color: tc.textMuted }, grid: { color: tc.gridColor } },
                    y: { ticks: { color: tc.textMuted }, grid: { color: tc.gridColor } }
                }
            }
        });
    }

    // 13. Comparativa Comunal (Bar Chart)
    function renderChartComparativaComunal() {
        const ctx = document.getElementById('chartComparativaComunal');
        if (!ctx) return;

        const tc = getThemeColors();
        const anoVal = state.selectedAno;

        const comEntries = Object.entries(state.data.metadata.comunas);
        const labels = comEntries.map(c => c[1]);
        const tot = comEntries.map(c => getIndicadorData(anoVal, c[0])?.Total?.cob || 0);
        const fem = comEntries.map(c => getIndicadorData(anoVal, c[0])?.Mujer?.cob || 0);
        const masc = comEntries.map(c => getIndicadorData(anoVal, c[0])?.Hombre?.cob || 0);

        if (state.charts.comparativa) state.charts.comparativa.destroy();

        state.charts.comparativa = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Total', data: tot, backgroundColor: tc.blue },
                    { label: 'Mujeres', data: fem, backgroundColor: tc.purple },
                    { label: 'Hombres', data: masc, backgroundColor: tc.cyan }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { min: 0, max: 105, ticks: { callback: v => `${v}%`, color: tc.textMuted }, grid: { color: tc.gridColor } },
                    x: { ticks: { color: tc.textMuted }, grid: { color: tc.gridColor } }
                }
            }
        });
    }

    // 14. Radar de Equidad Comunal
    function renderChartRadarComunal() {
        const ctx = document.getElementById('chartRadarComunal');
        if (!ctx) return;

        const tc = getThemeColors();
        const anoVal = state.selectedAno;

        const comEntries = Object.entries(state.data.metadata.comunas);
        const labels = comEntries.map(c => c[1]);
        const values = comEntries.map(c => getIndicadorData(anoVal, c[0])?.[state.selectedSexo]?.cob || 0);

        if (state.charts.radar) state.charts.radar.destroy();

        state.charts.radar = new Chart(ctx, {
            type: 'radar',
            data: {
                labels,
                datasets: [{
                    label: `Cobertura ${state.selectedSexo} (%)`,
                    data: values,
                    backgroundColor: 'rgba(15, 105, 180, 0.25)',
                    borderColor: tc.blue,
                    pointBackgroundColor: tc.blue
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        min: 0,
                        max: 100,
                        ticks: { stepSize: 20, color: tc.textMuted, backdropColor: 'transparent' },
                        grid: { color: tc.gridColor },
                        pointLabels: { color: tc.textPrimary, font: { size: 11, weight: '600' } }
                    }
                }
            }
        });
    }

    // 15. Tabla Detalle Comunal Completo
    function renderTablaDetalleComunal() {
        const tbody = document.querySelector('#tablaDetalleComunal tbody');
        if (!tbody) return;

        const anoVal = state.selectedAno;

        let html = '';
        Object.entries(state.data.metadata.comunas).forEach(([cod, nom]) => {
            const cInd = getIndicadorData(anoVal, cod);
            if (!cInd) return;
            const t = cInd.Total;
            const m = cInd.Mujer;
            const h = cInd.Hombre;
            const badge = t.cob >= 80 ? 'badge-green' : (t.cob >= 60 ? 'badge-yellow' : 'badge-red');
            html += `
                <tr>
                    <td>${cod}</td>
                    <td><strong>${nom}</strong></td>
                    <td>${t.nac.toLocaleString('es-CL')}</td>
                    <td>${t.def.toLocaleString('es-CL')}</td>
                    <td><strong>${t.den.toLocaleString('es-CL')}</strong></td>
                    <td>${t.num.toLocaleString('es-CL')}</td>
                    <td><span class="badge-pill ${badge}">${t.cob.toFixed(1)}%</span></td>
                    <td>${m.cob.toFixed(1)}%</td>
                    <td>${h.cob.toFixed(1)}%</td>
                    <td>${t.dropout.toFixed(1)}%</td>
                </tr>
            `;
        });

        const pInd = getIndicadorData(anoVal, 'TOTAL');
        if (pInd) {
            const pt = pInd.Total;
            const pm = pInd.Mujer;
            const ph = pInd.Hombre;
            const badgeTot = pt.cob >= 80 ? 'badge-green' : (pt.cob >= 60 ? 'badge-yellow' : 'badge-red');
            html += `
                <tr class="row-total">
                    <td>PROV</td>
                    <td><strong>TOTAL S.S. OSORNO</strong></td>
                    <td>${pt.nac.toLocaleString('es-CL')}</td>
                    <td>${pt.def.toLocaleString('es-CL')}</td>
                    <td><strong>${pt.den.toLocaleString('es-CL')}</strong></td>
                    <td>${pt.num.toLocaleString('es-CL')}</td>
                    <td><span class="badge-pill ${badgeTot}">${pt.cob.toFixed(1)}%</span></td>
                    <td>${pm.cob.toFixed(1)}%</td>
                    <td>${ph.cob.toFixed(1)}%</td>
                    <td>${pt.dropout.toFixed(1)}%</td>
                </tr>
            `;
        }

        tbody.innerHTML = html;
    }

    // 16. Gráfico Drop-out Rate (Tasa de Abandono por Sexo)
    function renderChartDropout() {
        const ctx = document.getElementById('chartDropoutEvolucion');
        if (!ctx) return;

        const tc = getThemeColors();
        const anos = Object.keys(state.data.indicadores_anuales).map(Number).sort((a, b) => a - b);
        const comCod = state.selectedComuna;

        const dataFem = anos.map(a => (comCod === 'TOTAL' ? state.data.indicadores_anuales[a].provincial.Mujer.dropout : state.data.indicadores_anuales[a].comunas[comCod].Mujer.dropout));
        const dataMasc = anos.map(a => (comCod === 'TOTAL' ? state.data.indicadores_anuales[a].provincial.Hombre.dropout : state.data.indicadores_anuales[a].comunas[comCod].Hombre.dropout));

        if (state.charts.dropout) state.charts.dropout.destroy();

        state.charts.dropout = new Chart(ctx, {
            type: 'line',
            data: {
                labels: anos,
                datasets: [
                    {
                        label: 'Mujeres',
                        data: dataFem,
                        borderColor: tc.purple,
                        backgroundColor: 'rgba(147, 51, 234, 0.10)',
                        borderWidth: 3,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        tension: 0.25,
                        fill: true
                    },
                    {
                        label: 'Hombres',
                        data: dataMasc,
                        borderColor: tc.cyan,
                        backgroundColor: 'rgba(2, 132, 199, 0.10)',
                        borderWidth: 3,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        tension: 0.25,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: tc.textPrimary,
                            usePointStyle: true,
                            boxWidth: 8,
                            padding: 12,
                            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: '600' }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`
                        }
                    }
                },
                scales: {
                    y: {
                        min: 0,
                        ticks: { callback: v => `${v}%`, color: tc.textMuted },
                        grid: { color: tc.gridColor }
                    },
                    x: {
                        ticks: { color: tc.textMuted },
                        grid: { color: tc.gridColor }
                    }
                }
            }
        });
    }

    // 17. Gráfico Transición de Vacunas
    function renderChartVacunasTransicion() {
        const ctx = document.getElementById('chartVacunasTransicion');
        if (!ctx || !state.data.evolucion_vacunas) return;

        const tc = getThemeColors();
        const anos = Object.keys(state.data.evolucion_vacunas).map(Number).sort((a, b) => a - b);
        const tetra = anos.map(a => state.data.evolucion_vacunas[a]['VPH Tetravalente (Gardasil 4)'] || 0);
        const nona = anos.map(a => state.data.evolucion_vacunas[a]['VPH Nonavalente (Gardasil 9)'] || 0);
        const biv = anos.map(a => (state.data.evolucion_vacunas[a]['VPH Bivalente (Cervarix)'] || 0) + (state.data.evolucion_vacunas[a]['VPH Otra / No Especificada'] || 0));

        // Determinar años activos para cada vacuna
        function formatYears(years) {
            if (!years || !years.length) return 'Sin registros';
            let ranges = [];
            let start = years[0];
            let prev = years[0];
            for (let i = 1; i <= years.length; i++) {
                if (years[i] === prev + 1) {
                    prev = years[i];
                } else {
                    if (start === prev) ranges.push(start);
                    else ranges.push(`${start}-${prev}`);
                    start = years[i];
                    prev = years[i];
                }
            }
            return `Años con registros: <strong>${ranges.join(', ')}</strong>`;
        }

        const activeYears = {
            'Tetravalente (Gardasil 4)': formatYears(anos.filter((a, i) => tetra[i] > 0)),
            'Nonavalente (Gardasil 9)': formatYears(anos.filter((a, i) => nona[i] > 0)),
            'Bivalente / Otras': formatYears(anos.filter((a, i) => biv[i] > 0))
        };

        if (state.charts.vacunasTrans) state.charts.vacunasTrans.destroy();

        state.charts.vacunasTrans = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: anos,
                datasets: [
                    { label: 'Tetravalente (Gardasil 4)', data: tetra, backgroundColor: tc.blue },
                    { label: 'Nonavalente (Gardasil 9)', data: nona, backgroundColor: tc.green },
                    { label: 'Bivalente / Otras', data: biv, backgroundColor: tc.amber }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        onHover: function(e, legendItem) {
                            const canvas = e.native.target;
                            canvas.style.cursor = 'help';
                            let tooltip = document.getElementById('customLegendTooltip');
                            if (!tooltip) {
                                tooltip = document.createElement('div');
                                tooltip.id = 'customLegendTooltip';
                                tooltip.style.position = 'fixed'; // Fixed better than absolute for page scrolling
                                tooltip.style.background = 'rgba(15, 23, 42, 0.95)';
                                tooltip.style.color = '#fff';
                                tooltip.style.padding = '8px 12px';
                                tooltip.style.borderRadius = '6px';
                                tooltip.style.fontSize = '12px';
                                tooltip.style.fontFamily = 'var(--font-primary)';
                                tooltip.style.pointerEvents = 'none';
                                tooltip.style.zIndex = '99999';
                                tooltip.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                                tooltip.style.border = '1px solid rgba(255,255,255,0.1)';
                                document.body.appendChild(tooltip);
                            }
                            tooltip.innerHTML = activeYears[legendItem.text] || 'Sin registros';
                            tooltip.style.display = 'block';
                            tooltip.style.left = (e.native.clientX + 15) + 'px';
                            tooltip.style.top = (e.native.clientY + 15) + 'px';
                        },
                        onLeave: function(e) {
                            e.native.target.style.cursor = 'default';
                            const tooltip = document.getElementById('customLegendTooltip');
                            if (tooltip) tooltip.style.display = 'none';
                        },
                        labels: {
                            color: tc.textPrimary,
                            usePointStyle: true,
                            boxWidth: 8,
                            padding: 12,
                            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: '600' }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (c) => ` ${c.dataset.label}: ${c.raw.toLocaleString('es-CL')} dosis`
                        }
                    }
                },
                scales: {
                    x: { stacked: true, ticks: { color: tc.textMuted }, grid: { color: tc.gridColor } },
                    y: { stacked: true, ticks: { color: tc.textMuted, callback: v => v.toLocaleString('es-CL') }, grid: { color: tc.gridColor } }
                }
            }
        });
    }

    // 18. Tabla Top Establecimientos
    function renderTablaTopEstablecimientos() {
        const tbody = document.querySelector('#tablaTopEstablecimientos tbody');
        if (!tbody || !state.data.top_establecimientos) return;

        const totalProv = state.data.top_establecimientos.reduce((acc, cur) => acc + cur.total, 0);
        let html = '';
        state.data.top_establecimientos.slice(0, 15).forEach((est, idx) => {
            const tetra = est.vacunas['VPH Tetravalente (Gardasil 4)'] || 0;
            const nona = est.vacunas['VPH Nonavalente (Gardasil 9)'] || 0;
            const otras = (est.vacunas['VPH Bivalente (Cervarix)'] || 0) + (est.vacunas['VPH Otra / No Especificada'] || 0);
            const part = totalProv > 0 ? ((est.total / totalProv) * 100).toFixed(1) : '0.0';

            html += `
                <tr>
                    <td><strong>${idx + 1}</strong></td>
                    <td><strong>${est.nombre}</strong></td>
                    <td>${tetra.toLocaleString('es-CL')}</td>
                    <td>${nona.toLocaleString('es-CL')}</td>
                    <td>${otras.toLocaleString('es-CL')}</td>
                    <td><strong>${est.total.toLocaleString('es-CL')}</strong></td>
                    <td><span class="badge-pill badge-green">${part}%</span></td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    }

    // ══════════════════════════════════════════════════════════════════════════════
    // 19. EXPORTACIÓN DE CAPTURAS PNG (HTML2CANVAS)
    // ══════════════════════════════════════════════════════════════════════════════
    window.downloadCardImage = async function(cardOrCanvasId, fileName) {
        try {
            const targetEl = document.getElementById(cardOrCanvasId);
            if (!targetEl) {
                console.warn('Element not found for snapshot:', cardOrCanvasId);
                return;
            }

            // Ocultar temporalmente los botones de acción para que la captura sea limpia e institucional
            const actionBtns = targetEl.querySelectorAll('.card-header-actions, .chart-help-btn, .card-screenshot-btn, .card-excel-btn');
            actionBtns.forEach(b => { 
                b.style.visibility = 'hidden'; 
            });

            // Determinar color de fondo según el tema activo
            const isDark = document.body.classList.contains('theme-dark');
            const bgColor = isDark ? '#0f172a' : '#ffffff';

            if (typeof html2canvas !== 'undefined') {
                const canvas = await html2canvas(targetEl, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: bgColor,
                    windowWidth: targetEl.scrollWidth || 1200
                });

                // Restaurar visibilidad de botones
                actionBtns.forEach(b => { 
                    b.style.visibility = 'visible'; 
                });

                const link = document.createElement('a');
                link.download = `${fileName}_${new Date().toISOString().slice(0, 10)}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            } else if (targetEl.tagName === 'CANVAS') {
                actionBtns.forEach(b => { 
                    b.style.visibility = 'visible'; 
                });
                const link = document.createElement('a');
                link.download = `${fileName}_${new Date().toISOString().slice(0, 10)}.png`;
                link.href = targetEl.toDataURL('image/png');
                link.click();
            } else {
                actionBtns.forEach(b => { 
                    b.style.visibility = 'visible'; 
                });
                alert('La herramienta de captura se está inicializando. Por favor intente nuevamente.');
            }
        } catch (err) {
            console.error('Error al generar la captura institucional:', err);
            const targetEl = document.getElementById(cardOrCanvasId);
            if (targetEl) {
                const actionBtns = targetEl.querySelectorAll('.card-header-actions, .chart-help-btn, .card-screenshot-btn, .card-excel-btn');
                actionBtns.forEach(b => { b.style.visibility = 'visible'; });
            }
        }
    };

    // ══════════════════════════════════════════════════════════════════════════════
    // 20. MOTOR DINÁMICO DE AYUDAS INTERPRETATIVAS (ENFOQUE EPIDEMIOLÓGICO Y ESTADÍSTICO)
    // ══════════════════════════════════════════════════════════════════════════════
    let activeSpotlightElement = null;

    window.openHelpModal = function(chartId, btnElement) {
        const overlay = document.getElementById('spotlightOverlay');
        const modal = document.getElementById('helpModal');
        const titleEl = document.getElementById('helpModalTitle');
        const subEl = document.getElementById('helpModalSubtitle');
        const bodyEl = document.getElementById('helpModalBody');

        if (!modal || !overlay || !bodyEl) return;

        // Remover spotlight anterior si existe
        if (activeSpotlightElement) {
            activeSpotlightElement.classList.remove('spotlight-active');
        }

        // Resaltar la tarjeta correspondiente
        if (btnElement) {
            const card = btnElement.closest('.chart-card, .table-card, .timeline-card, .methodology-card, .kpi-card, .coverage-table-container');
            if (card) {
                activeSpotlightElement = card;
                card.classList.add('spotlight-active');
            }
        }

        // Activar modo spotlight en el body (desenfoca header, tabs, filtros y otros módulos de fondo)
        document.body.classList.add('spotlight-active-mode');

        // Obtener datos dinámicos ajustados a la realidad filtrada
        const helpData = getHelpTextData(chartId);

        function getDynamicGlossary(htmlContent) {
            const text = htmlContent.toLowerCase();
            let defs = [];
            if (text.includes('puntos porcentuales') || text.includes('(pp)') || text.includes(' pp ') || text.includes(' pp<')) {
                defs.push('<li style="margin-bottom: 4px;"><strong>Puntos Porcentuales (pp):</strong> Diferencia aritmética absoluta entre dos porcentajes. Utilizado para medir brechas exactas.</li>');
            }
            if (text.includes('brecha inter-comunal') || text.includes('brecha inter-territorial') || text.includes('brecha intercomunal')) {
                defs.push('<li style="margin-bottom: 4px;"><strong>Brecha Inter-territorial / Intercomunal:</strong> Diferencia en pp entre el territorio con mayor y menor cobertura. Evalúa la inequidad y vulnerabilidad territorial.</li>');
            }
            

            if (defs.length === 0) return '';

            return `
            <div style="margin-top: 20px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 0.75rem; color: #64748b; line-height: 1.4; text-align: left;">
                <strong style="color: #475569; font-size: 0.8rem;">Glosario Epidemiológico:</strong>
                <ul style="padding-left: 15px; margin-top: 6px; margin-bottom: 0; list-style-type: disc;">
                    ${defs.join('')}
                </ul>
                <div style="margin-top: 8px; font-style: italic; color: #94a3b8;">
                    Referencias:<br>Organización Panamericana de la Salud [OPS]. (2020). <em>Consideraciones operativas para la vacunación contra el VPH</em>. Washington, D.C.
                </div>
            </div>`;
        }

        helpData.body += getDynamicGlossary(helpData.body);

        titleEl.innerHTML = helpData.title;
        subEl.textContent = helpData.subtitle;
        bodyEl.innerHTML = helpData.body;

        // Mostrar overlay y modal centrado
        overlay.style.display = 'block';
        setTimeout(() => { overlay.style.opacity = '1'; }, 10);

        modal.style.display = 'flex';
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        modal.style.opacity = '0';

        setTimeout(() => {
            modal.style.opacity = '1';
            modal.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 10);
    };

    window.closeHelpModal = function() {
        const overlay = document.getElementById('spotlightOverlay');
        const modal = document.getElementById('helpModal');

        // Quitar modo desenfoque de fondo
        document.body.classList.remove('spotlight-active-mode');

        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => { overlay.style.display = 'none'; }, 250);
        }

        if (modal) {
            modal.style.opacity = '0';
            modal.style.transform = 'translate(-50%, -50%) scale(0.95)';
            setTimeout(() => { modal.style.display = 'none'; }, 250);
        }

        if (activeSpotlightElement) {
            activeSpotlightElement.classList.remove('spotlight-active');
            activeSpotlightElement = null;
        }
    };

    // Cerrar con tecla Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            window.closeHelpModal();
        }
    });

    // Función de Arrastre (Drag) para el encabezado del Modal
    function initModalDrag() {
        const modal = document.getElementById('helpModal');
        const header = document.getElementById('helpModalHeader');
        if (!modal || !header) return;

        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.help-modal-close')) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;

            const rect = modal.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            modal.style.transform = 'none';
            modal.style.left = `${initialLeft}px`;
            modal.style.top = `${initialTop}px`;
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            modal.style.left = `${initialLeft + dx}px`;
            modal.style.top = `${initialTop + dy}px`;
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }
    initModalDrag();

    /**
     * Generador Dinámico de Análisis Epidemiológico y Estadístico
     */
    function getHelpTextData(chartId) {
        const ano = state.selectedAno;
        const comunaKey = state.selectedComuna;
        const sexoKey = state.selectedSexo;

        const nombreComuna = comunaKey === 'TOTAL' 
            ? 'Provincia de Osorno (7 Comunas)' 
            : (state.data?.metadata?.comunas?.[comunaKey] || `Comuna ${comunaKey}`);

        const nombreAno = ano === 'ALL' 
            ? 'Serie Histórica Consolidada (2015–2026)' 
            : `Año de Evaluación ${ano} (Cohorte ${state.data?.indicadores_anuales?.[ano]?.cohorte || (Number(ano)-15)})`;

        // Datos del año seleccionado usando el helper unificado
        let cobActual = 0, numActual = 0, denActual = 0, cobFem = 0, cobMasc = 0, cohorte = 0;
        let brechaMeta = 0, faltantesMeta = 0, rankingComunal = [];
        let statusBadgeClass = 'status-optimal';
        let statusBadgeText = 'Cobertura Óptima (≥ 80%)';
        let statusColor = '#10b981';

        const indData = getIndicadorData(ano, comunaKey);
        if (indData) {
            cohorte = ano === 'ALL' ? '2000–2011' : (state.data?.indicadores_anuales?.[ano]?.cohorte || (Number(ano) - 15));
            const curScope = indData[sexoKey] || indData.Total;
            cobActual = curScope.cob;
            numActual = curScope.num;
            denActual = curScope.den;
            cobFem = indData.Mujer.cob;
            cobMasc = indData.Hombre.cob;

            // Calcular ranking de comunas
            rankingComunal = Object.entries(state.data?.metadata?.comunas || {}).map(([cod, nom]) => {
                const cInd = getIndicadorData(ano, cod);
                return {
                    cod,
                    nombre: nom,
                    cobertura: cInd?.[sexoKey]?.cob || cInd?.Total?.cob || 0
                };
            }).sort((a, b) => b.cobertura - a.cobertura);

            // Faltantes para llegar a la meta sanitaria del 80%
            const meta80 = Math.ceil(denActual * 0.80);
            faltantesMeta = Math.max(0, meta80 - numActual);
            brechaMeta = (80 - cobActual).toFixed(1);

            if (cobActual >= 80) {
                statusBadgeClass = 'status-optimal';
                statusBadgeText = 'CUMPLE META SANITARIA (≥ 80%)';
                statusColor = '#10b981';
            } else if (cobActual >= 60) {
                statusBadgeClass = 'status-warning';
                statusBadgeText = 'ZONA DE ALERTA EPIDEMIOLÓGICA (60% – 79.9%)';
                statusColor = '#f59e0b';
            } else {
                statusBadgeClass = 'status-critical';
                statusBadgeText = 'NIVEL CRÍTICO DE VULNERABILIDAD (< 60%)';
                statusColor = '#ef4444';
            }
        }

        const comunaMax = rankingComunal.length > 0 ? rankingComunal[0] : null;
        const comunaMin = rankingComunal.length > 0 ? rankingComunal[rankingComunal.length - 1] : null;
        const brechaIntercomunal = (comunaMax && comunaMin) ? (comunaMax.cobertura - comunaMin.cobertura).toFixed(1) : '0.0';

        switch(chartId) {
            // ── TAB 1: RESUMEN ──
            case 'evolucionCobertura':
                return {
                    title: `Evolución de Cobertura a los 15 Años`,
                    subtitle: `Análisis Epidemiológico • ${nombreComuna} • ${nombreAno}`,
                    body: `
                        <div class="help-status-banner ${statusBadgeClass}">
                            <strong><i class="fas fa-shield-halved"></i> Diagnóstico de Blindaje: ${cobActual > 0 ? cobActual.toFixed(1) + '%' : 'Corte en Desarrollo'} (${statusBadgeText})</strong>
                            <span>Territorio evaluado: <strong>${nombreComuna}</strong> | Cohorte evaluada: Nacidos en ${cohorte || '---'} (evaluados a los 15 años).</span>
                        </div>

                        <div class="help-kpis-bar">
                            <div class="help-kpi-pill">
                                <span class="kpi-lbl">Cobertura Real</span>
                                <span class="kpi-num" style="color:${statusColor}">${cobActual > 0 ? cobActual.toFixed(1) + '%' : '--'}</span>
                            </div>
                            <div class="help-kpi-pill">
                                <span class="kpi-lbl">Inmunizados</span>
                                <span class="kpi-num">${numActual.toLocaleString('es-CL')}</span>
                            </div>
                            <div class="help-kpi-pill">
                                <span class="kpi-lbl">Pob. Neta DEIS</span>
                                <span class="kpi-num">${denActual.toLocaleString('es-CL')}</span>
                            </div>
                            <div class="help-kpi-pill">
                                <span class="kpi-lbl">Brecha a umbral 80%</span>
                                <span class="kpi-num" style="color:${faltantesMeta > 0 ? '#ef4444' : '#10b981'}">${faltantesMeta.toLocaleString('es-CL')}</span>
                            </div>
                        </div>

                        <div class="help-section">
                            <h4><i class="fas fa-microscope text-primary"></i> 1. Fundamentación Epidemiológica y Ventana de Oportunidad</h4>
                            <div class="help-section-content">
                                <p>La medición a los <strong>15 años cumplidos</strong> evalúa el éxito del <em>blindaje profiláctico</em> antes de la edad promedio de inicio de actividad sexual. El objetivo primordial de la vacuna VPH es prevenir la infección persistente por genotipos de alto riesgo oncogénico (especialmente VPH 16 y 18, responsables de >70% de cánceres cérvico-uterinos, y los genotipos adicionales en la Nonavalente).</p>
                                <p>En términos de dinámica de transmisión, alcanzar una cobertura comunitaria <strong>≥ 80%</strong> contribuye a aumentar la cobertura de vacunación VPH, reduciendo la brecha operativa y mejorando el avance de la vacunación de la población objetivo.</p>
                            </div>
                        </div>

                        <div class="help-grid">
                            <div class="help-box color-blue">
                                <h5><i class="fas fa-chart-line"></i> Rigor Estadístico DEIS</h5>
                                <p>El denominador se ajusta anualmente restando las defunciones de la cohorte acumuladas entre los 0 y 14 años, garantizando un denominador real cerrado sin sobrestimaciones censales.</p>
                            </div>
                            <div class="help-box color-orange">
                                <h5><i class="fas fa-venus-mars"></i> Paridad por Sexo</h5>
                                <p>Mujeres: <strong>${cobFem.toFixed(1)}%</strong> | Hombres: <strong>${cobMasc.toFixed(1)}%</strong>. Una brecha superior a 5 puntos porcentuales exige intensificar el rescate en varones escolares.</p>
                            </div>
                        </div>

                        <div class="help-section">
                            <h4><i class="fas fa-bullseye text-primary"></i> 2. Prescripción Táctica para la Red Asistencial</h4>
                            <div class="help-section-content">
                                ${faltantesMeta > 0 
                                    ? `<p>Para alcanzar el umbral del 80% en <strong>${nombreComuna}</strong> se requiere vacunar y registrar oportunamente a <strong>${faltantesMeta.toLocaleString('es-CL')} adolescentes adicionales</strong> de esta cohorte.</p>`
                                    : `<p><strong>${nombreComuna}</strong> supera el estándar sanitario ministerial del 80%. Se recomienda sostener el monitoreo para avanzar hacia la meta de erradicación global de la OMS (90%).</p>`
                                }
                            </div>
                        </div>
                    `
                };

            case 'rankingComunas':
                return {
                    title: `Ranking y Semáforo Comunal`,
                    subtitle: `Heterogeneidad Territorial • Provincia de Osorno • ${nombreAno}`,
                    body: `
                        <div class="help-status-banner ${Number(brechaIntercomunal) > 20 ? 'status-warning' : 'status-optimal'}">
                            <strong><i class="fas fa-scale-unbalanced-flip"></i> Brecha Inter-territorial: ${brechaIntercomunal} puntos porcentuales</strong>
                            <span>Máxima dispersión observada en el año evaluado entre comunas de la misma provincia.</span>
                        </div>

                        <div class="help-section">
                            <h4><i class="fas fa-magnifying-glass-chart text-primary"></i> 1. Diagnóstico de Dispersión Territorial</h4>
                            <div class="help-section-content">
                                <p>El semáforo estratifica las 7 comunas en tres categorías de riesgo sanitario:</p>
                                <ul>
                                    <li><strong style="color:#10b981">Cumple Meta (≥ 80%):</strong> Cobertura protectora comunitaria consolidada.</li>
                                    <li><strong style="color:#f59e0b">Alerta (60% – 79.9%):</strong> Cobertura sub-óptima; brecha operativa que requiere atención local.</li>
                                    <li><strong style="color:#ef4444">Crítico (&lt; 60%):</strong> Alta vulnerabilidad biológica ante exposición viral futura.</li>
                                </ul>
                            </div>
                        </div>

                        <div class="help-grid">
                            <div class="help-box color-green">
                                <h5><i class="fas fa-trophy"></i> Comuna Líder</h5>
                                <p><strong>${comunaMax ? comunaMax.nombre : '---'}</strong> con <strong>${comunaMax ? comunaMax.cobertura.toFixed(1) + '%' : '---'}</strong> de cobertura a los 15 años.</p>
                            </div>
                            <div class="help-box color-red">
                                <h5><i class="fas fa-triangle-exclamation"></i> Comuna en Rezago</h5>
                                <p><strong>${comunaMin ? comunaMin.nombre : '---'}</strong> con <strong>${comunaMin ? comunaMin.cobertura.toFixed(1) + '%' : '---'}</strong> de cobertura registrada.</p>
                            </div>
                        </div>

                        <div class="help-section">
                            <h4><i class="fas fa-stethoscope text-primary"></i> 2. Enfoque Epidemiológico de Equidad</h4>
                            <div class="help-section-content">
                                <p>Las asimetrías territoriales en VPH frecuentemente responden a barreras de dispersión geográfica rural, menor retención escolar o dificultades en la coordinación entre establecimientos de salud y colegios. Se sugiere desplegar equipos móviles de vacunación en las comunas con menor desempeño relativo.</p>
                            </div>
                        </div>
                    `
                };

            case 'tablaResumenEjecutivo':
                return {
                    title: `Matriz Espacio-Temporal de Coberturas`,
                    subtitle: `Seguimiento Longitudinal 2015–2026 • 7 Comunas de Osorno`,
                    body: `
                        <div class="help-section">
                            <h4><i class="fas fa-table-cells text-primary"></i> 1. Interpretación de la Matriz Histórica</h4>
                            <div class="help-section-content">
                                <p>Esta matriz presenta la serie histórica completa de evaluación a los 15 años (cohortes de nacimiento 2000 a 2011 evaluadas entre 2015 y 2026). Permite auditar la estabilidad programática a lo largo de más de una década de inmunización.</p>
                            </div>
                        </div>

                        <div class="help-grid">
                            <div class="help-box color-blue">
                                <h5><i class="fas fa-arrow-trend-up"></i> Tendencia Longitudinal</h5>
                                <p>Permite contrastar los periodos pre-incorporación de varones (2015-2018), el shock asistencial de pandemia (2020-2021) y el despegue con Dosis Única (2024-2026).</p>
                            </div>
                            <div class="help-box color-dark">
                                <h5><i class="fas fa-calculator"></i> Promedio Histórico</h5>
                                <p>El promedio histórico refleja la capacidad basal de captación vacunal de cada municipio, atenuando fluctuaciones anuales de cohortes pequeñas.</p>
                            </div>
                        </div>

                        <div class="help-section">
                            <h4><i class="fas fa-info-circle text-primary"></i> 2. Nota Técnica sobre el Corte 2026</h4>
                            <div class="help-section-content">
                                <p>La columna <strong>2026*</strong> contiene datos preliminares en ejecución escolar. Su valor se incrementa continuamente a medida que los equipos de APS cargan los registros del RNI durante el año lectivo.</p>
                            </div>
                        </div>
                    `
                };

            // ── TAB 2: SERIE HISTÓRICA ──
            case 'timelineHitos':
                return {
                    title: `Hitos Normativos y Evolución del PNI`,
                    subtitle: `Marco Regulatorio y Transiciones Tecnológicas (2014–2026)`,
                    body: `
                        <div class="help-section">
                            <h4><i class="fas fa-landmark text-primary"></i> 1. Eras del Programa de Vacunación VPH en Chile</h4>
                            <div class="help-section-content">
                                <p>La política pública de prevención del VPH en Chile ha transitado por 3 etapas fundamentales:</p>
                                <ul>
                                    <li><strong>2014–2018 (Focalización Femenina):</strong> Inicio con vacuna Tetravalente (Gardasil 4) en niñas de 4° y 5° básico en esquema de 2 dosis.</li>
                                    <li><strong>2019–2023 (Universalización a Varones):</strong> Incorporación de niños escolares de 4° básico, reconociendo el rol de los varones en la transmisión viral y otorgando protección directa contra patologías asociadas.</li>
                                    <li><strong>2024–2026 (Transición a Dosis Única & Gardasil 9):</strong> Cambio histórico a vacuna Nonavalente (9 serotipos) en esquema simplificado de 1 sola dosis.</li>
                                </ul>
                            </div>
                        </div>

                        <div class="help-grid">
                            <div class="help-box color-green">
                                <h5><i class="fas fa-flask"></i> Evidencia OMS / SAGE</h5>
                                <p>El paso a Dosis Única cuenta con respaldo de la OMS, evidenciando títulos de anticuerpos neutralizantes duraderos y alta eficacia en prevención de lesiones pre-cancerosas.</p>
                            </div>
                            <div class="help-box color-blue">
                                <h5><i class="fas fa-people-arrows"></i> Impacto de Equidad</h5>
                                <p>La simplificación a 1 dosis elimina la deserción entre 1ª y 2ª dosis, garantizando que el 100% de los contactados quede con esquema completo.</p>
                            </div>
                        </div>
                    `
                };

            case 'dosisPorTipo':
                return {
                    title: `Producción de Dosis por Tipo de Esquema`,
                    subtitle: `Dinámica Operativa Multidosis vs Dosis Única (2014–2026)`,
                    body: `
                        <div class="help-section">
                            <h4><i class="fas fa-syringe text-primary"></i> 1. Análisis de Carga Operativa Asistencial</h4>
                            <div class="help-section-content">
                                <p>El gráfico exhibe la distribución de 1ª dosis (azul), 2ª dosis (naranja) y Dosis Única (verde) administradas a residentes de la provincia de Osorno en cada periodo.</p>
                                <p>Hasta 2023, la red de salud requería realizar dos visitas escolares por cohorte para administrar ambas dosis. A partir de 2024, la consolidación de la <strong>Dosis Única</strong> reduce a la mitad la logística de contacto escolar para una misma cohorte, liberando horas-enfermera y mejorando la eficiencia general del vacunatorio.</p>
                            </div>
                        </div>

                        <div class="help-grid">
                            <div class="help-box color-blue">
                                <h5><i class="fas fa-filter"></i> Filtros de Inclusión RNI</h5>
                                <p>Solo contabiliza vacunas administradas con registro vigente. Se descartan registros eliminados y valores clasificados como EPRO.</p>
                            </div>
                            <div class="help-box color-green">
                                <h5><i class="fas fa-check-double"></i> Eficacia Programática</h5>
                                <p>Una sola intervención escolar logra el cierre epidemiológico del usuario sin riesgo de pérdida de seguimiento interanual.</p>
                            </div>
                        </div>
                    `
                };

            case 'dosisPorSexo':
                return {
                    title: `Producción Histórica Desagregada por Sexo`,
                    subtitle: `Evolución de Paridad y Demanda Asistencial (2014–2026)`,
                    body: `
                        <div class="help-section">
                            <h4><i class="fas fa-venus-mars text-primary"></i> 1. Salto de Producción Post-2019</h4>
                            <div class="help-section-content">
                                <p>Entre 2014 y 2018 la totalidad de dosis correspondían al sexo femenino. En 2019 se observa un incremento del 95% en la producción total de dosis por la incorporación universal de varones.</p>
                                <p>Epidemiológicamente, proteger a ambos sexos acelera el corte de la transmisión comunitaria y reduce la incidencia futura de cánceres orofaríngeos, de pene y anales en varones, además de cáncer cervicouterino en mujeres.</p>
                            </div>
                        </div>
                    `
                };

            // ── TAB 3: TERRITORIAL ──
            case 'comparativaComunal':
                return {
                    title: `Comparativa Territorial de Coberturas`,
                    subtitle: `Desglose por Comuna y Sexo • ${nombreAno}`,
                    body: `
                        <div class="help-section">
                            <h4><i class="fas fa-chart-column text-primary"></i> 1. Análisis de Brecha Territorial y Género</h4>
                            <div class="help-section-content">
                                <p>Esta gráfica de barras agrupadas permite comparar de manera directa la cobertura total, de mujeres y de hombres en cada una de las 7 comunas del Servicio de Salud Osorno.</p>
                                <p>Permite detectar si existen comunas donde los varones o las mujeres presentan una desproporción inusual en la captación vacunal, orientando auditorías en establecimientos escolares específicos.</p>
                            </div>
                        </div>

                        <div class="help-grid">
                            <div class="help-box color-blue">
                                <h5><i class="fas fa-ruler-combined"></i> Denominadores DEIS</h5>
                                <p>Cada comuna utiliza su propio denominador de nacidos vivos menos defunciones infantiles/juveniles correspondientes a la cohorte.</p>
                            </div>
                            <div class="help-box color-green">
                                <h5><i class="fas fa-flag-checkered"></i> Meta Sanitaria 80%</h5>
                                <p>La línea punteada de referencia ministerial marca el estándar mínimo de seguridad biológica poblacional.</p>
                            </div>
                        </div>
                    `
                };

            case 'radarComunal':
                return {
                    title: `Radar de Simetría y Equidad Territorial`,
                    subtitle: `Polígono de Cohesión Intercomunal • ${nombreAno}`,
                    body: `
                        <div class="help-section">
                            <h4><i class="fas fa-compass-drafting text-primary"></i> 1. Interpretación Geométrica del Radar</h4>
                            <div class="help-section-content">
                                <p>Un polígono regular y equilibrado (círculo simétrico cercano al borde exterior del 80-100%) indica alta <strong>equidad territorial</strong> en la provincia. Deformaciones o puntas pronunciadas hacia el centro evidencian asimetrías severas donde los residentes de ciertas comunas quedan desprotegidos frente al resto.</p>
                            </div>
                        </div>
                    `
                };

            case 'tablaDetalleComunal':
                return {
                    title: `Detalle Epidemiológico Comunal Completo`,
                    subtitle: `Auditoría Numérica de Indicadores • ${nombreAno}`,
                    body: `
                        <div class="help-section">
                            <h4><i class="fas fa-calculator text-primary"></i> 1. Desglose del Algoritmo Oficial</h4>
                            <div class="help-section-content">
                                <p>La tabla muestra el cálculo transparente de la fórmula oficial:</p>
                                <p style="background:rgba(15,105,180,0.08); padding:8px 12px; border-radius:6px; font-family:monospace; font-size:0.85rem;">
                                    Población Neta = Nacidos Vivos (DEIS) &minus; Defunciones &lt;15a (DEIS)<br>
                                    Cobertura (%) = (Esquemas Completos / Población Neta) &times; 100
                                </p>
                                <p>Permite fiscalizar con precisión la consistencia de cada comuna de la Provincia de Osorno.</p>
                            </div>
                        </div>
                    `
                };

            // ── TAB 4: EPIDEMIOLÓGICO ──
            case 'dropoutEvolucion':
                return {
                    title: `Tasa de Abandono (Drop-out) de Esquemas`,
                    subtitle: `Pérdida de Seguimiento 1ª a 2ª Dosis (Comparativa Mujeres vs Hombres)`,
                    body: `
                        <div class="help-section">
                            <h4><i class="fas fa-person-walking-dashed-line-arrow-right text-primary"></i> 1. Significado Clínico y Epidemiológico del Drop-out</h4>
                            <div class="help-section-content">
                                <p>La tasa de deserción o abandono (<em>drop-out rate</em>) mide el porcentaje de personas que recibieron su 1ª dosis pero <strong>nunca completaron la 2ª dosis</strong> requerida en esquemas multidosis:</p>
                                <p style="background:rgba(239,68,68,0.08); padding:8px 12px; border-radius:6px; font-family:monospace; font-size:0.85rem;">
                                    Tasa Drop-out (%) = [(1ª Dosis &minus; 2ª Dosis) / 1ª Dosis] &times; 100
                                </p>
                                <p>Históricamente, un drop-out superior al <strong>10%</strong> indicaba fallas críticas en la continuidad del programa escolar o pérdida de seguimiento en el traspaso de 4° a 5° básico.</p>
                            </div>
                        </div>

                        <div class="help-grid">
                            <div class="help-box color-purple">
                                <h5><i class="fas fa-venus"></i> Mujeres vs Hombres</h5>
                                <p>Históricamente los varones experimentaron mayores tasas de drop-out en periodos de rescate escolar (ej. 2021-2022).</p>
                            </div>
                            <div class="help-box color-green">
                                <h5><i class="fas fa-shield-check"></i> Resolución con Monodosis</h5>
                                <p>Con la adopción de la Dosis Única en 2024, el drop-out se reduce estructuralmente al 0%, garantizando máxima eficiencia inmunológica.</p>
                            </div>
                        </div>
                    `
                };

            case 'vacunasTransicion':
                return {
                    title: `Transición de Biológicos: Gardasil 4 vs Gardasil 9`,
                    subtitle: `Ampliación de Valencias y Protección Oncogénica`,
                    body: `
                        <div class="help-section">
                            <h4><i class="fas fa-vial-circle-check text-primary"></i> 1. Evolución de la Protección Antigénica</h4>
                            <div class="help-section-content">
                                <p>Este gráfico documenta el reemplazo tecnológico de vacunas en la red asistencial:</p>
                                <ul>
                                    <li><strong>Gardasil 4 (Tetravalente):</strong> Protege contra 4 genotipos (6, 11, 16 y 18). Cubre ~70% de cánceres cervicouterinos y ~90% de verrugas genitales.</li>
                                    <li><strong>Gardasil 9 (Nonavalente):</strong> Incorpora 5 genotipos oncogénicos adicionales (31, 33, 45, 52 y 58). Eleva la protección al <strong>~90%</strong> de los cánceres cérvico-uterinos y previene un espectro mucho mayor de neoplasias intraepiteliales (NIE II/III).</li>
                                    <li><strong>Bivalente (Cervarix) / Otras:</strong> Uso residual o marginal (24 dosis en toda la historia provincial = 0.038%).</li>
                                </ul>
                            </div>
                        </div>
                    `
                };

            case 'tablaTopEstablecimientos':
                return {
                    title: `Producción de Vacunas por Centros de Salud`,
                    subtitle: `Nodos Productivos y Logística de la Red Asistencial`,
                    body: `
                        <div class="help-section">
                            <h4><i class="fas fa-hospital-user text-primary"></i> 1. Distribución de Carga Asistencial</h4>
                            <div class="help-section-content">
                                <p>Esta tabla clasifica los establecimientos de salud según su producción histórica acumulada de vacunas VPH administradas (2014–2026).</p>
                                <p>Permite analizar la concentración de Pareto: los grandes CESFAMs urbanos de Osorno (Marcelo Lopetegui, Dr. Pedro Jáuregui, Pampa Alger, Rahue Alto) concentran la mayor parte de la producción, mientras que hospitales comunitarios y postas rurales sostienen la equidad de acceso en localidades apartadas.</p>
                            </div>
                        </div>
                    `
                };

            case 'matrizEstablecimientos': {
                const comLabel = estabState.comuna === 'ALL' ? 'Provincia de Osorno' : (state.data?.metadata?.comunas?.[estabState.comuna] || 'Comuna seleccionada');
                const anoLabel = estabState.ano === 'ALL' ? 'Serie Histórica Consolidada (2014–2026)' : `Año de Administración ${estabState.ano}`;
                const rowsData = getFilteredMatrizEstablecimientos();
                const totalDosisSel = rowsData.reduce((s, r) => s + r.total, 0);
                const totalNonaSel = rowsData.reduce((s, r) => s + r.nona, 0);
                const totalTetraSel = rowsData.reduce((s, r) => s + r.tetra, 0);
                const totalUnicaSel = rowsData.reduce((s, r) => s + r.dosis_unica, 0);
                const pctNona = totalDosisSel > 0 ? ((totalNonaSel / totalDosisSel) * 100).toFixed(1) : '0.0';

                return {
                    title: `Matriz Territorial de Producción por Establecimiento (Ocurrencia)`,
                    subtitle: `${comLabel} • ${anoLabel}`,
                    body: `
                        <div class="help-section">
                            <h4><i class="fas fa-hospital text-primary"></i> 1. Dimensión Operativa y Nodos de Ocurrencia</h4>
                            <div class="help-section-content">
                                <p>Esta matriz técnica consolida la producción real de vacunas administradas por cada centro de salud de la red asistencial, independientemente de la comuna de residencia del paciente (criterio de ocurrencia pura).</p>
                                
                                <div class="help-kpis-bar">
                                    <div class="help-kpi-pill">
                                        <span class="kpi-lbl">Dosis Totales</span>
                                        <span class="kpi-num">${totalDosisSel.toLocaleString('es-CL')}</span>
                                    </div>
                                    <div class="help-kpi-pill">
                                        <span class="kpi-lbl">Establecimientos</span>
                                        <span class="kpi-num">${rowsData.length}</span>
                                    </div>
                                    <div class="help-kpi-pill">
                                        <span class="kpi-lbl">% Gardasil 9</span>
                                        <span class="kpi-num">${pctNona}%</span>
                                    </div>
                                    <div class="help-kpi-pill">
                                        <span class="kpi-lbl">Dosis Únicas</span>
                                        <span class="kpi-num">${totalUnicaSel.toLocaleString('es-CL')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="help-section">
                            <h4><i class="fas fa-network-wired text-primary"></i> 2. Análisis de Distribución y Capacidad de Red</h4>
                            <div class="help-section-content">
                                <p>Los datos permiten evaluar:</p>
                                <ul>
                                    <li><strong>Capacidad Resolutiva:</strong> Centros de Atención Primaria (CESFAMs) que lideran las campañas escolares anuales vs Hospitales de mediana/alta complejidad.</li>
                                    <li><strong>Transición Tecnológica en Terreno:</strong> Despliegue de Gardasil 9 (${totalNonaSel.toLocaleString('es-CL')} dosis) vs histórico Gardasil 4 (${totalTetraSel.toLocaleString('es-CL')} dosis).</li>
                                    <li><strong>Exportación de Datos:</strong> Puede descargar la matriz filtrada en formato Microsoft Excel institucional utilizando el botón superior.</li>
                                </ul>
                            </div>
                        </div>
                    `
                };
            }

            case 'hitosNormativos':
                return {
                    title: `Hitos Normativos y Evolución del Programa VPH (2014–2026)`,
                    subtitle: `Marco Regulatorio MINSAL • PNI • Respaldo Bibliográfico`,
                    body: `
                        <div class="help-section">
                            <h4><i class="fas fa-landmark text-primary"></i> 1. Trayectoria Normativa y Respaldo Oficial</h4>
                            <div class="help-section-content">
                                <p>Cada hito de esta línea de tiempo documenta las transformaciones normativas del Programa Nacional de Inmunizaciones de Chile desde su incorporación pionera en 2014.</p>
                                <p>Cada afirmación técnica incluye su respectivo <strong>respaldo bibliográfico y normativo</strong> (Decretos Exentos del MINSAL, Ordinarios Ministeriales, Recomendaciones CAVEI y Posicionamientos OMS) visibles en las tarjetas de cada año.</p>
                            </div>
                        </div>
                    `
                };

            case 'fichaMetodologica':
                return {
                    title: `Gobernanza del Dato y Ficha Técnica Oficial`,
                    subtitle: `Estándares Metodológicos MINSAL • DEIS • OMS`,
                    body: `
                        <div class="help-section">
                            <h4><i class="fas fa-certificate text-primary"></i> 1. Criterios de Rigor Metodológico</h4>
                            <div class="help-section-content">
                                <p>El Observatorio Epidemiológico VPH procesa microdatos oficiales con algoritmos estandarizados:</p>
                                <ul>
                                    <li><strong>Criterio de Residencia Provincial:</strong> Los indicadores se calculan según el lugar de residencia del usuario, no por el lugar de ocurrencia del centro de salud, reflejando el verdadero impacto en la población local.</li>
                                    <li><strong>Filtros Obligatorios:</strong> Exclusión de registros con <code>REGISTRO_ELIMINADO = SI</code>, y depuración estricta de registros clasificados como <code>EPRO</code> en criterio de elegibilidad o dosis.</li>
                                    <li><strong>Denominadores Vitales:</strong> Se utilizan estadísticas vitales de nacimientos y defunciones oficiales del DEIS, evitando las desviaciones de proyecciones demográficas estáticas.</li>
                                </ul>
                            </div>
                        </div>
                    `
                };

            default:
                return {
                    title: `Ayuda Interpretativa Epidemiológica`,
                    subtitle: `Observatorio Epidemiológico VPH • Servicio de Salud Osorno`,
                    body: `
                        <div class="help-section">
                            <p>Información analítica contextual para la interpretación de indicadores de vacunación contra el Virus del Papiloma Humano en la Provincia de Osorno.</p>
                        </div>
                    `
                };
        }
    }

    // Cargar la aplicación
    loadData();

    // =========================================================================
    // MÓDULO: AVANCE SEMANAL VPH ESCOLAR 2026 (Independiente)
    // =========================================================================
    let escolarRendered = false;

    function renderAvanceEscolar() {
        const d = window.AVANCE_ESCOLAR_VPH_DATA;
        if (!d) {
            console.warn('AVANCE_ESCOLAR_VPH_DATA no disponible');
            return;
        }

        // Populate dates
        const elFechaMax = document.getElementById('escolarFechaMax');
        const elUltimaSE = document.getElementById('escolarUltimaSE');
        const elGenerado = document.getElementById('escolarGenerado');
        if (elFechaMax) elFechaMax.textContent = d.kpis.fecha_datos_hasta || '—';
        if (elUltimaSE) elUltimaSE.textContent = (d.kpis.ultima_se || '—') + ' — avance parcial';
        if (elGenerado) elGenerado.textContent = d.metadata.timestamp_generacion || '—';

        // KPIs
        const fmt = n => n != null ? n.toLocaleString('es-CL') : '—';
        const fmtDec = n => n != null ? Number(n).toLocaleString('es-CL', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : '—';
        
        const elVac = document.getElementById('escolarVacunados');
        const elVacD = document.getElementById('escolarVacunadosDetail');
        if (elVac) elVac.textContent = fmt(d.kpis.vacunados_acumulados);
        if (elVacD) elVacD.textContent = `Meta MINEDUC: ${fmt(d.kpis.meta_provincial)}`;

        const elCob = document.getElementById('escolarCobertura');
        const elCobD = document.getElementById('escolarCoberturaDetail');
        if (elCob) elCob.textContent = fmtDec(d.kpis.cobertura_provincial) + '%';
        if (elCobD) elCobD.textContent = `${fmt(d.kpis.vacunados_acumulados)} / ${fmt(d.kpis.meta_provincial)}`;

        const elBrecha = document.getElementById('escolarBrecha');
        const elBrechaD = document.getElementById('escolarBrechaDetail');
        if (d.kpis.brecha_provincial > 0) {
            if (elBrecha) elBrecha.textContent = fmt(d.kpis.brecha_provincial);
            if (elBrechaD) elBrechaD.textContent = 'Alumnos por vacunar';
        } else {
            if (elBrecha) elBrecha.textContent = '0';
            if (elBrechaD) elBrechaD.textContent = `Meta superada en ${fmt(d.kpis.meta_superada)} registros`;
        }

        const elDosis = document.getElementById('escolarDosisSemana');
        const elDosisD = document.getElementById('escolarDosisSemanaDetail');
        if (elDosis) elDosis.textContent = fmt(d.kpis.dosis_ultima_semana);
        const ppSign = d.kpis.variacion_pp_ultima_semana >= 0 ? '+' : '';
        if (elDosisD) elDosisD.textContent = `${ppSign}${fmtDec(d.kpis.variacion_pp_ultima_semana)} pp vs semana anterior (parcial)`;

        // Comparison card
        const elCompGrid = document.getElementById('escolarComparacionGrid');
        if (elCompGrid && d.resumen_provincial) {
            const prov = d.resumen_provincial;
            const deltaClass = (prov.variacion_vs_3108_pp || 0) >= 0 ? 'positive' : 'negative';
            const deltaSign = (prov.variacion_vs_3108_pp || 0) >= 0 ? '+' : '';
            elCompGrid.innerHTML = `
                <div class="escolar-comp-item">
                    <div class="escolar-comp-label">Cobertura 31-08-2026</div>
                    <div class="escolar-comp-value">${prov.cobertura_3108 != null ? fmtDec(prov.cobertura_3108) + '%' : '—'}</div>
                </div>
                <div class="escolar-comp-item">
                    <div class="escolar-comp-label">Cobertura Actual</div>
                    <div class="escolar-comp-value">${fmtDec(prov.cobertura)}%</div>
                </div>
                <div class="escolar-comp-item">
                    <div class="escolar-comp-label">Variación (pp)</div>
                    <div class="escolar-comp-value ${deltaClass}">${deltaSign}${prov.variacion_vs_3108_pp != null ? fmtDec(prov.variacion_vs_3108_pp) : '—'} pp</div>
                </div>
            `;
        }

        // Ranking badges
        const elBadges = document.getElementById('escolarRankingBadges');
        if (elBadges) {
            elBadges.innerHTML = `
                <span class="escolar-badge mayor"><i class="fas fa-arrow-up"></i> Mayor avance: ${d.mayor_avance}</span>
                <span class="escolar-badge menor"><i class="fas fa-arrow-down"></i> Menor avance: ${d.menor_avance}</span>
            `;
        }

        // Ranking table
        const elBody = document.getElementById('escolarRankingBody');
        if (elBody && d.ranking_comunal) {
            let rows = '';
            for (const r of d.ranking_comunal) {
                const brechaText = r.brecha > 0 ? fmt(r.brecha) : `<span style="color:#10b981;font-weight:700">+${fmt(r.meta_superada)}</span>`;
                const deltaText = r.variacion_vs_3108_pp != null
                    ? `<span class="${r.variacion_vs_3108_pp >= 0 ? 'escolar-delta-positive' : 'escolar-delta-negative'}">${r.variacion_vs_3108_pp >= 0 ? '+' : ''}${fmtDec(r.variacion_vs_3108_pp)} pp</span>`
                    : '—';
                rows += `<tr>
                    <td>${r.posicion}</td>
                    <td>${r.comuna}</td>
                    <td>${fmt(r.vacunados)}</td>
                    <td>${fmt(r.meta)}</td>
                    <td><span style="font-weight: 600; color: #475569;">${fmtDec(r.cobertura)}%</span></td>
                    <td>${brechaText}</td>
                    <td>${r.cobertura_3108 != null ? fmtDec(r.cobertura_3108) + '%' : '—'}</td>
                    <td>${deltaText}</td>
                </tr>`;
            }
            // Provincial total row
            const prov = d.resumen_provincial;
            const provBrechaText = prov.brecha > 0 ? fmt(prov.brecha) : `<span style="color:#10b981;font-weight:700">+${fmt(prov.meta_superada)}</span>`;
            const provDelta = prov.variacion_vs_3108_pp != null
                ? `<span class="${prov.variacion_vs_3108_pp >= 0 ? 'escolar-delta-positive' : 'escolar-delta-negative'}">${prov.variacion_vs_3108_pp >= 0 ? '+' : ''}${fmtDec(prov.variacion_vs_3108_pp)} pp</span>`
                : '—';
            rows += `<tr style="background:rgba(15,105,180,0.06);font-weight:700">
                <td></td>
                <td>TOTAL PROVINCIAL</td>
                <td>${fmt(prov.vacunados)}</td>
                <td>${fmt(prov.meta)}</td>
                <td><span style="font-weight: 700; color: #0f69b4;">${fmtDec(prov.cobertura)}%</span></td>
                <td>${provBrechaText}</td>
                <td>${prov.cobertura_3108 != null ? fmtDec(prov.cobertura_3108) + '%' : '—'}</td>
                <td>${provDelta}</td>
            </tr>`;
            elBody.innerHTML = rows;
        }

        // Charts (only render once)
        if (escolarRendered) return;
        escolarRendered = true;

        // Chart 1: Weekly temporal curve
        const ctxTemporal = document.getElementById('chartEscolarTemporal');
        if (ctxTemporal && d.serie_semanal_provincial) {
            const serie = d.serie_semanal_provincial;
            const labels = serie.map(s => s.semana);
            const cobData = serie.map(s => s.cobertura_acumulada);
            const dosisData = serie.map(s => s.dosis_semana);

            new Chart(ctxTemporal, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Cobertura Acumulada (%)',
                            data: cobData,
                            borderColor: '#7c3aed',
                            backgroundColor: 'rgba(124, 58, 237, 0.08)',
                            fill: true,
                            tension: 0.3,
                            pointRadius: 3,
                            pointHoverRadius: 6,
                            borderWidth: 2.5,
                            yAxisID: 'y',
                        },
                        {
                            label: 'Dosis por Semana',
                            data: dosisData,
                            borderColor: '#f59e0b',
                            backgroundColor: 'rgba(245, 158, 11, 0.5)',
                            type: 'bar',
                            yAxisID: 'y1',
                            barThickness: 12,
                            borderRadius: 3,
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { position: 'top', labels: { usePointStyle: true, padding: 15, font: { size: 11 } } },
                        tooltip: {
                            callbacks: {
                                afterBody: function(context) {
                                    const idx = context[0].dataIndex;
                                    const s = serie[idx];
                                    return `Acumulados: ${s.vacunados_acumulados.toLocaleString('es-CL')}\nBrecha: ${s.brecha.toLocaleString('es-CL')}\nΔ: ${s.variacion_pp >= 0 ? '+' : ''}${s.variacion_pp} pp`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            position: 'left',
                            title: { display: true, text: 'Cobertura (%)', font: { size: 11, weight: 'bold' } },
                            min: 0,
                            max: 100,
                            grid: { color: 'rgba(0,0,0,0.05)' },
                        },
                        y1: {
                            position: 'right',
                            title: { display: true, text: 'Dosis/Semana', font: { size: 11, weight: 'bold' } },
                            grid: { drawOnChartArea: false },
                            min: 0,
                        },
                        x: {
                            grid: { display: false },
                            ticks: { font: { size: 10 }, maxRotation: 45 }
                        }
                    }
                }
            });
        }

        // Chart 2: Horizontal bar chart by comuna
        const ctxComunas = document.getElementById('chartEscolarComunas');
        if (ctxComunas && d.ranking_comunal) {
            const comunas = d.ranking_comunal.map(r => r.comuna);
            const coberturas = d.ranking_comunal.map(r => r.cobertura);
            const colores = coberturas.map(c => c >= 90 ? '#10b981' : (c >= 70 ? '#f59e0b' : '#ef4444'));

            new Chart(ctxComunas, {
                type: 'bar',
                data: {
                    labels: comunas,
                    datasets: [{
                        label: 'Cobertura (%)',
                        data: coberturas,
                        backgroundColor: colores.map(c => c + '33'),
                        borderColor: colores,
                        borderWidth: 2,
                        borderRadius: 6,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                afterLabel: function(context) {
                                    const r = d.ranking_comunal[context.dataIndex];
                                    return `${r.vacunados.toLocaleString('es-CL')} / ${r.meta.toLocaleString('es-CL')}\nBrecha: ${r.brecha.toLocaleString('es-CL')}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            min: 0,
                            max: 100,
                            title: { display: true, text: 'Cobertura (%)', font: { size: 11, weight: 'bold' } },
                            grid: { color: 'rgba(0,0,0,0.05)' },
                        },
                        y: {
                            grid: { display: false },
                            ticks: { font: { size: 12, weight: '600' } }
                        }
                    }
                }
            });
        }
    }
});

