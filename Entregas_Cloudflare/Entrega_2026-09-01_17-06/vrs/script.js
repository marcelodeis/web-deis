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

window.downloadChartImage = function(canvasId, fileName) {
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
    const targetDoses = Math.ceil(metaT * 0.80);
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
    
    // Update fecha corte
    const reportDateEl = document.getElementById('reportDate');
    if (reportDateEl && dashboardData.fecha_actualizacion) {
        reportDateEl.innerText = `Fuente: Archivos Híbridos (Ocurrencia + Residencia) | Fecha de corte: ${dashboardData.fecha_actualizacion}`;
    }
    
    // Update Rescates Download Link
    const btnDescargaRescates = document.getElementById('btnDescargaRescates');
    if (btnDescargaRescates && dashboardData.archivo_rescates) {
        btnDescargaRescates.href = dashboardData.archivo_rescates;
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
        const privPattern = /clinica|mutual|achs|particular|privad|isapre|mutualidad|vaxplus|cochrane/i;
        data_ocur = data_ocur.filter(d => {
            const isPrivado = privPattern.test(d.establecimiento) || (dashboardData.estab_privados || []).includes(d.establecimiento);
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

        const savedTheme = localStorage.getItem('vrs_theme');
        if (savedTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            Chart.defaults.color = '#94a3b8';
        }

        populateFilters();
        setupEvents();
        
        const reportDateEl = document.getElementById('reportDate');
        if (reportDateEl) reportDateEl.innerText = `Fuente: Archivos Híbridos (Ocurrencia + Residencia) | Fecha de corte: ${dashboardData.fecha_actualizacion}`;
        
        const rescatesCountEl = document.getElementById('rescatesCount');
        if (rescatesCountEl && dashboardData.total_rescates !== undefined) {
            rescatesCountEl.innerText = dashboardData.total_rescates;
        }
        
        // Update Rescates Download Link
        const btnDescargaRescates = document.getElementById('btnDescargaRescates');
        if (btnDescargaRescates && dashboardData.archivo_rescates) {
            btnDescargaRescates.href = dashboardData.archivo_rescates;
        }
        
        updateVisitCounter();
        
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
            localStorage.setItem('vrs_theme', newTheme);
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
                const privPattern = /clinica|mutual|achs|particular|privad|isapre|mutualidad|vaxplus|cochrane/i;
                data_ocur = data_ocur.filter(d => {
                    const isPrivado = privPattern.test(d.establecimiento) || (dashboardData.estab_privados || []).includes(d.establecimiento);
                    const tipo = isPrivado ? 'privado' : 'publico';
                    return tipo === tipoFilter;
                });
            }
            
            let data_resi = globalFilter === 'all' ? dashboardData.data_residencia : dashboardData.data_residencia.filter(i => i.comuna === globalFilter);

            if (filterValue) {
                data_ocur = data_ocur.filter(i => i.establecimiento.toLowerCase().includes(filterValue));
                renderBarChart(data_ocur);
                renderDoughnutChart(data_resi, globalFilter);
                renderCriterioChart(data_resi, globalFilter);
            } else {
                renderBarChart(data_ocur);
                let data_resi = globalFilter === 'all' ? dashboardData.data_residencia : dashboardData.data_residencia.filter(i => i.comuna === globalFilter);
                renderCriterioChart(data_resi, globalFilter);
            }
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
            opt.style.color = 'black'; // Fix for invisible white text on white dropdown
            select.appendChild(opt);
            
            if (tableSelect) {
                const optTable = document.createElement('option');
                optTable.value = c; optTable.textContent = c;
                optTable.style.color = 'black'; // Fix for invisible white text on white dropdown
                tableSelect.appendChild(optTable);
            }
        });
    }
    
    const criterioSelect = document.getElementById('criterioFilter');
    if (criterioSelect && dashboardData && dashboardData.headers) {
        dashboardData.headers.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h; opt.textContent = h;
            opt.style.color = 'black'; // Fix for invisible white text on white dropdown
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
        opt.style.color = 'black'; // Fix for invisible white text on white dropdown
        
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
        optActual.style.color = 'black'; // Fix for invisible white text on white dropdown
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
        const prefix = el.dataset.prefix || '';
        el.innerHTML = `${prefix}${contextName} <span style="font-size: 0.75em; font-weight: 600;">(BASE RESIDENCIA 2026)</span>`;
    });
    
    document.querySelectorAll('.territory-context-ocurrencia').forEach(el => {
        el.innerHTML = `${contextName} <span style="font-size: 0.75em; font-weight: 600;">(BASE OCURRENCIA 2026)</span>`;
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
    
    // Epidemiológico (Residencia)
    let data_resi = filter === 'all' ? dashboardData.data_residencia : dashboardData.data_residencia.filter(i => i.comuna === filter);
    
    // Operativo (Ocurrencia)
    let data_ocur = filter === 'all' ? dashboardData.data_ocurrencia : dashboardData.data_ocurrencia.filter(i => i.comuna === filter);
    if (tipoFilter !== 'all') {
        const privPattern = /clinica|mutual|achs|particular|privad|isapre|mutualidad|vaxplus|cochrane/i;
        data_ocur = data_ocur.filter(d => {
            const isPrivado = privPattern.test(d.establecimiento) || (dashboardData.estab_privados || []).includes(d.establecimiento);
            const tipo = isPrivado ? 'privado' : 'publico';
            return tipo === tipoFilter;
        });
    }
    
    updateContextLabels(filter);
    updateKPIs(data_resi, filter);
    renderTimeSeriesChart(data_resi, filter);
    renderTerritoryMap();
    
    renderDoughnutChart(data_resi, filter);
    renderBarChart(data_ocur);
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
        Object.entries(i.datos).forEach(([g,v]) => {
            if (g !== 'Otras prioridades') validSum += v;
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
    if (pendingEl) animateValue(pendingEl, 0, Math.max(0, Math.ceil(metaT * 0.80) - targetDosesSum), 1000);

    const speedEl = document.getElementById('kpi-speed');
    if (speedEl && typeof DASHBOARD_DATA_OFFLINE_2026 !== 'undefined') {
        const speedData = DASHBOARD_DATA_OFFLINE_2026.velocidad_promedio || {};
        const speedVal = (filter === 'all' || !speedData[filter]) ? (speedData['TOTAL_PROVINCIAL'] || 0) : speedData[filter];
        animateValue(speedEl, 0, parseFloat(speedVal), 1000, (v) => v.toFixed(1).replace('.', ','));
    }

    // Simulación de Esfuerzo Estadístico (Basado solo en grupos objetivo)
    const stats = getCampaignStats(targetDosesSum, metaT);
    const predEl = document.getElementById('strategic-prediction-content');
    
    if (predEl) {
        if (targetDosesSum >= stats.targetDoses) {
            predEl.innerHTML = `
                <div style="background:#10b98110; padding:8px; border-radius:8px; border-left:3px solid #10b981; text-align:left;">
                    <div style="font-size:1.1rem; font-weight:900; color:#fff; margin-bottom:2px;">¡Inmunidad de Rebaño!</div>
                    <div style="font-size:0.6rem; color:#94a3b8; line-height:1.2;">Se ha cerrado la brecha de susceptibles a nivel ${filter === 'all' ? 'provincial' : 'comunal'}, reduciendo drásticamente la transmisión del VRS.</div>
                </div>
            `;
        } else {
            const gap = Math.max(0, stats.targetDoses - targetDosesSum);
            predEl.innerHTML = `
                <div style="background:#0ea5e910; padding:8px; border-radius:8px; border-left:3px solid #0ea5e9; text-align:left;">
                    <div style="font-size:1.1rem; font-weight:900; color:#fff; margin-bottom:2px;">${Math.ceil(stats.currentPace).toLocaleString('es-CL')} <small style="font-size:0.55rem; opacity:0.8;">dosis/día</small></div>
                    <div style="font-size:0.6rem; color:#94a3b8; line-height:1.2;">Velocidad de inmunización requerida para mitigar brote epidémico. Pool de susceptibles restantes (${filter === 'all' ? 'territorio provincial' : 'territorio comunal'}): <b style="color:#fff;">${gap.toLocaleString('es-CL')}</b> menores.</div>
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
    }).filter(s => s.g !== 'Estrategia Capullo' && s.g !== 'Otras prioridades' && s.m > 0)
    .sort((a,b) => b.p - a.p);

    const topEl = document.getElementById('kpi-top-grupo');
    const worstEl = document.getElementById('kpi-worst-grupo');
    
    if (topEl && stats.length > 0) {
        let topG = stats[0].g.replace('P. de salud:', 'Prestador:').replace('Cuidadores de adultos mayores y funcionarios de los ELEAM', 'Cuidadores de adultos mayores y funcionarios ELEAM');
        let topHtml = `<span style="font-weight:700; color:#1e293b; font-size: 1rem;">${topG}</span><br>
                       <span style="font-size:0.9rem; color:#0ea5e9; font-weight: 600;">${stats[0].p.toFixed(1).replace('.', ',')}% cobertura registrada</span>`;
        if (stats[0].p >= 100) {
            topHtml += `<br><span style="font-size:0.85rem; color:#10b981; font-weight: 600;">Meta superada</span>`;
        }
        topEl.innerHTML = topHtml;
                           
        const topPred = document.getElementById('strategic-prediction-top');
        if (topPred) {
            if (stats[0].p >= 100) {
                const surplus = stats[0].v - stats[0].m;
                topPred.innerHTML = `
                    <div style="background:#10b98110; padding:10px; border-radius:10px; border-left:4px solid #10b981; text-align:left;">
                        <div style="font-size:1.1rem; font-weight:900; color:#fff; margin-bottom:2px;">Barrera Inmunológica Exitosa</div>
                        <div style="font-size:0.65rem; color:#94a3b8; line-height:1.2;">La cobertura previene empíricamente clusters de ITRI grave.<br><br><i>Nota: Registros >100% indican inmunización de población flotante no censada.</i></div>
                    </div>
                `;
            } else {
                const missing = Math.max(0, stats[0].m - stats[0].v);
                topPred.innerHTML = `
                    <div style="background:#10b98110; padding:10px; border-radius:10px; border-left:4px solid #10b981; text-align:left;">
                        <div style="font-size:1.1rem; font-weight:900; color:#fff; margin-bottom:2px;">Tendencia Positiva</div>
                        <div style="font-size:0.65rem; color:#94a3b8; line-height:1.2;">Faltan ${missing.toLocaleString('es-CL')} dosis para alcanzar el umbral crítico de protección total en la cohorte.</div>
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
        const worst = stats[stats.length - 1];
        let worstG = worst.g.replace('P. de salud:', 'Prestador:');
        const titleEl = document.getElementById('kpi-worst-title');
        const iconContainer = worstEl.closest('.kpi-card').querySelector('.kpi-icon');
        
        if (worst.p >= 80) {
            // Escenario de Éxito: Todos sobre la meta
            if (titleEl) titleEl.innerText = "TODAS LAS METAS CUMPLIDAS";
            if (iconContainer) {
                if (!iconContainer.innerHTML.includes('✅')) {
                    iconContainer.innerHTML = '✅' + iconContainer.innerHTML.substring(iconContainer.innerHTML.indexOf('<div'));
                }
                iconContainer.style.background = 'rgba(16, 185, 129, 0.1)'; // Verde suave
            }
            worstEl.innerHTML = `<span style="font-weight:700; color:#1e293b; font-size: 1rem;">Campaña Exitosa</span><br>
                                 <span style="font-size:0.9rem; color:#10b981; font-weight: 600;">Ningún grupo presenta rezago</span><br>
                                 <span style="font-size:0.85rem; color:#94a3b8; font-weight: 600;">Coberturas sobre 80%</span>`;
                                 
            const worstPred = document.getElementById('strategic-prediction-worst');
            if (worstPred) {
                worstPred.innerHTML = `
                    <div style="background:#10b98110; padding:10px; border-radius:10px; border-left:4px solid #10b981; text-align:left;">
                        <div style="font-size:1.1rem; font-weight:900; color:#fff; margin-bottom:2px;">Protección Comunitaria Activa</div>
                        <div style="font-size:0.65rem; color:#94a3b8; line-height:1.2;">Las cohortes superan el umbral del 80%, consolidando el efecto cortafuegos y mitigando la saturación de red asistencial.</div>
                    </div>
                `;
            }
        } else {
            // Escenario normal: Hay rezago
            if (titleEl) titleEl.innerText = "GRUPO REZAGADO";
            if (iconContainer) {
                if (!iconContainer.innerHTML.includes('⚠️')) {
                    iconContainer.innerHTML = '⚠️' + iconContainer.innerHTML.substring(iconContainer.innerHTML.indexOf('<div'));
                }
                iconContainer.style.background = 'rgba(245, 158, 11, 0.1)'; // Naranja suave original
            }
            const brechaPP = Math.max(0, 80 - worst.p);
            worstEl.innerHTML = `<span style="font-weight:700; color:#1e293b; font-size: 1rem;">${worstG}</span><br>
                                 <span style="font-size:0.9rem; color:#f59e0b; font-weight: 600;">${worst.p.toFixed(1).replace('.', ',')}% cobertura registrada</span><br>
                                 <span style="font-size:0.85rem; color:#ef4444; font-weight: 600;">Faltan ${brechaPP.toFixed(1).replace('.', ',')} pp para la meta (80%)</span>`;
                                 
            const worstPred = document.getElementById('strategic-prediction-worst');
            if (worstPred) {
                const missingTo80 = Math.ceil(worst.m * 0.80 - worst.v);
                worstPred.innerHTML = `
                    <div style="background:#f59e0b10; padding:10px; border-radius:10px; border-left:4px solid #f59e0b; text-align:left;">
                        <div style="font-size:1.1rem; font-weight:900; color:#fff; margin-bottom:2px;">ALTO RIESGO EPIDEMIOLÓGICO</div>
                        <div style="font-size:0.65rem; color:#94a3b8; line-height:1.2;">Cobertura deficiente. Se proyecta un impacto severo en la ocupación de camas críticas si no se rescatan rápida y obligatoriamente <b style="color:#fff;">${missingTo80.toLocaleString('es-CL')}</b> menores susceptibles.</div>
                    </div>
                `;
            }
        }
    } else if (worstEl) {
        worstEl.innerHTML = `<span style="font-size:0.9rem; color:#64748b;">Datos de metas no disponibles aún.</span>`;
        const worstPred = document.getElementById('strategic-prediction-worst');
        if (worstPred) worstPred.innerHTML = '';
    }
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
    dashboardData.data_residencia.forEach(item => {
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

    const getColor = perc => perc >= 80 ? "#10b981" : (perc >= 70 ? "#fbbf24" : "#ef4444");

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

            // 1. Lógica Semáforo (Verde >=80, Amarillo 70-84, Rojo <70) según estado Comunal
            if (criticalOnly && comunaPerc >= 70) return;
            const col = comunaPerc >= 80 ? "#10b981" : (comunaPerc >= 70 ? "#fbbf24" : "#ef4444");
            const isCritico = comunaPerc < 70;
            
            let lat = f.geometry.coordinates[1];
            let lng = f.geometry.coordinates[0];
            
            window.seenMarkerCoords = window.seenMarkerCoords || new Set();
            let coordKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
            let offsetMultiplier = 1;
            while (window.seenMarkerCoords.has(coordKey)) {
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
    document.getElementById('panelProgress').style.background = comunaPerc >= 80 ? '#10b981' : (comunaPerc >= 70 ? '#fbbf24' : '#ef4444');

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

function clearVisitHistory() {
    if(confirm('¿Está seguro de eliminar el historial de visitas? Esta acción no se puede deshacer.')) {
        localStorage.removeItem('vrs_visits_history');
        localStorage.removeItem('vrs_visits');
        document.getElementById('visitModalTotal').innerText = '0';
        const countEl = document.getElementById('visitCount');
        if (countEl) countEl.innerText = '0';
        document.getElementById('visitModalBody').innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b;">Historial limpiado correctamente. No hay registros disponibles.</td></tr>';
        
        // Registrar visita actual inmediatamente de nuevo
        initVisitTracking();
        updateVisitCounter();
    }
}

function closeSidePanel() {
    document.getElementById('mapSidePanel')?.classList.remove('active');
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
            textY = height / 2 - 8;
            
        ctx.fillText(text, textX, textY);
        
        ctx.font = "600 12px Inter";
        ctx.fillStyle = "#64748b";
        var subText = "Cobertura acumulada",
            subTextX = Math.round((width - ctx.measureText(subText).width) / 2),
            subTextY = height / 2 + 24;
            
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
            if (g !== 'Otras prioridades') validSum += v;
        });
        return s + validSum;
    }, 0);
    const meta = getMetaTotal(filter);
    
    let labels = ['Vacunados', 'Brecha a meta', 'Tramo complementario'];
    let values = [total, Math.max(0, (meta * 0.80) - total), Math.max(0, meta - Math.max(total, meta * 0.80))];
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
        const faltanParaMeta = Math.max(0, (meta * 0.80) - total);
        
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
        const yPos = yAxis.getPixelForValue(80);
        const ctx = chart.ctx;
        
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(chart.chartArea.left, yPos);
        ctx.lineTo(chart.chartArea.right, yPos);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#ef4444'; // Red dashed line for target
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        
        const text = 'Meta de cobertura (80%)';
        ctx.font = '600 10px Inter';
        
        ctx.fillStyle = '#ef4444';
        ctx.textAlign = 'right';
        
        // Agregar contorno blanco para mejorar la legibilidad sobre barras verdes
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 4;
        ctx.strokeText(text, chart.chartArea.right - 5, yPos - 12);
        
        // Dibujar el texto rojo encima
        ctx.fillText(text, chart.chartArea.right - 5, yPos - 12);
        
        ctx.restore();
    }
};

function renderBarChart(data) {
    const ctx = document.getElementById('barChart')?.getContext('2d');
    if (!ctx) return;
    if (charts.bar) charts.bar.destroy();
    
    // Sort logic
    const coms = [...new Set(data.map(i => i.comuna))];
    const rawData = coms.map(c => {
        const meta = getMetaTotal(c);
        const total = data.filter(i => i.comuna === c).reduce((s, i) => {
            let validSum = 0;
            Object.entries(i.datos).forEach(([g,v]) => {
                if (g !== 'Otras prioridades') validSum += getFilteredValue(v, 99);
            });
            return s + validSum;
        }, 0);
        const val = meta > 0 ? (total / meta) * 100 : 0;
        return { label: c, value: val };
    });
    rawData.sort((a,b) => b.value - a.value);
    
    const sortedComs = rawData.map(d => d.label);
    const sortedVals = rawData.map(d => d.value);

    charts.bar = new Chart(ctx, {
        type: 'bar',
        data: { labels: sortedComs, datasets: [{ data: sortedVals, backgroundColor: sortedVals.map(v => v >= 85 ? '#10b981' : (v >= 70 ? '#fbbf24' : '#ef4444')), borderRadius: 4 }] },
        plugins: [targetLinePlugin],
        options: { 
            indexAxis: 'x', 
            plugins: { 
                legend: { display: false }, 
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const v = context.raw;
                            const gap = 80 - v;
                            let lines = [`Cobertura: ${v.toFixed(1).replace('.', ',')}%`];
                            if (gap > 0.05) {
                                lines.push(`Brecha: Faltan ${gap.toFixed(1).replace('.', ',')} puntos porcentuales (pp)`);
                            } else if (gap > -0.05) {
                                lines.push(`¡Meta Cumplida! (80%)`);
                            } else {
                                lines.push(`Supera meta por: +${(v - 80).toFixed(1).replace('.', ',')} puntos porcentuales (pp)`);
                            }
                            return lines;
                        }
                    }
                },
                datalabels: { 
                    labels: {
                        value: {
                            anchor: 'end', 
                            align: 'end',
                            offset: 4,
                            color: '#0f172a',
                            font: { weight: '800', size: 12 },
                            formatter: v => v.toFixed(1).replace('.', ',') + '%' 
                        },
                        gap: {
                            anchor: 'end', 
                            align: 'start', // Inside the top of the bar
                            offset: 6, // 6 pixels down from the top edge
                            color: 'rgba(0, 0, 0, 0.65)', // Dark translucent for contrast against yellow
                            font: { weight: '700', size: 9 }, // Smaller font to fit inside bar width
                            formatter: function(v) {
                                const gap = 80 - v;
                                if (gap > 0.05) return `(-${gap.toFixed(1).replace('.', ',')} pp)`;
                                else if (gap > -0.05) return `(Cumple)`;
                                else return `(+${(v - 80).toFixed(1).replace('.', ',')} pp)`;
                            }
                        }
                    }
                } 
            },
            scales: {
                y: {
                    min: 0,
                    max: Math.max(100, Math.ceil(Math.max(...sortedVals) / 10) * 10 + 10),
                    title: { display: true, text: 'Porcentaje de Cobertura (%)', color: '#475569', font: { weight: '600' } }
                },
                x: {
                    ticks: { maxRotation: 45, minRotation: 45, color: '#475569', font: { weight: '500' } }
                }
            },
            layout: {
                padding: { top: 10 } // Space for the single top label
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
        const logrados = grupos.filter(g => g.cobertura >= 80);
        const criticos = grupos.filter(g => g.cobertura < 70);
        
        const logradosNombres = logrados.map(g => g.label).join(', ');
        const criticosNombres = criticos.map(g => g.label).join(', ');

        badges.innerHTML =
            `<span class="epi-badge-pill success-pill" title="${logradosNombres}">&#x2705; ${logrados.length} Grupos en Meta</span>` +
            `<span class="epi-badge-pill danger-pill" title="${criticosNombres}">&#x1F534; ${criticos.length} Grupos Rezagados</span>`;
    }

    // 🚦 3. COLORES FORMALES (MINSAL) SEMÁFORO 🚦
    // Verde: >= 85%, Naranjo: 70-79.9%, Rojo: < 70%

    // 🎯 4. PLUGIN LÍNEA META 85% (Vertical) 🎯
    const meta80Plugin = {
        id: 'meta80Line',
        afterDraw(chart) {
            if (chart.config.type !== 'bar') return;
            const xAxis = chart.scales.x;
            if (!xAxis) return;
            const xPos = xAxis.getPixelForValue(80);
            const c = chart.ctx;
            c.save();
            c.beginPath();
            c.moveTo(xPos, chart.chartArea.top);
            c.lineTo(xPos, chart.chartArea.bottom);
            c.lineWidth = 2;
            c.strokeStyle = '#ef4444'; // Rojo fuerte para la meta
            c.setLineDash([6, 4]);
            c.stroke();
            c.fillStyle = '#ef4444';
            c.font = 'bold 11px Inter';
            c.textAlign = 'right';
            c.textBaseline = 'bottom';
            c.fillText('Meta 80%', xPos - 6, chart.chartArea.top - 2);
            c.restore();
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
            let riesgoLabel, riesgoColor, riesgoBg;
            if (pct >= 80)      { riesgoLabel = '✅ Meta lograda'; riesgoColor = '#065f46'; riesgoBg = 'rgba(16,185,129,0.12)'; }
            else if (pct >= 70) { riesgoLabel = '⚠️ Bajo meta';    riesgoColor = '#92400e'; riesgoBg = 'rgba(245,158,11,0.12)'; }
            else                { riesgoLabel = '🔴 Rezago crítico';     riesgoColor = '#991b1b'; riesgoBg = 'rgba(239,68,68,0.12)'; }

            let barColor = '#10b981'; // Verde por defecto
            if (pct < 80 && pct >= 70) barColor = '#f59e0b'; // Naranjo
            if (pct < 70) barColor = '#ef4444'; // Rojo

            let brechaHtml = '';
            if (pct >= 80) {
                const pendiente100 = Math.max(0, g.meta - g.vacunados);
                brechaHtml = '<div class="ectt-row"><span class="ectt-lbl">Pendiente a 100%</span><span class="ectt-val" style="color:#64748b;">' + (pendiente100 > 0 ? pendiente100.toLocaleString('es-CL') + ' dosis' : '&#x2014; Completado') + '</span></div>';
            } else {
                const meta80doses = Math.ceil(g.meta * 0.80);
                const faltan80 = Math.max(0, meta80doses - g.vacunados);
                const brechaPP = (85 - pct).toFixed(1).replace('.', ',');
                brechaHtml = '<div class="ectt-row"><span class="ectt-lbl" style="font-weight:700;color:#ef4444;">Brecha a meta 80%</span><span class="ectt-val" style="color:#ef4444;font-weight:700;">' + faltan80.toLocaleString('es-CL') + ' dosis</span></div>' +
                             '<div class="ectt-row"><span class="ectt-lbl" style="color:#ef4444;">Faltan para meta</span><span class="ectt-val" style="color:#ef4444;">' + brechaPP + ' pp</span></div>' +
                             '<div class="ectt-row"><span class="ectt-lbl">Pendiente a 100%</span><span class="ectt-val" style="color:#64748b;">' + Math.max(0, g.meta - g.vacunados).toLocaleString('es-CL') + ' dosis</span></div>';
            }

            tooltipEl.innerHTML =
                '<div class="ectt-badge" style="background:' + riesgoBg + ';color:' + riesgoColor + ';">' + riesgoLabel + '</div>' +
                '<div class="ectt-name">' + g.h.replace('P. de salud:', 'Prestador:') + '</div>' +
                '<div class="ectt-divider"></div>' +
                '<div class="ectt-row">' +
                    '<span class="ectt-lbl">Cobertura registrada</span>' +
                    '<span class="ectt-val" style="color:' + barColor + ';font-size:1.3rem;font-weight:900;">' + pct.toFixed(1).replace('.', ',') + '%</span>' +
                '</div>' +
                '<div class="ectt-progress-bg"><div class="ectt-progress-fill" style="width:' + Math.min(pct,100) + '%;background:' + barColor + ';"></div></div>' +
                '<div class="ectt-row"><span class="ectt-lbl">Vacunados</span><span class="ectt-val">' + g.vacunados.toLocaleString('es-CL') + '</span></div>' +
                '<div class="ectt-row"><span class="ectt-lbl">Universo objetivo</span><span class="ectt-val">' + g.meta.toLocaleString('es-CL') + '</span></div>' +
                brechaHtml;

            // Posicionamiento relativo al canvas
            const canvasRect = chart.canvas.getBoundingClientRect();
            const wrapRect = tooltipEl.parentElement.getBoundingClientRect();
            let left = tooltip.caretX + 12;
            let top = tooltip.caretY - 10;

            // Evitar que salga por la derecha
            if (left + 240 > wrapRect.width) left = tooltip.caretX - 252;

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
                    if (val >= 80) return '#10b981'; // Verde (Meta Lograda)
                    if (val >= 70) return '#f59e0b'; // Naranjo (Alerta)
                    return '#ef4444'; // Rojo (Rezagado)
                },
                hoverBackgroundColor: context => {
                    const val = context.dataset.data[context.dataIndex];
                    if (val >= 80) return '#059669'; // Verde oscuro
                    if (val >= 70) return '#d97706'; // Naranjo oscuro
                    return '#dc2626'; // Rojo oscuro
                },
                borderRadius: 4,
                borderSkipped: false,
                barPercentage: 0.6,
                categoryPercentage: 0.8
            }]
        },
        plugins: [meta80Plugin],
        options: {
            indexAxis: 'y', // Convertir a barras horizontales
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
                        const val = context.dataset.data[context.dataIndex];
                        return val < 70 ? '#dc2626' : '#0f172a'; // Rojo si es crítico, azul muy oscuro normal
                    },
                    backgroundColor: 'transparent',
                    font: { weight: '800', size: 12 },
                    formatter: function(v, ctx) {
                        let pct = v.toFixed(1).replace('.', ',') + '%';
                        let abs = ctx.dataset.absoluteData[ctx.dataIndex];
                        if (v === 0 && abs > 0) return [pct, `(${abs.toLocaleString('es-CL')})`];
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
                    suggestedMax: 100, // Permite que barras mayores al 100% y sus etiquetas se vean completas
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

function renderTimeSeriesChart(data, filter) {
    const ctx = document.getElementById('timeSeriesChart')?.getContext('2d');
    if (!ctx) return;
    if (charts.trend) charts.trend.destroy();

    // Extraer datos semanales (Semanas Epidemiológicas)
    const avanceData = typeof dashboardData !== 'undefined' ? (dashboardData.avance_semanal || {}) : {};
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

    const metaLine = new Array(finalLabels.length).fill(80);
    
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
    const maxDosis = Math.max(...finalDosis.filter(v => v !== null), 10);
    // Escala dinámica para no achatar las barras en comunas pequeñas
    let maxBarAxis = Math.ceil(maxDosis * 1.2);
    if (maxBarAxis <= 50) maxBarAxis = Math.ceil(maxBarAxis / 10) * 10;
    else if (maxBarAxis <= 500) maxBarAxis = Math.ceil(maxBarAxis / 50) * 50;
    else if (maxBarAxis <= 5000) maxBarAxis = Math.ceil(maxBarAxis / 500) * 500;
    else maxBarAxis = Math.ceil(maxBarAxis / 1000) * 1000;

    let gradientFill = ctx.createLinearGradient(0, 0, 0, 400);
    gradientFill.addColorStop(0, 'rgba(15, 105, 180, 0.15)');
    gradientFill.addColorStop(1, 'rgba(15, 105, 180, 0.0)');

    let barGradient = ctx.createLinearGradient(0, 0, 0, 400);
    barGradient.addColorStop(0, 'rgba(56, 189, 248, 0.7)');
    barGradient.addColorStop(1, 'rgba(14, 165, 233, 0.7)');
    


    charts.trend = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: finalLabels,
            datasets: [
                {
                    type: 'line',
                    label: 'Meta (80%)',
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
                    label: 'Cierre Histórico 2025',
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
                        padding: {top: 4, bottom: 4, left: 6, right: 6},
                        color: '#0f69b4',
                        font: { weight: '800', size: 12 },
                        formatter: function(value) {
                            return value.toLocaleString('es-CL') + '%';
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
        plugins: [],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: true,
            },
            onHover: (event, elements, chart) => {
                if (elements.length === 0) {
                    chart.tooltip.setActiveElements([], {x: 0, y: 0});
                    chart.update();
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
                                return 'Domingo 1° Marzo - INICIO CAMPAÑA VRS 2026';
                            }
                            return null;
                        },
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.dataset.label === '% Avance' || context.dataset.label.includes('Meta') || context.dataset.label.includes('Cierre')) {
                                label += context.parsed.y.toLocaleString('es-CL') + '%';
                            } else {
                                label += context.parsed.y.toLocaleString('es-CL');
                            }
                            return label;
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
                    suggestedMax: 100,
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
    if (canvasEl && !canvasEl.dataset.mouseoutAttached) {
        canvasEl.addEventListener('mouseout', function() {
            if (charts.trend) {
                charts.trend.tooltip.setActiveElements([], {x: 0, y: 0});
                charts.trend.update();
            }
        });
        canvasEl.dataset.mouseoutAttached = 'true';
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
    ws_data.push([`CAMPAÑA VRS ${currentTableYear}`]); // Row 2
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
    XLSX.writeFile(wb, `Reporte_Epidemiologico_VRS_${currentTableYear}_${filter}.xlsx`);
}

function printTableOnly() {
    document.body.classList.add('print-table-only');
    window.print();
    // Remove the class after a short delay so the page returns to normal after the print dialog
    setTimeout(() => {
        document.body.classList.remove('print-table-only');
    }, 1000);
}

async function updateVisitCounter() {
    let count = parseInt(localStorage.getItem('vrs_visits') || '0');
    localStorage.setItem('vrs_visits', ++count);
    const el = document.getElementById('visitCount');
    if (el) el.innerText = count.toLocaleString('es-CL');

    // 1. Inicializar historial si no existe
    let history = [];
    try {
        history = JSON.parse(localStorage.getItem('vrs_visits_history') || '[]');
    } catch(e) {
        history = [];
    }

    if (history.length === 0) {
        // Historial limpio, sin datos de demostración
        history = [];
    }

    // 2. Intentar geolocalización silenciosa vía IP (Modern & Frictionless)

    try {
        const res = await fetch('https://ipapi.co/json/');
        if (!res.ok) throw new Error('API Error');
        const data = await res.json();
        
        const locName = `${data.city || 'Desconocido'}, ${data.region || ''}`;
        const coords = `${data.latitude?.toFixed(4) || '0'}, ${data.longitude?.toFixed(4) || '0'}`;
        const ip = data.ip || 'Anon';
        const org = data.org || 'ISP Público';
        
        const currentVisit = {
            timestamp: new Date().toLocaleString('es-CL'),
            location: locName,
            coords: coords,
            ip: ip,
            org: org
        };
        
        // Evitar duplicados consecutivos del mismo IP
        if (history.length === 0 || history[history.length - 1].ip !== ip) {
            history.push(currentVisit);
            if (history.length > 50) history.shift();
            localStorage.setItem('vrs_visits_history', JSON.stringify(history));
        }
    } catch (e) {
        // Fallback genérico si falla la API (adblocker, etc)
        const currentVisit = {
            timestamp: new Date().toLocaleString('es-CL'),
            location: 'Desconocida',
            coords: '0, 0',
            ip: 'IP Oculta / No disponible',
            org: 'No detectada'
        };
        if (history.length === 0 || history[history.length - 1].ip !== 'IP Oculta / No disponible') {
            history.push(currentVisit);
            if (history.length > 50) history.shift();
            localStorage.setItem('vrs_visits_history', JSON.stringify(history));
        }
    }
}

function showVisitModal() {
    const modal = document.getElementById('visitModal');
    if (!modal) return;

    // Cargar historial
    let history = [];
    try {
        history = JSON.parse(localStorage.getItem('vrs_visits_history') || '[]');
    } catch(e) {
        history = [];
    }

    const totalVisits = localStorage.getItem('vrs_visits') || '258';
    const totalEl = document.getElementById('visitModalTotal');
    if (totalEl) totalEl.innerText = parseInt(totalVisits).toLocaleString('es-CL');

    const tbody = document.getElementById('visitModalBody');
    if (tbody) {
        if (history.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b;">No hay registros de visitas disponibles.</td></tr>';
        } else {
            // Mostrar del más nuevo al más viejo
            tbody.innerHTML = history.slice().reverse().map((v, i) => `
                <tr class="visit-row" style="border-bottom:1px solid #e2e8f0;">
                    <td class="hide-mobile" style="padding:0.6rem 0.4rem; text-align:center; color:#64748b; font-weight:600;">${history.length - i}</td>
                    <td data-label="Fecha / hora" style="padding:0.6rem 0.4rem; color:#1e293b;">${v.timestamp}</td>
                    <td data-label="Institución / red" style="padding:0.6rem 0.4rem; color:#334155;">
                        <div style="font-size:0.85rem;color:#64748b;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${v.org || 'No detectada'}">${v.org || 'No detectada'}</div>
                    </td>
                    <td data-label="IP" style="padding:0.6rem 0.4rem; color:#0f69b4; font-weight:600;">${v.ip || 'IP Oculta'}</td>
                    <td data-label="Ubicación aproximada" style="padding:0.6rem 0.4rem; text-align:center;">
                        <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                            <span style="font-size:0.75rem; color:#64748b;">${v.location}</span>
                            ${v.coords && v.coords !== '0, 0' ? `<a href="https://www.google.com/maps?q=${v.coords}" target="_blank" style="color:#10b981;text-decoration:none;background:rgba(16,185,129,0.1);padding:2px 8px;border-radius:12px;font-size:0.75rem;">Ver mapa</a>` : `<span style="color:#94a3b8;font-size:0.75rem;">No disp.</span>`}
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    }

    modal.classList.remove('hidden');
}

function closeVisitModal() {
    const modal = document.getElementById('visitModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// ── AYUDA INTERACTIVA (MODAL EPIDEMIOLÓGICO) ──
function getHelpTextData(chartId) {
    const filterSelect = document.getElementById('globalComunaFilter');
    const filter = filterSelect ? filterSelect.value : 'all';
    const isComuna = filter !== 'all';
    const filterText = filterSelect ? (isComuna ? filterSelect.options[filterSelect.selectedIndex].text : 'Provincia de Osorno') : 'la jurisdicción';
    const locationContext = isComuna ? `la comuna de ${filterText}` : 'todo el territorio provincial';
    const territorialLevel = isComuna ? 'Comunal' : 'Provincial';

    // --- Cálculos Dinámicos VRS ---
    let dynamicRescates = '';
    let dynamicVelocidad = '';
    
    if (dashboardData) {
        if (dashboardData.total_rescates !== undefined && !isComuna) {
            dynamicRescates = `<div style="background: rgba(239, 68, 68, 0.08); padding: 14px 16px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.2); margin-top: 16px;">
                <strong style="color: #991b1b;"><i class="fa-solid fa-truck-medical" style="margin-right:6px;"></i>Alerta Crítica: Rescates Pendientes</strong>
                <p style="margin: 8px 0 0 0; color: #7f1d1d;">El cruce de bases de datos de Nacidos Vivos (RNC) vs Dosis Administradas arroja un saldo de <strong>${dashboardData.total_rescates} recién nacidos y lactantes susceptibles</strong> sin Nirsevimab en la provincia. Constituye un mandato clínico iniciar operativos de barrido para estas cohortes antes del alza epidémica de VRS.</p>
            </div>`;
        }

        if (dashboardData.velocidad_promedio) {
            let velKey = isComuna ? filter : 'TOTAL_PROVINCIAL';
            let vel = dashboardData.velocidad_promedio[velKey] || 0;
            if (vel > 0) {
                dynamicVelocidad = `<div style="background: rgba(15, 105, 180, 0.08); padding: 12px; border-left: 4px solid var(--minsal-blue); border-radius: 4px; margin-top: 15px;">
                    <strong style="color: #0f69b4;"><i class="fa-solid fa-gauge-high" style="margin-right:6px;"></i>Cinética Semanal:</strong><br>
                    La velocidad actual de captura en ${locationContext} es de <strong>${vel.toLocaleString('es-CL')} dosis/semana</strong>. Si esta tasa de enrolamiento disminuye precozmente, se proyecta un fracaso en el alcance de la meta antes de la Semana Epidemiológica 20.
                </div>`;
            }
        }
    }

    const helps = {
        global: {
            title: `Análisis Epidemiológico de Cobertura Global - ${filterText}`,
            body: `<div style="color: var(--text-color, #334155);">
                <p style="margin-top:0;"><strong>¿Qué revela este indicador en el contexto actual?</strong><br>
                Este medidor consolida la tasa de ataque poblacional y la absorción real de la inmunización pasiva (Nirsevimab) en <strong>${locationContext}</strong>. El porcentaje central indica el grado de penetración sobre la cohorte basal (recién nacidos y lactantes) susceptible al VRS.</p>
                <p><strong>Morfología de Riesgo y Proyección:</strong><br>
                La fracción azul representa a la cohorte que ya adquirió inmunidad celular artificial. La zona naranja proyecta la <em>brecha absoluta de susceptibilidad</em> crítica hasta la meta óptima del 80%.</p>
                ${dynamicRescates}
            </div>`
        },
        local: {
            title: `Distribución Territorial y Mapas de Calor - ${filterText}`,
            body: `<div style="color: var(--text-color, #334155);">
                <p style="margin-top:0;"><strong>Análisis del Ranking Territorial</strong><br>
                Mapea la heterogeneidad de la absorción inmunológica en las unidades geográficas, permitiendo aislar <em>clústers de riesgo agudo</em> en zonas con baja adherencia a Nirsevimab.</p>
                <ul style="padding-left: 20px; margin-bottom: 15px;">
                    <li style="margin-bottom:6px;"><strong>Dispersión Geográfica:</strong> Identifica bolsones donde el escudo inmunológico infantil está comprometido. ${isComuna ? `Baja absorción en <strong>${filterText}</strong> repercute en camas pediátricas.` : ''}</li>
                    <li style="margin-bottom:6px;"><strong>Umbral de Rebaño (80%):</strong> Una vez cruzado, se reduce drásticamente el impacto de la circulación del VRS.</li>
                    <li><strong>Alerta ROJA (<70%):</strong> Sectores que enfrentarán hospitalizaciones severas. Exigen inmediata búsqueda activa.</li>
                </ul>
            </div>`
        },
        temporal: {
            title: `Modelamiento Cinemático Actual vs Histórico - ${filterText}`,
            body: `<div style="font-size: 0.95rem; line-height: 1.5; color: var(--text-color, #334155);">
                <p style="margin-top:0;"><strong>Modelamiento de Velocidad Poblacional</strong><br>
                Analiza el performance operativo continuo del despliegue en <strong>${locationContext}</strong>, cruzando el esfuerzo logístico presente versus la trayectoria histórica consolidada.</p>
                <ul style="padding-left: 20px; margin-bottom: 15px;">
                    <li style="margin-bottom:6px;"><strong>Impulso Operativo (Barras):</strong> Volumen inoculado por semana. Caídas indican estancamiento.</li>
                    <li style="margin-bottom:6px;"><strong>Cortafuegos (Umbral 80%):</strong> Define el éxito de inmunidad protectora en ${filterText}.</li>
                </ul>
                ${dynamicVelocidad}
            </div>`
        },
        criterios: {
            title: `Estratificación de Riesgo Neonatal/Lactante - ${filterText}`,
            body: `<div style="color: var(--text-color, #334155); font-size: 0.90rem; line-height: 1.5; text-align: justify;">
                <p style="margin-top:0;"><strong>Fundamento Clínico del Indicador en ${filterText}:</strong><br>
                Evalúa la distribución de la inmunidad pasiva. Si en <strong>${locationContext}</strong> se fracasa en captación de recién nacidos (Maternidad) o lactantes, la Tasa de Hospitalización Pediátrica colapsará la UPC.</p>
                ${dynamicRescates}
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
                    <div style="background: rgba(16, 185, 129, 0.04); padding: 12px; border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.1);">
                        <strong>Monitoreo de Susceptibilidad:</strong>
                        <ul style="padding-left: 15px; margin-bottom: 0; margin-top: 8px;">
                            <li>🟢 Meta (≥ 80%): Clúster protegido.</li>
                            <li>🟠 Precaución (70-79%): Riesgo moderado.</li>
                            <li>🔴 Crítica (< 70%): Rezago biomédico inminente.</li>
                        </ul>
                    </div>
                    <div style="background: rgba(239, 68, 68, 0.04); padding: 12px; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.1);">
                        <strong>Decisiones Clínicas:</strong>
                        <ul style="padding-left: 15px; margin-bottom: 0; margin-top: 8px;">
                            <li><strong>Maternidades (RN):</strong> Obligatoriedad de 100% pre-alta institucional.</li>
                            <li><strong>Lactantes:</strong> Bajo 80% exige intervención domiciliaria.</li>
                        </ul>
                    </div>
                </div>
            </div>`
        },
        comparativa: {
            title: `Velocidad Cinética Mensual Histórica - ${filterText}`,
            body: `<div style="color: var(--text-color, #334155);">
                <p style="margin-top:0;"><strong>Cinética Comparada en ${filterText}</strong><br>
                Este módulo aísla algorítmicamente el comportamiento de las dosis administradas mensualmente, detectando micro-retrasos y fallos operacionales.</p>
                <div style="background: rgba(15, 105, 180, 0.08); padding: 12px; border-left: 4px solid var(--minsal-blue); border-radius: 4px; margin-top: 15px;">
                    <strong>Falla Operacional:</strong><br>
                    Una barra actual deprimida frente a su contraparte histórica indica quiebre de stock, falla sistémica en comunicación de riesgo, o colapso temprano de trazabilidad local.
                </div>
            </div>`
        }
    };

    function getDynamicGlossary(htmlContent) {
        const text = htmlContent.toLowerCase();
        let defs = [];
        if (text.includes('puntos porcentuales') || text.includes('(pp)') || text.includes(' pp ') || text.includes(' pp<')) {
            defs.push('<li style="margin-bottom: 4px;"><strong>Puntos Porcentuales (pp):</strong> Diferencia aritmética absoluta entre dos porcentajes. Utilizado para medir brechas exactas.</li>');
        }
        if (text.includes('brecha inter-comunal') || text.includes('brecha inter-territorial') || text.includes('inequidad territorial')) {
            defs.push('<li style="margin-bottom: 4px;"><strong>Brecha Inter-territorial:</strong> Diferencia en pp entre el territorio con mayor y menor cobertura, evidenciando inequidad local.</li>');
        }
        if (text.includes('rebaño') || text.includes('inmunidad colectiva') || text.includes('escudo inmunitario')) {
            defs.push('<li style="margin-bottom: 4px;"><strong>Inmunidad Colectiva (Rebaño):</strong> Umbral crítico de cobertura que bloquea la transmisión comunitaria sostenida del patógeno.</li>');
        }
        if (text.includes('estancamiento')) {
            defs.push('<li style="margin-bottom: 4px;"><strong>Estancamiento de Brecha:</strong> Detención en la reducción de la brecha porcentual, indicando agotamiento de estrategias pasivas.</li>');
        }

        if (defs.length === 0) return '';

        return `
        <div style="margin-top: 20px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 0.75rem; color: #64748b; line-height: 1.4; text-align: left;">
            <strong style="color: #475569; font-size: 0.8rem;">Glosario Epidemiológico:</strong>
            <ul style="padding-left: 15px; margin-top: 6px; margin-bottom: 0; list-style-type: disc;">
                ${defs.join('')}
            </ul>
            <div style="margin-top: 8px; font-style: italic; color: #94a3b8;">
                Referencias:<br>Organización Panamericana de la Salud [OPS]. (2021). <em>Consideraciones epidemiológicas y operativas para la inmunización</em>. Washington, D.C.
            </div>
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
    void overlay.offsetWidth;
    overlay.style.opacity = '1';
    
    if (card) {
        card.classList.add('spotlight-active');
        window.currentSpotlightCard = card;
    }
    
    const modal = document.getElementById('helpModal');
    if(!modal) return;
    
    document.getElementById('helpModalTitle').innerText = data.title;
    document.getElementById('helpModalBody').innerHTML = data.body;
    
    // Mostrar fuera de pantalla primero para poder medir dimensiones
    modal.style.top = '-9999px';
    modal.style.left = '-9999px';
    modal.style.transform = 'none';
    modal.style.display = 'block';
    modal.style.opacity = '0';
    
    // Calcular posición lateral para NO tapar el gráfico
    setTimeout(() => {
        const modalRect = modal.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let modalTop, modalLeft;
        
        if (card) {
            const cardRect = card.getBoundingClientRect();
            const spaceRight = viewportWidth - cardRect.right - 20;
            const spaceLeft = cardRect.left - 20;
            const modalW = Math.min(850, viewportWidth * 0.9);
            
            if (spaceLeft >= modalW) {
                // Colocar a la IZQUIERDA del gráfico
                modalLeft = cardRect.left - modalW - 20;
            } else if (spaceRight >= modalW) {
                // Colocar a la DERECHA del gráfico
                modalLeft = cardRect.right + 20;
            } else {
                // No cabe a los lados: centrar horizontalmente sin tapar
                modalLeft = Math.max(20, (viewportWidth - modalW) / 2);
            }
            
            // Alinear verticalmente con la parte superior de la tarjeta
            modalTop = Math.max(20, cardRect.top);
        } else {
            // Sin tarjeta: centrar en pantalla
            modalTop = Math.max(20, (viewportHeight - modalRect.height) / 2);
            modalLeft = Math.max(20, (viewportWidth - Math.min(850, viewportWidth * 0.9)) / 2);
        }
        
        // Asegurar que no se salga por abajo
        if (modalTop + modalRect.height > viewportHeight - 20) {
            modalTop = viewportHeight - modalRect.height - 20;
        }
        if (modalTop < 20) modalTop = 20;
        
        modal.style.top = modalTop + 'px';
        modal.style.left = modalLeft + 'px';
        modal.style.transform = 'translateY(-10px)';
        
        // Trigger reflow para la animación
        void modal.offsetWidth;
        modal.style.transition = 'opacity 0.3s ease, transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        modal.style.transform = 'translateY(0)';
        modal.style.opacity = '1';
    }, 10);
};

window.closeHelpModal = function() {
    const modal = document.getElementById('helpModal');
    const overlay = document.getElementById('spotlightOverlay');
    
    if (modal) {
        modal.style.opacity = '0';
        modal.style.transform = 'translateY(-10px)';
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

window.downloadChartImage = function(canvasId, filename) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const newCanvas = document.createElement('canvas');
    newCanvas.width = canvas.width;
    newCanvas.height = canvas.height;
    const ctx = newCanvas.getContext('2d');
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);
    
    ctx.drawImage(canvas, 0, 0);
    
    const link = document.createElement('a');
    link.download = filename + '.png';
    link.href = newCanvas.toDataURL('image/png');
    link.click();
};

window.onload = init;
