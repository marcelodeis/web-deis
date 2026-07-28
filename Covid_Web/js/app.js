/* ══════════════════════════════════════════════════════════════════════════════
   Dashboard COVID-19 · Main App (Orchestrator)
   Inicialización, eventos y coordinación de módulos
   ══════════════════════════════════════════════════════════════════════════════ */

import { initData, loadYearData, getData, getCurrentYear, setCurrentYear, setCurrentComuna, setData, getDataForYear, COMUNAS, fmt } from './data.js';
import { renderKPIs, renderCharts, downloadChartImage, animateValue } from './charts.js';
import { updateDynamicFilters, renderTable, setupExcelExport } from './table.js';
import { openHelpModal, closeHelpModal } from './epidemiology.js';
import { initMap, updateMapData, updateMapTheme } from './map.js';

// ── Expose to window for inline onclick handlers ─────────────────────────────
window.openHelpModal = openHelpModal;
window.closeHelpModal = closeHelpModal;
window.downloadChartImage = downloadChartImage;
window.currentTemporalView = 'SE';
window.setTemporalView = function(view) {
    if (window.currentTemporalView === view) return;
    window.currentTemporalView = view;
    
    // Update button styles
    const btnSE = document.getElementById('btnViewSE');
    const btnMes = document.getElementById('btnViewMes');
    
    if (view === 'SE') {
        btnSE.style.background = 'var(--minsal-blue)';
        btnSE.style.color = 'white';
        btnMes.style.background = 'transparent';
        btnMes.style.color = '#64748b';
    } else {
        btnMes.style.background = 'var(--minsal-blue)';
        btnMes.style.color = 'white';
        btnSE.style.background = 'transparent';
        btnSE.style.color = '#64748b';
    }
    
    // Redraw charts
    try {
        console.log("Redrawing charts for view:", view);
        renderCharts();
    } catch(e) {
        alert("ERROR in setTemporalView: " + e.message + "\n" + e.stack);
        console.error(e);
    }
};

// ── Loading Skeleton ─────────────────────────────────────────────────────────
function showLoader() {
    const loader = document.getElementById('loader-overlay');
    if (loader) loader.style.display = 'flex';
}

function hideLoader() {
    const loader = document.getElementById('loader-overlay');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => { loader.style.display = 'none'; }, 400);
    }
}

// ── Core Rendering ───────────────────────────────────────────────────────────
function updateReportDate() {
    const DATA = getData();
    if (!DATA || !DATA.fecha_actualizacion) return;
    document.getElementById('reportDate').textContent = `Fuente: DEIS-MINSAL, Fecha de corte: ${DATA.fecha_actualizacion}`;
}

function renderAll() {
    try {
        const DATA = getData();
        if (!DATA) {
            console.warn("No data loaded for", getCurrentYear());
            return;
        }
        // Trigger fade-in animation
        document.querySelectorAll('.kpi-card, .chart-card, .card').forEach((el, i) => {
            el.classList.remove('animate-in');
            void el.offsetWidth; // force reflow
            el.style.animationDelay = `${i * 0.05}s`;
            el.classList.add('animate-in');
        });

        renderKPIs();
        renderCharts();
        updateDynamicFilters();
        updateReportDate();
        updateMapData();
    } catch(e) {
        alert("ERROR IN renderAll: " + e.message + "\n" + e.stack);
        console.error(e);
    }
}

// ── Year Switching ───────────────────────────────────────────────────────────
window.switchYear = async function(year) {
    if (year === getCurrentYear()) return;
    setCurrentYear(year);
    
    // Load data if not cached
    const data = getDataForYear(year);
    if (data) {
        setData(data);
    } else {
        showLoader();
        await loadYearData(year);
        hideLoader();
    }
    
    // Helper para actualizar estilos dinámicos de los botones
    const applyActiveStyle = (btn, isActive) => {
        if (!btn) return;
        if (isActive) {
            btn.style.background = 'var(--minsal-blue)';
            btn.style.color = 'white';
            btn.style.fontWeight = '700';
            btn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        } else {
            btn.style.background = 'transparent';
            btn.style.color = '#64748b';
            btn.style.fontWeight = '600';
            btn.style.boxShadow = 'none';
        }
    };

    // Actualizar botones del Header
    applyActiveStyle(document.getElementById('btnYear2025'), year === '2025');
    applyActiveStyle(document.getElementById('btnYear2026'), year === '2026');
    
    // Actualizar botones de la Matriz
    applyActiveStyle(document.getElementById('btnYear2025Prod'), year === '2025');
    applyActiveStyle(document.getElementById('btnYear2026Prod'), year === '2026');

    const headerBadge = document.getElementById('headerYearBadge');
    if (headerBadge) headerBadge.textContent = year;
    if (document.getElementById('badgeEvolucion')) {
        document.getElementById('badgeEvolucion').textContent = year;
    }
    document.getElementById('matrizYearTitle').textContent = `(BASE OCURRENCIA ${year})`;
    document.getElementById('footerYear').textContent = year;
    
    populateFechaCorte(year);
    
    renderAll();
};

function populateFechaCorte(yearStr) {
    const fechaCorteSelect = document.getElementById('fechaCorteSelect');
    if (!fechaCorteSelect) return;
    
    fechaCorteSelect.innerHTML = ''; // Clear previous options
    
    const year = parseInt(yearStr, 10);
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    
    const DATA = getDataForYear(yearStr);
    let defaultDate = '';
    let maxMonthForYear = 11; // Diciembre por defecto
    if (DATA && DATA.fecha_actualizacion) {
        const parts = DATA.fecha_actualizacion.split(/[\s/:-]+/);
        if (parts.length >= 3) {
            const d = parts[0].padStart(2, '0');
            const m = parts[1].padStart(2, '0');
            const y = parts[2];
            defaultDate = `${d}/${m}/${y}`;
            if (parseInt(y, 10) === year) {
                maxMonthForYear = parseInt(m, 10) - 1; // 0-indexed
            }
        }
    }
    
    // Por defecto meses de marzo a diciembre, filtrados hasta el mes actual de ese año
    let mesesList = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; 
    mesesList = mesesList.filter(m => m <= maxMonthForYear);
    
    let isDefaultDateACierre = false;
    const optionsToAdd = [];

    mesesList.forEach(m => {
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

    optionsToAdd.forEach(opt => fechaCorteSelect.appendChild(opt));
}

// ── Initialization ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    showLoader();

    // Load data asynchronously
    await initData();

    // Dark mode logic
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        const currentTheme = localStorage.getItem('theme') || 'light';
        if (currentTheme === 'dark') {
            document.body.setAttribute('data-theme', 'dark');
            themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
        }
        themeToggleBtn.addEventListener('click', () => {
            const isDark = document.body.getAttribute('data-theme') === 'dark';
            if (isDark) {
                document.body.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
                themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
            } else {
                document.body.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
            }
            renderCharts();
            updateMapTheme();
        });
    }

    // Populate comuna filter
    const sel = document.getElementById('globalComunaFilter');
    COMUNAS.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        opt.style.color = 'black';
        sel.appendChild(opt);
    });
    sel.addEventListener('change', () => {
        setCurrentComuna(sel.value);
        renderAll();
    });

    // Populate fecha corte para el año inicial
    populateFechaCorte(getCurrentYear());

    // Initial render
    hideLoader();
    initMap(); // Initialize Leaflet map immediately since it's visible now
    setupExcelExport(); // Initialize Excel button
    setTimeout(renderAll, 100);
});
