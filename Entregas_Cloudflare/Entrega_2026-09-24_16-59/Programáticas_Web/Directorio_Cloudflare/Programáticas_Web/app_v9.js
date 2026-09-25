/* ══════════════════════════════════════════════════════════════════════════════
   Dashboard Programáticas 2026 · App Logic
   ══════════════════════════════════════════════════════════════════════════════ */

// eslint-disable-next-line no-undef
const DATA_BY_YEAR = { '2025': PROGRAMATICAS_DATA_2025, '2026': PROGRAMATICAS_DATA_2026 };
let currentYear = '2026';
let DATA = DATA_BY_YEAR[currentYear];

const COMUNAS = ["Osorno", "Puerto Octay", "Purranque", "Puyehue", "Río Negro", "San Juan de la Costa", "San Pablo"];

// Normalize incoming data to ensure exact matching with COMUNAS array (fixes "San Juan De La Costa" casing issue)
Object.values(DATA_BY_YEAR).forEach(yData => {
    const normalize = c => COMUNAS.find(com => com.toLowerCase() === (c || '').toLowerCase()) || c;
    if (yData.data_residencia) yData.data_residencia.forEach(d => d.comuna = normalize(d.comuna));
    if (yData.data_ocurrencia) yData.data_ocurrencia.forEach(d => d.comuna = normalize(d.comuna));
});

const VACCINE_LABELS = {
    'BCG': 'BCG', 'BEXSERO': 'Bexsero', 'BEXSERO1D': 'Bexsero 1ᵃ', 'BEXSERO1R': 'Bexsero Ref.',
    'BEXSERO2D': 'Bexsero 2ᵃ', 'HEXA': 'Hexavalente', 'HEXA1D': 'Hexa 1ᵃ', 'HEXA2D': 'Hexa 2ᵃ',
    'HEXA3D': 'Hexa 3ᵃ', 'HEXA1R': 'Hexa Ref.', 'HepA': 'Hep. A', 'HepB': 'Hep. B', 'MENINGO': 'Meningocócica',
    'NEUMO': 'Neumocócica', 'NEUMO1D': 'Neumo 1ᵃ', 'NEUMO1R': 'Neumo Ref.', 'NEUMO23': 'Neumo 23V', 'NEUMO2D': 'Neumo 2ᵃ',
    'SRP': 'SRP', 'SRP1D': 'SRP 1ᵃ', 'SRP2D': 'SRP 2ᵃ', 'VARICELA': 'Varicela', 'VARICELA1D': 'Varicela 1ᵃ',
    'VARICELA2D': 'Varicela 2ᵃ', 'VPH': 'VPH', 'dTpa': 'dTpa'
};

const PALETTE = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#14b8a6', '#ec4899', '#f97316', '#06b6d4', '#84cc16',
    '#6366f1', '#d946ef', '#0ea5e9', '#22c55e', '#eab308',
    '#a855f7', '#e11d48', '#0d9488'
];

const COMUNA_COLORS = {};
COMUNAS.forEach((c, i) => COMUNA_COLORS[c] = PALETTE[i % PALETTE.length]);

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

let chartInstances = {};
let currentComuna = 'all';

// ── Utility ──────────────────────────────────────────────────────────────────
function fmt(n) {
    return n.toLocaleString('es-CL');
}

function pct(val, total) {
    if (!total || total === 0) return 0;
    return val / total;
}

function pctStr(val, total) {
    const p = pct(val, total) * 100;
    return p.toFixed(1) + '%';
}

function getLabel(key) {
    return VACCINE_LABELS[key] || key;
}

// Custom sort function to chronologically sort vaccines instead of alphabetically
function sortVacunas(a, b) {
    const getBaseAndSuffix = (vac) => {
        const match = vac.match(/^(.*?)(1D|2D|3D|1R|2R|23|UNICA)?$/);
        return match ? { base: match[1], suffix: match[2] || '' } : { base: vac, suffix: '' };
    };
    const parsedA = getBaseAndSuffix(a);
    const parsedB = getBaseAndSuffix(b);

    const epiOrder = ['BCG', 'HEXA', 'NEUMO', 'BEXSERO', 'MENINGO', 'SRP', 'VARICELA', 'HepA', 'HepB', 'dTpa', 'VPH'];
    
    let baseOrderA = epiOrder.indexOf(parsedA.base);
    let baseOrderB = epiOrder.indexOf(parsedB.base);
    
    if (baseOrderA === -1) baseOrderA = 999;
    if (baseOrderB === -1) baseOrderB = 999;

    if (baseOrderA !== baseOrderB) {
        return baseOrderA - baseOrderB;
    }

    if (parsedA.base !== parsedB.base) {
        return parsedA.base.localeCompare(parsedB.base);
    }

    const order = { '': 0, '1D': 1, '2D': 2, '3D': 3, '1R': 4, '2R': 5, '23': 6, 'UNICA': 7 };
    const valA = order[parsedA.suffix] !== undefined ? order[parsedA.suffix] : 99;
    const valB = order[parsedB.suffix] !== undefined ? order[parsedB.suffix] : 99;
    
    return valA - valB;
}

function destroyChart(id) {
    if (chartInstances[id]) {
        chartInstances[id].destroy();
        delete chartInstances[id];
    }
}

function heatColor(ratio) {
    if (ratio >= 1.5) return '#064e3b'; // Very high surplus (Dark Emerald)
    if (ratio >= 1.2) return '#047857'; // High surplus (Medium Emerald)
    if (ratio >= 1.0) return '#059669'; // Met goal
    if (ratio >= 0.85) return '#10b981';
    if (ratio >= 0.7) return '#34d399';
    if (ratio >= 0.5) return '#f59e0b';
    if (ratio >= 0.3) return '#f97316';
    if (ratio > 0) return '#ef4444';
    return '#94a3b8'; // 0 or N/A
}

// ── Data Aggregation ─────────────────────────────────────────────────────────

function getAggregatedResidenciaByComuna(comuna) {
    const items = DATA.data_residencia.filter(d => d.comuna === comuna);
    if (!items.length) return null;
    const aggregated = { comuna, datos: {} };
    items.forEach(item => {
        Object.keys(item.datos).forEach(v => {
            aggregated.datos[v] = (aggregated.datos[v] || 0) + item.datos[v];
        });
    });
    return aggregated;
}

function getResidenciaForComuna(comuna) {
    if (comuna === 'all') {
        // Sum all comunas
        const totals = {};
        DATA.headers.forEach(v => totals[v] = 0);
        DATA.data_residencia.forEach(item => {
            DATA.headers.forEach(v => {
                totals[v] += (item.datos[v] || 0);
            });
        });
        return totals;
    }
    const item = getAggregatedResidenciaByComuna(comuna);
    return item ? item.datos : {};
}

function getMetasForComuna(comuna) {
    if (comuna === 'all') {
        const totals = {};
        Object.values(DATA.metas).forEach(m => {
            Object.entries(m.Criterios || {}).forEach(([k, v]) => {
                totals[k] = (totals[k] || 0) + v;
            });
        });
        return totals;
    }
    const m = DATA.metas[comuna];
    return m ? (m.Criterios || {}) : {};
}

function getOcurrenciaFiltered(comuna) {
    if (comuna === 'all') return DATA.data_ocurrencia;
    return DATA.data_ocurrencia.filter(d => d.comuna === comuna);
}

// ── Year Switching (like Influenza dashboard) ────────────────────────────────
function switchYear(year) {
    if (year === currentYear) return;
    currentYear = year;
    DATA = DATA_BY_YEAR[currentYear];

    // Update toggle button styling (header + production tab)
    document.getElementById('btnYear2025').classList.toggle('active', year === '2025');
    document.getElementById('btnYear2026').classList.toggle('active', year === '2026');
    const prod2025 = document.getElementById('btnYear2025Prod');
    const prod2026 = document.getElementById('btnYear2026Prod');
    if (prod2025) prod2025.classList.toggle('active', year === '2025');
    if (prod2026) prod2026.classList.toggle('active', year === '2026');

    // Cambiar texto de dTpa dinámicamente según el año
    const dtpa1 = document.getElementById('dtpa-1b');
    const dtpa8 = document.getElementById('dtpa-8b');
    if (dtpa1 && dtpa8) {
        // En 2025: 1ra y 2da dosis. En 2026: Refuerzo y Refuerzo.
        const text1 = year === '2025' ? '1ra<br>dosis' : 'Refuerzo';
        const text2 = year === '2025' ? '2da<br>dosis' : 'Refuerzo';
        
        // El texto puede estar dentro de un span .dose-label si el calendario ya se inicializó
        const label1 = dtpa1.querySelector('.dose-label') || dtpa1;
        const label2 = dtpa8.querySelector('.dose-label') || dtpa8;
        label1.innerHTML = text1;
        label2.innerHTML = text2;
    }

    // Update dynamic subtitle
    const matrizYearTitle = document.getElementById('matrizYearTitle');
    if (matrizYearTitle) {
        matrizYearTitle.textContent = `(BASE OCURRENCIA ${year})`;
    }

    // Update header badge
    const badge = document.getElementById('headerYearBadge');
    if (badge) badge.textContent = currentYear;

    // Update footer year
    const footerYear = document.getElementById('footerYear');
    if (footerYear) footerYear.textContent = currentYear;

    // Update report date
    const reportDate = document.getElementById('reportDate');
    const isCobertura = document.querySelector('.tab-btn[data-tab="cobertura"]').classList.contains('active');
    if (reportDate) {
        if (isCobertura) {
            reportDate.innerText = `Fuente: DEIS-MINSAL, Fecha de corte: ${DATA.fecha_actualizacion} (Base Residencia)`;
        } else {
            reportDate.innerText = year === '2025' ? `Fuente: Archivos Híbridos (Ocurrencia + Residencia) | Fecha de corte: 31/12/2025` : `Fuente: Archivos Híbridos (Ocurrencia + Residencia) | Fecha de corte: ${DATA.fecha_actualizacion}`;
        }
    }

    // Update fecha de corte options
    const fechaCorteSelect = document.getElementById('matrizFechaCorteSelect');
    if (fechaCorteSelect) {
        if (year === '2025') {
            fechaCorteSelect.innerHTML = '<option value="all">Cierre Final (31/12/2025)</option>';
        } else {
            let soloFecha = DATA.fecha_actualizacion ? DATA.fecha_actualizacion.split(' ')[0] : 'Actual';
            fechaCorteSelect.innerHTML = `
                <option value="all">Actual (${soloFecha})</option>
                <option value="3">Cierre Marzo (31/03/2026)</option>
                <option value="4">Cierre Abril (30/04/2026)</option>
                <option value="5">Cierre Mayo (31/05/2026)</option>
                <option value="6">Cierre Junio (30/06/2026)</option>
                <option value="7">Cierre Julio (31/07/2026)</option>
            `;
        }
    }

    // Update badge dinámicamente según año y pestaña activa
    const epiBadge = document.getElementById('epiBadge');
    if (epiBadge) {
        if (isCobertura) {
            epiBadge.textContent = year === '2025' ? 'CIERRE ANUAL' : '1° TRIM.';
            epiBadge.style.backgroundColor = year === '2025' ? '#6366f1' : '#ef4444';
        } else {
            epiBadge.textContent = year === '2025' ? 'CIERRE ANUAL' : 'DATOS RECIENTES';
            epiBadge.style.backgroundColor = year === '2025' ? '#6366f1' : '#10b981';
        }
    }

    // Update nota de producción dinámicamente
    const notaProduccion = document.querySelector('#tab-produccion .info-alert');
    if (notaProduccion) {
        if (year === '2025') {
            notaProduccion.innerHTML = `
                <strong><i class="fas fa-info-circle"></i> Nota de Ocurrencia (Producción) - CIERRE 31/12/2025:</strong> 
                Esta sección refleja la <b>producción bruta</b> (total de dosis administradas en el establecimiento) para la campaña 2025 (año cerrado), independientemente de la comuna de residencia del paciente.`;
        } else {
            let soloFecha = DATA.fecha_actualizacion ? DATA.fecha_actualizacion.split(' ')[0] : '';
            notaProduccion.innerHTML = `
                <strong><i class="fas fa-info-circle"></i> Nota de Ocurrencia (Producción) - CORTE AL ${soloFecha}:</strong> 
                Esta sección refleja la <b>producción bruta</b> (total de dosis administradas en el establecimiento), independientemente de la comuna de residencia del paciente. Los datos no corresponden al corte de marzo, sino a la fecha de extracción de la base de datos (${soloFecha}).`;
        }
    }

    // Update badges estáticos de cobertura
    const cobertBadges = document.querySelectorAll('#tab-cobertura .card-badge');
    cobertBadges.forEach(badge => {
        if (badge.textContent.includes('Trimestre') || badge.textContent.includes('Anual')) {
            badge.textContent = badge.textContent.replace(
                /Avance 1° Trimestre|Cierre Anual 2025/g, 
                year === '2025' ? 'Cierre Anual 2025' : 'Avance 1° Trimestre'
            );
        }
    });

    try {
        // Update dynamic filters (like months) based on new year's data
        window.populateDynamicFilters();

        // Re-render everything
        renderAll();
    } catch (err) {
        if (matrizYearTitle) matrizYearTitle.textContent = "ERROR: " + err.message;
        console.error(err);
    }
}

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Set date
    document.getElementById('reportDate').innerText = 
        `Fuente: Archivos Híbridos (Ocurrencia + Residencia) | Fecha de corte: ${DATA.fecha_actualizacion}`;



    // Populate comuna filter
    const sel = document.getElementById('globalComunaFilter');
    COMUNAS.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        sel.appendChild(opt);
    });
    sel.addEventListener('change', () => {
        currentComuna = sel.value;
        renderAll();
    });

    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            const tabId = btn.dataset.tab;
            document.getElementById('tab-' + tabId).classList.add('active');
            
            // Dynamic Date Update for Ocurrencia vs Residencia
            const reportDate = document.getElementById('reportDate');
            const epiBadge = document.getElementById('epiBadge');
            
            document.querySelectorAll('.interactive-only').forEach(el => {
                if (tabId === 'calendario') el.style.display = 'inline-block';
                else el.style.display = 'none';
            });
            
            if (tabId === 'cobertura') {
                if (reportDate) reportDate.innerText = `Fuente: DEIS-MINSAL, Fecha de corte: ${DATA.fecha_actualizacion} (Base Residencia)`;
                if (epiBadge) {
                    epiBadge.textContent = currentYear === '2025' ? 'CIERRE ANUAL' : '1° TRIM.';
                    epiBadge.style.backgroundColor = currentYear === '2025' ? '#6366f1' : '#ef4444';
                }
            } else { // produccion or matriz (Ocurrencia)
                if (reportDate) reportDate.innerText = currentYear === '2025' 
                    ? `Fuente: Archivos Híbridos (Ocurrencia + Residencia) | Fecha de corte: 31/12/2025` 
                    : `Fuente: Archivos Híbridos (Ocurrencia + Residencia) | Fecha de corte: 20/08/2026`;
                if (epiBadge) {
                    epiBadge.textContent = currentYear === '2025' ? 'CIERRE ANUAL' : 'DATOS RECIENTES';
                    epiBadge.style.backgroundColor = currentYear === '2025' ? '#6366f1' : '#10b981';
                }
            }

            // Re-render charts on tab switch for proper sizing
            setTimeout(() => renderAll(), 50);
        });
    });

    // Theme toggle
    document.getElementById('themeToggleBtn').addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        document.documentElement.setAttribute('data-theme', isDark ? '' : 'dark');
        const icon = document.querySelector('#themeToggleBtn i');
        icon.className = isDark ? 'fas fa-moon' : 'fas fa-sun';
        // Re-render for color updates
        setTimeout(() => renderAll(), 100);
    });

    // Search: la lógica completa está en populateDynamicFilters (listener único)
    // No agregar un segundo listener aquí para evitar doble renderización.

// ── Matriz Filters ──
function setupMultiSelect(optionsListId, selectAllId, multiSelectId, defaultText, emptyText, dataList, valueFn, labelFn, previouslySelectedValues = null) {
    const optionsList = document.getElementById(optionsListId);
    if (!optionsList) return;

    // Clear previous options for re-initialization
    optionsList.innerHTML = '';

    dataList.forEach(item => {
        const val = valueFn(item);
        const label = labelFn(item);
        
        const isChecked = previouslySelectedValues ? previouslySelectedValues.includes(val) : true;
        const labelEl = document.createElement('label');
        labelEl.innerHTML = `<input type="checkbox" value="${val}" class="${optionsListId}-cb" ${isChecked ? 'checked' : ''}> ${label}`;
        optionsList.appendChild(labelEl);
    });

    // Re-create selectAll checkbox to remove old event listeners
    const oldSelectAllCb = document.getElementById(selectAllId);
    const selectAllCb = oldSelectAllCb.cloneNode(true);
    oldSelectAllCb.parentNode.replaceChild(selectAllCb, oldSelectAllCb);
    
    // Hide "Select All" if there's only 1 option
    if (dataList.length === 1) {
        selectAllCb.parentNode.style.display = 'none';
    } else {
        selectAllCb.parentNode.style.display = '';
    }
    
    // Also re-create the multiSelect container to remove old click outside listeners if any
    // Actually, document click listener is safe to keep global, but let's ensure we don't add multiple.
    if (!optionsList.dataset.initialized) {
        document.addEventListener('click', (e) => {
            const container = document.getElementById(multiSelectId);
            if (container && !container.contains(e.target)) {
                container.classList.remove('open');
            }
        });
        optionsList.dataset.initialized = 'true';
    }

    const cbs = document.querySelectorAll(`.${optionsListId}-cb`);
    
    selectAllCb.addEventListener('change', (e) => {
        cbs.forEach(cb => cb.checked = e.target.checked);
        updateSelectText();
        renderTableProduccion();
    });

    cbs.forEach(cb => {
        cb.addEventListener('change', () => {
            selectAllCb.checked = Array.from(cbs).every(c => c.checked);
            updateSelectText();
            renderTableProduccion();
        });
    });
    
    function updateSelectText() {
        const selectedCount = Array.from(cbs).filter(c => c.checked).length;
        const textSpan = document.querySelector(`#${multiSelectId} .selected-text`);
        if (dataList.length === 1) {
            textSpan.textContent = selectedCount === 1 ? labelFn(dataList[0]) : emptyText;
        } else {
            if (selectedCount === cbs.length) textSpan.textContent = defaultText;
            else if (selectedCount === 0) textSpan.textContent = emptyText;
            else textSpan.textContent = `${selectedCount} seleccionados`;
        }
    }
    
    // Set initial text
    updateSelectText();
}

window.populateDynamicFilters = function() {
    const getBaseVacunaName = vac => vac.replace(/(1D|2D|3D|1R|UNICA)$/, '');
    const vacunasBases = [...new Set(DATA.headers.map(getBaseVacunaName))];
    setupMultiSelect('vacunaBaseOptionsList', 'vacunaBaseSelectAll', 'matrizVacunaBaseMultiSelect', 'Todas las Vacunas', 'Ninguna', vacunasBases, v => v, v => getLabel(v));

    setupMultiSelect('comunaOptionsList', 'comunaSelectAll', 'matrizComunaMultiSelect', 'Todas las Comunas', 'Ninguna', COMUNAS, c => c, c => c);
    
    const updateDependentFilters = () => {
        // 1. Obtener filtros actuales
        const comunaCbs = document.querySelectorAll('.comunaOptionsList-cb');
        let selectedComunas = [];
        if (comunaCbs.length > 0) {
            selectedComunas = Array.from(comunaCbs).filter(c => c.checked).map(c => c.value);
        } else {
            selectedComunas = COMUNAS;
        }

        const estabQuery = (document.getElementById('searchEstab')?.value || '').toLowerCase();

        const vacunaCbs = document.querySelectorAll('.vacunaBaseOptionsList-cb');
        let selectedVacunas = [];
        if (vacunaCbs.length > 0) {
            selectedVacunas = Array.from(vacunaCbs).filter(c => c.checked).map(c => c.value);
        } else {
            selectedVacunas = vacunasBases; // default if not found
        }
        
        const criterioCbs = document.querySelectorAll('.criterioOptionsList-cb');
        let selectedCriterios = null; // null means we don't have previous state yet or want to preserve it
        if (criterioCbs.length > 0) {
            selectedCriterios = Array.from(criterioCbs).filter(c => c.checked).map(c => c.value);
        }

        const dosisCbs = document.querySelectorAll('.dosisOptionsList-cb');
        let selectedDosisPrev = null;
        if (dosisCbs.length > 0) {
            selectedDosisPrev = Array.from(dosisCbs).filter(c => c.checked).map(c => c.value);
        }

        // 2. Filtrar data_ocurrencia por Comuna y Establecimiento
        const filteredByTerritory = DATA.data_ocurrencia.filter(d => {
            const matchesComuna = selectedComunas.includes(d.comuna);
            const matchesEstab = d.establecimiento.toLowerCase().includes(estabQuery);
            return matchesComuna && matchesEstab;
        });

        // 3. Obtener Vacunas válidas para este territorio
        let validVacunasBase = new Set();
        filteredByTerritory.forEach(d => {
            Object.keys(d.datos).forEach(fullVacName => {
                validVacunasBase.add(getBaseVacunaName(fullVacName));
            });
        });
        
        const sortedValidVacunas = [...validVacunasBase].sort((a,b) => a.localeCompare(b));
        setupMultiSelect('vacunaBaseOptionsList', 'vacunaBaseSelectAll', 'matrizVacunaBaseMultiSelect', 'Todas las Vacunas', 'Ninguna', sortedValidVacunas, v => v, v => getLabel(v), selectedVacunas);
        
        // Listeners para las nuevas vacunas
        const newVacunaCbs = document.querySelectorAll('.vacunaBaseOptionsList-cb');
        newVacunaCbs.forEach(cb => cb.addEventListener('change', updateDependentFilters));
        const vacunaSelectAll = document.getElementById('vacunaBaseSelectAll');
        if (vacunaSelectAll) vacunaSelectAll.addEventListener('change', updateDependentFilters);

        // 4. Actualizar validVacunas según lo seleccionado AHORA
        const updatedVacunaCbs = document.querySelectorAll('.vacunaBaseOptionsList-cb');
        let currentSelectedVacunas = Array.from(updatedVacunaCbs).filter(c => c.checked).map(c => c.value);

        // 5. Obtener Criterios y Dosis válidos para este territorio y estas vacunas
        let validCriterios = new Set();
        let validDosis = new Set();
        
        filteredByTerritory.forEach(d => {
            let hasValidVacuna = false;
            Object.keys(d.datos).forEach(fullVacName => {
                const base = getBaseVacunaName(fullVacName);
                if (currentSelectedVacunas.includes(base)) {
                    hasValidVacuna = true;
                    if (fullVacName.endsWith('1D')) validDosis.add('1D');
                    else if (fullVacName.endsWith('2D')) validDosis.add('2D');
                    else if (fullVacName.endsWith('3D')) validDosis.add('3D');
                    else if (fullVacName.endsWith('1R')) validDosis.add('1R');
                    else validDosis.add('UNICA');
                }
            });
            if (hasValidVacuna) {
                validCriterios.add(d.criterio);
            }
        });
        
        const sortedCriterios = [...validCriterios].sort();
        setupMultiSelect('criterioOptionsList', 'criterioSelectAll', 'matrizCriterioMultiSelect', 'Todos los Criterios', 'Ninguno', sortedCriterios, c => c, c => c, selectedCriterios);
        
        const DOSIS_ALL = [
            { value: '1D', label: '1ª Dosis' },
            { value: '2D', label: '2ª Dosis' },
            { value: '3D', label: '3ª Dosis' },
            { value: '1R', label: 'Refuerzo' },
            { value: 'UNICA', label: 'Dosis Única / Otros' }
        ];
        const filteredDosis = DOSIS_ALL.filter(d => validDosis.has(d.value));
        setupMultiSelect('dosisOptionsList', 'dosisSelectAll', 'matrizDosisMultiSelect', 'Todas las Dosis', 'Ninguna', filteredDosis, d => d.value, d => d.label, selectedDosisPrev);
    };

    // Los listeners de Vacuna se asignan en updateDependentFilters
    // Necesitamos listeners para Comuna y searchEstab
    const comunaSelectAll = document.getElementById('comunaSelectAll');
    if (comunaSelectAll) {
        comunaSelectAll.addEventListener('change', updateDependentFilters);
    }
    const comunaCbs = document.querySelectorAll('.comunaOptionsList-cb');
    comunaCbs.forEach(cb => {
        cb.addEventListener('change', updateDependentFilters);
    });

    const searchEstabInput = document.getElementById('searchEstab');
    if (searchEstabInput) {
        searchEstabInput.addEventListener('input', () => {
            updateDependentFilters();
            // renderTableProduccion is called by the other listener above, or we can just call it here to be safe
            renderTableProduccion();
        });
    }

    // Run once on load
    updateDependentFilters();
    
    // Note: FECHA DE CORTE is now a native <select>, we don't need setupMultiSelect for it
    const fechaCorteSelect = document.getElementById('matrizFechaCorteSelect');
    if (fechaCorteSelect) {
        fechaCorteSelect.addEventListener('change', renderTableProduccion);
    }
}

    // Export to Excel simple function
    const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    function getMesName(m) {
        return nombresMeses[m - 1] || "Desconocido";
    }

    const btnExcel = document.getElementById('btnExportExcel');
    if (btnExcel) {
        btnExcel.addEventListener('click', () => {
            if (typeof XLSX === 'undefined') {
                alert("La librería de exportación a Excel está cargando. Por favor, intente nuevamente en unos segundos.");
                return;
            }

            const fechaCorteSelect = document.getElementById('matrizFechaCorteSelect');
            let textoCorte = "No definido";
            let mesesSeleccionados = DATA.meses_base || [];
            if (fechaCorteSelect) {
                textoCorte = fechaCorteSelect.options[fechaCorteSelect.selectedIndex].text;
                if (fechaCorteSelect.value !== 'all') {
                    const maxMes = parseInt(fechaCorteSelect.value);
                    mesesSeleccionados = mesesSeleccionados.filter(m => m <= maxMes);
                }
            }

            const ws_data = [];
            
            // Header information
            ws_data.push([]); // Row 1
            ws_data.push([`REPORTE PROGRAMÁTICAS ${currentYear}`]); // Row 2
            ws_data.push(["Servicio de Salud Osorno"]); // Row 3
            ws_data.push(["Reporte por Ocurrencia"]); // Row 4
            ws_data.push([]); // Row 5
            ws_data.push(["INFORMACIÓN DEL REPORTE"]); // Row 6
            ws_data.push(["- Comuna:", currentComuna === 'all' ? 'Todas' : currentComuna]); // Row 7
            ws_data.push(["- Periodo Informado:", "Campaña Anual " + currentYear]); // Row 8
            ws_data.push(["- Filtro Fecha de Corte:", textoCorte]); // Row 9
            ws_data.push(["- Fuente:", "DEIS - MINSAL"]); // Row 10
            ws_data.push(["- Fecha de Actualización:", textoCorte]); // Row 11
            ws_data.push([]); // Row 12
            
            // Criterios filter
            const criterioCbs = document.querySelectorAll('.criterioOptionsList-cb');
            let criterios = [];
            if (criterioCbs.length > 0) {
                criterios = Array.from(criterioCbs).filter(c => c.checked).map(c => c.value);
            } else {
                criterios = [...new Set(DATA.data_ocurrencia.map(d => d.criterio))];
            }

            // Generate data rows
            const comunas = currentComuna === 'all' ? COMUNAS : [currentComuna];
            const filteredRaw = DATA.data_ocurrencia.filter(d => comunas.includes(d.comuna) && criterios.includes(d.criterio));
            
            // Aggregate by comuna and establecimiento to combine criteria
            const aggregated = {};
            filteredRaw.forEach(d => {
                const key = `${d.comuna}|${d.establecimiento}`;
                if (!aggregated[key]) {
                    aggregated[key] = { comuna: d.comuna, establecimiento: d.establecimiento, datos: {} };
                }
                Object.keys(d.datos).forEach(v => {
                    if (!aggregated[key].datos[v]) aggregated[key].datos[v] = {};
                    Object.keys(d.datos[v]).forEach(m => {
                        aggregated[key].datos[v][m] = (aggregated[key].datos[v][m] || 0) + d.datos[v][m];
                    });
                });
            });
            const filtered = Object.values(aggregated);
            
            const vacunas = [...new Set(filtered.flatMap(d => Object.keys(d.datos)))].sort(sortVacunas);
            
            // Table Headers
            const headers = ["Comuna", "Establecimiento", ...vacunas.map(v => getLabel(v)), "Total"];
            ws_data.push(headers);
            
            // Group by comuna
            const byComuna = {};
            filtered.forEach(item => {
                if (!byComuna[item.comuna]) byComuna[item.comuna] = [];
                byComuna[item.comuna].push(item);
            });

            const grandTotal = {};
            vacunas.forEach(v => grandTotal[v] = 0);
            let grandTotalAll = 0;

            Object.keys(byComuna).sort().forEach(com => {
                const items = byComuna[com].map(item => {
                    let recalcTotal = 0;
                    vacunas.forEach(v => {
                        const mesData = item.datos[v] || {};
                        Object.keys(mesData).forEach(mStr => {
                            if (mesesSeleccionados.includes(parseInt(mStr))) recalcTotal += mesData[mStr];
                        });
                    });
                    return { ...item, recalcTotal };
                }).sort((a, b) => b.recalcTotal - a.recalcTotal);

                const comunaTotal = {};
                vacunas.forEach(v => comunaTotal[v] = 0);
                let comunaTotalAll = 0;

                items.forEach(item => {
                    const rowData = [com, item.establecimiento];
                    let rowTotalAll = 0;
                    
                    vacunas.forEach(v => {
                        const mesData = item.datos[v] || {};
                        let val = 0;
                        Object.keys(mesData).forEach(mStr => {
                            if (mesesSeleccionados.includes(parseInt(mStr))) {
                                val += mesData[mStr];
                            }
                        });
                        
                        comunaTotal[v] += val;
                        grandTotal[v] += val;
                        rowTotalAll += val;
                        rowData.push(val);
                    });
                    
                    comunaTotalAll += rowTotalAll;
                    grandTotalAll += rowTotalAll;
                    rowData.push(rowTotalAll);
                    ws_data.push(rowData);
                });

                // Subtotal row
                const subtotalRow = ["", `Subtotal ${com}`];
                vacunas.forEach(v => subtotalRow.push(comunaTotal[v]));
                subtotalRow.push(comunaTotalAll);
                ws_data.push(subtotalRow);
            });

            // Grand total
            const grandTotalRow = ["TOTALES", "TOTAL PROVINCIAL"];
            vacunas.forEach(v => grandTotalRow.push(grandTotal[v]));
            grandTotalRow.push(grandTotalAll);
            ws_data.push(grandTotalRow);

            // Create worksheet
            // Rellenar celdas alrededor de la tabla para ocultar cuadrícula de Excel
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
            
            // Merges
            ws['!merges'] = [
                { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }, // Title
                { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } },
                { s: { r: 3, c: 0 }, e: { r: 3, c: 4 } },
                { s: { r: 5, c: 0 }, e: { r: 5, c: 2 } },
                { s: { r: dataRowCount - 1, c: 0 }, e: { r: dataRowCount - 1, c: 1 } } // Merge TOTALES A:B
            ];

            // Vistas (inmovilizar paneles y ocultar cuadrícula)
            ws['!views'] = [
                { 
                    zoomScale: 80, 
                    zoomScaleNormal: 80, 
                    showGridLines: false,
                    state: 'frozen',
                    xSplit: 0,
                    ySplit: 13,
                    topLeftCell: 'A14',
                    activeCell: 'A14'
                }
            ];

            // Styles
            let currentComunaStyle = "";
            let comunaColorIndex = 0;

            for (let R = 0; R < MAX_ROWS; ++R) {
                if (R >= 13 && R < dataRowCount - 1) {
                    const rowComuna = ws_data[R][0];
                    if (rowComuna && rowComuna !== "" && rowComuna !== currentComunaStyle) {
                        currentComunaStyle = rowComuna;
                        comunaColorIndex = 1 - comunaColorIndex;
                    }
                }

                for (let C = 0; C < MAX_COLS; ++C) {
                    const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
                    if (!ws[cellRef]) continue;
                    
                    let cellStyle = { font: { name: "Calibri", sz: 10, color: { rgb: "000000" } }, border: {}, alignment: { vertical: "center" } };
                    
                    const isOutsideTable = (R >= dataRowCount || C >= tableColCount);
                    if (isOutsideTable) {
                        cellStyle.fill = { fgColor: { rgb: "FFFFFF" } };
                    } else if (R < 12) { // Top headers
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
                    } else if (R === 12) { // Table Headers (Row 13)
                        cellStyle.fill = { fgColor: { rgb: "1A3B66" } };
                        cellStyle.font = { name: "Calibri", sz: 10, color: { rgb: "FFFFFF" }, bold: true };
                        cellStyle.alignment = { vertical: "center", horizontal: "center", wrapText: true };
                        cellStyle.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
                    } else if (R >= 13 && R < dataRowCount - 1) { // Data rows
                        const isTotalCol = (C === tableColCount - 1);
                        const isTextCol = (C === 0 || C === 1);
                        const isSubtotalRow = ws_data[R][1] && ws_data[R][1].toString().startsWith('Subtotal');
                        
                        if (isSubtotalRow) {
                            cellStyle.fill = { fgColor: { rgb: "E8F0FE" } };
                            cellStyle.font = { name: "Calibri", sz: 10, color: { rgb: "000000" }, bold: true };
                            cellStyle.alignment = { vertical: "center", horizontal: "center", wrapText: true };
                            cellStyle.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
                            if (isTotalCol) {
                                cellStyle.fill = { fgColor: { rgb: "1A3B66" } };
                                cellStyle.font = { name: "Calibri", sz: 10, color: { rgb: "FFFFFF" }, bold: true };
                            }
                        } else {
                            cellStyle.fill = { fgColor: { rgb: comunaColorIndex === 0 ? "FFFFFF" : "F2F5F9" } };
                            cellStyle.alignment = { vertical: "center", horizontal: isTextCol ? "left" : "center", wrapText: true };
                            cellStyle.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
                            if (isTotalCol) {
                                cellStyle.fill = { fgColor: { rgb: "1A3B66" } };
                                cellStyle.font = { name: "Calibri", sz: 10, color: { rgb: "FFFFFF" }, bold: true };
                            }
                        }
                    } else if (R === dataRowCount - 1) { // TOTALES row
                        cellStyle.fill = { fgColor: { rgb: "1A3B66" } };
                        cellStyle.font = { name: "Calibri", sz: 10, color: { rgb: "FFFFFF" }, bold: true };
                        cellStyle.alignment = { vertical: "center", horizontal: "center", wrapText: true };
                        cellStyle.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
                    }

                    ws[cellRef].s = cellStyle;
                    
                    if (R >= 13 && C > 1 && C < tableColCount) {
                        ws[cellRef].z = '#,##0';
                    }
                }
            }

            // Row heights
            ws['!rows'] = [];
            ws['!rows'][0] = { hpt: 9.0 };
            ws['!rows'][1] = { hpt: 18.75 };
            ws['!rows'][2] = { hpt: 15.75 };
            ws['!rows'][4] = { hpt: 18.0 };
            ws['!rows'][5] = { hpt: 18.75 };
            for (let i = 6; i <= 11; i++) {
                ws['!rows'][i] = { hpt: 11.25 };
            }
            ws['!rows'][12] = { hpt: 63.75 };
            for (let i = 13; i < dataRowCount; i++) {
                ws['!rows'][i] = { hpt: 25.5 };
            }
            // Altura por defecto para el resto de celdas rellenadas en blanco
            for (let i = dataRowCount; i < MAX_ROWS; i++) {
                ws['!rows'][i] = { hpt: 15 };
            }

            // Auto-ajustar el ancho de las columnas
            const colWidths = [
                { wch: 26 }, // Comuna
                { wch: 45 }  // Establecimiento
            ];
            vacunas.forEach(h => colWidths.push({ wch: 16 })); 
            colWidths.push({ wch: 16 }); // TOTAL GENERAL
            ws['!cols'] = colWidths;

            // Configurar opciones de impresión
            ws['!pageSetup'] = {
                orientation: 'landscape',
                paperSize: 9,
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 0,
                margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
            };

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Matriz Técnica");
            XLSX.writeFile(wb, `Reporte_Programaticas_${currentYear}.xlsx`);
        });
    }

    window.populateDynamicFilters();
    renderAll();
});

// ── Render All ───────────────────────────────────────────────────────────────
function renderAll() {
    renderKPIsCobertura();
    renderChartCoberturaVacuna();
    renderChartDistribucion();
    renderHeatmap();
    renderKPIsProduccion();
    renderChartTopEstabs();
    renderChartProdComuna();
    renderTableProduccion();
    renderMatrizTecnica();
    renderChartRadar();
    renderChartTendencia();
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1: COBERTURA
// ══════════════════════════════════════════════════════════════════════════════

function renderKPIsCobertura() {
    const resi = getResidenciaForComuna(currentComuna);
    const metas = getMetasForComuna(currentComuna);
    
    const totalDosis = Object.values(resi).reduce((a, b) => a + b, 0);
    document.getElementById('kpiTotalDosis').textContent = fmt(totalDosis);
    document.getElementById('kpiTotalDosisContext').textContent = 
        currentComuna === 'all' ? 'Residencia provincial' : `Residencia · ${currentComuna}`;

    // Best & worst coverage
    let best = { vac: '', pct: 0 };
    let worst = { vac: '', pct: Infinity };
    
    DATA.headers.forEach(vac => {
        const admin = resi[vac] || 0;
        const meta = metas[vac] || 0;
        if (meta > 0) {
            const ratio = admin / meta;
            if (ratio > best.pct) best = { vac, pct: ratio };
            if (ratio < worst.pct) worst = { vac, pct: ratio };
        }
    });

    document.getElementById('kpiBestVac').textContent = getLabel(best.vac);
    document.getElementById('kpiBestPct').textContent = `${(best.pct * 100).toFixed(1)}% cobertura`;
    document.getElementById('kpiBestPct').style.color = '#10b981';

    if (worst.pct === Infinity || worst.vac === '') {
        document.getElementById('kpiWorstVac').textContent = 'S/I';
        document.getElementById('kpiWorstPct').textContent = 'Sin datos de meta';
        document.getElementById('kpiWorstPct').style.color = 'var(--text-muted)';
    } else {
        document.getElementById('kpiWorstVac').textContent = getLabel(worst.vac);
        document.getElementById('kpiWorstPct').textContent = `${(worst.pct * 100).toFixed(1)}% cobertura`;
        document.getElementById('kpiWorstPct').style.color = '#ef4444';
    }

    document.getElementById('kpiComunas').textContent = currentComuna === 'all' ? COMUNAS.length : '1';
}

function renderChartCoberturaVacuna() {
    const resi = getResidenciaForComuna(currentComuna);
    const metas = getMetasForComuna(currentComuna);
    
    const labels = DATA.headers.map(v => getLabel(v));
    const admins = [];
    const metas_arr = [];
    const coverages = DATA.headers.map(v => {
        const admin = resi[v] || 0;
        const meta = metas[v] || 0;
        admins.push(admin);
        metas_arr.push(meta);
        return meta > 0 ? ((admin / meta) * 100) : 0;
    });

    const colors = coverages.map(c => {
        if (c >= 100) return '#059669';
        if (c >= 85) return '#10b981';
        if (c >= 70) return '#f59e0b';
        return '#ef4444';
    });

    // Custom plugin for a 95% threshold line
    const thresholdLinePlugin = {
        id: 'thresholdLine',
        afterDraw: (chart) => {
            const ctx = chart.ctx;
            const yAxis = chart.scales.y;
            const xAxis = chart.scales.x;
            
            // Meta ideal 95%
            const y95 = yAxis.getPixelForValue(95);
            if (y95 >= yAxis.top && y95 <= yAxis.bottom) {
                ctx.save();
                ctx.beginPath();
                ctx.setLineDash([5, 5]);
                ctx.moveTo(xAxis.left, y95);
                ctx.lineTo(xAxis.right, y95);
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)'; // Red dashed line
                ctx.stroke();
                
                // Text for the line
                ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
                ctx.font = 'bold 10px Inter';
                ctx.fillText('Meta Ideal (95%)', xAxis.right - 85, y95 - 5);
                ctx.restore();
            }
        }
    };

    destroyChart('coberturaVacuna');
    const ctx = document.getElementById('chartCoberturaVacuna');
    if (!ctx) return;

    chartInstances['coberturaVacuna'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '% Cobertura',
                data: coverages,
                backgroundColor: colors.map(c => c + '99'),
                borderColor: colors,
                borderWidth: 2,
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { size: 14, family: 'Inter', weight: 700 },
                    bodyFont: { size: 13, family: 'Inter' },
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            let idx = context.dataIndex;
                            let admin = admins[idx];
                            let meta = metas_arr[idx];
                            let c = coverages[idx];
                            let falta = Math.max(0, meta - admin);
                            
                            let lines = [
                                `▶ Cobertura: ${c.toFixed(1)}%`,
                                `▶ Dosis Administradas: ${admin.toLocaleString('es-CL')}`,
                                `▶ Población Objetivo: ${meta.toLocaleString('es-CL')}`
                            ];
                            
                            if (meta > 0 && admin < meta) {
                                lines.push(`▶ Brecha: Faltan ${falta.toLocaleString('es-CL')} dosis para el 100%`);
                            } else if (meta > 0 && admin >= meta) {
                                lines.push(`▶ Meta Cumplida (+${(admin - meta).toLocaleString('es-CL')} dosis)`);
                            }
                            return lines;
                        }
                    }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    formatter: v => v.toFixed(1) + '%',
                    font: { weight: 700, size: 10, family: 'Inter' },
                    color: (ctx) => colors[ctx.dataIndex]
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: Math.max(105, Math.max(...coverages) + 5),
                    grid: { color: 'rgba(148,163,184,0.1)' },
                    ticks: {
                        callback: v => v + '%',
                        font: { family: 'Inter', size: 11 },
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim()
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { family: 'Inter', size: 10, weight: 600 },
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim(),
                        maxRotation: 45,
                        minRotation: 30
                    }
                }
            }
        },
        plugins: [ChartDataLabels, thresholdLinePlugin]
    });
}

function renderChartDistribucion() {
    const resi = getResidenciaForComuna(currentComuna);
    
    const sorted = DATA.headers
        .map(v => ({ key: v, val: resi[v] || 0 }))
        .sort((a, b) => b.val - a.val)
        .slice(0, 8);

    const totalDoses = sorted.reduce((sum, item) => sum + item.val, 0);

    destroyChart('distribucion');
    const ctx = document.getElementById('chartDistribucion');
    if (!ctx) return;
    
    const centerTextPlugin = {
        id: 'centerText',
        beforeDraw: function(chart) {
            if (chart.config.options.elements.center) {
                var width = chart.width,
                    height = chart.height,
                    ctx = chart.ctx;
    
                ctx.restore();
                
                // Stable pixel font size: 10% of height, max 34px
                var mainFontSize = Math.min(Math.round(height / 10), 34); 
                ctx.font = "bold " + mainFontSize + "px Inter";
                ctx.textBaseline = "middle";
                ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || "#0f172a";
    
                var text = totalDoses.toLocaleString('es-CL');
                var textX = Math.round((width - ctx.measureText(text).width) / 2);
                var textY = height / 2 - 6; // slightly above true center
    
                ctx.fillText(text, textX, textY);
                
                // Subtitle font size based on main font
                var subFontSize = Math.max(11, Math.round(mainFontSize * 0.45));
                ctx.font = "600 " + subFontSize + "px Inter";
                ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || "#94a3b8";
                var subText = "Dosis (Top 8)";
                var subTextX = Math.round((width - ctx.measureText(subText).width) / 2);
                
                // Distance based on main font size so it doesn't overlap
                ctx.fillText(subText, subTextX, textY + mainFontSize * 0.8);
                
                ctx.save();
            }
        }
    };

    chartInstances['distribucion'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sorted.map(s => getLabel(s.key)),
            datasets: [{
                data: sorted.map(s => s.val),
                backgroundColor: PALETTE.slice(0, 8).map(c => c + 'CC'),
                borderColor: PALETTE.slice(0, 8),
                borderWidth: 2,
                hoverOffset: 8,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%', // Made hole slightly larger for text
            elements: {
                center: true // trigger for our plugin
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: { family: 'Inter', size: 11, weight: 500 },
                        padding: 12,
                        usePointStyle: true,
                        pointStyleWidth: 8,
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim()
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { size: 13, family: 'Inter', weight: 700 },
                    bodyFont: { size: 13, family: 'Inter' },
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            let val = context.raw;
                            let pct = totalDoses > 0 ? ((val / totalDoses) * 100).toFixed(1) : 0;
                            return ` ▶ ${val.toLocaleString('es-CL')} dosis (${pct}%)`;
                        }
                    }
                },
                datalabels: {
                    color: '#fff',
                    font: { weight: 'bold', size: 11, family: 'Inter' },
                    formatter: (value, context) => {
                        if (totalDoses === 0) return '';
                        let pct = (value / totalDoses) * 100;
                        if (pct < 5) return ''; // Hide label if slice is too small
                        return pct.toFixed(1) + '%';
                    }
                }
            }
        },
        plugins: [ChartDataLabels, centerTextPlugin]
    });
}

function renderHeatmap() {
    const container = document.getElementById('heatmapContainer');
    if (!container) return;
    
    let html = '<table class="heatmap-table"><thead><tr><th>Comuna</th>';
    DATA.headers.forEach(v => { html += `<th>${getLabel(v)}</th>`; });
    html += '</tr></thead><tbody>';

    const comunasToShow = currentComuna === 'all' ? COMUNAS : [currentComuna];
    
    comunasToShow.forEach(com => {
        const resiItem = getAggregatedResidenciaByComuna(com);
        const metasObj = DATA.metas[com] ? DATA.metas[com].Criterios : {};
        html += `<tr><td>${com}</td>`;
        
        DATA.headers.forEach(vac => {
            const admin = resiItem ? (resiItem.datos[vac] || 0) : 0;
            const meta = metasObj[vac] || 0;
            const ratio = meta > 0 ? admin / meta : 0;
            const color = heatColor(ratio);
            const pctVal = (ratio * 100).toFixed(1);
            html += `<td class="heatmap-cell" style="background:${color}" title="${getLabel(vac)}: ${pctVal}% (${admin}/${meta})">${pctVal}%</td>`;
        });
        html += '</tr>';
    });

    // Provincial total row
    if (currentComuna === 'all') {
        const totalResi = getResidenciaForComuna('all');
        const totalMetas = getMetasForComuna('all');
        html += '<tr style="font-weight:800"><td>PROVINCIAL</td>';
        DATA.headers.forEach(vac => {
            const admin = totalResi[vac] || 0;
            const meta = totalMetas[vac] || 0;
            const ratio = meta > 0 ? admin / meta : 0;
            const color = heatColor(ratio);
            html += `<td class="heatmap-cell" style="background:${color};border:2px solid rgba(255,255,255,0.4)" title="Provincial ${getLabel(vac)}: ${(ratio*100).toFixed(1)}%">${(ratio*100).toFixed(1)}%</td>`;
        });
        html += '</tr>';
    }

    html += '</tbody></table>';
    container.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2: PRODUCCIÓN
// ══════════════════════════════════════════════════════════════════════════════

function renderKPIsProduccion() {
    const filteredRaw = getOcurrenciaFiltered(currentComuna);
    
    // Aggregate by establecimiento to calculate true totals
    const aggregated = {};
    let totalProd = 0;
    filteredRaw.forEach(d => {
        totalProd += d.total;
        if (!aggregated[d.establecimiento]) {
            aggregated[d.establecimiento] = { establecimiento: d.establecimiento, comuna: d.comuna, total: 0 };
        }
        aggregated[d.establecimiento].total += d.total;
    });
    
    const estsArray = Object.values(aggregated);
    const uniqueEstabs = estsArray.length;

    document.getElementById('kpiEstabs').textContent = fmt(uniqueEstabs);
    document.getElementById('kpiTotalProd').textContent = fmt(totalProd);
    document.getElementById('kpiAvgProd').textContent = uniqueEstabs > 0 ? fmt(Math.round(totalProd / uniqueEstabs)) : '0';

    if (uniqueEstabs > 0) {
        const top = estsArray.reduce((a, b) => a.total > b.total ? a : b);
        const name = top.establecimiento.length > 40 ? top.establecimiento.substring(0, 38) + '…' : top.establecimiento;
        document.getElementById('kpiTopEstab').textContent = name;
        document.getElementById('kpiTopEstabCount').textContent = `${fmt(top.total)} dosis · ${top.comuna}`;
        document.getElementById('kpiTopEstabCount').style.color = '#10b981';
    } else {
        document.getElementById('kpiTopEstab').textContent = 'S/I';
        document.getElementById('kpiTopEstabCount').textContent = 'Sin datos';
        document.getElementById('kpiTopEstabCount').style.color = 'var(--text-muted)';
    }
}

function renderChartTopEstabs() {
    const filteredRaw = getOcurrenciaFiltered(currentComuna);
    
    const aggregated = {};
    filteredRaw.forEach(d => {
        if (!aggregated[d.establecimiento]) {
            aggregated[d.establecimiento] = { establecimiento: d.establecimiento, comuna: d.comuna, total: 0, datos: {} };
        }
        aggregated[d.establecimiento].total += d.total;
        
        if (d.datos) {
            for (const [vac, months] of Object.entries(d.datos)) {
                if (!aggregated[d.establecimiento].datos[vac]) {
                    aggregated[d.establecimiento].datos[vac] = { aggregatedSum: 0 };
                }
                let vacSum = 0;
                for (const val of Object.values(months)) {
                    vacSum += val;
                }
                aggregated[d.establecimiento].datos[vac].aggregatedSum += vacSum;
            }
        }
    });
    
    const top10 = Object.values(aggregated).sort((a, b) => b.total - a.total).slice(0, 10);

    const titleEl = document.getElementById('rankingTitle');
    if (titleEl) {
        if (top10.length === 10) {
            titleEl.innerHTML = '<i class="fas fa-ranking-star"></i> Ranking Top 10 Establecimientos';
        } else {
            titleEl.innerHTML = `<i class="fas fa-ranking-star"></i> Ranking Top ${top10.length} Establecimientos`;
        }
    }

    const labels = top10.map(e => {
        const name = e.establecimiento.length > 45 ? e.establecimiento.substring(0, 43) + '…' : e.establecimiento;
        return name;
    });

    destroyChart('topEstabs');
    const ctx = document.getElementById('chartTopEstabs');
    if (!ctx) return;

    chartInstances['topEstabs'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Dosis',
                data: top10.map(e => e.total),
                backgroundColor: top10.map(e => (COMUNA_COLORS[e.comuna] || '#94a3b8') + '99'),
                borderColor: top10.map(e => COMUNA_COLORS[e.comuna] || '#94a3b8'),
                borderWidth: 2,
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
            layout: {
                padding: {
                    left: 0,
                    right: 40
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        afterBody: function(context) {
                            if (!context || !context.length) return;
                            const idx = context[0].dataIndex;
                            const e = top10[idx];
                            if (!e || !e.datos) return;
                            
                            const vacTotals = [];
                            for (const [vac, months] of Object.entries(e.datos)) {
                                let sum = 0;
                                for (const val of Object.values(months)) {
                                    sum += val;
                                }
                                if (sum > 0) {
                                    vacTotals.push({ vac: getLabel(vac), total: sum });
                                }
                            }
                            vacTotals.sort((a, b) => b.total - a.total);
                            const top3 = vacTotals.slice(0, 3);
                            
                            if (top3.length === 0) return '';
                            let bodyLines = [''];
                            bodyLines.push('Top 3 Vacunas (Acumulado):');
                            top3.forEach((item, i) => {
                                bodyLines.push(`${i+1}. ${item.vac}: ${fmt(item.total)} dosis`);
                            });
                            return bodyLines;
                        }
                    }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'end',
                    formatter: v => fmt(v),
                    font: { weight: 700, size: 11, family: 'Inter' },
                    color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim()
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: 'rgba(148,163,184,0.1)' },
                    ticks: {
                        font: { family: 'Inter', size: 11 },
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim()
                    }
                },
                y: {
                    grid: { display: false },
                    afterFit: function(scale) {
                        scale.width = 240;
                    },
                    ticks: {
                        font: { family: 'Inter', size: 10.5, weight: 500 },
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim()
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

function renderChartProdComuna() {
    const comunaTotals = {};
    COMUNAS.forEach(c => comunaTotals[c] = 0);
    
    // Obtenemos siempre el total provincial para dar contexto
    const allData = getOcurrenciaFiltered('all');
    allData.forEach(item => {
        comunaTotals[item.comuna] = (comunaTotals[item.comuna] || 0) + item.total;
    });

    let labels, values, bgColors, borderColors;

    if (currentComuna === 'all') {
        // Ordenar de mayor a menor para una mejor lectura epidemiológica (gráfico de barras horizontales)
        const sorted = COMUNAS.map(c => ({ name: c, val: comunaTotals[c] })).sort((a,b) => b.val - a.val);
        labels = sorted.map(s => s.name);
        values = sorted.map(s => s.val);
        bgColors = labels.map(c => (COMUNA_COLORS[c] || '#94a3b8') + 'cc');
        borderColors = labels.map(c => COMUNA_COLORS[c] || '#94a3b8');
    } else {
        const selectedTotal = comunaTotals[currentComuna];
        const restTotal = Object.values(comunaTotals).reduce((sum, val) => sum + val, 0) - selectedTotal;
        labels = [currentComuna, 'Resto Provincia'];
        values = [selectedTotal, restTotal];
        bgColors = [(COMUNA_COLORS[currentComuna] || '#94a3b8') + 'cc', '#cbd5e1cc'];
        borderColors = [COMUNA_COLORS[currentComuna] || '#94a3b8', '#94a3b8'];
    }

    destroyChart('prodComuna');
    const ctx = document.getElementById('chartProdComuna');
    if (!ctx) return;

    chartInstances['prodComuna'] = new Chart(ctx, {
        type: 'bar',
        plugins: [ChartDataLabels],
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: bgColors,
                borderColor: borderColors,
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw || 0;
                            const dataset = context.chart.data.datasets[context.datasetIndex];
                            const total = dataset.data.reduce((a, b) => a + b, 0) || 1;
                            const percentage = ((value / total) * 100).toFixed(1) + '%';
                            return ` ${context.label}: ${fmt(value)} (${percentage})`;
                        }
                    }
                },
                datalabels: {
                    display: true,
                    anchor: 'end',
                    align: 'right',
                    formatter: function(value, context) {
                        const dataset = context.chart.data.datasets[context.datasetIndex];
                        const total = dataset.data.reduce((a, b) => a + b, 0) || 1;
                        const percentage = ((value / total) * 100).toFixed(1) + '%';
                        return percentage;
                    },
                    color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim(),
                    font: { family: 'Inter', size: 10, weight: 600 }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: {
                        callback: function(val) { return fmt(val); }
                    },
                    suggestedMax: Math.max(...values) * 1.15
                },
                y: {
                    grid: { display: false },
                    ticks: {
                        font: { family: 'Inter', size: 11, weight: 500 }
                    },
                    afterFit: function(scaleInstance) {
                        scaleInstance.width = 130; // Ancho forzado para que no corte "San Juan de la Costa"
                    }
                }
            },
            layout: {
                padding: { left: 50, right: 40 }
            }
        }
    });
}

// ── Variables for Matriz Filters ──
let matrizFiltroComuna = 'all';
let matrizFiltroVacuna = 'all';

function renderTableProduccion() {
    const container = document.getElementById('tableProdContainer');
    if (!container) return;

    const comunaCbs = document.querySelectorAll('.comunaOptionsList-cb');
    let comunas = COMUNAS;
    if (comunaCbs.length > 0) {
        comunas = Array.from(comunaCbs).filter(c => c.checked).map(c => c.value);
    }
    
    const currentData = DATA_BY_YEAR[currentYear];
    
    const criterioCbs = document.querySelectorAll('.criterioOptionsList-cb');
    let criterios = [];
    if (criterioCbs.length > 0) {
        criterios = Array.from(criterioCbs).filter(c => c.checked).map(c => c.value);
    } else {
        criterios = [...new Set(currentData.data_ocurrencia.map(d => d.criterio))];
    }
    
    const searchEstabInput = document.getElementById('searchEstab');
    const estabQuery = searchEstabInput ? searchEstabInput.value.toLowerCase() : '';
    
    const filteredRaw = currentData.data_ocurrencia.filter(d => 
        comunas.includes(d.comuna) && 
        criterios.includes(d.criterio) &&
        d.establecimiento.toLowerCase().includes(estabQuery)
    );
    
    // Aggregate by comuna and establecimiento to combine criteria
    const aggregated = {};
    filteredRaw.forEach(d => {
        const key = `${d.comuna}|${d.establecimiento}`;
        if (!aggregated[key]) {
            aggregated[key] = { comuna: d.comuna, establecimiento: d.establecimiento, datos: {} };
        }
        Object.keys(d.datos).forEach(v => {
            if (!aggregated[key].datos[v]) aggregated[key].datos[v] = {};
            Object.keys(d.datos[v]).forEach(m => {
                aggregated[key].datos[v][m] = (aggregated[key].datos[v][m] || 0) + d.datos[v][m];
            });
        });
    });
    const filtered = Object.values(aggregated);
    
    const vacunasCbs = document.querySelectorAll('.vacunaOptionsList-cb');
    let vacunas = currentData.headers;
    if (vacunasCbs.length > 0) {
        vacunas = Array.from(vacunasCbs).filter(c => c.checked).map(c => c.value);
    }
    
    function getDosisOfVacuna(vac) {
        if (vac.endsWith('1D')) return '1D';
        if (vac.endsWith('2D')) return '2D';
        if (vac.endsWith('3D')) return '3D';
        if (vac.endsWith('1R')) return '1R';
        return 'UNICA';
    }
    const getBaseVacunaNameFilter = vac => vac.replace(/(1D|2D|3D|1R|UNICA)$/, '');
    
    const vacunasBasesCbs = document.querySelectorAll('.vacunaBaseOptionsList-cb');
    if (vacunasBasesCbs.length > 0) {
        const vacunasBasesSeleccionadas = Array.from(vacunasBasesCbs).filter(c => c.checked).map(c => c.value);
        vacunas = vacunas.filter(v => vacunasBasesSeleccionadas.includes(getBaseVacunaNameFilter(v)));
    }

    const dosisCbs = document.querySelectorAll('.dosisOptionsList-cb');
    if (dosisCbs.length > 0) {
        const dosisSeleccionadas = Array.from(dosisCbs).filter(c => c.checked).map(c => c.value);
        vacunas = vacunas.filter(v => dosisSeleccionadas.includes(getDosisOfVacuna(v)));
    }
    
    const fechaCorteSelect = document.getElementById('matrizFechaCorteSelect');
    let mesesSeleccionados = currentData.meses_base || [];
    if (fechaCorteSelect && fechaCorteSelect.value !== 'all') {
        const maxMes = parseInt(fechaCorteSelect.value);
        mesesSeleccionados = mesesSeleccionados.filter(m => m <= maxMes);
    }
    
    // Determinar el mes máximo seleccionado para el delta y leyendas
    const latestMonthNum = mesesSeleccionados.length > 0 ? Math.max(...mesesSeleccionados) : (currentData.meses_base && currentData.meses_base.length > 0 ? Math.max(...currentData.meses_base.map(Number)) : 6);
    const latestMonth = latestMonthNum.toString();
    const monthName = new Date(2026, latestMonthNum - 1).toLocaleString('es-CL', {month: 'long'}).toUpperCase();

    // Leyenda
    let html = `
        <div style="display:flex; justify-content:center; gap:30px; margin-bottom:15px; font-size:0.9rem;">
            <div><span style="font-weight:bold; color:var(--text-primary)">1.000</span> = Total Acumulado (Campaña a Fecha Corte)</div>
            <div><span style="font-weight:bold; color:#10b981">▲ +50</span> = Dosis administradas SOLO en el mes de ${monthName}</div>
        </div>
    `;

    html += `<table id="tablaOcurrenciaExcel" class="data-table matriz-table"><thead><tr><th>Comuna</th><th>Establecimiento</th>`;
    vacunas.forEach(v => { html += `<th>${getLabel(v)}</th>`; });
    html += `<th>Total</th></tr></thead><tbody>`;

    // Group by comuna
    const byComuna = {};
    filtered.forEach(item => {
        if (!byComuna[item.comuna]) byComuna[item.comuna] = [];
        byComuna[item.comuna].push(item);
    });

    const grandTotal = {};
    const grandDelta = {};
    vacunas.forEach(v => { grandTotal[v] = 0; grandDelta[v] = 0; });
    let grandTotalAll = 0;
    let grandDeltaAll = 0;

    Object.keys(byComuna).sort().forEach(com => {
        // Recalculate item total based on selected date filter for sorting purposes
        const items = byComuna[com].map(item => {
            let recalcTotal = 0;
            vacunas.forEach(v => {
                const mesData = item.datos[v] || {};
                Object.keys(mesData).forEach(mStr => {
                    if (mesesSeleccionados.includes(parseInt(mStr))) recalcTotal += mesData[mStr];
                });
            });
            return { ...item, recalcTotal };
        }).sort((a, b) => b.recalcTotal - a.recalcTotal);

        const comunaTotal = {};
        const comunaDelta = {};
        vacunas.forEach(v => { comunaTotal[v] = 0; comunaDelta[v] = 0; });
        let comunaTotalAll = 0;
        let comunaDeltaAll = 0;

        items.forEach(item => {
            html += `<tr><td>${com}</td><td style="text-align:left; font-weight:500;">${item.establecimiento}</td>`;
            let rowDeltaAll = 0;
            let rowTotalAll = 0;
            vacunas.forEach(v => {
                const mesData = item.datos[v] || {};
                
                let val = 0;
                Object.keys(mesData).forEach(mStr => {
                    if (mesesSeleccionados.includes(parseInt(mStr))) val += mesData[mStr];
                });
                const delta = mesesSeleccionados.includes(latestMonthNum) ? (mesData[latestMonth] || 0) : 0;
                
                comunaTotal[v] += val;
                comunaDelta[v] += delta;
                grandTotal[v] += val;
                grandDelta[v] += delta;
                rowDeltaAll += delta;
                rowTotalAll += val;
                
                if (val > 0) {
                    const deltaStr = delta > 0 ? ` <span title="Aumentó ${fmt(delta)} registro${delta === 1 ? '' : 's'} en el mes de ${monthName.charAt(0) + monthName.slice(1).toLowerCase()}" style="color:#10b981; font-weight:bold; font-size:0.85em; margin-left:4px; cursor:help;">▲ ${fmt(delta)}</span>` : '';
                    html += `<td>${fmt(val)}${deltaStr}</td>`;
                } else {
                    html += `<td><span style="color:var(--text-muted)">-</span></td>`;
                }
            });
            comunaTotalAll += rowTotalAll;
            comunaDeltaAll += rowDeltaAll;
            grandTotalAll += rowTotalAll;
            grandDeltaAll += rowDeltaAll;
            
            const totalDeltaStr = rowDeltaAll > 0 ? ` <span title="Aumentó ${fmt(rowDeltaAll)} registro${rowDeltaAll === 1 ? '' : 's'} en el mes de ${monthName.charAt(0) + monthName.slice(1).toLowerCase()}" style="color:#10b981; font-weight:bold; font-size:0.85em; margin-left:4px; cursor:help;">▲ ${fmt(rowDeltaAll)}</span>` : '';
            html += `<td style="font-weight:700; color:var(--accent-blue)">${fmt(rowTotalAll)}${totalDeltaStr}</td></tr>`;
        });

        // Subtotal row
        const subtotalDeltaStrAll = comunaDeltaAll > 0 ? ` <span title="Aumentó ${fmt(comunaDeltaAll)} registro${comunaDeltaAll === 1 ? '' : 's'} en el mes de ${monthName.charAt(0) + monthName.slice(1).toLowerCase()}" style="color:#10b981; font-weight:bold; font-size:0.85em; margin-left:4px; cursor:help;">▲ ${fmt(comunaDeltaAll)}</span>` : '';
        html += `<tr class="total-row" style="background:rgba(59,130,246,0.05)"><td></td><td style="text-align:right">Subtotal ${com}</td>`;
        vacunas.forEach(v => { 
            const deltaStr = comunaDelta[v] > 0 ? ` <span title="Aumentó ${fmt(comunaDelta[v])} registro${comunaDelta[v] === 1 ? '' : 's'} en el mes de ${monthName.charAt(0) + monthName.slice(1).toLowerCase()}" style="color:#10b981; font-weight:bold; font-size:0.85em; margin-left:4px; cursor:help;">▲ ${fmt(comunaDelta[v])}</span>` : '';
            html += `<td>${fmt(comunaTotal[v])}${deltaStr}</td>`; 
        });
        html += `<td style="color:var(--accent-blue); font-weight:bold;">${fmt(comunaTotalAll)}${subtotalDeltaStrAll}</td></tr>`;
    });

    // Grand total
    const grandDeltaStrAll = grandDeltaAll > 0 ? ` <span title="Aumentó ${fmt(grandDeltaAll)} registro${grandDeltaAll === 1 ? '' : 's'} en el mes de ${monthName.charAt(0) + monthName.slice(1).toLowerCase()}" style="color:#10b981; font-weight:bold; font-size:0.85em; margin-left:4px; cursor:help;">▲ ${fmt(grandDeltaAll)}</span>` : '';
    html += `<tr class="total-row grand-total" style="font-size:1rem; border-top:2px solid #cbd5e1;"><td></td><td>TOTAL PROVINCIAL</td>`;
    vacunas.forEach(v => { 
        const deltaStr = grandDelta[v] > 0 ? ` <span title="Aumentó ${fmt(grandDelta[v])} registro${grandDelta[v] === 1 ? '' : 's'} en el mes de ${monthName.charAt(0) + monthName.slice(1).toLowerCase()}" style="color:#10b981; font-weight:bold; font-size:0.85em; margin-left:4px; cursor:help;">▲ ${fmt(grandDelta[v])}</span>` : '';
        html += `<td>${fmt(grandTotal[v])}${deltaStr}</td>`; 
    });
    html += `<td>${fmt(grandTotalAll)}${grandDeltaStrAll}</td></tr>`;

    html += '</tbody></table>';
    container.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3: MATRIZ TÉCNICA
// ══════════════════════════════════════════════════════════════════════════════

function renderMatrizTecnica() {
    const container = document.getElementById('tableMatrizContainer');
    if (!container) return;

    const vacunas = [...DATA.headers].sort(sortVacunas);
    const comunasToShow = currentComuna === 'all' ? COMUNAS : [currentComuna];

    let html = '<table class="data-table matriz-compacta"><thead><tr><th class="sticky-vacuna-th">Vacuna</th><th class="sticky-metrica-th">Métrica</th>';
    comunasToShow.forEach(c => { html += `<th>${c}</th>`; });
    if (currentComuna === 'all') html += '<th class="col-provincial">TOTAL PROVINCIAL</th>';
    html += '</tr></thead><tbody>';

    vacunas.forEach((vac, idx) => {
        const rowClass = idx % 2 === 0 ? 'matriz-row-normal' : 'matriz-row-alt';

        // Row 1: Dosis
        html += `<tr class="${rowClass}"><td rowspan="3" class="sticky-vacuna">${getLabel(vac)}</td><td class="sticky-metrica">Dosis</td>`;
        let provDosis = 0;
        comunasToShow.forEach(com => {
            const item = getAggregatedResidenciaByComuna(com);
            const val = item ? (item.datos[vac] || 0) : 0;
            provDosis += val;
            html += `<td>${fmt(val)}</td>`;
        });
        if (currentComuna === 'all') html += `<td class="col-provincial" style="font-weight:700">${fmt(provDosis)}</td>`;
        html += '</tr>';

        // Row 2: Población
        html += `<tr class="${rowClass}"><td class="sticky-metrica">Población</td>`;
        let provPob = 0;
        comunasToShow.forEach(com => {
            const meta = DATA.metas[com] ? (DATA.metas[com].Criterios[vac] || 0) : 0;
            provPob += meta;
            html += `<td>${fmt(meta)}</td>`;
        });
        if (currentComuna === 'all') html += `<td class="col-provincial" style="font-weight:700">${fmt(provPob)}</td>`;
        html += '</tr>';

        // Row 3: Cobertura
        html += `<tr class="${rowClass}"><td class="sticky-metrica">Cobertura</td>`;
        comunasToShow.forEach(com => {
            const item = getAggregatedResidenciaByComuna(com);
            const admin = item ? (item.datos[vac] || 0) : 0;
            const meta = DATA.metas[com] ? (DATA.metas[com].Criterios[vac] || 0) : 0;
            const ratio = meta > 0 ? admin / meta : 0;
            const cls = ratio >= 0.85 ? 'coverage-good' : ratio >= 0.5 ? 'coverage-warn' : 'coverage-bad';
            html += `<td class="${cls}">${(ratio * 100).toFixed(1)}%</td>`;
        });
        if (currentComuna === 'all') {
            const provRatio = provPob > 0 ? provDosis / provPob : 0;
            const cls = provRatio >= 0.85 ? 'coverage-good' : provRatio >= 0.5 ? 'coverage-warn' : 'coverage-bad';
            html += `<td class="col-provincial ${cls}" style="font-weight:800">${(provRatio * 100).toFixed(1)}%</td>`;
        }
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function renderChartRadar() {
    let totalDosis = {};
    let totalMetas = {};
    const comunasToShow = currentComuna === 'all' ? COMUNAS : [currentComuna];
    
    DATA.headers.forEach(vac => {
        totalDosis[vac] = 0;
        totalMetas[vac] = 0;
        comunasToShow.forEach(com => {
            const resi = getAggregatedResidenciaByComuna(com);
            const admin = resi ? (resi.datos[vac] || 0) : 0;
            totalDosis[vac] += admin;
            if (DATA.metas[com] && DATA.metas[com].Criterios) {
                totalMetas[vac] += DATA.metas[com].Criterios[vac] || 0;
            }
        });
    });
    
    let coverageArr = [];
    DATA.headers.forEach(vac => {
        if (totalMetas[vac] > 0) {
            coverageArr.push({
                label: getLabel(vac),
                cov: (totalDosis[vac] / totalMetas[vac]) * 100
            });
        }
    });
    
    // Sort ascending to get the 5 lowest (most critical)
    coverageArr.sort((a, b) => a.cov - b.cov);
    const worst = coverageArr.slice(0, 5);
    
    const labels = worst.map(d => d.label);
    const data = worst.map(d => d.cov);
    // Gradient of urgency colors from red to yellowish-green
    const bgColors = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16'];
    
    destroyChart('radar');
    const ctx = document.getElementById('chartRezagadas');
    if (!ctx) return;

    chartInstances['radar'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Cobertura %',
                data: data,
                backgroundColor: bgColors,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: 'rgba(148,163,184,0.1)' },
                    ticks: {
                        callback: v => v + '%',
                        font: { family: 'Inter', size: 11 },
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim()
                    }
                },
                y: {
                    grid: { display: false },
                    ticks: {
                        font: { family: 'Inter', size: 11, weight: 600 },
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim()
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => ' Cobertura: ' + ctx.raw.toFixed(1) + '%'
                    }
                },
                datalabels: {
                    display: true,
                    align: 'right',
                    anchor: 'end',
                    formatter: v => v.toFixed(1) + '%',
                    font: { family: 'Inter', size: 10, weight: 600 },
                    color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim()
                }
            }
        }
    });
}

function renderChartTendencia() {
    // Monthly trend from ocurrencia data
    const meses = DATA.meses_base;
    if (!meses || meses.length === 0) return;

    const selectedVacs = ['HEXA1D', 'BCG', 'SRP1D', 'NEUMO1D', 'BEXSERO1D'];
    const filtered = getOcurrenciaFiltered(currentComuna);

    // Compute monthly totals for each vaccine
    const rawDataSets = selectedVacs.map(vac => {
        return meses.map(m => {
            let total = 0;
            filtered.forEach(item => {
                total += (item.datos[vac] || {})[String(m)] || 0;
            });
            return total;
        });
    });
    
    // Find the last month with > 0 total across ALL vaccines
    let lastValidMonthIndex = -1;
    for (let i = 0; i < meses.length; i++) {
        let monthTotal = 0;
        rawDataSets.forEach(ds => { monthTotal += ds[i]; });
        if (monthTotal > 0) lastValidMonthIndex = i;
    }
    
    // Ensure we show at least 1 month if all are empty
    if (lastValidMonthIndex === -1) lastValidMonthIndex = 0;
    
    const validMeses = meses.slice(0, lastValidMonthIndex + 1);
    
    const datasets = selectedVacs.map((vac, idx) => {
        const validData = rawDataSets[idx].slice(0, lastValidMonthIndex + 1);
        return {
            label: getLabel(vac),
            data: validData,
            borderColor: PALETTE[idx],
            backgroundColor: PALETTE[idx] + '15',
            borderWidth: 2.5,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: PALETTE[idx],
        };
    });

    destroyChart('tendencia');
    const ctx = document.getElementById('chartTendencia');
    if (!ctx) return;

    chartInstances['tendencia'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: validMeses.map(m => MONTH_NAMES[m - 1]),
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: { family: 'Inter', size: 11 },
                        usePointStyle: true,
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim()
                    }
                },
                datalabels: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(148,163,184,0.1)' },
                    ticks: {
                        font: { family: 'Inter', size: 11 },
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim()
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { family: 'Inter', size: 11, weight: 600 },
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim()
                    }
                }
            }
        }
    });
}


// ── CALENDARIO INTERACTIVO MINSAL ────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    // Escuchar clicks en las celdas del calendario
    const clickableDoses = document.querySelectorAll('.clickable-dose');
    
    clickableDoses.forEach(cell => {
        cell.addEventListener('click', function() {
            const vacId = this.getAttribute('data-vac-id');
            const vacName = this.getAttribute('data-vac-name');
            const doseText = this.innerText.replace('\n', ' ');
            
            renderDoseDetail(vacId, vacName, doseText);
        });
    });

    // Filtros de Comuna para actualizar Establecimientos
    const calComunaFilter = document.getElementById('globalComunaFilter');
    const calEstabFilter = document.getElementById('calendarioEstablecimientoFilter');
    if (calComunaFilter && calEstabFilter) {
        calComunaFilter.addEventListener('change', function() {
            const selectedComuna = this.value;
            calEstabFilter.innerHTML = '<option value="all">Todos los Establecimientos</option>';
            if (selectedComuna === 'all') return;
            
            const estabs = new Set();
            Object.values(DATA_BY_YEAR).forEach(yData => {
                if (yData && yData.data_ocurrencia) {
                    yData.data_ocurrencia.forEach(row => {
                        if (row.comuna === selectedComuna) {
                            estabs.add(row.establecimiento);
                        }
                    });
                }
            });
            Array.from(estabs).sort().forEach(e => {
                const opt = document.createElement('option');
                opt.value = e; opt.textContent = e;
                calEstabFilter.appendChild(opt);
            });
        });
    }
});

function renderDoseDetail(vacId, vacName, doseTitle) {
    const occurData = DATA.data_ocurrencia;
    let totalDoses = 0;
    const agg = {};

    const corteSelect = document.getElementById('calendarioFechaCorteFilter');
    const maxMes = (corteSelect && corteSelect.value !== 'all') ? parseInt(corteSelect.value, 10) : 99;
    
    const comunaSelect = document.getElementById('globalComunaFilter');
    const comunaFilter = (comunaSelect) ? comunaSelect.value : 'all';
    
    const estabSelect = document.getElementById('calendarioEstablecimientoFilter');
    const estabFilter = (estabSelect) ? estabSelect.value : 'all';

    occurData.forEach(row => {
        if (comunaFilter !== 'all' && row.comuna !== comunaFilter) return;
        if (estabFilter !== 'all' && row.establecimiento !== estabFilter) return;

        const comuna = row.comuna;
        const estab = row.establecimiento;
        const vacData = row.datos[vacId];
        
        if (vacData) {
            let sum = 0;
            Object.keys(vacData).forEach(m => {
                if (parseInt(m, 10) <= maxMes) sum += vacData[m];
            });
            
            if (sum > 0) {
                if (!agg[comuna]) agg[comuna] = {};
                agg[comuna][estab] = (agg[comuna][estab] || 0) + sum;
                totalDoses += sum;
            }
        }
    });
    
    const tbody = document.querySelector('#doseDetailTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (totalDoses === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 20px; color: #64748b;">No hay registros de administración para esta dosis en la base de ocurrencia (${currentYear}).</td></tr>`;
    } else {
        const rows = [];
        Object.keys(agg).forEach(comuna => {
            Object.keys(agg[comuna]).forEach(estab => {
                rows.push({ comuna, estab, count: agg[comuna][estab] });
            });
        });
        
        rows.sort((a, b) => b.count - a.count);
        
        rows.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${r.comuna}</td>
                <td><strong>${r.estab}</strong></td>
                <td style="text-align: right; font-weight: 600; color: #0f766e;">${r.count.toLocaleString('es-CL')}</td>
            `;
            tbody.appendChild(tr);
        });
    }
    
    const doseTotalEl = document.getElementById('doseDetailTotal');
    const doseTitleEl = document.getElementById('doseDetailTitle');
    const doseSubEl = document.getElementById('doseDetailSubtitle');
    
    if (doseTotalEl) doseTotalEl.innerText = totalDoses.toLocaleString('es-CL');
    if (doseTitleEl) doseTitleEl.innerText = `${vacName}`;
    if (doseSubEl) doseSubEl.innerHTML = `Desglose: <strong>${doseTitle}</strong>`;
    
    const backdrop = document.getElementById('doseDetailModalBackdrop');
    const windowEl = document.getElementById('doseDetailModalWindow');
    if (backdrop) backdrop.style.display = 'block';
    if (windowEl) windowEl.style.display = 'block';
}

window.closeDoseDetailModal = function() {
    const backdrop = document.getElementById('doseDetailModalBackdrop');
    const windowEl = document.getElementById('doseDetailModalWindow');
    if (backdrop) backdrop.style.display = 'none';
    if (windowEl) windowEl.style.display = 'none';
};

window.exportCalendarToExcel = function() {
    if (typeof XLSX === 'undefined') {
        alert("La librería de exportación a Excel está cargando. Por favor, intente nuevamente en unos segundos.");
        return;
    }

    const corteSelect = document.getElementById('calendarioFechaCorteFilter');
    const maxMes = (corteSelect && corteSelect.value !== 'all') ? parseInt(corteSelect.value, 10) : 99;
    
    const comunaSelect = document.getElementById('globalComunaFilter');
    const comunaFilter = (comunaSelect) ? comunaSelect.value : 'all';
    
    const estabSelect = document.getElementById('calendarioEstablecimientoFilter');
    const estabFilter = (estabSelect) ? estabSelect.value : 'all';

    const occurData = DATA.data_ocurrencia;
    const vaccines = DATA.headers;
    
    const rowsMap = {};
    
    occurData.forEach(row => {
        if (comunaFilter !== 'all' && row.comuna !== comunaFilter) return;
        if (estabFilter !== 'all' && row.establecimiento !== estabFilter) return;
        
        const key = `${row.comuna}_${row.establecimiento}`;
        if (!rowsMap[key]) {
            rowsMap[key] = { comuna: row.comuna, estab: row.establecimiento, totals: {} };
            vaccines.forEach(v => rowsMap[key].totals[v] = 0);
        }
        
        vaccines.forEach(v => {
            const vacData = row.datos[v];
            if (vacData) {
                Object.keys(vacData).forEach(m => {
                    if (parseInt(m, 10) <= maxMes) rowsMap[key].totals[v] += vacData[m];
                });
            }
        });
    });

    const rows = Object.values(rowsMap);
    rows.sort((a,b) => a.comuna.localeCompare(b.comuna) || a.estab.localeCompare(b.estab));

    const ws_data = [];
    ws_data.push(["REPORTE MATRIZ TÉCNICA TERRITORIAL (CALENDARIO MINSAL)"]);
    ws_data.push(["Campaña:", currentYear]);
    ws_data.push(["Comuna:", comunaFilter === 'all' ? 'Todas' : comunaFilter]);
    ws_data.push(["Establecimiento:", estabFilter === 'all' ? 'Todos' : estabFilter]);
    ws_data.push(["Fecha de Corte:", corteSelect && corteSelect.value !== 'all' ? corteSelect.options[corteSelect.selectedIndex].text : 'Año Completo']);
    ws_data.push([]);

    const headerRow = ["COMUNA", "ESTABLECIMIENTO"];
    vaccines.forEach(v => headerRow.push(v));
    headerRow.push("TOTAL GENERAL");
    ws_data.push(headerRow);

    let grandTotals = {};
    vaccines.forEach(v => grandTotals[v] = 0);
    let absoluteTotal = 0;

    rows.forEach(r => {
        const dataRow = [r.comuna, r.estab];
        let rowTotal = 0;
        vaccines.forEach(v => {
            const val = r.totals[v];
            dataRow.push(val);
            rowTotal += val;
            grandTotals[v] += val;
        });
        dataRow.push(rowTotal);
        absoluteTotal += rowTotal;
        ws_data.push(dataRow);
    });

    const totalRow = ["TOTALES", ""];
    vaccines.forEach(v => totalRow.push(grandTotals[v]));
    totalRow.push(absoluteTotal);
    ws_data.push(totalRow);

    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell_address = {c: C, r: R};
            const cell_ref = XLSX.utils.encode_cell(cell_address);
            if (!ws[cell_ref]) continue;

            if (R === 6) { 
                ws[cell_ref].s = {
                    fill: { fgColor: { rgb: "004282" } },
                    font: { bold: true, color: { rgb: "FFFFFF" } },
                    border: { top: { style: "thin", color: { rgb: "FFFFFF" } }, bottom: { style: "thin", color: { rgb: "FFFFFF" } }, left: { style: "thin", color: { rgb: "FFFFFF" } }, right: { style: "thin", color: { rgb: "FFFFFF" } } }
                };
            }
            else if (R === range.e.r) { 
                ws[cell_ref].s = {
                    fill: { fgColor: { rgb: "0F69B4" } },
                    font: { bold: true, color: { rgb: "FFFFFF" } }
                };
            }
            else if (R > 6) {
                ws[cell_ref].s = {
                    border: { bottom: { style: "hair", color: { rgb: "DDDDDD" } } }
                };
            }
        }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Matriz Territorial");
    XLSX.writeFile(wb, `Matriz_Territorial_Calendario_${currentYear}.xlsx`);
};

// ── INICIALIZACIÓN DE FILTROS CALENDARIO ──
function populateCalendarioFilters() {
    const dataOcurrencia = DATA.data_ocurrencia || [];
    const mesesSet = new Set();
    const estabsMap = {}; // comuna -> Set de estabs

    dataOcurrencia.forEach(row => {
        // Recolectar establecimientos por comuna
        if (!estabsMap[row.comuna]) estabsMap[row.comuna] = new Set();
        estabsMap[row.comuna].add(row.establecimiento);

        // Recolectar meses que tienen dosis reportadas
        Object.values(row.datos).forEach(vacData => {
            Object.keys(vacData).forEach(m => mesesSet.add(parseInt(m, 10)));
        });
    });

    const mesesArray = Array.from(mesesSet).sort((a, b) => a - b);
    const dateSelect = document.getElementById('calendarioFechaCorteFilter');
    if (dateSelect) {
        dateSelect.innerHTML = '<option value="all" style="color: black;">Año Completo</option>';
        mesesArray.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.style.color = 'black';
            opt.textContent = MONTH_NAMES[m - 1];
            dateSelect.appendChild(opt);
        });
    }

    // Inicializar Select2 en Establecimiento
    const estabSelect = $('#calendarioEstablecimientoFilter');
    if (estabSelect.length) {
        estabSelect.select2({
            placeholder: "Todos los Establecimientos",
            width: '250px',
            allowClear: true
        });

        // Evento para actualizar establecimientos cuando cambia globalComunaFilter
        const globalComuna = document.getElementById('globalComunaFilter');
        if (globalComuna) {
            globalComuna.addEventListener('change', function() {
                const comuna = this.value;
                estabSelect.empty();
                estabSelect.append(new Option("Todos los Establecimientos", "all", false, false));
                if (comuna !== 'all' && estabsMap[comuna]) {
                    const estabs = Array.from(estabsMap[comuna]).sort();
                    estabs.forEach(e => estabSelect.append(new Option(e, e, false, false)));
                } else if (comuna === 'all') {
                    // Si selecciona "Todas las comunas", poblar con todos los estabs
                    const allEstabs = new Set();
                    Object.values(estabsMap).forEach(s => s.forEach(e => allEstabs.add(e)));
                    Array.from(allEstabs).sort().forEach(e => estabSelect.append(new Option(e, e, false, false)));
                }
                estabSelect.trigger('change');
            });
            // Trigger initial population
            globalComuna.dispatchEvent(new Event('change'));
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Retrasar levemente la poblacion para que DATA este cargado
    setTimeout(populateCalendarioFilters, 500);
});

// ── LÓGICA DE ACTUALIZACIÓN DEL CALENDARIO INTERACTIVO EN CELDA ──
function updateCalendarCells() {
    const occurData = DATA.data_ocurrencia;
    const corteSelect = document.getElementById('calendarioFechaCorteFilter');
    const maxMes = (corteSelect && corteSelect.value !== 'all') ? parseInt(corteSelect.value, 10) : 99;
    
    const comunaSelect = document.getElementById('globalComunaFilter');
    const comunaFilter = (comunaSelect) ? comunaSelect.value : 'all';
    
    const estabSelect = document.getElementById('calendarioEstablecimientoFilter');
    const estabFilter = (estabSelect) ? estabSelect.value : 'all';

    const totalsByVac = {};
    
    occurData.forEach(row => {
        if (comunaFilter !== 'all' && row.comuna !== comunaFilter) return;
        if (estabFilter !== 'all' && row.establecimiento !== estabFilter) return;

        Object.keys(row.datos).forEach(vacId => {
            const vacData = row.datos[vacId];
            let sum = 0;
            Object.keys(vacData).forEach(m => {
                if (parseInt(m, 10) <= maxMes) sum += vacData[m];
            });
            
            if (sum > 0) {
                totalsByVac[vacId] = (totalsByVac[vacId] || 0) + sum;
            }
        });
    });

    const isFiltered = comunaFilter !== 'all' || estabFilter !== 'all' || (corteSelect && corteSelect.value !== 'all');

    const clickableDoses = document.querySelectorAll('.clickable-dose');
    clickableDoses.forEach(cell => {
        const vacId = cell.getAttribute('data-vac-id');
        const val = totalsByVac[vacId] || 0;
        
        // Ensure the original label is wrapped so we can hide/show it
        let labelSpan = cell.querySelector('.dose-label');
        if (!labelSpan) {
            const originalHTML = cell.innerHTML;
            cell.innerHTML = '';
            labelSpan = document.createElement('span');
            labelSpan.className = 'dose-label';
            labelSpan.innerHTML = originalHTML;
            cell.appendChild(labelSpan);
        }

        let valDiv = cell.querySelector('.calendar-val');
        if (!valDiv) {
            valDiv = document.createElement('div');
            valDiv.className = 'calendar-val';
            cell.appendChild(valDiv);
        }

        if (isFiltered) {
            cell.classList.add('has-value');
            labelSpan.style.visibility = 'hidden'; // Hide but preserve layout space
            valDiv.innerText = val.toLocaleString('es-CL');
            valDiv.style.display = 'block'; // Show number
        } else {
            cell.classList.remove('has-value');
            labelSpan.style.visibility = 'visible'; // Show original label
            valDiv.style.display = 'none'; // Hide number
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Escuchar cambios en los filtros para el calendario
    const calFilters = ['globalComunaFilter', 'calendarioFechaCorteFilter'];
    calFilters.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateCalendarCells);
    });

    const estabFilter = $('#calendarioEstablecimientoFilter');
    if (estabFilter.length) {
        estabFilter.on('change', updateCalendarCells);
    }

    const btnReset = document.getElementById('btnResetCalendar');
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            const com = document.getElementById('globalComunaFilter');
            if (com) { com.value = 'all'; com.dispatchEvent(new Event('change')); }
            
            const cort = document.getElementById('calendarioFechaCorteFilter');
            if (cort) { cort.value = 'all'; cort.dispatchEvent(new Event('change')); }
            
            if (estabFilter.length) { estabFilter.val('all').trigger('change'); }
            
            updateCalendarCells();
        });
    }

    const btnExportCal = document.getElementById('btnExportCalendarExcel');
    if (btnExportCal) {
        btnExportCal.addEventListener('click', exportVisualCalendarToExcel);
    }
});

function exportVisualCalendarToExcel() {
    if (typeof XLSX === 'undefined') {
        alert("La librería de exportación a Excel está cargando.");
        return;
    }

    const corteSelect = document.getElementById('calendarioFechaCorteFilter');
    const textoCorte = (corteSelect && corteSelect.value !== 'all') ? corteSelect.options[corteSelect.selectedIndex].text : 'Año Completo';
    
    const comunaSelect = document.getElementById('globalComunaFilter');
    const comunaText = (comunaSelect && comunaSelect.value !== 'all') ? comunaSelect.options[comunaSelect.selectedIndex].text : 'Todas las Comunas';
    
    const estabSelect = document.getElementById('calendarioEstablecimientoFilter');
    const estabText = (estabSelect && estabSelect.value !== 'all') ? estabSelect.value : 'Todos los Establecimientos';

    const ws_data = [];
    
    ws_data.push([`REPORTE CALENDARIO PROGRAMÁTICAS ${currentYear}`]); 
    ws_data.push(["Servicio de Salud Osorno"]);
    ws_data.push(["Reporte por Ocurrencia"]);
    ws_data.push([]); 
    ws_data.push(["INFORMACIÓN DEL REPORTE"]); 
    ws_data.push(["- Comuna:", comunaText]);
    ws_data.push(["- Establecimiento:", estabText]);
    ws_data.push(["- Filtro Fecha de Corte:", textoCorte]);
    ws_data.push(["- Fecha Base de Datos:", DATA.fecha_actualizacion || ""]); // Añadida la fecha de BD
    ws_data.push([]); 

    const table = document.querySelector('.minsal-calendar-table');
    if (!table) return;

    const theadRows = table.querySelectorAll('thead tr');
    theadRows.forEach((tr, index) => {
        const row = [];
        if (index === 1) row.push(""); // IMPORTANTE: Espacio vacío para que "RECIÉN NACIDO" caiga en la columna B
        tr.querySelectorAll('th').forEach(th => {
            const colspan = parseInt(th.getAttribute('colspan') || '1', 10);
            let text = th.innerText.replace(/\n/g, ' ');
            row.push(text);
            for (let i = 1; i < colspan; i++) row.push("");
        });
        ws_data.push(row);
    });

    const tbodyRows = table.querySelectorAll('tbody tr');
    tbodyRows.forEach(tr => {
        const row = [];
        tr.querySelectorAll('td').forEach(td => {
            let text = "";
            if (td.classList.contains('vacuna-name')) {
                text = td.querySelector('strong') ? td.querySelector('strong').innerText : td.innerText;
            } else if (td.classList.contains('clickable-dose') || td.classList.contains('dose-unclickable')) {
                if (td.classList.contains('has-value')) {
                    // Filtered state: only export the number
                    let valDiv = td.querySelector('.calendar-val');
                    text = valDiv ? valDiv.innerText : "";
                } else {
                    // Normal state: only export the label
                    let labelSpan = td.querySelector('.dose-label');
                    if (labelSpan) {
                        text = labelSpan.innerText.replace(/\n/g, ' ').trim();
                    } else {
                        text = td.innerText.replace(/\n/g, ' ').trim();
                    }
                }
            } else {
                text = td.innerText.replace(/\n/g, ' ').trim();
            }
            row.push(text);
        });
        ws_data.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(ws_data);

    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, 
        { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } },
        { s: { r: 4, c: 0 }, e: { r: 4, c: 2 } },
    ];

    ws['!merges'].push(
        { s: { r: 10, c: 0 }, e: { r: 11, c: 0 } },
        { s: { r: 10, c: 1 }, e: { r: 10, c: 10 } },
        { s: { r: 10, c: 11 }, e: { r: 10, c: 14 } },
        { s: { r: 10, c: 15 }, e: { r: 10, c: 17 } }
    );

    ws['!cols'] = [
        { wch: 35 }, // Columna A: Nombre de vacuna / Info
        { wch: 35 }  // Columna B: Valores (Osorno, Establecimiento, etc)
    ];

    ws['!views'] = [
        { showGridLines: false }
    ];

    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell_address = {c: C, r: R};
            const cell_ref = XLSX.utils.encode_cell(cell_address);
            if (!ws[cell_ref]) {
                 ws[cell_ref] = { t: 's', v: '' };
            }

            let cellStyle = { font: { name: "Calibri", sz: 10 }, alignment: { vertical: "center", horizontal: "center", wrapText: true } };

            if (R === 0) cellStyle.font = { name: "Aptos", sz: 14, bold: true, color: { rgb: "000000" } };
            else if (R === 1) cellStyle.font = { name: "Aptos", sz: 12, bold: true, color: { rgb: "000000" } };
            else if (R === 2) cellStyle.font = { name: "Aptos", sz: 11, bold: false, color: { rgb: "000000" } };
            else if (R === 4) cellStyle.font = { name: "Aptos", sz: 10, bold: true, color: { rgb: "000000" } };
            else if (R >= 5 && R <= 8 && C === 0) { // INFO rows
                cellStyle.font = { name: "Aptos", sz: 10, bold: true, color: { rgb: "333333" } };
                cellStyle.alignment.horizontal = "left";
            }
            else if (R >= 5 && R <= 8 && C === 1) {
                cellStyle.alignment.horizontal = "left";
            }
            else if (R === 10) { // Thead 1
                cellStyle.fill = { fgColor: { rgb: "1A3B66" } };
                cellStyle.font = { name: "Calibri", sz: 10, color: { rgb: "FFFFFF" }, bold: true };
                cellStyle.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
            }
            else if (R === 11) { // Thead 2
                cellStyle.fill = { fgColor: { rgb: "0F69B4" } };
                cellStyle.font = { name: "Calibri", sz: 9, color: { rgb: "FFFFFF" }, bold: true };
                cellStyle.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
                cellStyle.alignment.wrapText = true;
            }
            else if (R > 11) {
                // TODAS LAS CELDAS DE LA TABLA TIENEN BORDE NEGRO EXPLÍCITO
                cellStyle.border = { 
                    top: { style: "thin", color: { rgb: "000000" } }, 
                    bottom: { style: "thin", color: { rgb: "000000" } }, 
                    left: { style: "thin", color: { rgb: "000000" } }, 
                    right: { style: "thin", color: { rgb: "000000" } } 
                };
                
                if (C === 0) {
                    cellStyle.alignment.horizontal = "left";
                    cellStyle.font = { name: "Calibri", sz: 10, bold: true };
                    cellStyle.fill = { patternType: "solid", fgColor: { rgb: "F2F5F9" } };
                } else if (ws_data[R][C] !== "") {
                    const content = ws_data[R][C];
                    if (!isNaN(parseFloat(content.replace(/\./g, '')))) {
                        cellStyle.font = { name: "Calibri", sz: 11, bold: true, color: { rgb: "0F766E" } };
                        cellStyle.fill = { patternType: "solid", fgColor: { rgb: "E6F4F1" } };
                    } else {
                        cellStyle.font = { name: "Calibri", sz: 9, color: { rgb: "333333" } };
                        cellStyle.fill = { patternType: "solid", fgColor: { rgb: "FFFFFF" } };
                    }
                } else {
                    cellStyle.fill = { patternType: "solid", fgColor: { rgb: "FFFFFF" } };
                }
            }

            ws[cell_ref].s = cellStyle;
        }
    }

    ws['!cols'] = [{ wch: 45 }]; // Columna A más ancha
    for (let i = 1; i < 18; i++) {
        ws['!cols'].push({ wch: 10 });
    }

    // Agregar merges para las celdas B7, B8, B9, B10 (índices 6 a 9, columna 1)
    ws['!merges'].push(
        { s: { r: 6, c: 1 }, e: { r: 6, c: 4 } },
        { s: { r: 7, c: 1 }, e: { r: 7, c: 4 } },
        { s: { r: 8, c: 1 }, e: { r: 8, c: 4 } },
        { s: { r: 9, c: 1 }, e: { r: 9, c: 4 } }
    );

    ws['!views'] = [
        { showGridLines: false }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Calendario Interactivo");
    XLSX.writeFile(wb, `Calendario_Programaticas_${currentYear}.xlsx`);
}
