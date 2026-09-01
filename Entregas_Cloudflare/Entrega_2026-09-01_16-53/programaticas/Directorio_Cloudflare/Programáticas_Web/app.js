/* ══════════════════════════════════════════════════════════════════════════════
   Dashboard Programáticas 2026 · App Logic
   ══════════════════════════════════════════════════════════════════════════════ */

// eslint-disable-next-line no-undef
const DATA_BY_YEAR = { '2025': PROGRAMATICAS_DATA_2025, '2026': PROGRAMATICAS_DATA_2026 };
let currentYear = '2026';
let DATA = DATA_BY_YEAR[currentYear];

const COMUNAS = ["Osorno", "Puerto Octay", "Purranque", "Puyehue", "Río Negro", "San Juan de la Costa", "San Pablo"];

const VACCINE_LABELS = {
    'BCG': 'BCG', 'BEXSERO1D': 'Bexsero 1ᵃ', 'BEXSERO1R': 'Bexsero Ref.',
    'BEXSERO2D': 'Bexsero 2ᵃ', 'HEXA1D': 'Hexa 1ᵃ', 'HEXA2D': 'Hexa 2ᵃ',
    'HEXA3D': 'Hexa 3ᵃ', 'HepA': 'Hep. A', 'MENINGO': 'Meningo',
    'NEUMO1D': 'Neumo 1ᵃ', 'NEUMO23': 'Neumo 23V', 'NEUMO2D': 'Neumo 2ᵃ',
    'SRP1D': 'SRP 1ᵃ', 'SRP2D': 'SRP 2ᵃ', 'VARICELA1D': 'Varicela 1ᵃ',
    'VARICELA2D': 'Varicela 2ᵃ', 'VPH': 'VPH', 'dTpa': 'dTpa'
};

const PALETTE = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#14b8a6', '#ec4899', '#f97316', '#06b6d4', '#84cc16',
    '#6366f1', '#d946ef', '#0ea5e9', '#22c55e', '#eab308',
    '#a855f7', '#e11d48', '#0d9488'
];

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

function destroyChart(id) {
    if (chartInstances[id]) {
        chartInstances[id].destroy();
        delete chartInstances[id];
    }
}

function heatColor(ratio) {
    if (ratio >= 1.0) return '#059669';
    if (ratio >= 0.85) return '#10b981';
    if (ratio >= 0.7) return '#34d399';
    if (ratio >= 0.5) return '#f59e0b';
    if (ratio >= 0.3) return '#f97316';
    if (ratio > 0) return '#ef4444';
    return '#94a3b8';
}

// ── Data Aggregation ─────────────────────────────────────────────────────────
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
    const item = DATA.data_residencia.find(d => d.comuna === comuna);
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
    if (reportDate) {
        reportDate.innerHTML = `Fuente: Archivos Híbridos (Ocurrencia + Residencia) | Fecha de corte: ${DATA.fecha_actualizacion}`;
    }

    // Update dynamic filters (like months) based on new year's data
    populateDynamicFilters();

    // Re-render everything
    renderAll();
}

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Set date
    document.getElementById('reportDate').innerHTML = 
        `Fuente: Archivos Híbridos (Ocurrencia + Residencia) | Fecha de corte: ${DATA.fecha_actualizacion}`;



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
        currentComuna = sel.value;
        renderAll();
    });

    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
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

    // Search
    document.getElementById('searchEstab').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#tableProdContainer .data-table tbody tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(query) ? '' : 'none';
        });
    });

// ── Matriz Filters ──
function setupMultiSelect(optionsListId, selectAllId, multiSelectId, defaultText, emptyText, dataList, valueFn, labelFn) {
    const optionsList = document.getElementById(optionsListId);
    if (!optionsList) return;

    // Clear previous options for re-initialization
    optionsList.innerHTML = '';

    dataList.forEach(item => {
        const val = valueFn(item);
        const label = labelFn(item);
        
        const labelEl = document.createElement('label');
        labelEl.innerHTML = `<input type="checkbox" value="${val}" class="${optionsListId}-cb" checked> ${label}`;
        optionsList.appendChild(labelEl);
    });

    // Re-create selectAll checkbox to remove old event listeners
    const oldSelectAllCb = document.getElementById(selectAllId);
    const selectAllCb = oldSelectAllCb.cloneNode(true);
    oldSelectAllCb.parentNode.replaceChild(selectAllCb, oldSelectAllCb);
    
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
        if (selectedCount === cbs.length) textSpan.textContent = defaultText;
        else if (selectedCount === 0) textSpan.textContent = emptyText;
        else textSpan.textContent = `${selectedCount} seleccionados`;
    }
    
    // Set initial text
    updateSelectText();
}

function populateDynamicFilters() {
    if (DATA.meses_base) {
        const sortedMeses = [...DATA.meses_base].sort((a,b) => a - b);
        setupMultiSelect('fechaCorteOptionsList', 'fechaCorteSelectAll', 'matrizFechaCorteMultiSelect', 'Todos los Meses', 'Ninguno', sortedMeses, m => m, m => {
            const mesName = new Date(2026, m - 1).toLocaleString('es-CL', {month: 'long'});
            return mesName.charAt(0).toUpperCase() + mesName.slice(1);
        });
    }
}

    // Export to Excel simple function
    const btnExcel = document.getElementById('btnExportExcel');
    if (btnExcel) {
        btnExcel.addEventListener('click', () => {
            // As user wants "mismos formatos trabajados con Influenza" and Python generates it:
            // We just trigger download of the Python-generated Reporte_Programaticas_2026.xlsx
            const a = document.createElement('a');
            a.href = 'Reporte_Programaticas_2026.xlsx'; // Fallback if they moved it
            a.download = 'Reporte_Programaticas_2026.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // If they want to download the HTML table directly instead:
            let htmlTable = document.getElementById('tablaOcurrenciaExcel').outerHTML;
            // add some basic excel XML wrapper to make it readable
            let html = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head><meta charset="utf-8"></head><body>${htmlTable}</body></html>`;
            
            const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
            const url = URL.createObjectURL(blob);
            const a2 = document.createElement('a');
            a2.href = url;
            a2.download = `Matriz_Ocurrencia_${new Date().getTime()}.xls`;
            document.body.appendChild(a2);
            a2.click();
            document.body.removeChild(a2);
        });
    }

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

    document.getElementById('kpiWorstVac').textContent = getLabel(worst.vac);
    document.getElementById('kpiWorstPct').textContent = `${(worst.pct * 100).toFixed(1)}% cobertura`;
    document.getElementById('kpiWorstPct').style.color = '#ef4444';

    document.getElementById('kpiComunas').textContent = currentComuna === 'all' ? '7' : '1';
}

function renderChartCoberturaVacuna() {
    const resi = getResidenciaForComuna(currentComuna);
    const metas = getMetasForComuna(currentComuna);
    
    const labels = DATA.headers.map(v => getLabel(v));
    const coverages = DATA.headers.map(v => {
        const admin = resi[v] || 0;
        const meta = metas[v] || 0;
        return meta > 0 ? ((admin / meta) * 100) : 0;
    });

    const colors = coverages.map(c => {
        if (c >= 100) return '#059669';
        if (c >= 85) return '#10b981';
        if (c >= 70) return '#f59e0b';
        return '#ef4444';
    });

    // --- Dynamic Alert Container ---
    const alertContainer = document.getElementById('coberturaAlertContainer');
    if (alertContainer) {
        let lowestVac = '';
        let lowestCov = Infinity;
        let lowestMissing = 0;
        let totalDosis = 0;
        let totalMeta = 0;

        DATA.headers.forEach((v, idx) => {
            const admin = resi[v] || 0;
            const meta = metas[v] || 0;
            totalDosis += admin;
            totalMeta += meta;
            if (meta > 0 && coverages[idx] < lowestCov) {
                lowestCov = coverages[idx];
                lowestVac = getLabel(v);
                lowestMissing = Math.max(0, meta - admin);
            }
        });

        if (totalMeta > 0 && lowestCov < 90) {
            alertContainer.innerHTML = `
                <div style="background: rgba(239, 68, 68, 0.08); padding: 12px 16px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.2);">
                    <strong style="color: #991b1b; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-exclamation-triangle"></i> Alerta de Vulnerabilidad: ${lowestVac}
                    </strong>
                    <p style="margin: 6px 0 0 0; color: #7f1d1d; font-size: 0.9rem;">
                        La vacuna <strong>${lowestVac}</strong> representa el eslabón más débil en la cadena inmunológica de ${currentComuna === 'all' ? 'la provincia' : currentComuna}, con una cobertura del <strong>${lowestCov.toFixed(1)}%</strong>. Faltan <strong>${lowestMissing.toLocaleString('es-CL')}</strong> dosis para alcanzar la seguridad comunitaria.
                    </p>
                </div>
            `;
        } else if (totalMeta > 0 && lowestCov >= 90) {
             alertContainer.innerHTML = `
                <div style="background: rgba(16, 185, 129, 0.08); padding: 12px 16px; border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.2);">
                    <strong style="color: #047857; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-shield-alt"></i> Escudo Inmunológico Óptimo
                    </strong>
                    <p style="margin: 6px 0 0 0; color: #064e3b; font-size: 0.9rem;">
                        Todas las vacunas del programa superan el umbral del 90% en ${currentComuna === 'all' ? 'la provincia' : currentComuna}. El riesgo de brotes es mínimo.
                    </p>
                </div>
            `;
        } else {
            alertContainer.innerHTML = '';
        }
    }

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
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    formatter: v => v.toFixed(1) + '%',
                    font: { weight: 700, size: 10, family: 'Inter' },
                    color: (ctx) => colors[ctx.dataIndex]
                },
                annotation: undefined
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: Math.max(150, ...coverages) + 10,
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
        plugins: [ChartDataLabels]
    });
}

function renderChartDistribucion() {
    const resi = getResidenciaForComuna(currentComuna);
    
    const sorted = DATA.headers
        .map(v => ({ key: v, val: resi[v] || 0 }))
        .sort((a, b) => b.val - a.val)
        .slice(0, 8);

    destroyChart('distribucion');
    const ctx = document.getElementById('chartDistribucion');
    if (!ctx) return;

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
            cutout: '55%',
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
                datalabels: { display: false }
            }
        }
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
        const resiItem = DATA.data_residencia.find(d => d.comuna === com);
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
    const filtered = getOcurrenciaFiltered(currentComuna);
    
    const totalProd = filtered.reduce((a, b) => a + b.total, 0);
    document.getElementById('kpiEstabs').textContent = fmt(filtered.length);
    document.getElementById('kpiTotalProd').textContent = fmt(totalProd);
    document.getElementById('kpiAvgProd').textContent = filtered.length > 0 ? fmt(Math.round(totalProd / filtered.length)) : '0';

    if (filtered.length > 0) {
        const top = filtered.reduce((a, b) => a.total > b.total ? a : b);
        const name = top.establecimiento.length > 40 ? top.establecimiento.substring(0, 38) + '…' : top.establecimiento;
        document.getElementById('kpiTopEstab').textContent = name;
        document.getElementById('kpiTopEstabCount').textContent = `${fmt(top.total)} dosis · ${top.comuna}`;
        document.getElementById('kpiTopEstabCount').style.color = '#10b981';
    }
}

function renderChartTopEstabs() {
    const filtered = getOcurrenciaFiltered(currentComuna);
    const top10 = [...filtered].sort((a, b) => b.total - a.total).slice(0, 10);

    const labels = top10.map(e => {
        const name = e.establecimiento.length > 35 ? e.establecimiento.substring(0, 33) + '…' : e.establecimiento;
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
                backgroundColor: PALETTE.slice(0, 10).map(c => c + '99'),
                borderColor: PALETTE.slice(0, 10),
                borderWidth: 2,
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
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
    
    const filtered = getOcurrenciaFiltered(currentComuna);
    filtered.forEach(item => {
        comunaTotals[item.comuna] = (comunaTotals[item.comuna] || 0) + item.total;
    });

    const labels = currentComuna === 'all' ? COMUNAS : [currentComuna];
    const values = labels.map(c => comunaTotals[c] || 0);

    destroyChart('prodComuna');
    const ctx = document.getElementById('chartProdComuna');
    if (!ctx) return;

    chartInstances['prodComuna'] = new Chart(ctx, {
        type: 'polarArea',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: PALETTE.slice(0, labels.length).map(c => c + '88'),
                borderColor: PALETTE.slice(0, labels.length),
                borderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: { family: 'Inter', size: 11, weight: 500 },
                        padding: 10,
                        usePointStyle: true,
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim()
                    }
                },
                datalabels: { display: false }
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
    
    const filtered = DATA.data_ocurrencia.filter(d => comunas.includes(d.comuna));
    
    const vacunasCbs = document.querySelectorAll('.vacunaOptionsList-cb');
    let vacunas = DATA.headers;
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
    
    const dosisCbs = document.querySelectorAll('.dosisOptionsList-cb');
    if (dosisCbs.length > 0) {
        const dosisSeleccionadas = Array.from(dosisCbs).filter(c => c.checked).map(c => c.value);
        vacunas = vacunas.filter(v => dosisSeleccionadas.includes(getDosisOfVacuna(v)));
    }
    
    const fechaCorteCbs = document.querySelectorAll('.fechaCorteOptionsList-cb');
    let mesesSeleccionados = DATA.meses_base || [];
    if (fechaCorteCbs.length > 0) {
        mesesSeleccionados = Array.from(fechaCorteCbs).filter(c => c.checked).map(c => parseInt(c.value));
    }
    
    // Determinar el mes máximo seleccionado para el delta y leyendas
    const latestMonthNum = mesesSeleccionados.length > 0 ? Math.max(...mesesSeleccionados) : (DATA.meses_base && DATA.meses_base.length > 0 ? Math.max(...DATA.meses_base.map(Number)) : 6);
    const latestMonth = latestMonthNum.toString();
    const monthName = new Date(2026, latestMonthNum - 1).toLocaleString('es-CL', {month: 'long'}).toUpperCase();

    // Leyenda
    let html = `
        <div style="display:flex; justify-content:center; gap:30px; margin-bottom:15px; font-size:0.9rem;">
            <div><span style="font-weight:bold; color:var(--text-primary)">1.000</span> = Total Acumulado (Campaña a Fecha Corte)</div>
            <div><span style="font-weight:bold; color:#10b981">▲ +50</span> = Dosis administradas SOLO en el mes de ${monthName}</div>
        </div>
    `;

    html += `<table id="tablaOcurrenciaExcel" class="data-table matriz-compacta"><thead><tr><th class="sticky-comuna-th">Comuna</th><th class="sticky-estab-th">Establecimiento</th>`;
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
            html += `<tr><td class="sticky-comuna">${com}</td><td class="sticky-estab" style="text-align:left; font-weight:500;">${item.establecimiento}</td>`;
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
                    const deltaStr = delta > 0 ? ` <span style="color:#10b981; font-weight:bold; font-size:0.85em; margin-left:4px;">▲ ${fmt(delta)}</span>` : '';
                    html += `<td>${fmt(val)}${deltaStr}</td>`;
                } else {
                    html += `<td><span style="color:var(--text-muted)">-</span></td>`;
                }
            });
            comunaTotalAll += rowTotalAll;
            comunaDeltaAll += rowDeltaAll;
            grandTotalAll += rowTotalAll;
            grandDeltaAll += rowDeltaAll;
            
            const totalDeltaStr = rowDeltaAll > 0 ? ` <span style="color:#10b981; font-weight:bold; font-size:0.85em; margin-left:4px;">▲ ${fmt(rowDeltaAll)}</span>` : '';
            html += `<td style="font-weight:700; color:var(--accent-blue)">${fmt(rowTotalAll)}${totalDeltaStr}</td></tr>`;
        });

        // Subtotal row
        const subtotalDeltaStrAll = comunaDeltaAll > 0 ? ` <span style="color:#10b981; font-weight:bold; font-size:0.85em; margin-left:4px;">▲ ${fmt(comunaDeltaAll)}</span>` : '';
        html += `<tr class="total-row" style="background:rgba(59,130,246,0.05)"><td></td><td style="text-align:right">Subtotal ${com}</td>`;
        vacunas.forEach(v => { 
            const deltaStr = comunaDelta[v] > 0 ? ` <span style="color:#10b981; font-weight:bold; font-size:0.85em; margin-left:4px;">▲ ${fmt(comunaDelta[v])}</span>` : '';
            html += `<td>${fmt(comunaTotal[v])}${deltaStr}</td>`; 
        });
        html += `<td style="color:var(--accent-blue); font-weight:bold;">${fmt(comunaTotalAll)}${subtotalDeltaStrAll}</td></tr>`;
    });

    // Grand total
    const grandDeltaStrAll = grandDeltaAll > 0 ? ` <span style="color:#10b981; font-weight:bold; font-size:0.85em; margin-left:4px;">▲ ${fmt(grandDeltaAll)}</span>` : '';
    html += `<tr class="total-row grand-total" style="font-size:1rem; background:#475569; color:white; border-top:2px solid #cbd5e1;"><td></td><td style="text-align:center; font-weight:900; color:white;">TOTAL PROVINCIAL</td>`;
    vacunas.forEach(v => { 
        const deltaStr = grandDelta[v] > 0 ? ` <span style="color:#10b981; font-weight:bold; font-size:0.85em; margin-left:4px;">▲ ${fmt(grandDelta[v])}</span>` : '';
        html += `<td style="color:white !important;">${fmt(grandTotal[v])}${deltaStr}</td>`; 
    });
    html += `<td style="color:white !important; font-weight:bold;">${fmt(grandTotalAll)}${grandDeltaStrAll}</td></tr>`;

    html += '</tbody></table>';
    container.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3: MATRIZ TÉCNICA
// ══════════════════════════════════════════════════════════════════════════════

function renderMatrizTecnica() {
    const container = document.getElementById('tableMatrizContainer');
    if (!container) return;

    const vacunas = DATA.headers;
    const comunasToShow = currentComuna === 'all' ? COMUNAS : [currentComuna];

    let html = '<table class="data-table"><thead><tr><th>Vacuna</th><th>Métrica</th>';
    comunasToShow.forEach(c => { html += `<th>${c}</th>`; });
    if (currentComuna === 'all') html += '<th>Provincial</th>';
    html += '</tr></thead><tbody>';

    vacunas.forEach((vac, idx) => {
        const bgAlt = idx % 2 === 0 ? '' : 'style="background: rgba(59,130,246,0.03)"';

        // Row 1: Dosis
        html += `<tr ${bgAlt}><td rowspan="3" style="font-weight:700; border-right:2px solid var(--accent-blue); vertical-align:middle">${getLabel(vac)}</td><td>Dosis</td>`;
        let provDosis = 0;
        comunasToShow.forEach(com => {
            const item = DATA.data_residencia.find(d => d.comuna === com);
            const val = item ? (item.datos[vac] || 0) : 0;
            provDosis += val;
            html += `<td>${fmt(val)}</td>`;
        });
        if (currentComuna === 'all') html += `<td style="font-weight:700">${fmt(provDosis)}</td>`;
        html += '</tr>';

        // Row 2: Población
        html += `<tr ${bgAlt}><td>Población</td>`;
        let provPob = 0;
        comunasToShow.forEach(com => {
            const meta = DATA.metas[com] ? (DATA.metas[com].Criterios[vac] || 0) : 0;
            provPob += meta;
            html += `<td>${fmt(meta)}</td>`;
        });
        if (currentComuna === 'all') html += `<td style="font-weight:700">${fmt(provPob)}</td>`;
        html += '</tr>';

        // Row 3: Cobertura
        html += `<tr ${bgAlt}><td>Cobertura</td>`;
        comunasToShow.forEach(com => {
            const item = DATA.data_residencia.find(d => d.comuna === com);
            const admin = item ? (item.datos[vac] || 0) : 0;
            const meta = DATA.metas[com] ? (DATA.metas[com].Criterios[vac] || 0) : 0;
            const ratio = meta > 0 ? admin / meta : 0;
            const cls = ratio >= 0.85 ? 'coverage-good' : ratio >= 0.5 ? 'coverage-warn' : 'coverage-bad';
            html += `<td class="${cls}">${(ratio * 100).toFixed(1)}%</td>`;
        });
        if (currentComuna === 'all') {
            const provRatio = provPob > 0 ? provDosis / provPob : 0;
            const cls = provRatio >= 0.85 ? 'coverage-good' : provRatio >= 0.5 ? 'coverage-warn' : 'coverage-bad';
            html += `<td class="${cls}" style="font-weight:800">${(provRatio * 100).toFixed(1)}%</td>`;
        }
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function renderChartRadar() {
    // Select up to 8 vaccines for readability
    const selectVacs = ['HEXA1D', 'SRP1D', 'BCG', 'NEUMO1D', 'BEXSERO1D', 'MENINGO', 'VPH', 'NEUMO23'];
    const labels = selectVacs.map(v => getLabel(v));

    const datasets = [];
    const comunasToShow = currentComuna === 'all' ? COMUNAS.slice(0, 4) : [currentComuna];

    comunasToShow.forEach((com, idx) => {
        const resi = DATA.data_residencia.find(d => d.comuna === com);
        const metas = DATA.metas[com] ? DATA.metas[com].Criterios : {};
        
        const values = selectVacs.map(v => {
            const admin = resi ? (resi.datos[v] || 0) : 0;
            const meta = metas[v] || 0;
            return meta > 0 ? ((admin / meta) * 100) : 0;
        });

        datasets.push({
            label: com,
            data: values,
            borderColor: PALETTE[idx],
            backgroundColor: PALETTE[idx] + '22',
            borderWidth: 2,
            pointBackgroundColor: PALETTE[idx],
            pointRadius: 4,
        });
    });

    destroyChart('radar');
    const ctx = document.getElementById('chartRadar');
    if (!ctx) return;

    chartInstances['radar'] = new Chart(ctx, {
        type: 'radar',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    beginAtZero: true,
                    max: 200,
                    ticks: {
                        stepSize: 50,
                        callback: v => v + '%',
                        font: { family: 'Inter', size: 10 },
                        backdropColor: 'transparent',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim()
                    },
                    grid: { color: 'rgba(148,163,184,0.15)' },
                    pointLabels: {
                        font: { family: 'Inter', size: 11, weight: 600 },
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim()
                    }
                }
            },
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

    const datasets = selectedVacs.map((vac, idx) => {
        const monthlyTotals = meses.map(m => {
            let total = 0;
            filtered.forEach(item => {
                total += (item.datos[vac] || {})[String(m)] || 0;
            });
            return total;
        });

        return {
            label: getLabel(vac),
            data: monthlyTotals,
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
            labels: meses.map(m => MONTH_NAMES[m - 1]),
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
