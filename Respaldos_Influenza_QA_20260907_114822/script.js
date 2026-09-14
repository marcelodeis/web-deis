// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD DE INTELIGENCIA TERRITORIAL - ESTADO MAESTRO (RESTAURACIÓN T89)
// ─────────────────────────────────────────────────────────────────────────────

Chart.register(ChartDataLabels);

let dashboardData = null;
let charts = {};
let mapInstance = null;

const minsalColors = ['#0f69b4', '#0054a6', '#0284c7', '#0ea5e9', '#06b6d4', '#14b8a6'];
Chart.defaults.color = '#475569';
Chart.defaults.font.family = "'Inter', sans-serif";

// Parche para Leaflet: Forzar coordenadas enteras para evitar texto borroso en popups
const originalSetPosition = L.DomUtil.setPosition;
L.DomUtil.setPosition = function(el, point) {
    if (point && point.x !== undefined && point.y !== undefined) {
        point.x = Math.round(point.x);
        point.y = Math.round(point.y);
    }
    originalSetPosition(el, point);
};

// ── UTILIDADES ─────────────────────────────────────────────────────────────

function isGrupoElegibleParaCobertura(grupo) {
    if (!grupo) return false;
    const lowerGroup = grupo.toLowerCase();
    // Excluir grupos sin meta/denominador programático
    if (lowerGroup === 'poblacion general' || lowerGroup === 'población general') {
        return false;
    }
    return true;
}

function downloadChartImage(canvasId, fileName) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    // Crear un canvas temporal, añadiendo espacio extra abajo para el texto
    const paddingBottom = 30;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height + paddingBottom;
    const ctx = tempCanvas.getContext('2d');
    
    // Rellenar fondo con blanco puro (o el color que corresponda al tema si prefieres, pero blanco asegura lectura de PNGs)
    const currentTheme = document.documentElement.getAttribute('data-theme');
    ctx.fillStyle = currentTheme === 'dark' ? '#1e293b' : '#ffffff';
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Dibujar el gráfico original sobre el fondo
    ctx.drawImage(canvas, 0, 0);
    
    // Agregar el texto de la fuente y fecha de corte
    const fecha = dashboardData && dashboardData.fecha_actualizacion ? dashboardData.fecha_actualizacion : '';
    ctx.fillStyle = currentTheme === 'dark' ? '#94a3b8' : '#64748b';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Fuente: DEIS - MINSAL | Fecha de corte: ${fecha}`, tempCanvas.width - 15, tempCanvas.height - 10);
    
    const link = document.createElement('a');
    link.download = fileName + '.png';
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
}

function animateValue(obj, start, end, duration, formatFn) {
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const currentVal = progress * (end - start) + start;
        obj.innerText = formatFn ? formatFn(currentVal) : Math.floor(currentVal).toLocaleString('es-CL');
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

function abbreviate(name) {
    if (!name) return "";
    return name
        .replace(/Centro de Salud Familiar/gi, 'CESFAM')
        .replace(/Posta de Salud Rural/gi, 'PSR')
        .replace(/Centro Comunitario de Salud Familiar/gi, 'CECOSF')
        .replace(/Hospital/gi, 'Hosp.')
        .replace(/Clinica Alemana.*/gi, 'Clínica Alemana')
        .replace(/Centro Medico Cochrane.*/gi, 'Cochrane')
        .replace(/Mutual de Seguridad.*/gi, 'Mutual CCHC')
        .replace(/Vaxplus.*/gi, 'VAXPLUS');
}

function wrapLabel(text, maxChars = 20) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    for (const word of words) {
        if ((currentLine + word).length > maxChars && currentLine.trim().length > 0) {
            lines.push(currentLine.trim());
            currentLine = word + ' ';
        } else {
            currentLine += word + ' ';
        }
    }
    if (currentLine.trim().length > 0) {
        lines.push(currentLine.trim());
    }
    return lines;
}

function getCampaignStats(totalV, metaT) {
    const start = new Date(2026, 2, 1); // 1 de Marzo 2026
    let today = new Date();
    
    if (dashboardData && dashboardData.fecha_actualizacion) {
        const parts = dashboardData.fecha_actualizacion.split(/[\s/:]+/);
        if (parts.length >= 3) {
            const d = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const y = parseInt(parts[2], 10);
            today = new Date(y, m, d);
        }
    }
    
    // Días transcurridos (calendario)
    const elapsedMs = today - start;
    const elapsedDays = Math.max(1, Math.floor(elapsedMs / (1000 * 60 * 60 * 24)));
    
    // Ritmo actual (dosis por día en promedio histórico)
    const currentPace = totalV / elapsedDays;
    
    // Brecha para el 85%
    const targetDoses = Math.ceil(metaT * 0.85);
    const gap = Math.max(0, targetDoses - totalV);
    
    // Proyección de días para alcanzar la meta a este ritmo
    const projectedDaysToHit = currentPace > 0 ? Math.ceil(gap / currentPace) : 0;
    
    // Fecha proyectada
    const projectedDate = new Date(today);
    projectedDate.setDate(today.getDate() + projectedDaysToHit);
    
    return {
        currentPace: currentPace,
        projectedDate: projectedDate,
        targetDoses: targetDoses,
        elapsedDays: elapsedDays
    };
}

function getMetaTotal(filter, group = 'Total') {
    if (!dashboardData || !dashboardData.metas || Object.keys(dashboardData.metas).length === 0) return 0;
    if (filter === 'all') {
        return Object.values(dashboardData.metas).reduce((sum, m) => sum + (group === 'Total' ? m.Total : (m.Criterios[group] || 0)), 0);
    }
    const metaKey = Object.keys(dashboardData.metas).find(k => k.toLowerCase() === filter.toLowerCase());
    if (metaKey && dashboardData.metas[metaKey]) {
        return group === 'Total' ? dashboardData.metas[metaKey].Total : (dashboardData.metas[metaKey].Criterios[group] || 0);
    }
    return 0;
}

// ── INICIALIZACIÓN Y AÑO DE TABLA ──────────────────────────────────────────────────

let currentTableYear = '2026';

function switchYear(year) {
    if (year === currentTableYear) return;
    currentTableYear = year;
    
    // Cambiar la base de datos global
    const dataVarName = `DASHBOARD_DATA_OFFLINE_${year}`;
    if (typeof window[dataVarName] !== 'undefined') {
        dashboardData = window[dataVarName];
    } else if (year === '2026' && typeof DASHBOARD_DATA_OFFLINE !== 'undefined') {
        dashboardData = DASHBOARD_DATA_OFFLINE; // Fallback
    }

    // Update active button styling
    const btn2026 = document.getElementById('btnYear2026');
    const btn2025 = document.getElementById('btnYear2025');
    const prod2026 = document.getElementById('btnYear2026Prod');
    const prod2025 = document.getElementById('btnYear2025Prod');
    if (btn2026) btn2026.classList.toggle('active', year === '2026');
    if (btn2025) btn2025.classList.toggle('active', year === '2025');
    if (prod2026) prod2026.classList.toggle('active', year === '2026');
    if (prod2025) prod2025.classList.toggle('active', year === '2025');
    
    // Update dynamic subtitle
    const matrizYearTitle = document.getElementById('matrizYearTitle');
    if (matrizYearTitle) {
        matrizYearTitle.textContent = `(BASE OCURRENCIA ${year})`;
    }
    
    // Update dynamically tagged texts in HTML
    const rechOcurrenciaTag = document.getElementById('rechazos-ocurrencia-tag');
    if (rechOcurrenciaTag) rechOcurrenciaTag.innerHTML = `BASE OCURRENCIA ${year} <i class="fas fa-info-circle" style="margin-left: 6px; cursor: help;" title="El total por ocurrencia puede diferir del total por residencia, ya que corresponden a criterios territoriales distintos. Residencia identifica dónde vive la persona; ocurrencia identifica dónde fue registrado el rechazo."></i>`;
    
    const terrResOriginario = document.getElementById('territory-context-residencia-originario');
    if (terrResOriginario) terrResOriginario.textContent = `PROVINCIAL · BASE RESIDENCIA ${year} · PUEBLO ORIGINARIO REGISTRADO`;
    
    const rechazosResidenciaTag = document.getElementById('rechazos-territory-tag');
    if (rechazosResidenciaTag) rechazosResidenciaTag.textContent = `BASE RESIDENCIA ${year}`;

    const btnDescargaRechazos = document.getElementById('btnDescargaRechazos');
    if (btnDescargaRechazos) {
        btnDescargaRechazos.href = `Rechazos_Influenza_General_${year}.xlsx`;
    }
    
    const btnDescargaRescates = document.getElementById('btnDescargaRescates');
    if (btnDescargaRescates) {
        btnDescargaRescates.href = `Rescates_Influenza_60Plus_${year}.xlsx`; // Updating filename assumption based on audit
    }
    
    const autoTitulo = document.getElementById('autoconsulta-titulo-year');
    if (autoTitulo) autoTitulo.textContent = `Influenza por Residencia ${year} — DEIS MINSAL.`;
    
    const rescateTitulo = document.getElementById('rescates-titulo-year');
    if (rescateTitulo) rescateTitulo.textContent = `Influenza ${year}`;
    
    const notaFuente = document.getElementById('nota-fuente-year');
    if (notaFuente) notaFuente.textContent = `Influenza ${year}`;
    
    const notaCriterio = document.getElementById('nota-criterio-year');
    if (notaCriterio) notaCriterio.textContent = `base residencia ${year}`;
    
    const notaMeta = document.getElementById('nota-meta-year');
    if (notaMeta) notaMeta.textContent = `Influenza ${year}`;

    // Disable Autoconsulta module for 2025 since there's no nominal database
    const autoModule = document.getElementById('autoconsulta-module');
    if (autoModule) {
        if (year === '2025') {
            autoModule.style.display = 'none';
        } else {
            autoModule.style.display = 'block';
        }
    }

    // Update fecha corte
    const reportDateEl = document.getElementById('reportDate');
    if (reportDateEl && dashboardData.fecha_actualizacion) {
        reportDateEl.innerText = `Fuente: ${dashboardData.fuente || 'DEIS-MINSAL'} | Datos disponibles hasta:  | Última SE con registros disponibles: `;
    }
    
    populateFechaCorte(year);

    // Re-render entire dashboard
    renderAll();
}

// ── LÓGICA PARA ARRASTRAR LA VENTANA MODAL ──
function makeDraggable(modalId, handleId) {
    const modal = document.getElementById(modalId);
    const handle = document.getElementById(handleId);
    if (!modal || !handle) return;

    handle.style.cursor = 'grab';

    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        // Obtener posición inicial
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
        handle.style.cursor = 'grabbing';
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // Calcular nueva posición
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        
        let currentTop = parseFloat(modal.style.top) || 0;
        let currentLeft = parseFloat(modal.style.left) || 0;
        
        let newTop = currentTop - pos2;
        let newLeft = currentLeft - pos1;
        
        // Prevenir que se pierda fuera de los bordes de la pantalla
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - 50));
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - 100));

        modal.style.top = newTop + "px";
        modal.style.left = newLeft + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
        handle.style.cursor = 'grab';
    }
}

function updateTableData() {
    const filter = document.getElementById('globalComunaFilter')?.value || 'all';
    const tipoFilter = document.getElementById('globalTipoFilter')?.value || 'all';
    
    let data_ocur = filter === 'all' ? dashboardData.data_ocurrencia : dashboardData.data_ocurrencia.filter(i => i.comuna === filter);
    
    if (tipoFilter !== 'all') {
        data_ocur = data_ocur.filter(d => {
            const privPattern = /clinica|mutual|achs|particular|privad|isapre|mutualidad|vaxplus|cochrane/i;
            const isPrivado = privPattern.test(d.establecimiento) || (typeof dashboardData !== 'undefined' && dashboardData.estab_privados && dashboardData.estab_privados.includes(d.establecimiento));
            const tipo = isPrivado ? 'privado' : 'publico';
            return tipo === tipoFilter;
        });
    }
    
    const dataVarName = `DASHBOARD_DATA_OFFLINE_${currentTableYear}`;
    let tableDataObj = dashboardData; // fallback
    if (typeof window[dataVarName] !== 'undefined') {
        tableDataObj = window[dataVarName];
    }
    
    renderTable(data_ocur, tableDataObj);
}

async function init() {
    try {
        if (typeof DASHBOARD_DATA_OFFLINE_2026 !== 'undefined') {
            dashboardData = DASHBOARD_DATA_OFFLINE_2026;
        } else if (typeof DASHBOARD_DATA_OFFLINE !== 'undefined') {
            dashboardData = DASHBOARD_DATA_OFFLINE; // Fallback to old format
        } else {
            console.warn(`No offline data found. Trying to fetch JSON.`);
            const response = await fetch(`dashboard_data_2026.json`);
            dashboardData = await response.json();
        }

        const savedTheme = localStorage.getItem('influenza_theme');
        if (savedTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            Chart.defaults.color = '#94a3b8';
        }

        populateFilters();
        setupEvents();
        
        const reportDateEl = document.getElementById('reportDate');
        if (reportDateEl) reportDateEl.innerText = `Fuente: ${dashboardData.fuente || 'DEIS-MINSAL'} | Datos disponibles hasta:  | Última SE con registros disponibles: `;
        
        // Inicializar el arrastre de la ventana modal
        makeDraggable('helpModal', 'helpModalTitle');
        
        renderAll();
    } catch (e) { console.error("Error init:", e); }
}

function setupEvents() {
    const globalComuna = document.getElementById('globalComunaFilter');
    const tableComuna = document.getElementById('tableComunaFilter');
    
    if (globalComuna) {
        globalComuna.addEventListener('change', (e) => {
            if (tableComuna) tableComuna.value = e.target.value;
            renderAll();
        });
    }
    
    const globalTipo = document.getElementById('globalTipoFilter');
    if (globalTipo) {
        globalTipo.addEventListener('change', () => renderAll());
    }
    
    if (tableComuna) {
        tableComuna.addEventListener('change', (e) => {
            if (globalComuna) globalComuna.value = e.target.value;
            renderAll();
        });
    }

    document.getElementById('criticalModeToggle')?.addEventListener('change', () => renderTerritoryMap());

    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('influenza_theme', newTheme);
            Chart.defaults.color = newTheme === 'dark' ? '#94a3b8' : '#475569';
            renderAll();
        });
    }

    const tableSearch = document.getElementById('tableSearch');
    if (tableSearch) {
        tableSearch.addEventListener('keyup', function() {
            const filterValue = this.value.toLowerCase();
            const rows = document.querySelectorAll('#dataTable tbody tr');
            rows.forEach(row => {
                const text = row.innerText.toLowerCase();
                row.style.display = text.includes(filterValue) ? '' : 'none';
            });
            updateTableFooter();
            
            // Sync with charts
            const globalFilter = document.getElementById('globalComunaFilter')?.value || 'all';
            const tipoFilter = document.getElementById('globalTipoFilter')?.value || 'all';
            
            let data_ocur = globalFilter === 'all' ? dashboardData.data_ocurrencia : dashboardData.data_ocurrencia.filter(i => i.comuna === globalFilter);
            if (tipoFilter !== 'all') {
                data_ocur = data_ocur.filter(d => {
                    const privPattern = /clinica|mutual|achs|particular|privad|isapre|mutualidad|vaxplus|cochrane/i;
                    const isPrivado = privPattern.test(d.establecimiento) || (typeof dashboardData !== 'undefined' && dashboardData.estab_privados && dashboardData.estab_privados.includes(d.establecimiento));
                    const tipo = isPrivado ? 'privado' : 'publico';
                    return tipo === tipoFilter;
                });
            }
            
            let data_resi = globalFilter === 'all' ? dashboardData.data_residencia : dashboardData.data_residencia.filter(i => i.comuna === globalFilter);

            if (filterValue) {
                data_ocur = data_ocur.filter(i => i.establecimiento.toLowerCase().includes(filterValue));
                renderDoughnutChart(data_resi, globalFilter);
                renderCriterioChart(data_resi, globalFilter);
            } else {
                let data_resi = globalFilter === 'all' ? dashboardData.data_residencia : dashboardData.data_residencia.filter(i => i.comuna === globalFilter);
                renderCriterioChart(data_resi, globalFilter);
            }
            // Update table which shows Ocurrencia
            updateTableData(data_ocur);
        });
    }

    const criterioFilter = document.getElementById('criterioFilter');
    if (criterioFilter) {
        criterioFilter.addEventListener('change', () => {
            updateTableData();
        });
    }

    const fechaCorteFilter = document.getElementById('fechaCorteFilter');
    if (fechaCorteFilter) {
        fechaCorteFilter.addEventListener('change', () => {
            updateTableData();
            updateLegendText();
        });
    }
}

function populateFilters() {
    const select = document.getElementById('globalComunaFilter');
    const tableSelect = document.getElementById('tableComunaFilter');
    
    if (select && dashboardData && dashboardData.data_residencia) {
        const comunas = [...new Set(dashboardData.data_residencia.map(i => i.comuna))].sort();
        comunas.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c; opt.textContent = c;
            opt.style.color = 'black';
            select.appendChild(opt);
            
            if (tableSelect) {
                const optTable = document.createElement('option');
                optTable.value = c; optTable.textContent = c;
                optTable.style.color = 'black';
                tableSelect.appendChild(optTable);
            }
        });
    }
    
    const criterioSelect = document.getElementById('criterioFilter');
    if (criterioSelect && dashboardData && dashboardData.headers) {
        dashboardData.headers.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h; opt.textContent = h;
            opt.style.color = 'black';
            criterioSelect.appendChild(opt);
        });
    }

    populateFechaCorte(currentTableYear);
}

function populateFechaCorte(yearStr) {
    const fechaCorteSelect = document.getElementById('fechaCorteFilter');
    if (!fechaCorteSelect) return;
    
    fechaCorteSelect.innerHTML = ''; // Clear previous options
    
    const year = parseInt(yearStr, 10);
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    
    const dataVarName = `DASHBOARD_DATA_OFFLINE_${yearStr}`;
    let dataObj = dashboardData;
    if (typeof window[dataVarName] !== 'undefined') {
        dataObj = window[dataVarName];
    }

    // Obtener la fecha del dashboard si existe
    let defaultDate = '';
    if (dataObj && dataObj.fecha_actualizacion) {
        const parts = dataObj.fecha_actualizacion.split(/[\s/:]+/);
        if (parts.length >= 3) {
            const d = parts[0].padStart(2, '0');
            const m = parts[1].padStart(2, '0');
            const y = parts[2];
            defaultDate = `${d}/${m}/${y}`;
        }
    }
    
    // Generar último día de cada mes basado en los meses reales de la base
    let mesesList = [];
    if (dataObj && dataObj.meses_base && dataObj.meses_base.length > 0) {
        mesesList = dataObj.meses_base.map(m => m - 1); // Convertir a índice 0 (0=Enero)
    } else {
        // Fallback si la base no tiene meses_base
        mesesList = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; // Marzo a Diciembre
    }

    let isDefaultDateACierre = false;
    const optionsToAdd = [];

    mesesList.forEach(m => {
        // El día 0 del mes siguiente es el último día del mes actual
        const lastDay = new Date(year, m + 1, 0);
        const d = lastDay.getDate().toString().padStart(2, '0');
        const mo = (m + 1).toString().padStart(2, '0');
        const value = `${d}/${mo}/${year}`;
        
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = `Cierre ${months[m]} (${value})`;
        opt.style.color = 'black';
        
        if (value === defaultDate) {
            isDefaultDateACierre = true;
            opt.selected = true;
        }
        optionsToAdd.push(opt);
    });

    // Si la fecha por defecto NO es un cierre de mes, agregar opción "Actual" al principio
    if (!isDefaultDateACierre && defaultDate !== '' && defaultDate.endsWith(yearStr)) {
        const optActual = document.createElement('option');
        optActual.value = defaultDate;
        optActual.textContent = `Actual (${defaultDate})`;
        optActual.style.color = 'black';
        optActual.selected = true;
        fechaCorteSelect.appendChild(optActual);
    } else if (!isDefaultDateACierre && optionsToAdd.length > 0) {
        optionsToAdd[optionsToAdd.length - 1].selected = true;
    }

    // Agregar todas las opciones de cierre
    optionsToAdd.forEach(opt => fechaCorteSelect.appendChild(opt));
}

function updateContextLabels(filter) {
    const contextName = (filter === 'all' ? 'Provincial' : filter).toUpperCase();
    
    document.querySelectorAll('.territory-context-residencia').forEach(el => {
        el.innerHTML = `${contextName} | BASE RESIDENCIA ${currentTableYear}`;
    });
    
    document.querySelectorAll('.territory-context-ocurrencia').forEach(el => {
        el.innerHTML = `${contextName} | BASE OCURRENCIA ${currentTableYear}`;
    });
}

function updateLegendText() {
    const fechaSelect = document.getElementById('fechaCorteFilter');
    const legendTextSpan = document.getElementById('legendMonthText');
    const legendTooltip = document.getElementById('legendGreenTooltip');
    if (!fechaSelect || !legendTextSpan || !legendTooltip) return;
    
    // Obtener mes numérico de la fecha seleccionada (d/m/yyyy)
    const parts = fechaSelect.value.split('/');
    const maxMonth = parts.length >= 2 ? parseInt(parts[1], 10) : 99;
    
    const monthNames = {
      3: "MARZO", 4: "ABRIL", 5: "MAYO", 6: "JUNIO", 
      7: "JULIO", 8: "AGOSTO", 9: "SEPTIEMBRE", 
      10: "OCTUBRE", 11: "NOVIEMBRE", 12: "DICIEMBRE"
    };
    
    if (maxMonth < 99 && monthNames[maxMonth]) {
        const monthName = monthNames[maxMonth];
        legendTextSpan.innerText = `Dosis administradas SOLO en el mes de ${monthName}`;
        legendTooltip.setAttribute('data-tooltip', `Dosis administradas de forma exclusiva durante el mes de ${monthName}.`);
    } else {
        legendTextSpan.innerText = `Dosis administradas SOLO en este mes`;
        legendTooltip.setAttribute('data-tooltip', `Dosis administradas de forma exclusiva durante el mes de análisis.`);
    }
}

function renderAll() {
    const filter = document.getElementById('globalComunaFilter')?.value || 'all';
    const tipoFilter = document.getElementById('globalTipoFilter')?.value || 'all';
    
    // Epidemiológico (Residencia) - Ahora soporta splits Público/Privado precalculados en el backend
    let baseResi = dashboardData.data_residencia;
    let baseAvance = dashboardData.avance_semanal || {};
    let basePueblos = dashboardData.pueblos_data || {};
    
    if (tipoFilter === 'publico') {
        baseResi = dashboardData.data_residencia_publico || baseResi;
        baseAvance = dashboardData.avance_semanal_publico || baseAvance;
        basePueblos = dashboardData.pueblos_data_publico || basePueblos;
    } else if (tipoFilter === 'privado') {
        baseResi = dashboardData.data_residencia_privado || baseResi;
        baseAvance = dashboardData.avance_semanal_privado || baseAvance;
        basePueblos = dashboardData.pueblos_data_privado || basePueblos;
    }
    
    let data_resi = filter === 'all' ? baseResi : baseResi.filter(i => i.comuna === filter);
    window.currentBaseAvance = baseAvance;
    window.currentBasePueblos = basePueblos;
    window.currentBaseResi = baseResi;
    
    // Operativo (Ocurrencia)
    let data_ocur = filter === 'all' ? dashboardData.data_ocurrencia : dashboardData.data_ocurrencia.filter(i => i.comuna === filter);
    if (tipoFilter !== 'all') {
        const privPattern = /clinica|mutual|achs|particular|privad|isapre|mutualidad|vaxplus|cochrane/i;
        data_ocur = data_ocur.filter(d => {
            const isPrivado = privPattern.test(d.establecimiento) || (typeof dashboardData !== 'undefined' && dashboardData.estab_privados && dashboardData.estab_privados.includes(d.establecimiento));
            const tipo = isPrivado ? 'privado' : 'publico';
            return tipo === tipoFilter;
        });
    }
    
    updateContextLabels(filter);
    
    // Si estamos filtrando por tipo (ej. solo privados), la residencia (KPIs globales) sigue mostrando el total de la comuna
    // porque las metas son comunales totales (público + privado). Los gráficos de ocurrencia sí cambian.
    updateKPIs(data_resi, filter);
    renderTimeSeriesChart(data_resi, filter);
    renderTerritoryMap();
    renderInterculturalGrid(filter);
    renderDoughnutChart(data_resi, filter);
    renderBarChart(data_resi); // Residencia
    renderCriterioChart(data_resi, filter);
    updateTableData();
    updateLegendText();
}

// ── KPIs Y RANKING (ALINEADO A LA IZQUIERDA) ───────────────────────────────

function updateKPIs(data, filter) {
    const totalV = data.reduce((s, i) => s + i.total, 0); // Dosis totales administradas
    
    // Solo vacunas aplicadas a grupos objetivo
    const targetDosesSum = data.reduce((s, i) => {
        let validSum = 0;
        Object.entries(i.datos).forEach(([g, v]) => {
            if (isGrupoElegibleParaCobertura(g)) {
                if (typeof v === 'object' && v !== null) {
                    validSum += Object.values(v).reduce((a, b) => a + b, 0);
                } else {
                    validSum += v;
                }
            }
        });
        return s + validSum;
    }, 0);
    
    const extraDoses = totalV - targetDosesSum;

    const metaT = getMetaTotal(filter);
    const coverage = metaT > 0 ? (targetDosesSum / metaT) * 100 : 0;

    const totalEl = document.getElementById('kpi-total');
    if (totalEl) animateValue(totalEl, 0, coverage, 1000, (v) => v.toFixed(1).replace('.', ',') + '%');
    
    const vacEl = document.getElementById('kpi-vacunados');
    if (vacEl) animateValue(vacEl, 0, targetDosesSum, 1000);

    const univEl = document.getElementById('kpi-universo');
    if (univEl) animateValue(univEl, 0, metaT, 1000);
    
    const pendingEl = document.getElementById('kpi-pending');
    if (pendingEl) animateValue(pendingEl, 0, Math.max(0, Math.ceil(metaT * 0.85) - targetDosesSum), 1000);

    // Simulación de Esfuerzo Estadístico (Basado solo en grupos objetivo)
    const stats = getCampaignStats(targetDosesSum, metaT);
    const predEl = document.getElementById('strategic-prediction-content');
    
    if (predEl) {
        if (targetDosesSum >= stats.targetDoses) {
            predEl.innerHTML = `
                <div style="background:#10b98110; padding:8px; border-radius:8px; border-left:3px solid #10b981; text-align:left;">
                    <div style="font-size:1.1rem; font-weight:900; color:#fff; margin-bottom:2px;">¡Meta Lograda!</div>
                    <div style="font-size:0.6rem; color:#94a3b8; line-height:1.2;">Campaña alcanzó cobertura.</div>
                </div>
            `;
        } else {
            const gap = Math.max(0, stats.targetDoses - targetDosesSum);
            predEl.innerHTML = `
                <div style="background:#0ea5e910; padding:8px; border-radius:8px; border-left:3px solid #0ea5e9; text-align:left;">
                    <div style="font-size:1.1rem; font-weight:900; color:#fff; margin-bottom:2px;">${Math.ceil(stats.currentPace).toLocaleString('es-CL')} <small style="font-size:0.55rem; opacity:0.8;">dosis/día</small></div>
                    <div style="font-size:0.6rem; color:#94a3b8; line-height:1.2;">Ritmo diario requerido para alcanzar la meta al cierre de campaña. Faltantes para meta: <b style="color:#fff;">${gap.toLocaleString('es-CL')}</b>.</div>
                </div>
            `;
        }
    }

    updateRankings(data, filter);
}

function updateRankings(data, filter) {
    const groups = {};
    data.forEach(item => Object.entries(item.datos).forEach(([g,v]) => groups[g] = (groups[g] || 0) + v));
    
    const stats = Object.entries(groups).map(([g,v]) => {
        const m = getMetaTotal(filter, g);
        return { g, v, m, p: m > 0 ? (v / m) * 100 : 0 };
    }).filter(s => s.g !== 'Estrategia Capullo' && isGrupoElegibleParaCobertura(s.g) && s.m > 0)
    .sort((a,b) => b.p - a.p);

    const topEl = document.getElementById('kpi-top-grupo');
    const worstEl = document.getElementById('kpi-worst-grupo');
    
    if (topEl && stats.length > 0) {
        let topG = stats[0].g.replace('P. de salud:', 'Prestador:').replace('Cuidadores de adultos mayores y funcionarios de los ELEAM', 'Cuidadores de adultos mayores y funcionarios ELEAM').replace('Personas mayores de 60 años y más (año 1966)', 'Personas de 60 años y más (nacidos en 1966 o antes)');
        let topHtml = `<div style="display: flex; flex-direction: column; gap: 4px; padding-top: 4px;">
                           <span style="font-weight:700; color:#1e293b; font-size: 0.95rem; line-height: 1.25;">${topG}</span>
                           <div style="display: flex; flex-direction: column; gap: 2px; margin-top: 2px;">
                               <span style="font-size:0.85rem; color:#0ea5e9; font-weight: 700;">${stats[0].p.toFixed(1).replace('.', ',')}% cobertura registrada</span>`;
        if (stats[0].p >= 100) {
            topHtml += `       <span style="font-size:0.8rem; color:#10b981; font-weight: 600;">Meta superada</span>`;
        }
        topHtml += `       </div>
                       </div>`;
        topEl.innerHTML = topHtml;
                           
        const topPred = document.getElementById('strategic-prediction-top');
        if (topPred) {
            if (stats[0].p >= 100) {
                const surplus = stats[0].v - stats[0].m;
                topPred.innerHTML = `
                    <div style="background:#10b98110; padding:10px; border-radius:10px; border-left:4px solid #10b981; text-align:left;">
                        <div style="font-size:1.1rem; font-weight:900; color:#fff; margin-bottom:2px;">Meta 100% alcanzada</div>
                        <div style="font-size:0.65rem; color:#94a3b8; line-height:1.2;">Excedente sobre meta: ${surplus.toLocaleString('es-CL')} dosis.<br><br><i>Nota: Coberturas sobre 100% pueden ocurrir cuando el número de vacunados registrados supera la población estimada del grupo.</i></div>
                    </div>
                `;
            } else {
                const missing = Math.max(0, stats[0].m - stats[0].v);
                topPred.innerHTML = `
                    <div style="background:#10b98110; padding:10px; border-radius:10px; border-left:4px solid #10b981; text-align:left;">
                        <div style="font-size:1.1rem; font-weight:900; color:#fff; margin-bottom:2px;">${stats[0].v.toLocaleString('es-CL')} <small style="font-size:0.6rem; opacity:0.8;">dosis admin.</small></div>
                        <div style="font-size:0.65rem; color:#94a3b8; line-height:1.2;">Faltan ${missing.toLocaleString('es-CL')} dosis para meta 100%.</div>
                    </div>
                `;
            }
        }
    } else if (topEl) {
        topEl.innerHTML = `<span style="font-size:0.9rem; color:#64748b;">Datos de metas no disponibles aún.</span>`;
        const topPred = document.getElementById('strategic-prediction-top');
        if (topPred) topPred.innerHTML = '';
    }
    
    if (worstEl && stats.length > 0) {
        let targetGroup = stats.find(s => /60 a[ñn]os/i.test(s.g));
        if (!targetGroup) targetGroup = stats[stats.length - 1]; // Fallback
        
        let targetGroupLabel = targetGroup.g.replace('P. de salud:', 'Prestador:').replace('Personas mayores de 60 años y más (año 1966)', 'Personas de 60 años y más (nacidos en 1966 o antes)');
        
        /* 
         * REGLA METODOLÓGICA:
         * Para la clasificación visual de estados del dashboard se utiliza la cobertura normalizada a una décima (p10/pVis), 
         * coincidente con la precisión presentada al usuario. El valor bruto original (targetGroup.p) se conserva para auditoría 
         * y cálculos que requieran mayor precisión. 
         * Esto garantiza que los puntos de corte 70,0% y 85,0% se evalúen sobre la misma precisión visible y evita contradicciones.
         */
        const p10 = Math.round((targetGroup.p * 10) + 1e-9);
        const pVis = p10 / 10;
        const brechaPP = 85.0 - pVis;
        
        let stateTitle = 'GRUPO PRIORITARIO REZAGADO';
        let stateColor = '#ef4444'; // Rojo
        let stateBg = 'rgba(239, 68, 68, 0.1)';
        let emoji = '⚠️';
        let ppText = `Faltan ${Math.max(0, brechaPP).toFixed(1).replace('.', ',')} pp <span title="pp = puntos porcentuales" style="cursor:help; font-size:0.75em; opacity:0.7;">ℹ️</span> para la meta`;
        
        if (p10 > 850) {
            stateTitle = 'GRUPO PRIORITARIO EN META';
            stateColor = '#10b981'; // Verde
            stateBg = 'rgba(16, 185, 129, 0.1)';
            emoji = '✅';
            ppText = `Meta superada`;
        } else if (p10 === 850) {
            stateTitle = 'GRUPO PRIORITARIO EN META';
            stateColor = '#10b981'; // Verde
            stateBg = 'rgba(16, 185, 129, 0.1)';
            emoji = '✅';
            ppText = `Meta alcanzada`;
        } else if (p10 >= 700) {
            stateTitle = 'GRUPO PRIORITARIO EN AVANCE';
            stateColor = '#f59e0b'; // Naranjo
            stateBg = 'rgba(245, 158, 11, 0.1)';
            emoji = '📈';
        }

        const titleEl = document.getElementById('kpi-worst-title');
        if (titleEl) {
            titleEl.innerText = stateTitle;
            titleEl.style.color = '#1e293b'; // Mantener color de título neutral o theme color
        }
        
        const cardWorst = document.getElementById('kpi-card-worst');
        if (cardWorst) cardWorst.style.borderTopColor = stateColor;
        
        const iconContainer = document.getElementById('kpi-icon-worst');
        if (iconContainer) iconContainer.style.background = stateBg;
        
        const emojiEl = document.getElementById('kpi-emoji-worst');
        if (emojiEl) {
            emojiEl.innerText = emoji;
            emojiEl.style.fontSize = '1.8rem'; // Reduce emoji size to fit better in icon container
        }

        worstEl.innerHTML = `<div style="display: flex; flex-direction: column; gap: 4px; padding-top: 4px;">
                                <span style="font-weight:700; color:#1e293b; font-size: 0.95rem; line-height: 1.25;">${targetGroupLabel}</span>
                                <div style="display: flex; flex-direction: column; gap: 2px; margin-top: 2px;">
                                    <span style="font-size:0.85rem; color:${stateColor}; font-weight: 700;">${pVis.toFixed(1).replace('.', ',')}% cobertura registrada</span>
                                    <span style="font-size:0.8rem; color:${stateColor}; font-weight: 600;">${ppText}</span>
                                </div>
                             </div>`;
                             
        const worstPred = document.getElementById('strategic-prediction-worst');
        if (worstPred) {
            const missing = Math.max(0, targetGroup.m - targetGroup.v);
            if (p10 > 850) {
                const overPP = (pVis - 85.0).toFixed(1).replace('.', ',');
                worstPred.innerHTML = `
                    <div style="background:${stateBg}; padding:10px; border-radius:10px; border-left:4px solid ${stateColor}; text-align:left;">
                        <div style="font-size:1.1rem; font-weight:900; color:#fff; margin-bottom:2px;">Meta Superada</div>
                        <div style="font-size:0.65rem; color:#94a3b8; line-height:1.2;">+${overPP} pp sobre la meta programática del 85%.</div>
                    </div>
                `;
            } else if (p10 === 850) {
                worstPred.innerHTML = `
                    <div style="background:${stateBg}; padding:10px; border-radius:10px; border-left:4px solid ${stateColor}; text-align:left;">
                        <div style="font-size:1.1rem; font-weight:900; color:#fff; margin-bottom:2px;">Meta Alcanzada</div>
                        <div style="font-size:0.65rem; color:#94a3b8; line-height:1.2;">Cobertura exacta del 85,0%.</div>
                    </div>
                `;
            } else {
                worstPred.innerHTML = `
                    <div style="background:${stateBg}; padding:10px; border-radius:10px; border-left:4px solid ${stateColor}; text-align:left;">
                        <div style="font-size:1.1rem; font-weight:900; color:#fff; margin-bottom:2px;">${targetGroup.v.toLocaleString('es-CL')} <small style="font-size:0.6rem; opacity:0.8;">dosis admin.</small></div>
                        <div style="font-size:0.65rem; color:#94a3b8; line-height:1.2;">Faltan ${missing.toLocaleString('es-CL')} dosis para meta 100%.</div>
                    </div>
                `;
            }
        }
    } else if (worstEl) {
        worstEl.innerHTML = `<span style="font-size:0.9rem; color:#64748b;">Datos de metas no disponibles aún.</span>`;
        const worstPred = document.getElementById('strategic-prediction-worst');
        if (worstPred) worstPred.innerHTML = '';
    }

    if (stats.length > 0) {
        renderRescateModule(stats[stats.length - 1].g, filter);
    }
}

// ── MÓDULO DE SEGUIMIENTO Y RESCATE ───────────────────────────────────────
let rescateChartInstance = null;

function renderRescateModule(grupoOriginal, tipoFilter) {
    const rescateSection = document.getElementById('modulo-rescate');
    if (!rescateSection) return;

    // Remove 'P. de salud: ' prefix for display
    let grupoDisplay = grupoOriginal.replace('P. de salud: ', 'Prestador: ');
    grupoDisplay = grupoDisplay.replace('Personas mayores de 60 años y más (año 1966)', 'Personas de 60 años y más (nacidos en 1966 o antes)');
    
    document.getElementById('rescate-grupo-name').innerText = grupoDisplay;
    document.getElementById('rescate-estab-grupo').innerText = grupoDisplay;
    
    const baseResidencia = dashboardData.data_residencia;
    if (!baseResidencia) return;

    let totalVacunadosProv = 0;
    let totalPoblacionProv = 0;
    
    const comunasStats = [];

    // Filter by type if needed
    let baseDataToUse = baseResidencia;
    if (tipoFilter === 'publico' && dashboardData.data_residencia_publico) {
        baseDataToUse = dashboardData.data_residencia_publico;
    } else if (tipoFilter === 'privado' && dashboardData.data_residencia_privado) {
        baseDataToUse = dashboardData.data_residencia_privado;
    }

    baseDataToUse.forEach(cData => {
        const comuna = cData.comuna;
        // Avoid "Desconocido" or non-commune entries if any
        if (!comuna || comuna === 'Desconocido' || comuna === 'SIN COMUNA') return;
        
        const vacunados = cData.datos[grupoOriginal] || 0;
        const poblacionObj = getMetaTotal(comuna, grupoOriginal);
        
        totalVacunadosProv += vacunados;
        totalPoblacionProv += poblacionObj;

        const cobertura = poblacionObj > 0 ? (vacunados / poblacionObj) * 100 : 0;
        const meta85 = Math.ceil(poblacionObj * 0.85);
        const brechaAbsoluta = meta85 - vacunados;
        
        let estadoStr = '';
        let estadoClass = '';
        if (cobertura < 70) {
            estadoStr = 'Crítico';
            estadoClass = 'semaforo-red';
        } else if (cobertura < 85) {
            estadoStr = 'En avance';
            estadoClass = 'semaforo-orange';
        } else {
            estadoStr = 'Meta alcanzada';
            estadoClass = 'semaforo-green';
        }

        comunasStats.push({
            comuna,
            poblacionObj,
            vacunados,
            cobertura,
            brechaAbsoluta: Math.max(0, brechaAbsoluta), // Don't show negative
            estadoStr,
            estadoClass
        });
    });

    if (comunasStats.length === 0) {
        rescateSection.style.display = 'none';
        return;
    }
    
    rescateSection.style.display = 'block';

    // Update Provincial Cards
    const coberturaProv = totalPoblacionProv > 0 ? (totalVacunadosProv / totalPoblacionProv) * 100 : 0;
    document.getElementById('rescate-cobertura-prov').innerText = coberturaProv.toFixed(1).replace('.', ',') + '%';
    document.getElementById('rescate-vacunados-prov').innerText = totalVacunadosProv.toLocaleString('es-CL');
    
    const meta85Prov = Math.ceil(totalPoblacionProv * 0.85);
    const brechaProv = Math.max(0, meta85Prov - totalVacunadosProv);
    document.getElementById('rescate-brecha-prov').innerText = brechaProv.toLocaleString('es-CL');

    // Find min coverage and max absolute gap
    let minCoberturaComuna = comunasStats[0];
    let maxBrechaComuna = comunasStats[0];

    comunasStats.forEach(c => {
        if (c.cobertura < minCoberturaComuna.cobertura) minCoberturaComuna = c;
        if (c.brechaAbsoluta > maxBrechaComuna.brechaAbsoluta) maxBrechaComuna = c;
    });

    const pctBrecha = brechaProv > 0 ? (maxBrechaComuna.brechaAbsoluta / brechaProv) * 100 : 0;
    document.getElementById('rescate-mayor-brecha').innerText = maxBrechaComuna.comuna + ' (' + maxBrechaComuna.brechaAbsoluta.toLocaleString('es-CL') + ')';
    document.getElementById('rescate-pct-brecha').innerText = `${maxBrechaComuna.comuna} concentra ~${Math.round(pctBrecha)}% de la brecha prov.`;
    document.getElementById('rescate-menor-cobertura').innerText = 'Menor cobertura: ' + minCoberturaComuna.comuna + ' (' + minCoberturaComuna.cobertura.toFixed(1).replace('.', ',') + '%)';

    // Texto descriptivo (usando la nueva meta dinamica)
    let inteligenciaTxt = '';
    if (minCoberturaComuna.comuna === maxBrechaComuna.comuna) {
        inteligenciaTxt = `<b>${minCoberturaComuna.comuna}</b> constituye actualmente la principal prioridad territorial del grupo: presenta la menor cobertura comunal del grupo (${minCoberturaComuna.cobertura.toFixed(1).replace('.', ',')}%) y, simultáneamente, concentra la mayor brecha absoluta, con <b>${maxBrechaComuna.brechaAbsoluta.toLocaleString('es-CL')}</b> personas adicionales por vacunar para alcanzar el 85%. A nivel provincial faltan <b>${brechaProv.toLocaleString('es-CL')}</b> personas para alcanzar la meta.`;
    } else {
        inteligenciaTxt = `<b>${minCoberturaComuna.comuna}</b> presenta la menor cobertura comunal del grupo (${minCoberturaComuna.cobertura.toFixed(1).replace('.', ',')}%). Sin embargo, <b>${maxBrechaComuna.comuna}</b> concentra la mayor brecha absoluta, con <b>${maxBrechaComuna.brechaAbsoluta.toLocaleString('es-CL')}</b> personas adicionales pendientes para alcanzar la meta del 85%. A nivel provincial faltan <b>${brechaProv.toLocaleString('es-CL')}</b> personas para alcanzar la meta.`;
    }
    document.getElementById('rescate-inteligencia').innerHTML = inteligenciaTxt;

    // Render Table (Sorted by lowest coverage first)
    comunasStats.sort((a, b) => a.cobertura - b.cobertura);
    
    const tbody = document.getElementById('rescate-table-body');
    tbody.innerHTML = '';
    
    comunasStats.forEach(c => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = () => {
            Array.from(tbody.querySelectorAll('tr')).forEach(row => row.style.backgroundColor = '');
            tr.style.backgroundColor = 'rgba(15, 105, 180, 0.15)';
            renderEstablecimientosRescate(c.comuna, grupoOriginal, tipoFilter);
        };
        
        const formatBrecha = c.brechaAbsoluta > 0 ? c.brechaAbsoluta.toLocaleString('es-CL') : '<span style="color:#10b981; font-weight:bold;">Meta ✓</span>';
        
        tr.innerHTML = `
            <td><span class="semaforo-dot ${c.estadoClass}"></span> ${c.estadoStr}</td>
            <td style="font-weight: 600;">${c.comuna}</td>
            <td style="text-align: right;">${c.poblacionObj.toLocaleString('es-CL')}</td>
            <td style="text-align: right;">${c.vacunados.toLocaleString('es-CL')}</td>
            <td style="text-align: right; font-weight: 600;">${c.cobertura.toFixed(1).replace('.', ',')}%</td>
            <td style="text-align: right;">${formatBrecha}</td>
        `;
        tbody.appendChild(tr);
    });

    // Render Chart
    renderRescateChart(comunasStats);
}

function renderRescateChart(comunasStats) {
    const ctx = document.getElementById('rescateChart');
    if (!ctx) return;
    
    // Do not reverse, match table order
    const chartData = [...comunasStats];

    if (rescateChartInstance) {
        rescateChartInstance.destroy();
    }

    rescateChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.map(c => c.comuna),
            datasets: [{
                label: 'Cobertura %',
                data: chartData.map(c => parseFloat(c.cobertura.toFixed(1))),
                backgroundColor: chartData.map(c => {
                    if (c.cobertura < 70) return '#dc2626';
                    if (c.cobertura < 85) return '#f59e0b';
                    return '#10b981';
                }),
                borderRadius: 4,
                barThickness: 20
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const dataIndex = context.dataIndex;
                            const c = chartData[dataIndex];
                            return [
                                `Cobertura: ${c.cobertura.toFixed(1).replace('.', ',')}%`,
                                `Vacunados: ${c.vacunados.toLocaleString('es-CL')} / ${c.poblacionObj.toLocaleString('es-CL')}`,
                                `Brecha al 85%: ${c.brechaAbsoluta.toLocaleString('es-CL')} personas`
                            ];
                        }
                    }
                },
                annotation: {
                    clip: false,
                    annotations: {
                        line1: {
                            type: 'line',
                            xMin: 85,
                            xMax: 85,
                            borderColor: 'rgba(30, 41, 59, 0.8)',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                display: true,
                                content: 'Meta 85%',
                                position: 'end',
                                yAdjust: -16,
                                backgroundColor: 'rgba(30, 41, 59, 0.8)'
                            }
                        }
                    }
                },
                datalabels: {
                    color: function(context) {
                        const value = context.dataset.data[context.dataIndex];
                        return value < 70 ? '#ffffff' : '#1e293b';
                    },
                    font: { weight: 'bold' },
                    formatter: function(value) {
                        return value.toFixed(1).replace('.', ',') + '%';
                    }
                }
            },
            layout: {
                padding: { top: 35 }
            },
            scales: {
                x: {
                    max: 100,
                    ticks: {
                        callback: function(value) { return value + '%' }
                    }
                }
            }
        }
    });
}

function renderEstablecimientosRescate(comunaName, grupoOriginal, tipoFilter) {
    const container = document.getElementById('rescate-establecimientos-container');
    const tbody = document.getElementById('rescate-estab-body');
    
    document.getElementById('rescate-estab-comuna').innerText = comunaName;
    
    if (!dashboardData || !dashboardData.data_ocurrencia) return;

    let estabsData = [];
    let totalOcurrenciaComuna = 0;

    // Filter type
    let targetTipo = null;
    if (tipoFilter === 'publico') targetTipo = 'Público';
    if (tipoFilter === 'privado') targetTipo = 'Privado';

    dashboardData.data_ocurrencia.forEach(row => {
        if (row.comuna === comunaName) {
            if (targetTipo && row.tipo !== targetTipo) return;
            
            let vacsForGroup = 0;
            // Sum across months
            const groupData = row.datos[grupoOriginal];
            if (groupData) {
                Object.values(groupData).forEach(v => vacsForGroup += v);
            }
            
            if (vacsForGroup > 0) {
                estabsData.push({ nombre: row.establecimiento, vacunados: vacsForGroup });
                totalOcurrenciaComuna += vacsForGroup;
            }
        }
    });

    if (estabsData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #64748b;">No hay datos de ocurrencia para esta comuna y grupo en el filtro actual.</td></tr>`;
    } else {
        estabsData.sort((a, b) => b.vacunados - a.vacunados);
        
        tbody.innerHTML = '';
        estabsData.forEach(e => {
            const tr = document.createElement('tr');
            const percent = totalOcurrenciaComuna > 0 ? (e.vacunados / totalOcurrenciaComuna) * 100 : 0;
            tr.innerHTML = `
                <td style="padding: 8px;">${e.nombre}</td>
                <td style="padding: 8px; text-align: right; font-weight: 600;">${e.vacunados.toLocaleString('es-CL')}</td>
                <td style="padding: 8px; text-align: right; color: #64748b;">${percent.toFixed(1).replace('.', ',')}%</td>
                <td style="padding: 8px; width: 100px;">
                    <div style="background: #e2e8f0; border-radius: 4px; overflow: hidden; height: 6px; width: 100%;">
                        <div style="background: #0ea5e9; width: ${percent}%; height: 100%;"></div>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        const tfoot = document.getElementById('rescate-estab-foot');
        if (tfoot) {
            tfoot.innerHTML = `
                <tr style="background: rgba(15, 105, 180, 0.05);">
                    <td style="padding: 12px 8px;">TOTAL COMUNA</td>
                    <td style="padding: 12px 8px; text-align: right;">${totalOcurrenciaComuna.toLocaleString('es-CL')}</td>
                    <td style="padding: 12px 8px; text-align: right;">100%</td>
                    <td style="padding: 12px 8px;"></td>
                </tr>
            `;
        }
    }

    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── MAPA Y GRÃ FICOS ───────────────────────────────────────────────────────

let geojsonLayer = null;
let markersLayerGroup = null;

function renderTerritoryMap() {
    const mapContainer = document.getElementById("territoryMap");
    if (!mapContainer || typeof L === "undefined" || !dashboardData) return;

    // ── 1. Inicializar Mapa (Si no existe) ─────────────────────────────────────
    if (!mapInstance) {
        mapInstance = L.map("territoryMap", { zoomControl: true }).setView([-40.5739, -73.1336], 9);
        // Mover el control de zoom a la posición inferior derecha para que no estorbe (opcional, pero buena práctica)
        mapInstance.zoomControl.setPosition('bottomright');
        // Diseño de mapa interactivo moderno (Google Maps)
        L.tileLayer("http://mt0.google.com/vt/lyrs=m&hl=es&x={x}&y={y}&z={z}", {
            attribution: "© Google Maps", opacity: 0.95
        }).addTo(mapInstance);
        L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(mapInstance);
    }

    // Limpiar capas previas
    if (geojsonLayer) { mapInstance.removeLayer(geojsonLayer); geojsonLayer = null; }
    if (markersLayerGroup) { mapInstance.removeLayer(markersLayerGroup); markersLayerGroup = null; }
    window.seenMarkerCoords = new Set();

    // ── 2. Lógica de Negocio: Cobertura por Comuna ─────────────────────────────
    const comunaCoberturas = {};
    const aggTotales = {};
    const baseData = typeof window.currentBaseResi !== 'undefined' ? window.currentBaseResi : dashboardData.data_residencia;
    baseData.forEach(item => {
        const cName = (item.comuna || '').toLowerCase();
        if (!cName) return;
        aggTotales[cName] = (aggTotales[cName] || 0) + item.total;
    });

    Object.keys(aggTotales).forEach(cName => {
        const metaKey = Object.keys(dashboardData.metas).find(k =>
            k.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "") ===
            cName.normalize("NFD").replace(/[^a-z]/g, "")
        );
        if (metaKey) {
            const meta = dashboardData.metas[metaKey].Total;
            if (meta > 0) comunaCoberturas[cName] = {
                perc: (aggTotales[cName] / meta) * 100,
                total: aggTotales[cName], meta
            };
        }
    });

    const getColor = perc => perc >= 85 ? "#10b981" : (perc >= 70 ? "#fbbf24" : "#ef4444");

    const filter = document.getElementById('globalComunaFilter')?.value || 'all';
    const filterNorm = filter === 'all' ? 'all' : filter.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
    const bounds = [];

    // ── 3. Polígonos de Comunas (Visualización Territorial) ────────────────────
    if (typeof COMUNAS_GEOJSON !== 'undefined' && COMUNAS_GEOJSON.features) {
        geojsonLayer = L.geoJSON(COMUNAS_GEOJSON, {
            style: feature => {
                const nGeo = (feature.properties.nombre || '').toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
                const key = Object.keys(comunaCoberturas).find(k => k.normalize("NFD").replace(/[^a-z]/g, "") === nGeo);
                const cob = key ? comunaCoberturas[key] : null;
                const isFiltered = filter !== 'all' && !nGeo.includes(filterNorm) && !filterNorm.includes(nGeo);
                
                return {
                    fillColor: cob ? getColor(cob.perc) : "#e2e8f0",
                    fillOpacity: isFiltered ? 0.05 : 0.3,
                    color: "#ffffff", weight: 1.5
                };
            },
            onEachFeature: (feature, layer) => {
                const nGeo = (feature.properties.nombre || '').toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
                const key = Object.keys(comunaCoberturas).find(k => k.normalize("NFD").replace(/[^a-z]/g, "") === nGeo);
                const cob = key ? comunaCoberturas[key] : null;
                const display = (feature.properties.nombre || '').toUpperCase();
                
                const html = cob
                    ? `<div style="min-width:160px">
                           <strong style="color:#0f69b4">${display}</strong><br>
                           <div style="margin-top:5px; padding-top:5px; border-top:1px dashed #cbd5e1; font-size:0.9em">
                               Cobertura: <b>${cob.perc.toFixed(1)}%</b><br>
                               Vacunados: ${cob.total.toLocaleString('es-CL')}<br>
                               Meta: ${cob.meta.toLocaleString('es-CL')}
                           </div>
                       </div>`
                    : `<strong>${display}</strong><br>Sin datos`;
                layer.bindPopup(html);
                layer.on('mouseover', () => layer.setStyle({ fillOpacity: 0.5 }));
                layer.on('mouseout', () => layer.setStyle({ fillOpacity: filter !== 'all' && !nGeo.includes(filterNorm) ? 0.05 : 0.3 }));
            }
        }).addTo(mapInstance);
    }

    // ── 4. Marcadores de Establecimientos (Simbología y Semáforo) ──
    if (typeof ESTABLECIMIENTOS_GEOJSON !== 'undefined') {
        const criticalOnly = document.getElementById('criticalModeToggle')?.checked;
        
        // Grupo para almacenar todos los marcadores (sin agrupar en números)
        markersLayerGroup = L.layerGroup();

        ESTABLECIMIENTOS_GEOJSON.features.forEach(f => {
            const p = f.properties;
            const cE = (p.Nombre_com || '').toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
            
            const isVisible = filter === 'all' || cE.includes(filterNorm) || filterNorm.includes(cE);
            if (!isVisible) return;
            
            // Filtro por público/privado
            const tipoFilter = document.getElementById('globalTipoFilter')?.value || 'all';
            const privPattern = /clinica|mutual|achs|particular|privad|isapre|mutualidad|vaxplus|cochrane/i;
            const isMarkerPrivado = privPattern.test(p.Nombre_Oficial) || (dashboardData.estab_privados || []).includes(p.Nombre_Oficial);
            if (tipoFilter === 'publico' && isMarkerPrivado) return;
            if (tipoFilter === 'privado' && !isMarkerPrivado) return;

            const v = dashboardData.data_ocurrencia.find(d => 
                d.establecimiento.includes(abbreviate(p.Nombre_Oficial)) || 
                p.Nombre_Oficial.includes(d.establecimiento)
            );

            // Intentar obtener cobertura específica o usar la de la comuna como referencia visual
            const key = Object.keys(comunaCoberturas).find(k => k.normalize("NFD").replace(/[^a-z]/g, "") === cE);
            const cob = key ? comunaCoberturas[key] : null;
            
            // La cobertura comunal es el único parámetro de riesgo estadísticamente válido a falta de meta por establecimiento
            const comunaPerc = cob ? cob.perc : 0;
            // El aporte del establecimiento a la meta de su comuna
            const aporteEstablecimiento = (v && cob && cob.meta) ? (v.total / cob.meta) * 100 : 0;
            const vacEstablecimiento = v ? v.total : 0;

            // 1. Lógica Semáforo (Verde >=85, Amarillo 70-84, Rojo <70) según estado Comunal
            if (criticalOnly && comunaPerc >= 70) return;
            const col = comunaPerc >= 85 ? "#10b981" : (comunaPerc >= 70 ? "#fbbf24" : "#ef4444");
            const isCritico = comunaPerc < 70;
            
            let lat = f.geometry.coordinates[1];
            let lng = f.geometry.coordinates[0];
            
            // Jitter for identical coordinates so they don't perfectly overlap and hide each other
            window.seenMarkerCoords = window.seenMarkerCoords || new Set();
            let coordKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
            let offsetMultiplier = 1;
            while (window.seenMarkerCoords.has(coordKey)) {
                // Shift slightly to the North-East for each overlapping marker
                lat += 0.002 * offsetMultiplier;
                lng += 0.002 * offsetMultiplier;
                coordKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
                offsetMultiplier++;
            }
            window.seenMarkerCoords.add(coordKey);
            
            const coords = [lat, lng];
            bounds.push(coords);

            // 2. Jerarquía Visual de Establecimientos
            let iconHtml = '<i class="fa-solid fa-house-medical"></i>';
            let estabClass = 'posta';
            let iconSize = [24, 24];
            let type = (p.Tipo_estab || "").toLowerCase();
            
            if (type.includes("hospital")) {
                iconHtml = '<i class="fa-solid fa-hospital"></i>';
                estabClass = 'hospital';
                iconSize = [32, 32];
            } else if (type.includes("cesfam") || type.includes("consultorio") || type.includes("salud familiar")) {
                iconHtml = '<i class="fa-solid fa-clinic-medical"></i>';
                estabClass = 'cesfam';
                iconSize = [28, 28];
            }

            const customIcon = L.divIcon({
                html: `<div class="estab-marker ${estabClass} ${isCritico ? 'pulse-critical' : ''}" style="background-color: ${col}; width: 100%; height: 100%;">${iconHtml}</div>`,
                className: '',
                iconSize: iconSize,
                iconAnchor: [iconSize[0]/2, iconSize[1]/2]
            });

            const marker = L.marker(coords, { icon: customIcon }).bindPopup(`
                <div style="text-align:center; min-width: 220px; padding: 10px 5px;">
                    <b style="color:#ffffff; font-size:18px; display:block; margin-bottom:4px;">${p.Nombre_Oficial}</b>
                    <span style="color:#cbd5e1; font-size:14px; display:block; margin-bottom:12px;">${p.Tipo_estab} · ${p.Nombre_com}</span>
                    <div style="padding:8px; background:#ffffff; color:#0f172a; border-radius:8px; font-weight:700; font-size:15px; border-left: 6px solid ${col}; margin-bottom: 8px;">
                        Riesgo Comunal: <span style="color:${col};">${comunaPerc.toFixed(1)}%</span>
                    </div>
                    ${v ? `<div style="padding:8px; background:#ffffff; color:#0f172a; border-radius:8px; font-weight:600; font-size:15px; border-left: 6px solid #0ea5e9;">
                        <b style="color:#0ea5e9; font-size:20px;">${v.total.toLocaleString('es-CL')}</b> vacunas adm.
                    </div>` : `<div style="padding:8px; background:rgba(255,255,255,0.1); color:#cbd5e1; border-radius:8px; font-weight:600; font-size:14px;">Sin registros hoy</div>`}
                </div>
            `);

            marker.on('mouseover', function (e) {
                this.openPopup();
            });
            marker.on('mouseout', function (e) {
                this.closePopup();
            });

            marker.on('click', () => {
                openSidePanel(p, comunaPerc, aporteEstablecimiento, vacEstablecimiento, cob);
            });
            
            markersLayerGroup.addLayer(marker);
        });
        
        // Agregar marcadores individuales sin agrupar
        mapInstance.addLayer(markersLayerGroup);
    }

    // ── 5. Encuadre ────────────────────────────────────────────────────────────
    if (filter === 'all') {
        mapInstance.flyTo([-40.5739, -73.1336], 9);
    } else if (bounds.length > 0) {
        mapInstance.flyToBounds(bounds, { padding: [40, 40] });
    }
}

function openSidePanel(props, comunaPerc, aporteEstablecimiento, vacEstablecimiento, cob) {
    const panel = document.getElementById('mapSidePanel');
    if (!panel) return;
    
    panel.classList.add('active');
    document.getElementById('panelTitle').textContent = props.Nombre_Oficial;
    document.getElementById('panelType').textContent = props.Tipo_estab;
    document.getElementById('panelComuna').textContent = props.Nombre_com;
    
    // Panel central: Vacunados del Establecimiento
    document.getElementById('panelCoverage').textContent = vacEstablecimiento.toLocaleString('es-CL');
    document.getElementById('panelProgress').style.width = Math.min(100, aporteEstablecimiento) + '%';
    document.getElementById('panelProgress').style.background = comunaPerc >= 85 ? '#10b981' : (comunaPerc >= 70 ? '#fbbf24' : '#ef4444');

    // Cambiar la etiqueta dinámicamente si existe
    const labelEst = document.querySelector('#mapSidePanel .panel-stat-card label');
    if(labelEst) labelEst.textContent = "VACUNADOS (ESTABLECIMIENTO)";

    const extra = document.getElementById('panelExtraInfo');
    extra.innerHTML = cob ? `
        <div style="font-size:0.75rem; color:#94a3b8; margin-bottom:10px;">RENDIMIENTO COMUNAL (${props.Nombre_com.toUpperCase()})</div>
        <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Vacunados Comuna:</span> <b>${cob.total.toLocaleString('es-CL')}</b></div>
        <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Meta Comunal:</span> <b>${cob.meta.toLocaleString('es-CL')}</b></div>
        <div style="display:flex; justify-content:space-between; margin-bottom:5px; color:#38bdf8; font-weight:bold;"><span>Aporte de este centro:</span> <b>${aporteEstablecimiento.toFixed(1)}%</b></div>
        <div style="margin-top:15px; font-size:0.7rem; font-style:italic; opacity:0.7;">Fuente: DEIS - MINSAL</div>
    ` : 'No hay datos detallados para esta zona.';
}

function closeSidePanel() {
    document.getElementById('mapSidePanel')?.classList.remove('active');
}

let currentSelectedEtnia = null;
let currentPueblosFilter = null;

function renderInterculturalGrid(filter) {
    const grid = document.getElementById('pueblosInteractiveGrid');
    const summary = document.getElementById('pueblosSummaryCard');
    if (!grid) return;
    grid.innerHTML = '';
    
    if (filter !== currentPueblosFilter) {
        currentPueblosFilter = filter;
        currentSelectedEtnia = null; // Reset selection on filter change
    }
    
    const key = filter === 'all' ? 'TOTAL_PROVINCIAL' : filter;
    const basePueblos = typeof window.currentBasePueblos !== 'undefined' ? window.currentBasePueblos : dashboardData.pueblos_data;
    const pData = basePueblos[key] || {};
    
    // Sort and calculate totals
    const entries = Object.entries(pData).sort((a, b) => (b[1].total || 0) - (a[1].total || 0));
    const grandTotal = entries.reduce((sum, [_, valObj]) => sum + (valObj.total || 0), 0);
    
    // Default selection to the highest volume ethnicity if none selected
    if (!currentSelectedEtnia && entries.length > 0) {
        currentSelectedEtnia = entries[0][0];
    }
    
    // Swap selected etnia to the top position (index 0) so it always renders as the big card at the top
    const selectedIndex = entries.findIndex(e => e[0] === currentSelectedEtnia);
    if (selectedIndex > 0) {
        const temp = entries[0];
        entries[0] = entries[selectedIndex];
        entries[selectedIndex] = temp;
    }
    
    if (summary) {
        const mapucheEntry = entries.find(e => e[0] === 'Mapuche');
        const mapucheTotal = mapucheEntry ? (mapucheEntry[1].total || 0) : 0;
        const mapuchePct = grandTotal > 0 ? ((mapucheTotal / grandTotal) * 100).toFixed(1).replace('.', ',') : '0,0';
        
        summary.innerHTML = `
            <div class="glass" style="display: flex; flex-wrap: wrap; gap: 20px; align-items: center; justify-content: space-between; padding: 15px 25px; border-left: 5px solid #0f69b4;">
                <div>
                    <div style="font-size: 0.8rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Total registrado</div>
                    <div style="font-size: 1.5rem; color: #0f172a; font-weight: 900;">${grandTotal.toLocaleString('es-CL')} <span style="font-size: 0.9rem; color: #64748b; font-weight: 600;">dosis administradas</span></div>
                </div>
                <div style="background: rgba(15, 105, 180, 0.05); padding: 10px 15px; border-radius: 8px; text-align: right;">
                    <div style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Principal concentración</div>
                    <div style="color: #0f69b4; font-weight: 800; font-size: 1.1rem;">Mapuche <span style="background: #0f69b4; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; margin-left: 5px;">${mapuchePct}% del total</span></div>
                </div>
            </div>
        `;
    }

    entries.forEach(([etnia, valObj]) => {
        const totalCount = valObj.total || 0;
        const dist = valObj.distribucion || {};
        const adultoMayor = dist['Adulto Mayor'] || 0;
        const ninos = dist['Niños/as'] || 0;
        const cronicos = dist['Crónicos'] || 0;
        const otros = dist['Otros'] || 0;
        
        const isBig = etnia === currentSelectedEtnia;
        const pctStr = grandTotal > 0 ? ((totalCount / grandTotal) * 100).toFixed(1).replace('.', ',') : '0,0';

        const card = document.createElement('div');
        card.className = 'glass';
        card.style.transition = 'all 0.2s ease';
        
        if (isBig) {
            // Tarjeta grande
            card.style.cssText = 'padding: 20px; border-radius: 12px; grid-column: 1 / -1; display: flex; flex-direction: column; gap: 15px; background: rgba(255,255,255,0.7); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid rgba(15,105,180,0.1); padding-bottom: 10px; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <div style="font-weight:900; color:#0f69b4; font-size: 1.5rem; letter-spacing: 0.5px;">${etnia.toUpperCase()}</div>
                        <div style="font-size: 0.85rem; color: #64748b; font-weight: 600; margin-top: 2px;">${pctStr}% del total registrado</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="color:#1e293b; font-size: 2rem; font-weight: 900; line-height: 1;">${totalCount.toLocaleString('es-CL')}</div>
                        <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 800; margin-top: 5px; letter-spacing: 0.5px;">Dosis Administradas</div>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px;">
                    <div style="background: rgba(241,245,249,0.6); padding: 12px; border-radius: 8px;">
                        <div style="font-size: 0.7rem; color: #64748b; font-weight: 700; text-transform: uppercase;">👵 Adultos Mayores</div>
                        <div style="font-size: 1.3rem; font-weight: 800; color: #334155; margin-top: 5px;">${adultoMayor.toLocaleString('es-CL')}</div>
                    </div>
                    <div style="background: rgba(241,245,249,0.6); padding: 12px; border-radius: 8px;">
                        <div style="font-size: 0.7rem; color: #64748b; font-weight: 700; text-transform: uppercase;">👶 Niños/as</div>
                        <div style="font-size: 1.3rem; font-weight: 800; color: #334155; margin-top: 5px;">${ninos.toLocaleString('es-CL')}</div>
                    </div>
                    <div style="background: rgba(241,245,249,0.6); padding: 12px; border-radius: 8px;">
                        <div style="font-size: 0.7rem; color: #64748b; font-weight: 700; text-transform: uppercase;">🧬 Crónicos</div>
                        <div style="font-size: 1.3rem; font-weight: 800; color: #334155; margin-top: 5px;">${cronicos.toLocaleString('es-CL')}</div>
                    </div>
                    <div style="background: rgba(241,245,249,0.6); padding: 12px; border-radius: 8px;">
                        <div style="font-size: 0.7rem; color: #64748b; font-weight: 700; text-transform: uppercase;">📋 Otros Criterios</div>
                        <div style="font-size: 1.3rem; font-weight: 800; color: #334155; margin-top: 5px;">${otros.toLocaleString('es-CL')}</div>
                    </div>
                </div>
            `;
        } else {
            // Tarjeta chip pequeña
            card.style.cssText = 'padding: 12px 15px; border-radius: 10px; display: flex; flex-direction: column; justify-content: center; background: rgba(255,255,255,0.5); cursor: pointer; transition: all 0.2s ease; border: 1px solid transparent;';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-weight:800; color:#0f69b4; font-size: 0.9rem;">${etnia.toUpperCase()}</div>
                    <div style="color:#1e293b; font-size: 1.1rem; font-weight: 900;">${totalCount.toLocaleString('es-CL')}</div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top: 4px;">
                    <div style="font-size: 0.65rem; color: #64748b; font-weight: 700;">${pctStr}% del total</div>
                    <div style="font-size: 0.65rem; color: #64748b; font-weight: 700;">DOSIS ADMIN.</div>
                </div>
            `;
            
            card.onmouseover = () => {
                card.style.transform = 'translateY(-2px)';
                card.style.boxShadow = '0 4px 6px -1px rgba(15, 105, 180, 0.15)';
                card.style.borderColor = 'rgba(15, 105, 180, 0.3)';
            };
            card.onmouseout = () => {
                card.style.transform = 'translateY(0)';
                card.style.boxShadow = 'none';
                card.style.borderColor = 'transparent';
            };
            
            card.onclick = () => {
                currentSelectedEtnia = etnia;
                renderInterculturalGrid(filter);
            };
            
            // Tooltip nativo para desglose en chips pequeños
            card.title = `Clic para ver detalles de ${etnia.toUpperCase()}`;
        }
        
        grid.appendChild(card);
    });
}

const centerTextPlugin = {
    id: 'centerText',
    beforeDraw: function(chart) {
        if (chart.config.type !== 'doughnut') return;
        var width = chart.width,
            height = chart.height,
            ctx = chart.ctx;

        ctx.restore();
        
        // Fixed font sizes to prevent overlap issues
        ctx.font = "800 36px Inter";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#0f172a";

        // Calculate percentage of Total Meta
        const meta = chart.config.options.plugins.centerTextPluginMeta || 0;
        const totalVac = chart.config.options.plugins.centerTextPluginTotal || 0;
        var text = (meta > 0 ? (totalVac / meta * 100).toFixed(1).replace('.', ',') : "0,0") + "%",
            textX = Math.round((width - ctx.measureText(text).width) / 2),
            textY = height / 2;
            
        ctx.fillText(text, textX, textY);
        
        ctx.font = "600 12px Inter";
        ctx.fillStyle = "#64748b";
        var subText = "Cobertura acumulada",
            subTextX = Math.round((width - ctx.measureText(subText).width) / 2),
            subTextY = height / 2 + 20;
            
        ctx.fillText(subText, subTextX, subTextY);
        ctx.save();
    }
};

function renderDoughnutChart(data, filter) {
    const ctx = document.getElementById('doughnutChart')?.getContext('2d');
    if (!ctx) return;
    if (charts.doughnut) charts.doughnut.destroy();
    
    // Solo vacunas aplicadas a grupos objetivo
    const total = data.reduce((s, i) => {
        let validSum = 0;
        Object.entries(i.datos).forEach(([g,v]) => {
            if (isGrupoElegibleParaCobertura(g)) validSum += v;
        });
        return s + validSum;
    }, 0);
    const meta = getMetaTotal(filter);
    
    let labels = ['Cobertura alcanzada', 'Brecha a meta', 'Tramo 85–100%'];
    let values = [total, Math.max(0, (meta * 0.85) - total), Math.max(0, meta - Math.max(total, meta * 0.85))];
    let bgColors = ['#0f69b4', '#f59e0b', '#e2e8f0'];

    charts.doughnut = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: values, backgroundColor: bgColors, borderWidth: 2, borderColor: '#ffffff' }] },
        plugins: [centerTextPlugin],
        options: { 
            cutout: '75%', 
            maintainAspectRatio: false,
            plugins: { 
                centerTextPluginTotal: total,
                centerTextPluginMeta: meta,
                legend: { display: true, position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 15, font: {size: 11} } },
                datalabels: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    titleColor: '#1e293b',
                    bodyColor: '#334155',
                    borderColor: 'rgba(15, 105, 180, 0.25)',
                    borderWidth: 1,
                    padding: 12,
                    boxPadding: 6,
                    usePointStyle: true, 
                    callbacks: { 
                        label: function(context) { 
                            const val = context.parsed;
                            const pct = meta > 0 ? ((val / meta) * 100).toFixed(1).replace('.', ',') : "0,0";
                            let label = context.label;
                            return `${label}: ${val.toLocaleString('es-CL')} personas (${pct}% del universo objetivo)`;
                        } 
                    } 
                }
            } 
        }
    });

    const indContainer = document.getElementById('doughnutIndicators');
    if (indContainer) {
        const cobActual = meta > 0 ? (total / meta * 100) : 0;
        const faltanParaMeta = Math.max(0, (meta * 0.85) - total);
        
        indContainer.innerHTML = `
            <div><strong style="color: #0f69b4; display: block; font-size: 1.1em;">${total.toLocaleString('es-CL')}</strong><span style="color:#64748b;">Vacunados</span></div>
            <div><strong style="color: #f59e0b; display: block; font-size: 1.1em;">${faltanParaMeta.toLocaleString('es-CL')}</strong><span style="color:#64748b;">Faltan para meta</span></div>
            <div><strong style="color: #0f69b4; display: block; font-size: 1.1em;">${cobActual.toFixed(1).replace('.', ',')}%</strong><span style="color:#64748b;">Cobertura</span></div>
        `;
    }
}

const targetLinePlugin = {
    id: 'targetLine',
    afterDraw: chart => {
        if (chart.config.type !== 'bar' || !chart.scales.y) return;
        const yAxis = chart.scales.y;
        const yPos = yAxis.getPixelForValue(85);
        const ctx = chart.ctx;
        
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(chart.chartArea.left, yPos);
        ctx.lineTo(chart.chartArea.right, yPos);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#ef4444'; // Red dashed line for target
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        
        const text = 'Meta de cobertura (85%)';
        ctx.font = '600 10px Inter';
        
        ctx.fillStyle = '#ef4444';
        ctx.textAlign = 'right';
        ctx.fillText(text, chart.chartArea.right - 5, yPos - 12);
        ctx.restore();
    }
};

function renderBarChart(data) {
    const ctx = document.getElementById('barChart')?.getContext('2d');
    if (!ctx) return;
    if (charts.bar) charts.bar.destroy();
    
    // Agrupar por comuna y calcular cobertura usando el año activo
    const coms = [...new Set(data.map(i => i.comuna))];
    const rawData = coms.map(c => {
        const meta = getMetaTotal(c);
        const totalVac = data.filter(i => i.comuna === c).reduce((s, i) => {
            let validSum = 0;
            if (i.datos) {
                Object.entries(i.datos).forEach(([g,v]) => {
                    if (isGrupoElegibleParaCobertura(g)) validSum += v;
                });
            } else {
                validSum = i.total || 0;
            }
            return s + validSum;
        }, 0);
        const val = meta > 0 ? (totalVac / meta) * 100 : 0;
        const brechaAbsoluta = Math.max(0, Math.ceil(meta * 0.85 - totalVac));
        let val2025 = null;
        if (typeof DASHBOARD_DATA_OFFLINE_2025 !== 'undefined' && DASHBOARD_DATA_OFFLINE_2025.data_residencia) {
            const meta2025 = DASHBOARD_DATA_OFFLINE_2025.metas && DASHBOARD_DATA_OFFLINE_2025.metas[c] ? DASHBOARD_DATA_OFFLINE_2025.metas[c].Total : 0;
            const vac2025 = DASHBOARD_DATA_OFFLINE_2025.data_residencia.filter(i => i.comuna === c).reduce((s, i) => {
                let validSum = 0;
                if (i.datos) {
                    Object.entries(i.datos).forEach(([g,v]) => {
                        if (isGrupoElegibleParaCobertura(g)) validSum += v;
                    });
                } else {
                    validSum = i.total || 0;
                }
                return s + validSum;
            }, 0);
            if (meta2025 > 0) val2025 = (vac2025 / meta2025) * 100;
        }
        return { label: c, value: val, absolute: totalVac, meta: meta, brechaAbs: brechaAbsoluta, val2025: val2025 };
    });
    rawData.sort((a,b) => b.value - a.value);
    window.currentLocalChartData = rawData;
    
    const sortedVals = rawData.map(d => d.value);
    const yearLabel = currentTableYear || '2026';
    
    // Colores semáforo por comuna
    const barColors = rawData.map(d => {
        if (d.value >= 85) return '#10b981';      // Verde – meta lograda
        if (d.value >= 70) return '#f59e0b';       // Naranjo – en avance
        return '#ef4444';                           // Rojo – crítico
    });
    
    charts.bar = new Chart(ctx, {
        type: 'bar',
        data: { 
            labels: rawData.map(d => d.label), 
            datasets: [{
                label: `Cobertura ${yearLabel}`,
                data: sortedVals,
                backgroundColor: barColors,
                borderRadius: 4,
                borderSkipped: false
            }]
        },
        plugins: [targetLinePlugin],
        options: { 
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    color: '#475569',
                    font: { weight: '700', size: 11 },
                    formatter: val => val.toFixed(1).replace('.', ',') + '%'
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleFont: { weight: '700', size: 13 },
                    bodyFont: { size: 12 },
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        title: function(items) {
                            return items[0]?.label || '';
                        },
                        label: function(context) {
                            const d = rawData[context.dataIndex];
                            const diffToMeta = d.value - 85;
                            let lines = [
                                `Cobertura: ${d.value.toFixed(1).replace('.', ',')}%`,
                                `Meta: 85%`,
                                `Brecha: ${diffToMeta > 0 ? '+' : ''}${diffToMeta.toFixed(1).replace('.', ',')} pp`,
                                `Vacunados: ${d.absolute.toLocaleString('es-CL')}`,
                                `Población objetivo: ${d.meta.toLocaleString('es-CL')}`,
                                `Personas adicionales necesarias para alcanzar 85%: ${d.brechaAbs.toLocaleString('es-CL')}`,
                                `Posición provincial: ${context.dataIndex + 1} de ${rawData.length}`
                            ];
                            if (d.val2025 !== null) {
                                lines.push('');
                                lines.push(`Cobertura misma SE 2025: ${d.val2025.toFixed(1).replace('.', ',')}%`);
                                const diff = d.value - d.val2025;
                                lines.push(`Diferencia interanual: ${diff > 0 ? '+' : ''}${diff.toFixed(1).replace('.', ',')} pp`);
                            }
                            return lines;
                        }
                    }
                } 
            },
            scales: {
                y: {
                    min: 0,
                    max: Math.max(100, Math.ceil(Math.max(...sortedVals, 0) / 10) * 10 + 10),
                    title: { display: true, text: 'Porcentaje de Cobertura (%)', color: '#475569', font: { weight: '600' } }
                },
                x: {
                    ticks: { maxRotation: 45, minRotation: 45, color: '#475569', font: { weight: '500' } }
                }
            },
            layout: {
                padding: { top: 20 }
            }
        }
    });
}

function renderCriterioChart(data, filter) {
    // ── 1. CÁLCULO EPIDEMIOLÓGICO BASE ──
    const ctx = document.getElementById('criterioChart')?.getContext('2d');
    if (!ctx) return;
    if (charts.criterio) charts.criterio.destroy();

    const shortNames = {
        "Cuidadores de adultos mayores y funcionarios de los ELEAM": "Cuidadores y func. ELEAM",
        "Trabajadores de la educación preescolar y escolar hasta 8° basico": "Trab. Educación (hasta 8° básico)",
        "Trabajadores de avícolas, ganaderas y de criaderos de cerdo": "Trab. Avícolas y Criaderos",
        "Enfermos cronicos de 11 a 59 años de edad": "Crónicos (11 a 59 años)",
        "Niños y niñas de 6 meses a 5 años de edad": "Niños (6m a 5 años)",
        "Personas mayores de 60 años y más (año 1966)": "Adultos Mayores (60+ años)",
        "Escolares de 1° a 5° año básico": "Escolares (1° a 5° básico)",
        "P. de salud: Privado": "P. Salud Privado",
        "P. de salud: Público": "P. Salud Público",
        "Otras prioridades": "Otras prioridades",
        "Estrategia Capullo": "Estrategia Capullo",
        "Embarazadas": "Embarazadas"
    };

    const grupos = dashboardData.headers.map(h => {
        const vacunados = data.reduce((s, i) => s + (i.datos[h] || 0), 0);
        const meta = getMetaTotal(filter, h);
        const cobertura = meta > 0 ? (vacunados / meta) * 100 : 0;
        const brecha = Math.max(0, meta - vacunados);
        const labelName = shortNames[h] || h;
        const label = wrapLabel(labelName, 40); // 40 chars wrap
        return { h, label, vacunados, meta, cobertura, brecha };
    }).sort((a, b) => b.cobertura - a.cobertura);

    // ── 2. BADGES RESUMEN DEL ENCABEZADO ──
    const badges = document.getElementById('epiSummaryBadges');
    if (badges) {
        const logrados = grupos.filter(g => g.meta > 0 && g.cobertura >= 85).length;
        const enAvance = grupos.filter(g => g.meta > 0 && g.cobertura >= 70 && g.cobertura < 85).length;
        const criticos = grupos.filter(g => g.meta > 0 && g.cobertura < 70).length;
        const ndCount = grupos.filter(g => g.meta === 0).length;
        badges.innerHTML =
            '<span class="epi-badge-pill success-pill" style="font-weight: 700;">✅ ' + logrados + ' En meta</span>' +
            '<span class="epi-badge-pill warning-pill" style="background: rgba(245,158,11,0.15); color: #d97706; border: 1px solid rgba(245,158,11,0.3); padding: 4px 10px; border-radius: 50px; font-weight: 700; font-size: 0.75rem;">⚠️ ' + enAvance + ' En avance</span>' +
            '<span class="epi-badge-pill danger-pill" style="font-weight: 700;">🔴 ' + criticos + ' Rezagados</span>' +
            (ndCount > 0 ? '<span class="epi-badge-pill" title="' + ndCount + ' categoría' + (ndCount === 1 ? '' : 's') + ' sin denominador válido para cálculo de cobertura." style="background: #e2e8f0; color: #475569; border: 1px solid #cbd5e1; padding: 4px 10px; border-radius: 50px; font-weight: 700; font-size: 0.75rem; cursor: help;">⚪ ' + ndCount + ' Sin denominador</span>' : '');
    }

    // 🚦 3. COLORES FORMALES (MINSAL) SEMÁFORO 🚦
    // Verde: >= 85%, Naranjo: 70-84.9%, Rojo: < 70%

    const maxCobertura = Math.max(...grupos.map(g => g.cobertura));
    let xAxisMax = 100;
    if (maxCobertura > 100) {
        xAxisMax = Math.ceil(maxCobertura / 10) * 10;
        if (xAxisMax - maxCobertura < 2) xAxisMax += 10;
    }

    // 🎯 4. PLUGIN LÍNEA META 85% Y 100% (Vertical) 🎯
    const meta85Plugin = {
        id: 'meta85Line',
        afterDraw(chart) {
            if (chart.config.type !== 'bar') return;
            const xAxis = chart.scales.x;
            if (!xAxis) return;

            const drawLine = (val, color, text, yOffset) => {
                if (xAxis.max < val) return;
                const xPos = xAxis.getPixelForValue(val);
                const c = chart.ctx;
                c.save();
                c.beginPath();
                c.moveTo(xPos, chart.chartArea.top);
                c.lineTo(xPos, chart.chartArea.bottom);
                c.lineWidth = 2;
                c.strokeStyle = color;
                c.setLineDash([6, 4]);
                c.stroke();
                c.fillStyle = color;
                c.font = 'bold 11px Inter';
                c.textAlign = 'right';
                c.textBaseline = 'bottom';
                c.fillText(text, xPos - 6, chart.chartArea.top - yOffset);
                c.restore();
            };

            drawLine(85, '#ef4444', 'Meta 85%', 2);
            if (xAxis.max > 100) {
                drawLine(100, '#64748b', '100%', 2);
            }
        }
    };

    // ── 5. TOOLTIP PERSONALIZADO EXTERNO ──
    const tooltipEl = document.getElementById('epiCustomTooltip');

    function externalTooltipHandler(context) {
        const { chart, tooltip } = context;

        if (tooltip.opacity === 0) {
            if (tooltipEl) tooltipEl.style.opacity = '0';
            return;
        }

        if (tooltip.dataPoints && tooltip.dataPoints.length > 0) {
            const dp = tooltip.dataPoints[0];
            const idx = dp.dataIndex;
            const g = grupos[idx];
            if (!g || !tooltipEl) return;

            const pct = g.cobertura;
            const hasMeta = g.meta > 0;
            let riesgoLabel, riesgoColor, riesgoBg;
            if (!hasMeta)       { riesgoLabel = '⚪ N/D'; riesgoColor = '#64748b'; riesgoBg = 'rgba(100,116,139,0.12)'; }
            else if (pct >= 85) { riesgoLabel = '✅ En meta'; riesgoColor = '#065f46'; riesgoBg = 'rgba(16,185,129,0.12)'; }
            else if (pct >= 70) { riesgoLabel = '⚠️ En avance';    riesgoColor = '#92400e'; riesgoBg = 'rgba(245,158,11,0.12)'; }
            else                { riesgoLabel = '🔴 Rezagado';     riesgoColor = '#991b1b'; riesgoBg = 'rgba(239,68,68,0.12)'; }

            let barColor = '#10b981'; // Verde por defecto
            if (pct < 85 && pct >= 70) barColor = '#f59e0b'; // Naranjo
            if (pct < 70) barColor = '#ef4444'; // Rojo
            if (!hasMeta) barColor = '#64748b'; // Gris si no hay meta

            let brechaHtml = '';
            if (!hasMeta) {
                brechaHtml = '<div class="ectt-row"><span class="ectt-lbl" style="color:#64748b;font-style:italic;">Sin denominador asignado</span></div>';
            } else if (pct >= 85) {
                const estadoMeta = pct > 85 ? 'Meta superada' : 'Meta alcanzada';
                brechaHtml = '<div class="ectt-row"><span class="ectt-lbl">Estado de meta 85%</span><span class="ectt-val" style="color:#065f46; font-weight: 700;">&#x2714; ' + estadoMeta + '</span></div>';
            } else {
                const brechaPP = (85 - pct).toFixed(1).replace('.', ',');
                brechaHtml = '<div class="ectt-row"><span class="ectt-lbl" style="font-weight:700;color:#ef4444;">Brecha a meta 85%</span><span class="ectt-val" style="color:#ef4444;font-weight:700;">' + brechaPP + ' puntos porcentuales</span></div>' +
                             '<div class="ectt-row"><span class="ectt-lbl">Dosis faltantes para 85%</span><span class="ectt-val" style="color:#64748b;">' + Math.ceil(g.meta * 0.85 - g.vacunados).toLocaleString('es-CL') + '</span></div>';
            }

            let pctString = hasMeta ? pct.toFixed(1).replace('.', ',') + '%' : 'N/D';
            
            let over100Nota = '';
            if (pct > 100) {
                over100Nota = '<div style="margin-top: 8px; font-size: 0.7rem; color: #64748b; line-height: 1.2; font-style: italic;">* Las coberturas superiores a 100% pueden producirse cuando los registros acumulados superan el denominador poblacional utilizado y no deben interpretarse automáticamente como error de registro.</div>';
            }

            let cobHtml = '';
            if (hasMeta) {
                cobHtml = '<div class="ectt-row">' +
                    '<span class="ectt-lbl">Cobertura registrada</span>' +
                    '<span class="ectt-val" style="color:' + barColor + ';font-size:1.3rem;font-weight:900;">' + pctString + '</span>' +
                '</div>' +
                '<div class="ectt-progress-bg"><div class="ectt-progress-fill" style="width:' + Math.min(pct,100) + '%;background:' + barColor + ';"></div></div>';
            } else {
                 cobHtml = '<div class="ectt-row">' +
                    '<span class="ectt-lbl">Cobertura</span>' +
                    '<span class="ectt-val" style="color:#64748b; font-size: 0.85rem; font-style: italic; max-width: 140px; text-align: right;">no calculable por ausencia de denominador válido</span>' +
                '</div>';
            }

            if (!hasMeta) {
                tooltipEl.style.maxWidth = '320px';
                tooltipEl.style.padding = '12px 14px';
                tooltipEl.innerHTML = 
                    '<div style="font-size:0.8rem; font-weight:700; color:#64748b; margin-bottom:4px;">⚪ N/D — Cobertura no determinable</div>' +
                    '<div style="font-size:0.9rem; font-weight:700; color:#0f172a; margin-bottom:8px;">' + g.h.replace('P. de salud:', 'Prestador:') + '</div>' +
                    '<div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.85rem;"><span style="color:#475569;">Registros acumulados:</span><span style="font-weight:700;color:#0f172a;">' + g.vacunados.toLocaleString('es-CL') + '</span></div>' +
                    '<div style="font-size:0.75rem; color:#475569; line-height:1.35; padding-top:8px; border-top:1px solid #e2e8f0;">No es posible calcular cobertura porque no existe un denominador poblacional válido. N/D no equivale a 0%.</div>';
            } else {
                tooltipEl.style.maxWidth = '';
                tooltipEl.style.padding = '';
                tooltipEl.innerHTML =
                    '<div class="ectt-badge" style="background:' + riesgoBg + ';color:' + riesgoColor + ';">' + riesgoLabel + '</div>' +
                    '<div class="ectt-name" style="font-size:0.9rem; font-weight:700;">' + g.h.replace('P. de salud:', 'Prestador:') + '</div>' +
                    '<div class="ectt-divider"></div>' +
                    cobHtml +
                    '<div class="ectt-row"><span class="ectt-lbl">Vacunados (N)</span><span class="ectt-val">' + g.vacunados.toLocaleString('es-CL') + '</span></div>' +
                    '<div class="ectt-row"><span class="ectt-lbl">Población objetivo</span><span class="ectt-val">' + g.meta.toLocaleString('es-CL') + '</span></div>' +
                    brechaHtml + over100Nota;
            }

            // Posicionamiento relativo al canvas
            const canvasRect = chart.canvas.getBoundingClientRect();
            const wrapRect = tooltipEl.parentElement.getBoundingClientRect();
            let left = tooltip.caretX + 12;
            let top = tooltip.caretY - 10;

            // Evitar que salga por la derecha o tape N/D
            if (!hasMeta) {
                left = tooltip.caretX + 45; // Desplazar más a la derecha para no tapar N/D
                top = tooltip.caretY - 40;  // Elevar ligeramente
            } else {
                if (left + 240 > wrapRect.width) left = tooltip.caretX - 252;
            }

            tooltipEl.style.left = left + 'px';
            tooltipEl.style.top = top + 'px';
            tooltipEl.style.opacity = '1';
        }
    }

    // 📊 6. GRÁFICO FULL-WIDTH IMPACTANTE (HORIZONTAL) 📊
    charts.criterio = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: grupos.map(g => g.label),
            datasets: [{
                data: grupos.map(g => parseFloat(g.cobertura.toFixed(1))),
                absoluteData: grupos.map(g => g.vacunados),
                backgroundColor: context => {
                    const val = context.dataset.data[context.dataIndex];
                    if (val >= 85) return '#10b981'; // Verde (Meta Lograda)
                    if (val >= 70) return '#f59e0b'; // Naranjo (Alerta)
                    return '#ef4444'; // Rojo (Rezagado)
                },
                hoverBackgroundColor: context => {
                    const val = context.dataset.data[context.dataIndex];
                    if (val >= 85) return '#059669'; // Verde oscuro
                    if (val >= 70) return '#d97706'; // Naranjo oscuro
                    return '#dc2626'; // Rojo oscuro
                },
                borderRadius: 4,
                borderSkipped: false,
                barPercentage: 0.6,
                categoryPercentage: 0.8
            }]
        },
        plugins: [meta85Plugin],
        options: {
            indexAxis: 'y', // Convertir a barras horizontales
            interaction: {
                mode: 'y',
                intersect: false,
            },
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1500,
                easing: 'easeOutQuart'
            },
            layout: { padding: { top: 25, right: 50, bottom: 10 } },
            plugins: {
                legend: { display: false },
                datalabels: {
                    clip: false,
                    anchor: 'end', align: 'end',
                    color: context => {
                        const idx = context.dataIndex;
                        const g = grupos[idx];
                        if (g.meta === 0) return '#64748b';
                        const val = context.dataset.data[idx];
                        return val < 70 ? '#dc2626' : '#0f172a'; // Rojo si es crítico, azul muy oscuro normal
                    },
                    backgroundColor: 'transparent',
                    font: { weight: '800', size: 12 },
                    formatter: function(v, ctx) {
                        const idx = ctx.dataIndex;
                        const g = grupos[idx];
                        if (g.meta === 0) return 'N/D';
                        let pct = v.toFixed(1).replace('.', ',') + '%';
                        return pct;
                    }
                },
                tooltip: {
                    enabled: false,
                    external: externalTooltipHandler
                }
            },
            scales: {
                x: {
                    min: 0,
                    max: xAxisMax,
                    ticks: { callback: v => v + '%', color: '#94a3b8', font: { size: 10, weight: '600' } },
                    grid: { color: 'rgba(0,0,0,0.03)', drawBorder: false }
                },
                y: {
                    ticks: { autoSkip: false, color: '#334155', font: { size: 10, weight: '600' } },
                    grid: { display: false, drawBorder: false }
                }
            },
            onHover: (event, elements) => {
                if (tooltipEl) {
                    if (elements.length === 0) tooltipEl.style.opacity = '0';
                }
            }
        }
    });
}

function calculateLinearSlope(xArr, yArr) {
    if (xArr.length !== yArr.length || xArr.length < 2) return null;
    const n = xArr.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
        sumX += xArr[i];
        sumY += yArr[i];
        sumXY += xArr[i] * yArr[i];
        sumX2 += xArr[i] * xArr[i];
    }
    const denominator = (n * sumX2 - sumX * sumX);
    if (denominator === 0) return 0;
    return (n * sumXY - sumX * sumY) / denominator;
}

function renderTimeSeriesChart(data, filter) {
    const ctx = document.getElementById('timeSeriesChart')?.getContext('2d');
    if (!ctx) return;
    if (charts.trend) charts.trend.destroy();

    // Extraer datos semanales (Semanas Epidemiológicas)
    const avanceData = typeof window.currentBaseAvance !== 'undefined' ? window.currentBaseAvance : (typeof dashboardData !== 'undefined' ? (dashboardData.avance_semanal || {}) : {});
    const targetKey = filter === 'all' ? 'TOTAL_PROVINCIAL' : filter;
    const weeklyData = avanceData[targetKey] || {};
    
    // Extraer y ordenar las llaves de SE (SE 9 en adelante)
    const seKeys = Object.keys(weeklyData).map(k => parseInt(k)).sort((a,b) => a - b);
    
    // Extraer datos 2025 (Sombra Histórica)
    let avanceData2025Key = 'avance_semanal';
    const tipoFilter = document.getElementById('globalTipoFilter')?.value || 'all';
    if (tipoFilter === 'publico') avanceData2025Key = 'avance_semanal_publico';
    else if (tipoFilter === 'privado') avanceData2025Key = 'avance_semanal_privado';
    
    const avanceData2025 = typeof DASHBOARD_DATA_OFFLINE_2025 !== 'undefined' ? (DASHBOARD_DATA_OFFLINE_2025[avanceData2025Key] || {}) : {};
    const weeklyData2025 = avanceData2025[targetKey] || {};
    
    const seKeys2025 = Object.keys(weeklyData2025).map(k => parseInt(k)).sort((a,b) => a - b);
    let maxSe25 = seKeys2025.length > 0 ? Math.max(...seKeys2025) : 52;
    if (maxSe25 > 53) maxSe25 = 53;
    if (maxSe25 < 52) maxSe25 = 52;

    let startSe = 9;
    if (seKeys2025.length > 0 && seKeys.length > 0) {
        startSe = Math.min(seKeys2025[0], seKeys[0]);
    } else if (seKeys.length > 0) {
        startSe = seKeys[0];
    } else if (seKeys2025.length > 0) {
        startSe = seKeys2025[0];
    }

    const totalMeta = getMetaTotal(filter);

    let finalLabels = [];
    for(let i = startSe; i <= maxSe25; i++){
        finalLabels.push('SE ' + i);
    }
    
    let finalAvance = new Array(finalLabels.length).fill(null);
    let finalDosis = new Array(finalLabels.length).fill(null);
    let cumulative = 0;
    
    // Obtener SE actual aproximada para ignorar datos erróneos del futuro
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const currentSE = Math.ceil((now - startOfYear) / (1000 * 60 * 60 * 24 * 7)) + 1;
    
    seKeys.forEach(se => {
        if (se > currentSE) return; // Ignorar fechas errneas futuras
        const idx = se - startSe;
        if(idx >= 0 && idx < finalLabels.length) {
            const count = weeklyData[se] || 0;
            cumulative += count;
            finalDosis[idx] = count;
            const pct = totalMeta > 0 ? (cumulative / totalMeta) * 100 : 0;
            finalAvance[idx] = parseFloat(pct.toFixed(1));
        }
    });

    let lastValidIdx = -1;
    for(let i = 0; i < finalAvance.length; i++){
        if(finalAvance[i] !== null) {
            lastValidIdx = i;
        } else if (i < lastValidIdx) {
            finalAvance[i] = finalAvance[i-1];
        }
    }

    const metaLine = new Array(finalLabels.length).fill(85);
    // Calcular Sombra 2025
    let cumulative2025 = 0;
    const cierreLine = finalLabels.map(labelStr => {
        const seNumber = parseInt(labelStr.replace('SE ', ''));
        if (weeklyData2025[seNumber]) {
            cumulative2025 += weeklyData2025[seNumber];
            return totalMeta > 0 ? parseFloat(((cumulative2025 / totalMeta) * 100).toFixed(1)) : 0;
        } else if (cumulative2025 > 0) {
            return totalMeta > 0 ? parseFloat(((cumulative2025 / totalMeta) * 100).toFixed(1)) : 0;
        }
        return null;
    });
    
    // Encontrar el valor máximo de dosis semanales para ajustar el eje Y secundario (barras)
    const maxDosis = Math.max(...finalDosis.filter(v => v !== null), 1000);
    // Redondear hacia arriba al múltiplo de 5000 más cercano para que el gráfico respire
    const maxBarAxis = Math.ceil(maxDosis / 5000) * 5000;

    let gradientFill = ctx.createLinearGradient(0, 0, 0, 400);
    gradientFill.addColorStop(0, 'rgba(15, 105, 180, 0.5)');
    gradientFill.addColorStop(1, 'rgba(15, 105, 180, 0.0)');

    let barGradient = ctx.createLinearGradient(0, 0, 0, 400);
    barGradient.addColorStop(0, 'rgba(56, 189, 248, 0.7)');
    barGradient.addColorStop(1, 'rgba(14, 165, 233, 0.7)');
    
    const futureWeeksShadingPlugin = {
        id: 'futureWeeksShading',
        beforeDraw: chart => {
            const ctx = chart.ctx;
            if (!chart.chartArea || !chart.scales.x) return;
            const x = chart.scales.x;
            const top = chart.chartArea.top;
            const bottom = chart.chartArea.bottom;
            
            const datasets = chart.data.datasets;
            const barData = datasets.find(d => d.type === 'bar')?.data;
            if(!barData) return;
            
            let firstFutureIdx = -1;
            for(let i = 0; i < barData.length; i++) {
                if (barData[i] === 0 || barData[i] === null) {
                    let isFuture = true;
                    for(let j = i; j < barData.length; j++) {
                        if (barData[j] > 0) { isFuture = false; break; }
                    }
                    if (isFuture) { firstFutureIdx = i; break; }
                }
            }
            
            if (firstFutureIdx > 0 && firstFutureIdx < chart.data.labels.length) {
                const tickWidth = x.getPixelForTick(1) - x.getPixelForTick(0);
                const startPixel = x.getPixelForTick(firstFutureIdx - 1) + tickWidth / 2;
                const endPixel = x.right;
                
                ctx.save();
                ctx.fillStyle = 'rgba(226, 232, 240, 0.75)';
                ctx.fillRect(startPixel, top, endPixel - startPixel, bottom - top);
                
                if (endPixel - startPixel > 40) {
                    ctx.translate(startPixel + (endPixel - startPixel)/2, top + (bottom - top)/2);
                    ctx.rotate(-Math.PI / 2);
                    ctx.fillStyle = '#94a3b8';
                    ctx.font = '600 12px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('Período pendiente de actualización', 0, 0);
                }
                ctx.restore();
            }
        }
    };

    const lastConsolidatedWeekPlugin = {
        id: 'lastConsolidatedWeek',
        afterDraw: chart => {
            const ctx = chart.ctx;
            if (!chart.chartArea || !chart.scales.x) return;
            const x = chart.scales.x;
            const top = chart.chartArea.top;
            const bottom = chart.chartArea.bottom;
            
            const datasets = chart.data.datasets;
            const barData = datasets.find(d => d.type === 'bar')?.data;
            if(!barData) return;
            
            let firstFutureIdx = -1;
            for(let i = 0; i < barData.length; i++) {
                if (barData[i] === 0 || barData[i] === null) {
                    let isFuture = true;
                    for(let j = i; j < barData.length; j++) {
                        if (barData[j] > 0) { isFuture = false; break; }
                    }
                    if (isFuture) { firstFutureIdx = i; break; }
                }
            }
            
            const lastConsolidatedIdx = firstFutureIdx > 0 ? firstFutureIdx - 1 : (firstFutureIdx === -1 ? barData.length - 1 : -1);
            
            if (lastConsolidatedIdx >= 0 && lastConsolidatedIdx < chart.data.labels.length) {
                const tickWidth = x.getPixelForTick(1) - x.getPixelForTick(0);
                const boundaryPixel = x.getPixelForTick(lastConsolidatedIdx) + tickWidth / 2;
                
                let lbl = chart.data.labels[lastConsolidatedIdx];
                if (!lbl.startsWith('SE')) lbl = 'SE ' + lbl;
                const labelText = `Última SE consolidada: ${lbl}`;
                
                ctx.save();
                ctx.beginPath();
                ctx.strokeStyle = '#94a3b8';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 4]);
                ctx.moveTo(boundaryPixel, top);
                ctx.lineTo(boundaryPixel, bottom);
                ctx.stroke();
                
                ctx.fillStyle = '#64748b';
                ctx.font = '600 11px sans-serif';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'top';
                ctx.fillText(labelText, boundaryPixel - 6, top + 6);
                ctx.restore();
            }
        }
    };

    charts.trend = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: finalLabels,
            datasets: [
                {
                    type: 'line',
                    label: 'Meta (85%)',
                    data: metaLine,
                    borderColor: '#ef4444',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    pointStyle: 'line',
                    yAxisID: 'y'
                },
                {
                    type: 'line',
                    label: 'Cobertura acumulada 2025 (referencia histórica)',
                    data: cierreLine,
                    borderColor: '#64748b',
                    borderWidth: 3,
                    fill: false,
                    pointRadius: 0,
                    pointStyle: 'line',
                    yAxisID: 'y'
                },
                {
                    type: 'line',
                    label: 'Cobertura acumulada 2026 (%)',
                    data: finalAvance,
                    borderColor: '#0f69b4',
                    backgroundColor: gradientFill,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#0f69b4',
                    pointBorderWidth: 2,
                    pointHoverRadius: 8,
                    pointHoverBackgroundColor: '#0f69b4',
                    pointHoverBorderColor: '#ffffff',
                    pointHoverBorderWidth: 2,
                    pointStyle: 'circle',
                    datalabels: {
                        display: function(context) {
                            const data = context.dataset.data;
                            const idx = context.dataIndex;
                            if (data[idx] === null) return false;
                            if (idx === data.length - 1) return true;
                            return data[idx + 1] === null;
                        },
                        align: 'left',
                        anchor: 'center',
                        offset: 12,
                        backgroundColor: '#ffffff',
                        borderColor: '#0f69b4',
                        borderWidth: 1.5,
                        borderRadius: 6,
                        padding: {top: 6, bottom: 6, left: 8, right: 8},
                        color: '#0f69b4',
                        font: { weight: '800', size: 12 },
                        textAlign: 'center',
                        formatter: function(value) {
                            if (value === null) return null;
                            const brecha = (85 - value).toFixed(1).replace('.', ',');
                            return `Cobertura actual: ${value.toLocaleString('es-CL')}%\nBrecha a meta: ${brecha} pp`;
                        }
                    },
                    yAxisID: 'y'
                },
                {
                    type: 'bar',
                    label: 'Dosis administradas por semana',
                    data: finalDosis,
                    backgroundColor: barGradient,
                    borderColor: '#38bdf8',
                    borderWidth: 1,
                    hoverBackgroundColor: 'rgba(56, 189, 248, 1)',
                    borderRadius: 8,
                    pointStyle: 'rectRounded',
                    yAxisID: 'y1'
                }
            ]
        },
        plugins: [futureWeeksShadingPlugin, lastConsolidatedWeekPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: true, // MUST be true so it hides in empty space
            },
            onHover: function(event, activeElements, chart) {
                // Strict check: if mouse is outside the grid, or no elements strictly intersected
                const isOutside = (
                    event.x < chart.chartArea.left || 
                    event.x > chart.chartArea.right || 
                    event.y < chart.chartArea.top || 
                    event.y > chart.chartArea.bottom
                );
                
                if (isOutside || !activeElements || activeElements.length === 0) {
                    // 1. Clear chart highlights
                    chart.setActiveElements([]);
                    // 2. Clear tooltip public state
                    if (chart.tooltip) {
                        chart.tooltip.setActiveElements([], { x: 0, y: 0 });
                        // 3. Force-flush internal sticky state (solves the Chart.js ghosting bug)
                        chart.tooltip._active = []; 
                    }
                    // 4. Render instantly
                    chart.update('none');
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { usePointStyle: true, color: '#475569', font: { weight: '600' } },
                    padding: { bottom: 30 }
                },
                datalabels: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    titleColor: '#1e293b',
                    bodyColor: '#334155',
                    borderColor: 'rgba(15, 105, 180, 0.25)',
                    borderWidth: 1,
                    padding: 12,
                    boxPadding: 6,
                    usePointStyle: true,
                    callbacks: {
                        afterTitle: function(context) {
                            if (context[0].label === 'SE 9') {
                                return 'Domingo 1° Marzo - INICIO CAMPAÑA INFLUENZA 2026';
                            }
                            return null;
                        },
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.raw === null) {
                                return label + 'N/D';
                            }
                            if (context.dataset.label === '% Avance' || context.dataset.label.includes('Meta') || context.dataset.label.includes('Cobertura')) {
                                return label + context.parsed.y.toLocaleString('es-CL') + '%';
                            } else {
                                return label + context.parsed.y.toLocaleString('es-CL');
                            }
                        },
                        afterBody: function(tooltipItems) {
                            let val26 = null;
                            let val25 = null;
                            const idx = tooltipItems[0].dataIndex;
                            const dsDosis = tooltipItems[0].chart.data.datasets.find(d => d.type === 'bar');
                            const dosisData = dsDosis ? dsDosis.data : [];
                            
                            let firstFutureIdx = -1;
                            for(let i = 0; i < dosisData.length; i++) {
                                if (dosisData[i] === 0 || dosisData[i] === null) {
                                    let isFuture = true;
                                    for(let j = i; j < dosisData.length; j++) {
                                        if (dosisData[j] > 0) { isFuture = false; break; }
                                    }
                                    if (isFuture) { firstFutureIdx = i; break; }
                                }
                            }
                            const lastConsolidatedIdx = firstFutureIdx > 0 ? firstFutureIdx - 1 : (firstFutureIdx === -1 ? dosisData.length - 1 : -1);
                            
                            let estadoText = "Estado: Consolidada";
                            if (idx > lastConsolidatedIdx) {
                                estadoText = "Estado: Pendiente de actualización";
                            }
                            
                            for (let item of tooltipItems) {
                                if (item.dataset.label.includes('2026')) val26 = item.raw;
                                if (item.dataset.label.includes('2025')) val25 = item.raw;
                            }
                            
                            let extraText = `\n${estadoText}`;
                            if (val26 !== null && val25 !== null) {
                                const dif = val26 - val25;
                                const sign = dif > 0 ? '+' : '';
                                extraText += `\nDiferencia histórica: ${sign}${dif.toFixed(1).replace('.',',')} pp`;
                            }
                            
                            return extraText;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { 
                        display: true, 
                        text: 'Semana Epidemiológica', 
                        color: '#475569', 
                        font: { weight: 'bold', size: 13 },
                        padding: { top: 10 }
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    min: 0,
                    max: 100,
                    title: { display: true, text: '% Cobertura Acumulada', color: '#475569', font: { weight: 'bold' } },
                    ticks: { callback: v => v + '%' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    min: 0,
                    max: maxBarAxis,
                    title: { display: true, text: 'N° Dosis Administradas por SE', color: '#475569', font: { weight: 'bold' } },
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });

    const canvasEl = document.getElementById('timeSeriesChart');
    if (canvasEl) {
        const containerEl = canvasEl.parentElement;
        if (containerEl && !containerEl.dataset.pointerleaveAttached) {
            containerEl.addEventListener('pointerleave', function() {
                if (charts.trend) {
                    charts.trend.setActiveElements([]);
                    if (charts.trend.tooltip) {
                        charts.trend.tooltip.setActiveElements([], {x: 0, y: 0});
                    }
                    charts.trend.update('none');
                }
            });
            containerEl.dataset.pointerleaveAttached = 'true';
        }
    }
}

function renderComparativeMonthlyChart(filter) {
    const ctx = document.getElementById('comparativeChart')?.getContext('2d');
    if (!ctx) return;
    if (charts.comparative) charts.comparative.destroy();

    // Siempre comparamos 2025 vs 2026
    const data2025 = filter === 'all' ? DASHBOARD_DATA_OFFLINE_2025.data_ocurrencia : DASHBOARD_DATA_OFFLINE_2025.data_ocurrencia.filter(i => i.comuna === filter);
    const data2026 = filter === 'all' ? DASHBOARD_DATA_OFFLINE_2026.data_ocurrencia : DASHBOARD_DATA_OFFLINE_2026.data_ocurrencia.filter(i => i.comuna === filter);

    let monthly2025 = {};
    let monthly2026 = {};

    let allMonths = new Set();
    [DASHBOARD_DATA_OFFLINE_2025, DASHBOARD_DATA_OFFLINE_2026].forEach(d => {
        if (d.meses_base) d.meses_base.forEach(m => allMonths.add(m));
    });
    let monthsArr = Array.from(allMonths).sort((a,b) => a - b);
    monthsArr.forEach(m => { monthly2025[m] = 0; monthly2026[m] = 0; });

    data2025.forEach(row => {
        for (let crit in row.datos) {
            for (let m in row.datos[crit]) {
                monthly2025[m] = (monthly2025[m] || 0) + (parseInt(row.datos[crit][m]) || 0);
            }
        }
    });

    data2026.forEach(row => {
        for (let crit in row.datos) {
            for (let m in row.datos[crit]) {
                monthly2026[m] = (monthly2026[m] || 0) + (parseInt(row.datos[crit][m]) || 0);
            }
        }
    });

    const monthNames = { 1:'Enero', 2:'Feb', 3:'Marzo', 4:'Abril', 5:'Mayo', 6:'Junio', 7:'Julio', 8:'Agosto', 9:'Sept', 10:'Oct', 11:'Nov', 12:'Dic' };
    const labels = monthsArr.map(m => monthNames[m] || `Mes ${m}`);
    const dataSeries2025 = monthsArr.map(m => monthly2025[m]);
    const dataSeries2026 = monthsArr.map(m => monthly2026[m]);

    charts.comparative = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Campaña 2025',
                    data: dataSeries2025,
                    backgroundColor: '#94a3b8',
                    hoverBackgroundColor: '#64748b',
                    borderRadius: 4,
                    borderWidth: 0,
                    barPercentage: 0.6,
                    categoryPercentage: 0.8
                },
                {
                    label: 'Campaña 2026',
                    data: dataSeries2026,
                    backgroundColor: '#0f69b4',
                    hoverBackgroundColor: '#0284c7',
                    borderRadius: 4,
                    borderWidth: 0,
                    barPercentage: 0.6,
                    categoryPercentage: 0.8
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { usePointStyle: true, color: '#475569', font: { weight: '600' } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let val = context.raw;
                            return ' ' + context.dataset.label + ': ' + val.toLocaleString('es-CL') + ' dosis';
                        }
                    }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    color: function(context) {
                        return context.datasetIndex === 0 ? '#64748b' : '#0284c7';
                    },
                    font: { weight: 'bold', size: 11 },
                    formatter: function(value) {
                        return value > 0 ? value.toLocaleString('es-CL') : '';
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    min: 0,
                    title: { display: true, text: 'N° Dosis Administradas (por mes)', color: '#475569', font: { weight: 'bold' } },
                    grid: { drawBorder: false, color: '#e2e8f0' },
                    ticks: { callback: v => v.toLocaleString('es-CL') }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function getFilteredValue(dataObj, maxMonth) {
    if (typeof dataObj === 'number') return dataObj;
    if (!dataObj) return 0;
    let sum = 0;
    for (let m in dataObj) {
        if (parseInt(m) <= maxMonth) {
            sum += dataObj[m];
        }
    }
    return sum;
}

function updateTableFooter(tableDataObj) {
    const tfoot = document.getElementById('dataTableFooter');
    const headersToShow = tableDataObj._lastHeadersToShow || [];
    if (!tfoot || headersToShow.length === 0) return;
    
    const rows = document.querySelectorAll('#dataTable tbody tr.data-row');
    let columnSums = new Array(headersToShow.length).fill(0);
    let totalSum = 0;
    
    rows.forEach(row => {
        if (row.style.display !== 'none') {
            const cells = row.querySelectorAll('td');
            if (cells.length < headersToShow.length + 3) return; // safety check
            
            for (let i = 0; i < headersToShow.length; i++) {
                const valStr = cells[i + 2].getAttribute('data-value');
                columnSums[i] += parseInt(valStr, 10) || 0;
            }
            const rowTotStr = cells[cells.length - 1].getAttribute('data-value');
            totalSum += parseInt(rowTotStr, 10) || 0;
        }
    });

    tfoot.innerHTML = `<tr>
        <td colspan="2" style="background-color: #004282; color: #ffffff; font-weight: 800; padding: 0.6rem; text-align: right; border: 1px solid #ffffff !important;">TOTALES</td>
        ${columnSums.map(sum => `<td style="background-color: #004282; color: #ffffff; font-weight: 800; padding: 0.6rem; text-align: center; border: 1px solid #ffffff !important;">${sum.toLocaleString('es-CL')}</td>`).join('')}
        <td style="background-color: #0f69b4; color: #ffffff; font-weight: 900; padding: 0.6rem; text-align: center; border: 1px solid #ffffff !important;">${totalSum.toLocaleString('es-CL')}</td>
    </tr>`;
}

window.currentTableSortCol = window.currentTableSortCol || null;
window.currentTableSortDir = window.currentTableSortDir || 'desc';

window.handleTableSort = function(colName) {
    if (window.currentTableSortCol === colName) {
        window.currentTableSortDir = window.currentTableSortDir === 'desc' ? 'asc' : 'desc';
    } else {
        window.currentTableSortCol = colName;
        window.currentTableSortDir = 'desc';
    }
    updateTableData();
};

function renderTable(data, tableDataObj = dashboardData) {
    const tbody = document.querySelector('#dataTable tbody');
    const thead = document.getElementById('dataTableHeader');
    if (!tbody || !thead) return;

    const criterioSelect = document.getElementById('criterioFilter');
    const selectedCriterio = criterioSelect ? criterioSelect.value : 'all';

    const fechaCorteSelect = document.getElementById('fechaCorteFilter');
    let maxMonth = 99; 
    if (fechaCorteSelect && fechaCorteSelect.value && !fechaCorteSelect.options[fechaCorteSelect.selectedIndex]?.text.includes('Actual')) {
        const parts = fechaCorteSelect.value.split('/');
        if (parts.length >= 2) {
            maxMonth = parseInt(parts[1], 10);
        }
    }

    let headersToShow = tableDataObj.headers;
    if (selectedCriterio !== 'all') {
        headersToShow = tableDataObj.headers.filter(h => h === selectedCriterio);
    }
    tableDataObj._lastHeadersToShow = headersToShow;
    
    const getSortIcon = (col) => {
        if (window.currentTableSortCol !== col) return '<i class="fas fa-sort" style="opacity: 0.3; margin-left: 5px;"></i>';
        return window.currentTableSortDir === 'asc' 
            ? '<i class="fas fa-sort-up" style="margin-left: 5px; color: #38bdf8;"></i>' 
            : '<i class="fas fa-sort-down" style="margin-left: 5px; color: #38bdf8;"></i>';
    };

    thead.innerHTML = `<tr>
        <th onclick="handleTableSort('Comuna')" style="cursor: pointer; background-color: var(--minsal-blue-dark); color: #ffffff; padding: 0.6rem; border: 1px solid #ffffff !important; box-shadow: inset 0 0 0 1px #ffffff !important; box-sizing: border-box; height: 110px; vertical-align: middle;">Comuna ${getSortIcon('Comuna')}</th>
        <th onclick="handleTableSort('Establecimiento')" style="cursor: pointer; background-color: var(--minsal-blue-dark); color: #ffffff; padding: 0.6rem; border: 1px solid #ffffff !important; box-shadow: inset 0 0 0 1px #ffffff !important; box-sizing: border-box; height: 110px; vertical-align: middle;">Establecimiento ${getSortIcon('Establecimiento')}</th>
        ${headersToShow.map(h => `<th onclick="handleTableSort('${h}')" style="cursor: pointer; background-color: var(--minsal-blue-dark); color: #ffffff; padding: 0.6rem; border: 1px solid #ffffff !important; box-shadow: inset 0 0 0 1px #ffffff !important; box-sizing: border-box; height: 110px; vertical-align: middle;">${h} ${getSortIcon(h)}</th>`).join('')}
        <th onclick="handleTableSort('Total')" style="cursor: pointer; background-color: #004282; color: #ffffff; padding: 0.6rem; border: 1px solid #ffffff !important; box-shadow: inset 0 0 0 1px #ffffff !important; box-sizing: border-box; height: 110px; vertical-align: middle;">Total ${getSortIcon('Total')}</th>
    </tr>`;
    
    let currentComuna = '';
    let comunaColorIndex = 0;
    
    // Sort data by comuna and establecimiento to group them and keep rows consistent
    let sortedData = [...data];
    if (window.currentTableSortCol) {
        sortedData.sort((a, b) => {
            let valA, valB;
            if (window.currentTableSortCol === 'Comuna') {
                valA = a.comuna; valB = b.comuna;
            } else if (window.currentTableSortCol === 'Establecimiento') {
                valA = a.establecimiento; valB = b.establecimiento;
            } else if (window.currentTableSortCol === 'Total') {
                valA = 0; valB = 0;
                headersToShow.forEach(h => {
                    valA += getFilteredValue(a.datos[h], maxMonth);
                    valB += getFilteredValue(b.datos[h], maxMonth);
                });
            } else {
                valA = getFilteredValue(a.datos[window.currentTableSortCol], maxMonth);
                valB = getFilteredValue(b.datos[window.currentTableSortCol], maxMonth);
            }

            if (typeof valA === 'string') {
                const cmp = valA.localeCompare(valB);
                return window.currentTableSortDir === 'asc' ? cmp : -cmp;
            } else {
                return window.currentTableSortDir === 'asc' ? valA - valB : valB - valA;
            }
        });
    } else {
        sortedData.sort((a,b) => a.comuna.localeCompare(b.comuna) || a.establecimiento.localeCompare(b.establecimiento));
    }
    
    tbody.innerHTML = sortedData.map(i => {
        if (i.comuna !== currentComuna) {
            currentComuna = i.comuna;
            comunaColorIndex = 1 - comunaColorIndex; // toggle 0 and 1
        }
        
        // Colores de la fila en general
        const bgClass = comunaColorIndex === 0 ? '#ffffff' : '#f8fafc';
        
        // Fondo intercalado exclusivo para la columna Comuna
        const bgComuna = comunaColorIndex === 0 ? '#e2e8f0' : '#475569'; // Gris muy claro vs Gris oscuro
        const textComuna = comunaColorIndex === 0 ? '#1e293b' : '#ffffff'; // Contraste de texto dinámico
        
        let rowTotal = 0;
        let prevRowTotal = 0;
        if (selectedCriterio !== 'all') {
            rowTotal = getFilteredValue(i.datos[selectedCriterio], maxMonth);
            prevRowTotal = maxMonth < 99 ? getFilteredValue(i.datos[selectedCriterio], maxMonth - 1) : rowTotal;
        } else {
            headersToShow.forEach(h => {
                rowTotal += getFilteredValue(i.datos[h], maxMonth);
                prevRowTotal += maxMonth < 99 ? getFilteredValue(i.datos[h], maxMonth - 1) : getFilteredValue(i.datos[h], maxMonth);
            });
        }

        let rowBadge = '';
        if (maxMonth < 99 && rowTotal > prevRowTotal) {
            rowBadge = ` <span class="interactive-tooltip" data-tooltip="+${rowTotal - prevRowTotal} dosis administradas exclusivamente durante este mes" style="font-size:0.65rem; color:#10b981; font-weight:bold; margin-left:4px;">▲ ${rowTotal - prevRowTotal}</span>`;
        }

        return `<tr style="background-color: ${bgClass};" class="data-row">
            <td style="background-color: ${bgComuna}; color: ${textComuna}; font-weight: 700; padding: 0.6rem; border: 1px solid ${comunaColorIndex === 0 ? '#cbd5e1' : '#ffffff'} !important; box-shadow: inset 0 0 0 1px ${comunaColorIndex === 0 ? '#cbd5e1' : '#ffffff'} !important; box-sizing: border-box; vertical-align: middle;">${i.comuna}</td>
            <td style="font-weight:600; padding: 0.5rem; border: 1px solid #cbd5e1; box-shadow: inset 0 0 0 1px #cbd5e1; box-sizing: border-box;">${i.establecimiento}</td>
            ${headersToShow.map(h => {
                const currentVal = getFilteredValue(i.datos[h], maxMonth);
                const prevVal = maxMonth < 99 ? getFilteredValue(i.datos[h], maxMonth - 1) : currentVal;
                let badge = '';
                if (maxMonth < 99 && currentVal > prevVal) {
                    badge = ` <span class="interactive-tooltip" data-tooltip="+${currentVal - prevVal} dosis administradas exclusivamente durante este mes" style="font-size:0.65rem; color:#10b981; font-weight:bold; margin-left:4px;">▲ ${currentVal - prevVal}</span>`;
                }
                return `<td data-value="${currentVal}" class="interactive-tooltip" data-tooltip="Total acumulado a la fecha de corte: ${currentVal.toLocaleString('es-CL')} dosis" style="text-align: center; padding: 0.5rem; border: 1px solid #cbd5e1; box-shadow: inset 0 0 0 1px #cbd5e1; box-sizing: border-box;">${currentVal.toLocaleString('es-CL')}${badge}</td>`;
            }).join('')}
            <td data-value="${rowTotal}" class="interactive-tooltip" data-tooltip="Total acumulado a la fecha de corte: ${rowTotal.toLocaleString('es-CL')} dosis" style="font-weight:800; color:#0f69b4; text-align: center; background-color: rgba(15,105,180,0.08); padding: 0.5rem; border: 1px solid #cbd5e1; box-shadow: inset 0 0 0 1px #cbd5e1; box-sizing: border-box;">${rowTotal.toLocaleString('es-CL')}${rowBadge}</td>
        </tr>`;
    }).join('');

    const searchInput = document.getElementById('tableSearch');
    if (searchInput && searchInput.value) {
        const filterValue = searchInput.value.toLowerCase();
        const rows = document.querySelectorAll('#dataTable tbody tr.data-row');
        rows.forEach(row => {
            const text = row.innerText.toLowerCase();
            row.style.display = text.includes(filterValue) ? '' : 'none';
        });
    }
    
    updateTableFooter(tableDataObj);
}

function exportToExcel() {
    const filter = document.getElementById('globalComunaFilter')?.value || 'all';
    
    const dataVarName = `DASHBOARD_DATA_OFFLINE_${currentTableYear}`;
    let tableDataObj = dashboardData;
    if (typeof window[dataVarName] !== 'undefined') {
        tableDataObj = window[dataVarName];
    }
    
    const data = filter === 'all' ? tableDataObj.data_ocurrencia : tableDataObj.data_ocurrencia.filter(i => i.comuna === filter);
    
    const criterionFilter = document.getElementById('criterioFilter')?.value || 'all';
    
    let headersToShow = tableDataObj.headers;
    if (criterionFilter !== 'all') {
        headersToShow = tableDataObj.headers.filter(h => h === criterionFilter);
    }
    
    if (typeof XLSX === 'undefined') {
        alert("La librería de exportación a Excel está cargando. Por favor, intente nuevamente en unos segundos.");
        return;
    }
    
    const ws_data = [];
    
    const fechaCorteInput = document.getElementById('fechaCorteFilter');
    const fechaCorte = fechaCorteInput ? (fechaCorteInput.options[fechaCorteInput.selectedIndex]?.text || fechaCorteInput.value) : tableDataObj.fecha_actualizacion;
    
    let maxMonth = 99;
    let periodoText = fechaCorte;
    let fechaCorteVal = fechaCorte;
    if (fechaCorteInput && fechaCorteInput.value && !fechaCorteInput.options[fechaCorteInput.selectedIndex]?.text.includes('Actual')) {
        const text = fechaCorteInput.options[fechaCorteInput.selectedIndex]?.text;
        const parts = fechaCorteInput.value.split('/');
        if (parts.length >= 2) {
            maxMonth = parseInt(parts[1], 10);
        }
        if (text && text.includes('(')) {
            periodoText = text.split('(')[0].trim();
            fechaCorteVal = text.split('(')[1].replace(')', '').trim();
        }
    }

    ws_data.push([]); // Row 1
    ws_data.push([`CAMPAÑA INFLUENZA ${currentTableYear}`]); // Row 2
    ws_data.push(["Servicio de Salud Osorno"]); // Row 3
    ws_data.push(["Reporte por Ocurrencia"]); // Row 4
    ws_data.push([]); // Row 5
    ws_data.push(["INFORMACIÓN DEL REPORTE"]); // Row 6
    ws_data.push(["- Criterio:", criterionFilter === 'all' ? 'Todos' : criterionFilter]); // Row 7
    ws_data.push(["- Periodo Informado:", periodoText]); // Row 8
    ws_data.push(["- Fecha de Corte:", fechaCorteVal]); // Row 9
    ws_data.push(["- Fuente", "DEIS - MINSAL"]); // Row 10
    ws_data.push(["- Fecha de Actualización:", tableDataObj.fecha_actualizacion]); // Row 11
    ws_data.push([]); // Row 12
    
    // 1. Fila de Cabeceras
    const headers = ["Comuna", "Establecimiento", ...headersToShow, "Total"];
    ws_data.push(headers);
    
    const searchInput = document.getElementById('tableSearch');
    const searchFilter = searchInput ? searchInput.value.toLowerCase() : '';

    // Sort data to match online view
    const sortedData = [...data].sort((a,b) => a.comuna.localeCompare(b.comuna) || a.establecimiento.localeCompare(b.establecimiento));
    
    // 2. Filas de Datos
    let currentComuna = '';
    let comunaColorIndex = 0;
    
    const totals = new Array(headersToShow.length + 1).fill(0);

    sortedData.forEach(item => {
        let rowTotal = 0;
        const rowVals = [];
        if (criterionFilter !== 'all') {
            const v = getFilteredValue(item.datos[criterionFilter], maxMonth);
            rowTotal = v;
            rowVals.push(v);
            totals[0] += v;
        } else {
            headersToShow.forEach((h, idx) => {
                const v = getFilteredValue(item.datos[h], maxMonth);
                rowTotal += v;
                rowVals.push(v);
                totals[idx] += v;
            });
        }
        totals[totals.length - 1] += rowTotal;

        const row = [item.comuna, item.establecimiento, ...rowVals, rowTotal];
        
        const rowText = row.join(' ').toLowerCase();
        if (searchFilter && !rowText.includes(searchFilter)) return;

        ws_data.push(row);
    });

    const totalsRow = ["TOTALES", "", ...totals];
    ws_data.push(totalsRow);
    
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
    
    ws['!merges'] = [
        { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }, // Merge A2:E2
        { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } }, // Merge A3:E3
        { s: { r: 3, c: 0 }, e: { r: 3, c: 4 } }, // Merge A4:E4
        { s: { r: 5, c: 0 }, e: { r: 5, c: 2 } }, // Merge INFORMACIÓN DEL REPORTE
        { s: { r: dataRowCount - 1, c: 0 }, e: { r: dataRowCount - 1, c: 1 } } // Merge TOTALES A:B
    ];

    ws['!views'] = [{ zoomScale: 80, zoomScaleNormal: 80, showGridLines: false }];
    
    // 3. Estilos (xlsx-js-style)
    const range = XLSX.utils.decode_range(ws['!ref']);
    
    for (let R = range.s.r; R <= range.e.r; ++R) {
        
        if (R >= 13 && R < dataRowCount - 1) {
            const rowComuna = ws_data[R][0];
            if (rowComuna !== currentComuna) {
                currentComuna = rowComuna;
                comunaColorIndex = 1 - comunaColorIndex;
            }
        }

        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
            if (!ws[cellRef]) continue;
            
            let cellStyle = { font: { name: "Calibri", sz: 10, color: { rgb: "000000" } }, border: {}, alignment: { vertical: "center" } };

            const isOutsideTable = (R >= dataRowCount || C >= tableColCount);

            if (isOutsideTable) {
                cellStyle.fill = { fgColor: { rgb: "FFFFFF" } };
            } else if (R < 12) { // Top headers and filters
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
                cellStyle.fill = { fgColor: { rgb: comunaColorIndex === 0 ? "FFFFFF" : "F2F5F9" } };
                cellStyle.alignment = { vertical: "center", horizontal: isTextCol ? "left" : "center", wrapText: true };
                cellStyle.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
                if (isTotalCol) {
                    cellStyle.fill = { fgColor: { rgb: "1A3B66" } };
                    cellStyle.font = { name: "Calibri", sz: 10, color: { rgb: "FFFFFF" }, bold: true };
                }
            } else if (R === dataRowCount - 1) { // TOTALES row
                cellStyle.fill = { fgColor: { rgb: "1A3B66" } };
                cellStyle.font = { name: "Calibri", sz: 10, color: { rgb: "FFFFFF" }, bold: true };
                cellStyle.alignment = { vertical: "center", horizontal: (C === 0 ? "right" : "center"), wrapText: true };
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

    // Auto-ajustar el ancho de las columnas
    const colWidths = [
        { wch: 26 }, // Comuna
        { wch: 45 }  // Establecimiento
    ];
    headersToShow.forEach(h => colWidths.push({ wch: 16 })); 
    colWidths.push({ wch: 16 }); // TOTAL GENERAL
    ws['!cols'] = colWidths;

    // Configurar opciones de impresión
    ws['!pageSetup'] = {
        orientation: 'landscape',
        paperSize: 9, // A4
        scale: 50
    };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Matriz Técnica");
    XLSX.writeFile(wb, `Reporte_Epidemiologico_Influenza_${currentTableYear}_${filter}.xlsx`);
}

function printTableOnly() {
    document.body.classList.add('print-table-only');
    window.print();
    // Remove the class after a short delay so the page returns to normal after the print dialog
    setTimeout(() => {
        document.body.classList.remove('print-table-only');
    }, 1000);
}

// ── AYUDA INTERACTIVA (MODAL EPIDEMIOLÓGICO) ──
function getHelpTextData(chartId) {
    const filterSelect = document.getElementById('globalComunaFilter');
    const filter = filterSelect && filterSelect.value ? filterSelect.value : 'all';
    const isComuna = filter !== 'all' && filter !== '';
    let filterText = 'Provincia de Osorno';
    let locContext = 'provincial';
    if (isComuna && filterSelect.options && filterSelect.selectedIndex >= 0) {
        filterText = 'Comuna de ' + filterSelect.options[filterSelect.selectedIndex].text;
        locContext = 'comunal';
    }

    // --- Dynamic Calculations ---
    let dynamicTactical = '';
    let missingDoses = 0;
    let dosisTotal = 0;
    let metaTotal = 0;
    
    let baseResi = typeof window.currentBaseResi !== 'undefined' ? window.currentBaseResi : (dashboardData ? dashboardData.data_residencia : []);
    if (baseResi && baseResi.length > 0) {
        dosisTotal = baseResi.filter(d => isComuna ? d.comuna === filter : true)
                           .reduce((s, d) => {
                               let validSum = 0;
                               Object.entries(d.datos).forEach(([g,v]) => {
                                   if (isGrupoElegibleParaCobertura(g)) validSum += v;
                               });
                               return s + validSum;
                           }, 0);
        if (dashboardData.metas) {
             if (isComuna && dashboardData.metas[filter]) {
                 metaTotal = dashboardData.metas[filter].Total || 0;
             } else if (!isComuna) {
                 metaTotal = Object.values(dashboardData.metas).reduce((s, m) => s + (m.Total || 0), 0);
             }
        }
        const targetDoses = Math.ceil(metaTotal * 0.85);
        missingDoses = Math.max(0, targetDoses - dosisTotal);
        
        let groups = {};
        baseResi.filter(d => isComuna ? d.comuna === filter : true).forEach(c => {
            for(let g in c.datos) {
                if (g.toLowerCase().includes('total') || g === 'comuna') continue;
                groups[g] = (groups[g] || 0) + c.datos[g];
            }
        });
        
        let groupMetas = {};
        if (dashboardData.metas) {
            let metaObj = isComuna ? { [filter]: dashboardData.metas[filter] } : dashboardData.metas;
            for (let com in metaObj) {
                if (metaObj[com] && metaObj[com].Criterios) {
                    for (let g in metaObj[com].Criterios) {
                        groupMetas[g] = (groupMetas[g] || 0) + metaObj[com].Criterios[g];
                    }
                }
            }
        }

        let logradosCount = 0;
        let enAvanceCount = 0;
        let rezagadosCount = 0;
        let validGroups = [];
        let ndGroupsCount = 0;

        const shortNames = {
            "Cuidadores de adultos mayores y funcionarios de los ELEAM": "Cuidadores y func. ELEAM",
            "Trabajadores de la educación preescolar y escolar hasta 8° basico": "Trabajadores de la Educación",
            "Trabajadores de avícolas, ganaderas y de criaderos de cerdo": "Trabajadores Avícolas y Criaderos",
            "Enfermos cronicos de 11 a 59 años de edad": "Crónicos",
            "Niños y niñas de 6 meses a 5 años de edad": "Niños de 6 meses a 5 años",
            "Personas mayores de 60 años y más (año 1966)": "Adultos Mayores",
            "Escolares de 1° a 5° año básico": "Escolares",
            "P. de salud: Privado": "Personal de Salud Privado",
            "P. de salud: Público": "Personal de Salud Público",
            "Poblacion general": "Población general"
        };

        for (let g in groups) {
            let meta = groupMetas[g] || 0;
            if (meta > 0) {
                let cob = (groups[g] / meta) * 100;
                validGroups.push({ name: g, percent: cob, gap: 85 - cob });
                if (cob >= 85) logradosCount++;
                else if (cob >= 70) enAvanceCount++;
                else rezagadosCount++;
            } else {
                ndGroupsCount++;
            }
        }
        
        validGroups.sort((a,b) => a.gap - b.gap);
        const cercanosAMeta = validGroups.filter(g => g.gap > 0).slice(0, 2);
        const over100Count = validGroups.filter(g => g.percent > 100).length;
        
        let closestHtml = '';
        if (cercanosAMeta.length === 1) {
            closestHtml = `<strong>${shortNames[cercanosAMeta[0].name] || cercanosAMeta[0].name}</strong>, con una brecha de ${cercanosAMeta[0].gap.toFixed(1).replace('.',',')} puntos porcentuales`;
        } else if (cercanosAMeta.length === 2) {
            closestHtml = `<strong>${shortNames[cercanosAMeta[0].name] || cercanosAMeta[0].name}</strong> y <strong>${shortNames[cercanosAMeta[1].name] || cercanosAMeta[1].name}</strong>, con brechas de ${cercanosAMeta[0].gap.toFixed(1).replace('.',',')} y ${cercanosAMeta[1].gap.toFixed(1).replace('.',',')} puntos porcentuales, respectivamente`;
        }

        let lowestGroup = validGroups.length > 0 ? validGroups.reduce((prev, current) => (prev.percent < current.percent) ? prev : current) : null;
        let lowestHtml = lowestGroup ? `<strong>${shortNames[lowestGroup.name] || lowestGroup.name}</strong> presenta una cobertura de ${lowestGroup.percent.toFixed(1).replace('.',',')}%, situándose ${lowestGroup.gap.toFixed(1).replace('.',',')} puntos porcentuales bajo la meta.` : '';
        
        let over100Html = over100Count > 0 ? `<br><span style="font-size:0.85em; color:#0f172a; font-weight:500; font-style:italic; display:inline-block; margin-top:4px;">Se identifican ${over100Count} grupos con coberturas superiores al 100%. Las coberturas superiores a 100% pueden producirse cuando los registros acumulados superan el denominador poblacional utilizado y no deben interpretarse automáticamente como error de registro.</span>` : '';
        let ndHtml = ndGroupsCount > 0 ? ` Una categoría no dispone de denominador válido para cálculo de cobertura.` : '';

        dynamicTactical = `
        <div style="background: rgba(15, 105, 180, 0.04); padding: 14px 16px; border-radius: 8px; border: 1px solid rgba(15, 105, 180, 0.1); margin-top: 16px; font-size: 0.9rem;">
            <p style="margin: 0;">De los ${validGroups.length} grupos evaluables, <strong>${logradosCount}</strong> alcanzan o superan la meta del 85%, <strong>${enAvanceCount}</strong> se encuentran en avance y <strong>${rezagadosCount}</strong> permanecen rezagados.${ndHtml}</p>
            <p style="margin: 8px 0 0 0;">${closestHtml ? `Los grupos más próximos a alcanzar la meta son ${closestHtml}.` : ''} ${lowestHtml}${over100Html}</p>
        </div>`;
    }

    let temporalTitle = `Interpretación Epidemiológica del Avance Temporal — ${filterText}`;
    let temporalBodyHtml = '';

    if (charts.trend) {
        const datasets = charts.trend.data.datasets;
        const ds2026 = datasets.find(d => d.label.includes('2026'));
        const ds2025 = datasets.find(d => d.label.includes('2025'));
        const dsDosis = datasets.find(d => d.type === 'bar');
        
        if (ds2026 && ds2025 && dsDosis) {
            const data26 = ds2026.data;
            const data25 = ds2025.data;
            const dosis = dsDosis.data;
            const labels = charts.trend.data.labels;
            
            let firstFutureIdx = -1;
            for(let i = 0; i < dosis.length; i++) {
                if (dosis[i] === 0 || dosis[i] === null) {
                    let isFuture = true;
                    for(let j = i; j < dosis.length; j++) {
                        if (dosis[j] > 0) { isFuture = false; break; }
                    }
                    if (isFuture) { firstFutureIdx = i; break; }
                }
            }
            const lastConsolidatedIdx = firstFutureIdx > 0 ? firstFutureIdx - 1 : (firstFutureIdx === -1 ? dosis.length - 1 : -1);
            
            if (lastConsolidatedIdx >= 0) {
                const currentCov = data26[lastConsolidatedIdx];
                const currentSe = labels[lastConsolidatedIdx];
                const gapTo85 = 85 - currentCov;
                
                // 1. Situación Actual
                const currentCovStr = currentCov.toLocaleString('es-CL', {minimumFractionDigits:1, maximumFractionDigits:1});
                const situacionText = `Al cierre de la ${currentSe}, la cobertura acumulada de Influenza 2026 alcanza ${currentCovStr}%, situándose ${gapTo85 > 0 ? gapTo85.toFixed(1).replace('.',',') + ' puntos porcentuales bajo' : Math.abs(gapTo85).toFixed(1).replace('.',',') + ' puntos porcentuales sobre'} la meta programática del 85%. La última semana considerada para este análisis corresponde a información consolidada.`;
                
                // 2. Comparación con 2025
                const cov2025 = data25[lastConsolidatedIdx];
                let comparacionText = '';
                if (cov2025 !== null) {
                    const cov2025Str = cov2025.toLocaleString('es-CL', {minimumFractionDigits:1, maximumFractionDigits:1});
                    const dif = currentCov - cov2025;
                    let relation = 'al mismo nivel';
                    if (dif > 0) relation = 'por sobre';
                    else if (dif < 0) relation = 'por debajo';
                    
                    if (dif === 0) {
                        comparacionText = `En la misma semana epidemiológica de 2025, la cobertura acumulada alcanzaba ${cov2025Str}%. En 2026 alcanza ${currentCovStr}%, ubicándose al mismo nivel del valor observado en igual semana del año anterior.`;
                    } else {
                        comparacionText = `En la misma semana epidemiológica de 2025, la cobertura acumulada alcanzaba ${cov2025Str}%. En 2026 alcanza ${currentCovStr}%, ubicándose ${Math.abs(dif).toFixed(1).replace('.',',')} puntos porcentuales ${relation} del valor observado en igual semana del año anterior.`;
                    }
                } else {
                    comparacionText = `No se dispone de datos consolidados para la misma semana de 2025.`;
                }
                
                // 3 & 4 & 5. Slopes and Doses
                let slopeRecent = null;
                let slopePrev = null;
                let dosisRecent = 0;
                let dosisPrev = 0;
                let dinamicaText = 'Información aún insuficiente para estimar dinámica reciente.';
                let actividadText = '';
                let escenarioText = '';
                const horizonteRestante = labels.length - 1 - lastConsolidatedIdx;
                
                if (lastConsolidatedIdx >= 3) {
                    const yRec = [data26[lastConsolidatedIdx-3], data26[lastConsolidatedIdx-2], data26[lastConsolidatedIdx-1], data26[lastConsolidatedIdx]];
                    const xRec = [1, 2, 3, 4];
                    slopeRecent = calculateLinearSlope(xRec, yRec);
                    dosisRecent = dosis[lastConsolidatedIdx-3] + dosis[lastConsolidatedIdx-2] + dosis[lastConsolidatedIdx-1] + dosis[lastConsolidatedIdx];
                    
                    if (lastConsolidatedIdx >= 7) {
                        const yPrev = [data26[lastConsolidatedIdx-7], data26[lastConsolidatedIdx-6], data26[lastConsolidatedIdx-5], data26[lastConsolidatedIdx-4]];
                        slopePrev = calculateLinearSlope(xRec, yPrev);
                        dosisPrev = dosis[lastConsolidatedIdx-7] + dosis[lastConsolidatedIdx-6] + dosis[lastConsolidatedIdx-5] + dosis[lastConsolidatedIdx-4];
                    }
                    
                    const incRec = data26[lastConsolidatedIdx] - data26[lastConsolidatedIdx-3];
                    let comparativaDinamica = '';
                    if (slopePrev !== null) {
                        const diffSlope = slopeRecent - slopePrev;
                        // Reglas matemáticas explícitas:
                        // Diferencia absoluta <= 0.1 pp/semana -> Avance estable
                        // Diferencia > 0.1 -> Aceleración
                        // Diferencia < -0.1 -> Desaceleración
                        // Si la velocidad reciente es <= 0.1 pp/semana -> Meseta
                        if (slopeRecent <= 0.1) comparativaDinamica = 'una meseta en el avance';
                        else if (Math.abs(diffSlope) <= 0.1) comparativaDinamica = 'un avance estable';
                        else if (diffSlope > 0.1) comparativaDinamica = 'una aceleración';
                        else comparativaDinamica = 'una desaceleración';
                    }
                    
                    dinamicaText = `Durante las últimas cuatro semanas epidemiológicas consolidadas, la cobertura aumentó desde ${data26[lastConsolidatedIdx-3].toLocaleString('es-CL', {minimumFractionDigits:1, maximumFractionDigits:1})}% hasta ${currentCovStr}%, equivalente a un incremento de ${incRec.toFixed(1).replace('.',',')} puntos porcentuales y una velocidad media de ${slopeRecent.toFixed(2).replace('.',',')} pp por semana.`;
                    
                    if (slopePrev !== null) {
                        dinamicaText += ` En las cuatro semanas precedentes, la velocidad media fue de ${slopePrev.toFixed(2).replace('.',',')} pp por semana. La comparación entre ambos períodos muestra ${comparativaDinamica}.`;
                        
                        const varDosis = ((dosisRecent - dosisPrev) / dosisPrev) * 100;
                        const varText = varDosis > 0 ? 'aumentó' : 'disminuyó';
                        actividadText = `La actividad de vacunación de las últimas cuatro semanas ${varText} ${Math.abs(varDosis).toFixed(1).replace('.',',')}% respecto de las cuatro semanas inmediatamente anteriores. En términos absolutos, se administraron ${dosisRecent.toLocaleString('es-CL')} dosis recientes frente a ${dosisPrev.toLocaleString('es-CL')} del período previo.`;
                    }
                    
                    if (slopeRecent > 0.1 && gapTo85 > 0) {
                        const semanasEstimadas = gapTo85 / slopeRecent;
                        if (semanasEstimadas > horizonteRestante) {
                            escenarioText = `Al ritmo reciente serían necesarias aproximadamente <strong>${Math.ceil(semanasEstimadas)}</strong> semanas para cerrar la brecha, período que se extiende más allá del horizonte actualmente representado en esta visualización.`;
                        } else {
                            escenarioText = `Si se mantuviera la velocidad media observada durante las últimas cuatro semanas, la brecha actual podría cerrarse aproximadamente en <strong>${Math.ceil(semanasEstimadas)}</strong> semanas.`;
                        }
                        escenarioText += ` Esta es una estimación descriptiva condicionada a mantener el ritmo reciente y no constituye una predicción.`;
                    } else {
                        escenarioText = `El comportamiento reciente no permite construir un escenario simple de continuidad con suficiente estabilidad (velocidad de avance mínima o nula).`;
                    }
                }
                
                // 6. Orientacion
                let orientacion = `La cobertura ${isComuna ? 'comunal' : 'provincial'} permanece ${gapTo85 > 0 ? 'bajo' : 'sobre'} la meta programática. `;
                if (slopeRecent !== null && slopePrev !== null) {
                    const diffSlope = slopeRecent - slopePrev;
                    if (diffSlope < -0.1 && dosisRecent < dosisPrev) {
                        orientacion += `La trayectoria reciente evidencia una desaceleración del avance y una disminución de la actividad semanal de vacunación. Este patrón sugiere profundizar el análisis por grupo objetivo y territorio para identificar dónde se concentra la población pendiente y orientar estrategias de vacunación pertinentes.`;
                    } else if (diffSlope > 0.1 && dosisRecent > dosisPrev) {
                        orientacion += `La trayectoria reciente muestra una aceleración del avance coincidente con una mayor actividad semanal de vacunación. Se recomienda mantener e intensificar las estrategias actuales y verificar adherencia en grupos rezagados.`;
                    } else if (Math.abs(diffSlope) <= 0.1 && slopeRecent <= 0.1) {
                        orientacion += `La cobertura se encuentra en una meseta prolongada. Se requiere una intervención inmediata para destrabar los bolsones de susceptibilidad estancados.`;
                    } else {
                        orientacion += `El ritmo de vacunación se ha mantenido relativamente estable. Se recomienda profundizar el análisis por grupo objetivo para gestionar eficientemente la población pendiente.`;
                    }
                } else {
                    orientacion += `Se requiere profundizar el monitoreo durante las próximas semanas para establecer patrones de tendencia consolidados.`;
                }

                temporalBodyHtml = `
                <div style="font-size: 0.90rem; color: var(--text-color, #334155); text-align: left;">
                    <div style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(0,0,0,0.04);">
                        <strong style="display:block; margin-bottom:4px; color:#0f172a; font-size:0.95rem;">Situación Actual</strong>
                        <span style="display:block; line-height:1.55;">${situacionText}</span>
                    </div>
                    
                    <div style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(0,0,0,0.04);">
                        <strong style="display:block; margin-bottom:4px; color:#0f172a; font-size:0.95rem;">Comparación con la Campaña 2025</strong>
                        <span style="display:block; line-height:1.55;">${comparacionText}</span>
                    </div>
                    
                    <div style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(0,0,0,0.04);">
                        <strong style="display:block; margin-bottom:4px; color:#0f172a; font-size:0.95rem;">Dinámica Reciente</strong>
                        <span style="display:block; line-height:1.55;">${dinamicaText}</span>
                    </div>
                    
                    ${actividadText ? `
                    <div style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(0,0,0,0.04);">
                        <strong style="display:block; margin-bottom:4px; color:#0f172a; font-size:0.95rem;">Actividad de Vacunación</strong>
                        <span style="display:block; line-height:1.55;">${actividadText}</span>
                    </div>
                    ` : ''}
                    
                    <div style="margin-bottom: 16px; padding-bottom: 12px;">
                        <strong style="display:block; margin-bottom:4px; color:#0f172a; font-size:0.95rem;">Escenario de Continuidad del Ritmo Reciente</strong>
                        <span style="display:block; line-height:1.55;">${escenarioText}</span>
                    </div>
                    
                    <div style="background: rgba(15, 105, 180, 0.05); padding: 12px 16px; border-left: 4px solid var(--minsal-blue); border-radius: 4px; margin-bottom: 16px;">
                        <strong style="display:block; margin-bottom:4px; color:#0f172a; font-size:0.95rem;">Orientación para la Gestión</strong>
                        <span style="display:block; line-height:1.55;">${orientacion}</span>
                    </div>
                    
                    <div style="margin-top: 14px; font-size: 0.75rem; color: #334155; font-style: italic; border-top: 1px solid #e2e8f0; padding-top: 10px; line-height:1.4;">
                        <strong style="color: #0f172a;">Consideraciones Metodológicas:</strong> La comparación histórica utiliza la misma Semana Epidemiológica en ambas campañas. Las tendencias recientes emplean únicamente semanas consolidadas. Los cambios temporales describen evolución asociativa y no demuestran causalidad directa. Los escenarios asumen la mantención del ritmo y no son predictivos.
                    </div>
                </div>`;
            }
        }
    }

        let localHtml = '';
        if (window.currentLocalChartData && window.currentLocalChartData.length > 0) {
            let comunasData = window.currentLocalChartData.map(c => ({
                comuna: c.label,
                cob: c.value,
                brechaAbs: c.brechaAbs
            }));
            
            let enMeta = comunasData.filter(c => c.cob >= 85);
            let enAvance = comunasData.filter(c => c.cob >= 70 && c.cob < 85);
            let rezagadas = comunasData.filter(c => c.cob < 70);
            
            let maxCob = comunasData[0];
            let minCob = comunasData[comunasData.length - 1];
            
            const pluralizeEnMeta = enMeta.length === 1 ? '1 comuna en meta' : `${enMeta.length} comunas en meta`;
            const pluralizeEnAvance = enAvance.length === 1 ? '1 comuna en avance' : `${enAvance.length} comunas en avance`;
            const pluralizeRezagadas = rezagadas.length === 1 ? '1 comuna rezagada' : `${rezagadas.length} comunas rezagadas`;
            
            let rezagadasHtml = rezagadas.length === 0 ? ` Actualmente no se identifican comunas con cobertura inferior a 70%.` : ``;
            
            let brechasMeta = comunasData.filter(c => c.cob < 85).map(c => `<strong>${c.comuna}</strong> (${(85 - c.cob).toFixed(1).replace('.', ',')} pp)`).join(', ');
            if (!brechasMeta) brechasMeta = 'Todas las comunas han alcanzado la meta programática del 85%.';
            else brechasMeta = `Comunas bajo la meta programática del 85%: ${brechasMeta}.`;
            
            let comunasBrechaAbs = [...comunasData].filter(c => c.brechaAbs > 0).sort((a,b) => b.brechaAbs - a.brechaAbs);
            let brechaAbsHtml = '';
            if (comunasBrechaAbs.length > 0) {
                brechaAbsHtml = `La mayor brecha absoluta se concentra en <strong>${comunasBrechaAbs[0].comuna}</strong>, con <strong>${comunasBrechaAbs[0].brechaAbs.toLocaleString('es-CL')}</strong> personas pendientes para alcanzar la meta.`;
            } else {
                brechaAbsHtml = `No existen personas pendientes para alcanzar la meta programática del 85% a nivel comunal.`;
            }
            
            let comunasBrechaRelativa = [...comunasData].filter(c => c.cob < 85).sort((a,b) => a.cob - b.cob);
            let maxBrechaRelativa = comunasBrechaRelativa.length > 0 ? comunasBrechaRelativa[0] : null;
            let maxBrechaAbsoluta = comunasBrechaAbs.length > 0 ? comunasBrechaAbs[0] : null;
            
            let orientacionHtml = `Las comunas bajo la meta requieren priorización diferenciada considerando tanto su brecha porcentual como el número absoluto de personas pendientes. Se recomienda profundizar el análisis por establecimiento y grupo objetivo para orientar estrategias territoriales pertinentes.`;
            if (maxBrechaRelativa && maxBrechaAbsoluta) {
                if (maxBrechaRelativa.comuna !== maxBrechaAbsoluta.comuna) {
                    orientacionHtml = `<strong>${maxBrechaRelativa.comuna}</strong> presenta actualmente la mayor brecha relativa respecto de la meta, mientras que <strong>${maxBrechaAbsoluta.comuna}</strong> concentra la mayor brecha absoluta de personas pendientes. Esta diferencia evidencia que la priorización territorial debe considerar simultáneamente la magnitud porcentual de la brecha y el volumen absoluto de población pendiente. Se recomienda profundizar el análisis por establecimiento y grupo objetivo para orientar estrategias territoriales pertinentes.`;
                } else {
                    orientacionHtml = `<strong>${maxBrechaRelativa.comuna}</strong> concentra actualmente tanto la mayor brecha relativa respecto de la meta como la mayor brecha absoluta de personas pendientes. Esto evidencia que la priorización territorial debe considerar simultáneamente la magnitud porcentual de la brecha y el volumen absoluto de población pendiente. Se recomienda profundizar el análisis por establecimiento y grupo objetivo para orientar estrategias territoriales pertinentes.`;
                }
            }

            localHtml = `<div style="color: var(--text-color, #334155); font-size: 0.90rem; line-height: 1.5; text-align: justify;">
                <p style="margin-top:0;"><strong>Situación Provincial:</strong><br>
                El análisis territorial muestra <strong>${pluralizeEnMeta}</strong> (≥85%), <strong>${pluralizeEnAvance}</strong> (70–84,9%) y <strong>${pluralizeRezagadas}</strong> (<70%).${rezagadasHtml}</p>
                
                <p><strong>Distribución Territorial:</strong><br>
                <strong>${maxCob.comuna}</strong> presenta la mayor cobertura territorial (${maxCob.cob.toFixed(1).replace('.', ',')}%), mientras que <strong>${minCob.comuna}</strong> registra la menor (${minCob.cob.toFixed(1).replace('.', ',')}%).</p>
                
                <p><strong>Brechas a Meta:</strong><br>
                ${brechasMeta}</p>
                
                <p><strong>Brecha Absoluta:</strong><br>
                ${brechaAbsHtml}</p>
                
                <div style="background: rgba(15, 105, 180, 0.08); padding: 12px; border-left: 4px solid var(--minsal-blue); border-radius: 4px; margin-top: 15px;">
                    <strong>Orientación para la Gestión:</strong><br>
                    ${orientacionHtml}
                </div>
                
                <div style="background: rgba(241, 245, 249, 0.8); padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; margin-top: 15px; font-size: 0.85rem;">
                    <strong>Consideraciones Metodológicas:</strong>
                    <ul style="margin: 8px 0 0 0; padding-left: 20px;">
                        <li style="margin-bottom: 4px;"><strong>Meta programática de cobertura: 85%</strong>. Nivel definido para el seguimiento de la campaña.</li>
                        <li style="margin-bottom: 4px;">La cobertura territorial describe el avance de vacunación y no constituye por sí sola una medida directa de transmisión, riesgo individual o causalidad epidemiológica.</li>
                    </ul>
                </div>
            </div>`;
        }

    let globalBodyHtml = '';
    if (metaTotal > 0) {
        const pct = (dosisTotal / metaTotal) * 100;
        const diff = pct - 85;
        const missing = Math.max(0, Math.ceil(metaTotal * 0.85) - dosisTotal);
        
        let situacionHtml = '';
        let brechaHtml = '';
        let orientacionHtml = '';
        
        situacionHtml = `<p style="margin-top:0;"><strong>Situación Actual:</strong><br>
        Al cierre de la información disponible, la cobertura acumulada de vacunación contra Influenza alcanza <strong>${pct.toFixed(1).replace('.',',')}%</strong>, correspondiente a <strong>${dosisTotal.toLocaleString('es-CL')}</strong> personas vacunadas de la población objetivo ${locContext}.</p>`;
        
        if (pct < 85) {
            brechaHtml = `<p><strong>Brecha a la Meta Programática:</strong><br>
            La cobertura se encuentra <strong>${Math.abs(diff).toFixed(1).replace('.',',')}</strong> puntos porcentuales bajo la meta programática del 85%. Para alcanzar dicha meta se requiere vacunar aproximadamente a <strong>${missing.toLocaleString('es-CL')}</strong> personas adicionales, de acuerdo con el denominador vigente.</p>`;
            
            orientacionHtml = `<div style="background: rgba(15, 105, 180, 0.08); padding: 12px; border-left: 4px solid var(--minsal-blue); border-radius: 4px; margin-top: 15px;">
                <strong>Orientación para la Gestión:</strong><br>
                La brecha ${locContext} permite dimensionar el esfuerzo adicional necesario para alcanzar la meta programática. Su interpretación debe complementarse con el análisis por comuna, establecimiento y grupo objetivo para identificar dónde se concentra la población pendiente y orientar estrategias de vacunación pertinentes.
            </div>`;
        } else if (pct === 85) {
            brechaHtml = `<p><strong>Brecha a la Meta Programática:</strong><br>
            La cobertura ${locContext} alcanza actualmente la meta programática del 85%.</p>`;
            
            orientacionHtml = `<div style="background: rgba(15, 105, 180, 0.08); padding: 12px; border-left: 4px solid var(--minsal-blue); border-radius: 4px; margin-top: 15px;">
                <strong>Orientación para la Gestión:</strong><br>
                Se ha alcanzado la meta programática. Se recomienda mantener la vigilancia y completar esquemas pendientes en grupos de alto riesgo.
            </div>`;
        } else {
            brechaHtml = `<p><strong>Brecha a la Meta Programática:</strong><br>
            La cobertura ${locContext} supera actualmente la meta programática del 85% por <strong>${diff.toFixed(1).replace('.',',')}</strong> puntos porcentuales.</p>`;
            
            orientacionHtml = `<div style="background: rgba(15, 105, 180, 0.08); padding: 12px; border-left: 4px solid var(--minsal-blue); border-radius: 4px; margin-top: 15px;">
                <strong>Orientación para la Gestión:</strong><br>
                Se ha superado la meta programática. Se recomienda enfocar los esfuerzos en grupos específicos que aún puedan presentar rezagos y realizar acciones de cierre de campaña.
            </div>`;
        }
        
        globalBodyHtml = `<div style="color: var(--text-color, #334155); font-size: 0.90rem; line-height: 1.5; text-align: justify;">
            ${situacionHtml}
            ${brechaHtml}
            ${orientacionHtml}
            
            <div style="background: rgba(241, 245, 249, 0.8); padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; margin-top: 15px; font-size: 0.85rem;">
                <strong>Consideraciones Metodológicas:</strong>
                <ul style="margin: 8px 0 0 0; padding-left: 20px;">
                    <li style="margin-bottom: 4px;">La cobertura corresponde a personas vacunadas respecto de la población objetivo definida para la campaña.</li>
                    <li style="margin-bottom: 4px;">La cobertura de vacunación no equivale directamente a inmunidad poblacional ni permite estimar por sí sola protección individual o transmisión.</li>
                    <li style="margin-bottom: 4px;">La meta del 85% corresponde a una meta programática de seguimiento y no debe interpretarse como un umbral de inmunidad colectiva.</li>
                </ul>
            </div>
        </div>`;
    } else {
        globalBodyHtml = `<div style="color: var(--text-color, #334155); font-size: 0.90rem; line-height: 1.5; text-align: justify;">
            <p><strong>N/D — cobertura no determinable</strong></p>
            <p>No se dispone de un denominador válido para calcular la cobertura.</p>
        </div>`;
    }

    const helps = {
        global: {
            title: `Interpretación Epidemiológica del Avance ${isComuna ? 'Comunal' : 'Provincial'} — ${filterText}`,
            body: globalBodyHtml
        },
        local: {
            title: `Interpretación Epidemiológica del Avance Territorial — Provincia de Osorno`,
            body: localHtml
        },
        temporal: {
            title: temporalTitle,
            body: temporalBodyHtml
        },
        criterios: {
            title: `Interpretación Epidemiológica por Grupo Objetivo — ${filterText}`,
            body: `<div style="color: var(--text-color, #334155); font-size: 0.90rem; line-height: 1.5; text-align: justify;">
                <p style="margin-top:0;"><strong>Fundamento de Priorización Epidemiológica:</strong><br>
                La cobertura global puede ocultar brechas relevantes en grupos de mayor riesgo. El análisis estratificado permite identificar poblaciones prioritarias y orientar acciones de vacunación.</p>
                ${dynamicTactical}
                <div style="display: flex; flex-wrap: wrap; gap: 15px; margin-top: 15px;">
                    <div style="flex: 1 1 250px; background: rgba(241, 245, 249, 0.8); padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
                        <strong>Estado de Cobertura:</strong>
                        <ul style="list-style: none; padding-left: 0; margin-bottom: 0; margin-top: 8px; display: flex; flex-direction: column; gap: 6px;">
                            <li style="display: flex; align-items: center; gap: 6px;"><span>🟢</span><span>En meta (≥ 85%)</span></li>
                            <li style="display: flex; align-items: center; gap: 6px;"><span>🟠</span><span>En avance (70% - 84,9%)</span></li>
                            <li style="display: flex; align-items: center; gap: 6px;"><span>🔴</span><span>Rezagado (< 70%)</span></li>
                            <li style="display: flex; align-items: center; gap: 6px;"><span>⚪</span><span>N/D (Sin denominador válido)</span></li>
                        </ul>
                    </div>
                    <div style="flex: 1 1 250px; background: rgba(241, 245, 249, 0.8); padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
                        <strong>Orientación para la Gestión:</strong>
                        <p style="margin-top: 8px; text-align: left;">Los grupos rezagados, especialmente aquellos con mayor riesgo de complicaciones, requieren priorización para revisar brechas territoriales y definir estrategias de vacunación pertinentes.</p>
                    </div>
                </div>
            </div>`
        },
        comparativa: {
            title: `Velocidad Logística Histórica (Actual vs Año Anterior)`,
            body: `<div style="color: var(--text-color, #334155);">
                <p style="margin-top:0;"><strong>Evaluación de Ritmo Táctico en ${filterText}</strong><br>
                Evalúa milimétricamente el ritmo logístico de la campaña cruzando rendimientos actuales mensuales contra la línea base dura del año pasado.</p>
                <div style="background: rgba(15, 105, 180, 0.08); padding: 12px; border-left: 4px solid var(--minsal-blue); border-radius: 4px; margin-top: 15px;">
                    <strong>Alarma de Quiebre:</strong><br>
                    Si tras un avance inicial la barra actual colapsa por debajo de la gris, se diagnostica estancamiento precoz.
                </div>
            </div>`
        }
    };

    function getDynamicGlossary(htmlContent) {
        const text = htmlContent.toLowerCase();
        let defs = [];
        if (text.includes('puntos porcentuales') || text.includes('(pp)') || text.includes(' pp ') || text.includes(' pp<')) {
            defs.push('<li style="margin-bottom: 4px;"><strong>Puntos porcentuales (pp):</strong> Diferencia aritmética entre dos porcentajes.</li>');
        }
        if (text.includes('brecha absoluta') || text.includes('personas adicionales')) {
            defs.push('<li style="margin-bottom: 4px;"><strong>Brecha absoluta:</strong> Número estimado de personas adicionales que deben vacunarse para alcanzar la meta programática.</li>');
        }
        if (text.includes('meta programática')) {
            defs.push('<li style="margin-bottom: 4px;"><strong>Meta programática:</strong> Nivel de cobertura definido para seguimiento de la campaña.</li>');
        }

        if (defs.length === 0) return '';

        return `
        <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 0.75rem; color: #64748b; line-height: 1.3; text-align: left;">
            <strong style="color: #475569; font-size: 0.8rem;">Glosario Epidemiológico:</strong>
            <ul style="padding-left: 15px; margin-top: 4px; margin-bottom: 0; list-style-type: disc;">
                ${defs.join('')}
            </ul>
        </div>`;
    }

    for (let key in helps) {
        if (helps[key] && helps[key].body) {
            helps[key].body += getDynamicGlossary(helps[key].body);
        }
    }

    return helps[chartId];
}

window.openHelpModal = function(chartId, btnElement) {
    const data = getHelpTextData(chartId);
    if(!data) return;
    
    const card = btnElement.closest('.chart-card, .epi-panel, .epi-chart-full');
    
    let overlay = document.getElementById('spotlightOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'spotlightOverlay';
        overlay.className = 'spotlight-overlay';
        overlay.onclick = window.closeHelpModal;
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'block';
    // Trigger reflow for opacity transition
    void overlay.offsetWidth;
    overlay.style.opacity = '1';
    
    if (card) {
        card.classList.add('spotlight-active');
        window.currentSpotlightCard = card;
        
        const modal = document.getElementById('helpModal');
        if(!modal) return;
        
        document.getElementById('helpModalTitle').innerText = data.title;
        document.getElementById('helpModalBody').innerHTML = data.body;
        
        modal.style.display = 'block';
        modal.style.opacity = '0';
        modal.style.transform = 'translateY(-20px)';
        
        setTimeout(() => {
            const cardRect = card.getBoundingClientRect();
            const modalRect = modal.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            let modalTop = Math.max(20, cardRect.top);
            let modalLeft = cardRect.right + 20;
            
            const spaceRight = viewportWidth - cardRect.right;
            const spaceLeft = cardRect.left;
            
            // Colocar siempre en el lado donde haya más espacio visual
            if (spaceLeft > spaceRight) {
                if (spaceLeft >= modalRect.width + 20) {
                    // Colocar a la izquierda
                    modalLeft = cardRect.left - modalRect.width - 20;
                } else {
                    // No cabe a la izquierda, centrar
                    modalLeft = Math.max(20, (viewportWidth - modalRect.width) / 2);
                    modalTop = cardRect.top + 60; 
                }
            } else {
                if (spaceRight >= modalRect.width + 20) {
                    // Colocar a la derecha
                    modalLeft = cardRect.right + 20;
                } else {
                    // No cabe a la derecha, centrar
                    modalLeft = Math.max(20, (viewportWidth - modalRect.width) / 2);
                    modalTop = cardRect.top + 60; 
                }
            }
            
            // Asegurar que no se salga por abajo
            if (modalTop + modalRect.height > viewportHeight - 20) {
                modalTop = viewportHeight - modalRect.height - 20;
            }
            // Asegurar que no se salga por arriba
            if (modalTop < 20) {
                modalTop = 20;
            }
            
            modal.style.top = modalTop + 'px';
            modal.style.left = modalLeft + 'px';
            
            modal.style.opacity = '1';
            modal.style.transform = 'translateY(0)';
        }, 10);
    }
};

window.closeHelpModal = function() {
    const modal = document.getElementById('helpModal');
    const overlay = document.getElementById('spotlightOverlay');
    
    if (modal) {
        modal.style.opacity = '0';
        modal.style.transform = 'translateY(-20px)';
        setTimeout(() => { modal.style.display = 'none'; }, 300);
    }
    
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => { overlay.style.display = 'none'; }, 300);
    }
    
    if (window.currentSpotlightCard) {
        window.currentSpotlightCard.classList.remove('spotlight-active');
        window.currentSpotlightCard = null;
    }
};

window.renderComparativeTable = function() {
    const tableBody = document.getElementById('compDataTableBody');
    if (!tableBody) return;
    
    const searchVal = (document.getElementById('compTableSearch')?.value || '').toLowerCase();
    
    let totals2025 = {};
    let totals2026 = {};
    
    // Sumar 2025
    DASHBOARD_DATA_OFFLINE_2025.data_ocurrencia.forEach(row => {
        let key = row.establecimiento;
        if(!totals2025[key]) totals2025[key] = { comuna: row.comuna, total: 0 };
        for (let crit in row.datos) {
            for (let m in row.datos[crit]) {
                totals2025[key].total += (parseInt(row.datos[crit][m]) || 0);
            }
        }
    });
    
    // Sumar 2026
    DASHBOARD_DATA_OFFLINE_2026.data_ocurrencia.forEach(row => {
        let key = row.establecimiento;
        if(!totals2026[key]) totals2026[key] = { comuna: row.comuna, total: 0 };
        for (let crit in row.datos) {
            for (let m in row.datos[crit]) {
                totals2026[key].total += (parseInt(row.datos[crit][m]) || 0);
            }
        }
    });
    
    let allEstabs = new Set([...Object.keys(totals2025), ...Object.keys(totals2026)]);
    let tableData = [];
    
    allEstabs.forEach(estab => {
        let t25 = totals2025[estab]?.total || 0;
        let t26 = totals2026[estab]?.total || 0;
        let comuna = totals2025[estab]?.comuna || totals2026[estab]?.comuna || '';
        
        let diff = t26 - t25;
        let diffPct = t25 > 0 ? ((diff / t25) * 100).toFixed(1) : (t26 > 0 ? 100 : 0);
        
        tableData.push({ comuna, estab, t25, t26, diff, diffPct });
    });
    
    // Sort by comuna, then estab
    tableData.sort((a,b) => {
        if(a.comuna < b.comuna) return -1;
        if(a.comuna > b.comuna) return 1;
        if(a.estab < b.estab) return -1;
        if(a.estab > b.estab) return 1;
        return 0;
    });
    
    tableBody.innerHTML = '';
    
    tableData.forEach(row => {
        if (searchVal && !row.comuna.toLowerCase().includes(searchVal) && !row.estab.toLowerCase().includes(searchVal)) {
            return;
        }
        
        let colorDiff = row.diff > 0 ? '#10b981' : (row.diff < 0 ? '#ef4444' : '#64748b');
        let iconDiff = row.diff > 0 ? '▲ +' : (row.diff < 0 ? '▼ ' : '');
        let pctDisplay = row.diff === 0 ? '-' : `${iconDiff}${Math.abs(row.diffPct)}%`;
        
        let tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #e2e8f0';
        // Add hover effect using CSS classes or inline JS events
        tr.onmouseover = function() { this.style.backgroundColor = 'rgba(15, 105, 180, 0.05)'; };
        tr.onmouseout = function() { this.style.backgroundColor = 'transparent'; };

        tr.innerHTML = `
            <td style="padding: 0.8rem; text-align: left; font-weight: 500; color: #475569;">${row.comuna}</td>
            <td style="padding: 0.8rem; text-align: left; font-weight: 700; color: #1e293b;">${row.estab}</td>
            <td style="padding: 0.8rem; text-align: right; color: #64748b;">${row.t25.toLocaleString('es-CL')}</td>
            <td style="padding: 0.8rem; text-align: right; font-weight: 800; color: #0f69b4;">${row.t26.toLocaleString('es-CL')}</td>
            <td style="padding: 0.8rem; text-align: right; font-weight: 700; color: ${colorDiff};">${row.diff > 0 ? '+' : ''}${row.diff.toLocaleString('es-CL')}</td>
            <td style="padding: 0.8rem; text-align: center;">
                <div style="font-weight: 800; color: ${colorDiff}; background: ${colorDiff}15; border-radius: 4px; padding: 4px 8px; display: inline-block;">${pctDisplay}</div>
            </td>
            <td style="padding: 0.8rem; text-align: center;">
                <button onclick="openCompChartModal('${row.estab.replace(/'/g, "\\'")}')" style="background: var(--minsal-blue); color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.85rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">📊 Ver Gráfico</button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
};

window.openCompChartModal = function(establecimiento) {
    const modal = document.getElementById('compChartModal');
    const title = document.getElementById('compChartModalTitle');
    const ctx = document.getElementById('modalComparativeChartCanvas')?.getContext('2d');
    
    if(!modal || !ctx) return;
    
    title.innerHTML = `📊 Comparativa Mensual: <span style="color:var(--minsal-blue);">${establecimiento}</span>`;
    
    // Filter data for this estab
    const data2025 = DASHBOARD_DATA_OFFLINE_2025.data_ocurrencia.filter(i => i.establecimiento === establecimiento);
    const data2026 = DASHBOARD_DATA_OFFLINE_2026.data_ocurrencia.filter(i => i.establecimiento === establecimiento);
    
    let monthly2025 = {};
    let monthly2026 = {};

    let allMonths = new Set();
    [DASHBOARD_DATA_OFFLINE_2025, DASHBOARD_DATA_OFFLINE_2026].forEach(d => {
        if (d.meses_base) d.meses_base.forEach(m => allMonths.add(m));
    });
    let monthsArr = Array.from(allMonths).sort((a,b) => a - b);
    monthsArr.forEach(m => { monthly2025[m] = 0; monthly2026[m] = 0; });

    data2025.forEach(row => {
        for (let crit in row.datos) {
            for (let m in row.datos[crit]) {
                monthly2025[m] = (monthly2025[m] || 0) + (parseInt(row.datos[crit][m]) || 0);
            }
        }
    });

    data2026.forEach(row => {
        for (let crit in row.datos) {
            for (let m in row.datos[crit]) {
                monthly2026[m] = (monthly2026[m] || 0) + (parseInt(row.datos[crit][m]) || 0);
            }
        }
    });

    const monthNames = { 1:'Enero', 2:'Feb', 3:'Marzo', 4:'Abril', 5:'Mayo', 6:'Junio', 7:'Julio', 8:'Agosto', 9:'Sept', 10:'Oct', 11:'Nov', 12:'Dic' };
    const labels = monthsArr.map(m => monthNames[m] || `Mes ${m}`);
    const dataSeries2025 = monthsArr.map(m => monthly2025[m]);
    const dataSeries2026 = monthsArr.map(m => monthly2026[m]);
    
    if (window.modalChartInstance) window.modalChartInstance.destroy();
    
    window.modalChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Campaña 2025',
                    data: dataSeries2025,
                    backgroundColor: '#94a3b8',
                    hoverBackgroundColor: '#64748b',
                    borderRadius: 4,
                    borderWidth: 0,
                    barPercentage: 0.6,
                    categoryPercentage: 0.8
                },
                {
                    label: 'Campaña 2026',
                    data: dataSeries2026,
                    backgroundColor: '#0f69b4',
                    hoverBackgroundColor: '#0284c7',
                    borderRadius: 4,
                    borderWidth: 0,
                    barPercentage: 0.6,
                    categoryPercentage: 0.8
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, color: '#475569', font: { weight: '600' } } },
                datalabels: {
                    anchor: 'end', align: 'top',
                    color: function(context) { return context.datasetIndex === 0 ? '#64748b' : '#0284c7'; },
                    font: { weight: 'bold', size: 11 },
                    formatter: function(value) { return value > 0 ? value.toLocaleString('es-CL') : ''; }
                }
            },
            scales: {
                y: {
                    type: 'linear', display: true, position: 'left', min: 0,
                    title: { display: true, text: 'N° Dosis Administradas', color: '#475569', font: { weight: 'bold' } },
                    grid: { drawBorder: false, color: '#e2e8f0' },
                    ticks: { callback: v => v.toLocaleString('es-CL') }
                },
                x: { grid: { display: false } }
            }
        }
    });

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
};

window.closeCompChartModal = function() {
    const modal = document.getElementById('compChartModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
};

window.onload = init;
