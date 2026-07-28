try {
/* --- data.js --- */
/* ══════════════════════════════════════════════════════════════════════════════
   Dashboard COVID-19 · Data Module
   Constantes, estado global y funciones de acceso a datos
   ══════════════════════════════════════════════════════════════════════════════ */

// ── Constantes ───────────────────────────────────────────────────────────────
const COMUNAS = ["Osorno", "Puerto Octay", "Purranque", "Puyehue", "Río Negro", "San Juan de la Costa", "San Pablo"];
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const PALETTE = [
    '#0f69b4', // Azul Minsal
    '#0ea5e9', // Celeste
    '#10b981', // Verde
    '#f59e0b', // Ambar
    '#8b5cf6', // Morado
    '#ef4444', // Rojo
    '#14b8a6', // Teal
    '#f43f5e'  // Rose
];

const COMUNA_COLORS = {};
COMUNAS.forEach((c, i) => COMUNA_COLORS[c.toUpperCase()] = PALETTE[i % PALETTE.length]);

// ── Estado Global ────────────────────────────────────────────────────────────
const state = {
    currentYear: '2026',
    DATA: null,
    currentComuna: 'all',
    DATA_BY_YEAR: {}
};

function getState() { return state; }
function getCurrentYear() { return state.currentYear; }
function getData() { return state.DATA; }
function getCurrentComuna() { return state.currentComuna; }

function setCurrentYear(year) { state.currentYear = year; }
function setData(data) { state.DATA = data; }
function setCurrentComuna(comuna) { state.currentComuna = comuna; }
function setDataForYear(year, data) { state.DATA_BY_YEAR[year] = data; }
function getDataForYear(year) { return state.DATA_BY_YEAR[year] || null; }

// ── Carga de Datos (Async JSON) ──────────────────────────────────────────────
const dataCache = {};

async function loadYearData(year) {
    if (dataCache[year]) {
        state.DATA_BY_YEAR[year] = dataCache[year];
        state.DATA = dataCache[year];
        return dataCache[year];
    }

    try {
        const response = await fetch(`data/covid_data_${year}.json`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        dataCache[year] = data;
        state.DATA_BY_YEAR[year] = data;
        state.DATA = data;
        return data;
    } catch (e) {
        console.error(`Error cargando datos ${year}:`, e);
        // Fallback: intentar variable global legacy
        const globalVar = window[`COVID_DATA_${year}`];
        if (globalVar) {
            console.warn(`Usando fallback de variable global para ${year}`);
            dataCache[year] = globalVar;
            state.DATA_BY_YEAR[year] = globalVar;
            state.DATA = globalVar;
            return globalVar;
        }
        return null;
    }
}

async function initData() {
    // Cargar ambos años
    await loadYearData('2025');
    await loadYearData('2026');
    state.currentYear = '2026';
    state.DATA = state.DATA_BY_YEAR['2026'];
}

// ── Utilidades ───────────────────────────────────────────────────────────────
function fmt(n) {
    return (n || 0).toLocaleString('es-CL');
}

function shortenEstabName(name) {
    if (!name) return '';
    let n = name;
    n = n.replace(/Centro de Salud Familiar/gi, 'CESFAM');
    n = n.replace(/Centro Comunitario de Salud Familiar/gi, 'CECOSF');
    n = n.replace(/Hospital Base San José de Osorno/gi, 'HBSJO');
    n = n.replace(/Hospital/gi, 'Hosp.');
    n = n.replace(/Clínica Alemana de Osorno/gi, 'C. Alemana');
    return n.length > 35 ? n.substring(0, 32) + '...' : n;
}

function getTipoEstablecimiento(nombre) {
    let n = nombre.toUpperCase();
    if (n.includes('HOSPITAL')) return 'Hospitales';
    if (n.includes('CLÍNICA') || n.includes('CLINICA') || n.includes('PRIVAD')) return 'Clínicas Privadas';
    if (n.includes('CESFAM') || n.includes('FAMILIAR')) return 'CESFAM';
    if (n.includes('CECOSF') || n.includes('COMUNITARIO')) return 'CECOSF';
    if (n.includes('POSTA')) return 'Postas Rurales';
    return 'Otros';
}

// ── Data Access ──────────────────────────────────────────────────────────────
function getResidenciaTotals(comuna) {
    const DATA = state.DATA;
    const totals = {};
    if (!DATA) return totals;
    DATA.headers.forEach(h => totals[h] = 0);
    
    DATA.data_residencia.forEach(item => {
        if (comuna === 'all' || item.comuna.toUpperCase() === comuna.toUpperCase()) {
            Object.keys(item.datos_mes || {}).forEach(vac => {
                if (totals[vac] !== undefined) {
                    const sum = Object.values(item.datos_mes[vac]).reduce((a, b) => a + b, 0);
                    totals[vac] += sum;
                }
            });
        }
    });
    return totals;
}

function getResidenciaData(comuna) {
    const DATA = state.DATA;
    if (!DATA) return [];
    if (comuna === 'all') return DATA.data_residencia;
    return DATA.data_residencia.filter(item => item.comuna.toUpperCase() === comuna.toUpperCase());
}

function getOcurrenciaData(comuna) {
    const DATA = state.DATA;
    if (!DATA) return [];
    if (comuna === 'all') return DATA.data_ocurrencia;
    return DATA.data_ocurrencia.filter(d => d.comuna.toUpperCase() === comuna.toUpperCase());
}

function getPoblacionObjetivo(comuna) {
    const DATA = state.DATA;
    if (!DATA || !DATA.metas) return 0;
    
    if (comuna === 'all') {
        let total = 0;
        for (let com in DATA.metas) {
            total += DATA.metas[com].Poblacion_Objetivo || 0;
        }
        return total;
    } else {
        const comKey = Object.keys(DATA.metas).find(k => k.toUpperCase() === comuna.toUpperCase());
        return comKey ? (DATA.metas[comKey].Poblacion_Objetivo || 0) : 0;
    }
}


/* --- charts.js --- */
/* ══════════════════════════════════════════════════════════════════════════════
   Dashboard COVID-19 · Charts Module
   Renderizado de gráficos Chart.js y KPIs
   ══════════════════════════════════════════════════════════════════════════════ */


const chartInstances = {};

// ── Utilidades de Gráficos ───────────────────────────────────────────────────
function destroyChart(id) {
    if (chartInstances[id]) {
        chartInstances[id].destroy();
        delete chartInstances[id];
    }
}

function animateValue(obj, end, duration = 800) {
    if (!obj) return;
    if (isNaN(end) || end === 0) {
        obj.innerHTML = fmt(end);
        return;
    }
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        obj.innerHTML = fmt(Math.floor(easeOut * end));
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = fmt(end);
        }
    };
    window.requestAnimationFrame(step);
}

function downloadChartImage(canvasId, fileName) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = canvas.width;
    tmpCanvas.height = canvas.height;
    const ctx = tmpCanvas.getContext('2d');
    
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    ctx.fillStyle = isDark ? '#1e293b' : '#ffffff';
    ctx.fillRect(0, 0, tmpCanvas.width, tmpCanvas.height);
    ctx.drawImage(canvas, 0, 0);

    const link = document.createElement('a');
    link.href = tmpCanvas.toDataURL('image/png');
    link.download = fileName + '_' + new Date().toISOString().slice(0, 10) + '.png';
    link.click();
}

function getChartColors() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    return {
        text: isDark ? '#f1f5f9' : '#1e293b',
        grid: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
    };
}

// ── Render KPIs ──────────────────────────────────────────────────────────────
function renderKPIs() {
    const DATA = getData();
    const currentComuna = getCurrentComuna();
    if (!DATA) return;
    
    // Residencia KPIs
    const resTotals = getResidenciaTotals(currentComuna);
    const totalDosisRes = Object.values(resTotals).reduce((a, b) => a + b, 0);
    
    animateValue(document.getElementById('kpiTotalDosis'), totalDosisRes);
    
    // Estimación oficial de grupos según Orientaciones MINSAL
    let kpi60 = 0, kpiCronicos = 0, kpiSalud = 0;
    
    // 60+ y Crónicos se extraen por RESIDENCIA. 60+ manda por edad.
    DATA.data_residencia.forEach(item => {
        if (currentComuna === 'all' || item.comuna.toUpperCase() === currentComuna.toUpperCase()) {
            if (item.es_mayor_60) {
                kpi60 += item.total;
            } else {
                let cr = (item.criterio || '').toLowerCase();
                if (cr.includes('cronico') || cr.includes('crónico') || cr.includes('inmuno') || cr.includes('embarazada')) {
                    kpiCronicos += item.total;
                }
            }
        }
    });

    // Personal de Salud se extrae por RESIDENCIA
    DATA.data_residencia.forEach(item => {
        if (currentComuna === 'all' || item.comuna.toUpperCase() === currentComuna.toUpperCase()) {
            let cr = (item.criterio || '').toLowerCase();
            if (cr.includes('salud') || cr.includes('medico') || cr.includes('clínico') || cr.includes('funcionario')) {
                kpiSalud += item.total;
            }
        }
    });
    
    animateValue(document.getElementById('kpi60'), kpi60);
    animateValue(document.getElementById('kpiCronicos'), kpiCronicos);
    animateValue(document.getElementById('kpiSalud'), kpiSalud);
    
    // Ocurrencia KPIs
    const occData = getOcurrenciaData(currentComuna);
    let totalOcc = 0;
    const estabsMap = {};
    occData.forEach(item => {
        totalOcc += item.total;
        if (!estabsMap[item.establecimiento]) estabsMap[item.establecimiento] = 0;
        estabsMap[item.establecimiento] += item.total;
    });
    
    const estabsCount = Object.keys(estabsMap).length;
    let topEstab = { name: '--', val: 0 };
    Object.entries(estabsMap).forEach(([name, val]) => {
        if (val > topEstab.val) {
            topEstab.name = name;
            topEstab.val = val;
        }
    });

    animateValue(document.getElementById('kpiCentrosActivos'), estabsCount);
    animateValue(document.getElementById('kpiOcurrenciaTotal'), totalOcc);
    if(document.getElementById('kpiVelocidad')) {
        animateValue(document.getElementById('kpiVelocidad'), DATA.velocidad_promedio || 0);
    }
    if (document.getElementById('kpiTopCentro')) {
        document.getElementById('kpiTopCentro').textContent = topEstab.name;
    }
    if (document.getElementById('kpiTopCentroDosis')) {
        document.getElementById('kpiTopCentroDosis').textContent = fmt(topEstab.val) + ' dosis';
    }

    // KPIs Ejecutivos (Tendencia)
    renderExecutiveKPIs();
}

// ── KPIs Ejecutivos con Tendencia ────────────────────────────────────────────
function renderExecutiveKPIs() {
    const DATA = getData();
    const currentComuna = getCurrentComuna();
    if (!DATA) return;

    // 1. Variación mensual
    const monthlyTotals = Array(12).fill(0);
    getOcurrenciaData(currentComuna).forEach(item => {
        if (item.datos) {
            Object.values(item.datos).forEach(vacMonths => {
                Object.entries(vacMonths).forEach(([m, count]) => {
                    const mIdx = parseInt(m) - 1;
                    if (mIdx >= 0 && mIdx < 12) monthlyTotals[mIdx] += count;
                });
            });
        }
    });

    // Encontrar el último mes con datos y el anterior
    let lastMonth = -1;
    for (let i = 11; i >= 0; i--) {
        if (monthlyTotals[i] > 0) { lastMonth = i; break; }
    }
    let prevMonth = -1;
    for (let i = lastMonth - 1; i >= 0; i--) {
        if (monthlyTotals[i] > 0) { prevMonth = i; break; }
    }

    const elVariacion = document.getElementById('kpiExecVariacion');
    const elVariacionSub = document.getElementById('kpiExecVariacionSub');
    if (elVariacion && lastMonth >= 0 && prevMonth >= 0) {
        const diff = monthlyTotals[lastMonth] - monthlyTotals[prevMonth];
        const pct = prevMonth >= 0 && monthlyTotals[prevMonth] > 0
            ? ((diff / monthlyTotals[prevMonth]) * 100).toFixed(1)
            : 0;
        const isUp = diff >= 0;
        elVariacion.innerHTML = `<span class="trend-${isUp ? 'up' : 'down'}">${isUp ? '↑' : '↓'} ${Math.abs(pct).toString().replace('.', ',')}%</span>`;
        if (elVariacionSub) {
            const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            elVariacionSub.textContent = `${meses[prevMonth]} → ${meses[lastMonth]}`;
        }
    } else if (elVariacion) {
        elVariacion.textContent = '--';
    }

    // 2. Comuna crítica (menor vacunación)
    const comunaTotals = {};
    getOcurrenciaData('all').forEach(item => {
        const c = item.comuna;
        if (!comunaTotals[c]) comunaTotals[c] = 0;
        comunaTotals[c] += item.total;
    });
    const comunaSorted = Object.entries(comunaTotals).sort((a, b) => a[1] - b[1]);
    const elCritica = document.getElementById('kpiExecCritica');
    const elCriticaSub = document.getElementById('kpiExecCriticaSub');
    if (elCritica && comunaSorted.length > 0) {
        elCritica.textContent = comunaSorted[0][0];
        if (elCriticaSub) elCriticaSub.textContent = fmt(comunaSorted[0][1]) + ' dosis';
    }

    // 3. Brecha provincial
    const elBrecha = document.getElementById('kpiExecBrecha');
    const elBrechaSub = document.getElementById('kpiExecBrechaSub');
    if (elBrecha && comunaSorted.length >= 2) {
        const max = comunaSorted[comunaSorted.length - 1];
        const min = comunaSorted[0];
        const brecha = max[1] - min[1];
        elBrecha.textContent = fmt(brecha);
        if (elBrechaSub) elBrechaSub.textContent = `${min[0]} ↔ ${max[0]}`;
    }
}

// ── Render Charts ────────────────────────────────────────────────────────────
function renderCharts() {
    const DATA = getData();
    const currentComuna = getCurrentComuna();
    if (!DATA) return;
    if (typeof ChartDataLabels !== 'undefined') Chart.register(ChartDataLabels);
    const colors = getChartColors();

    function getCommonOptions(colors) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: colors.text } },
                datalabels: { color: colors.text, font: { weight: 'bold' }, formatter: (val) => val > 0 ? fmt(val) : '' }
            },
            scales: {
                x: { ticks: { color: colors.text }, grid: { color: colors.grid } },
                y: { ticks: { color: colors.text }, grid: { color: colors.grid } }
            }
        };
    }

    // Chart: Distribución de Vacunas (Pie)
    destroyChart('chartDistribucionVacunas');
    const resTotals = getResidenciaTotals(currentComuna);
    const vacData = Object.entries(resTotals).filter(([k,v]) => v > 0).sort((a,b) => b[1] - a[1]);
    
    chartInstances['chartDistribucionVacunas'] = new Chart(document.getElementById('chartDistribucionVacunas'), {
        type: 'doughnut',
        data: {
            labels: vacData.map(d => d[0]),
            datasets: [{
                data: vacData.map(d => d[1]),
                backgroundColor: PALETTE,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { color: colors.text } },
                datalabels: { color: '#fff', font: { weight: 'bold' }, textStrokeColor: '#000000', textStrokeWidth: 2, formatter: (v) => fmt(v) }
            }
        }
    });

    // Chart: Distribución por Grupo Objetivo (Bar)
    destroyChart('chartCoberturaGrupos');
    const crits = {};
    getResidenciaData(currentComuna).forEach(d => {
        if(!crits[d.criterio]) crits[d.criterio] = 0;
        crits[d.criterio] += d.total;
    });
    const critSorted = Object.entries(crits).sort((a,b) => b[1] - a[1]).slice(0, 8);
    
    chartInstances['chartCoberturaGrupos'] = new Chart(document.getElementById('chartCoberturaGrupos'), {
        type: 'bar',
        data: {
            labels: critSorted.map(d => d[0].length > 20 ? d[0].substring(0,20)+'...' : d[0]),
            datasets: [{
                label: 'Dosis por Grupo',
                data: critSorted.map(d => d[1]),
                backgroundColor: PALETTE[0],
                borderRadius: 4
            }]
        },
        options: { 
            ...getCommonOptions(colors), 
            plugins: { 
                ...getCommonOptions(colors).plugins, 
                legend: { display: false },
                datalabels: {
                    color: '#ffffff',
                    font: { weight: 'bold', size: 11 },
                    textStrokeColor: '#000000',
                    textStrokeWidth: 2,
                    formatter: (v) => fmt(v)
                }
            } 
        }
    });

    // Chart: Evolución Temporal
    destroyChart('chartEvolucion');
    const baseOptionsEvol = getCommonOptions(colors);
    
    const view = window.currentTemporalView || 'SE';
    
    // Update title text based on view
    const titleTextSpan = document.getElementById('temporalChartTitleText');
    if (titleTextSpan) {
        titleTextSpan.innerHTML = view === 'SE' ? 'Curva de Avance Temporal <span class="territory-context-residencia" style="font-size: 0.75rem; color: #94a3b8; font-weight: 700; display: block; margin-top: 4px; margin-bottom: 6px; letter-spacing: 1px; text-transform: uppercase;">PROVINCIAL (BASE RESIDENCIA)</span>' : 'Evolución Mensual (Residencia) <span class="territory-context-residencia" style="font-size: 0.75rem; color: #94a3b8; font-weight: 700; display: block; margin-top: 4px; margin-bottom: 6px; letter-spacing: 1px; text-transform: uppercase;">PROVINCIAL (BASE RESIDENCIA)</span>';
        
        // Also update the territory text contextually
        const terrName = currentComuna === 'all' ? 'PROVINCIAL' : currentComuna.toUpperCase();
        const ctxSpans = titleTextSpan.querySelectorAll('.territory-context-residencia');
        ctxSpans.forEach(span => span.textContent = terrName + ' (BASE RESIDENCIA)');
    }

    if (view === 'MES') {
        let maxMonthWithData = -1;
        getResidenciaData(currentComuna).forEach(item => {
            Object.values(item.datos_mes || {}).forEach(vacMonths => {
                Object.entries(vacMonths).forEach(([m, count]) => {
                    if (count > 0) {
                        const mIdx = parseInt(m) - 1;
                        if (mIdx > maxMonthWithData) maxMonthWithData = mIdx;
                    }
                });
            });
        });

        const monthlyTotals = Array(12).fill(null);
        for (let i = 0; i <= maxMonthWithData; i++) monthlyTotals[i] = 0;

        getResidenciaData(currentComuna).forEach(item => {
            Object.values(item.datos_mes || {}).forEach(vacMonths => {
                Object.entries(vacMonths).forEach(([m, count]) => {
                    const mIdx = parseInt(m) - 1;
                    if (mIdx >= 0 && mIdx <= maxMonthWithData) monthlyTotals[mIdx] += count;
                });
            });
        });

        const evolOptions = {
            ...baseOptionsEvol,
            scales: {
                x: baseOptionsEvol.scales.x,
                y: {
                    ...baseOptionsEvol.scales.y,
                    title: { display: true, text: 'N° de Dosis Administradas', color: colors.text, font: { weight: 'bold' } },
                    grace: '15%'
                }
            },
            plugins: {
                ...baseOptionsEvol.plugins,
                datalabels: {
                    ...baseOptionsEvol.plugins.datalabels,
                    align: 'top', anchor: 'end', offset: 4,
                    formatter: (val) => val !== null && val > 0 ? fmt(val) : ''
                }
            }
        };

        chartInstances['chartEvolucion'] = new Chart(document.getElementById('chartEvolucion'), {
            type: 'bar',
            data: {
                labels: MONTH_NAMES,
                datasets: [{
                    label: 'Dosis Administradas',
                    data: monthlyTotals,
                    backgroundColor: '#38bdf8',
                    borderColor: 'transparent',
                    borderWidth: 0,
                    borderRadius: 3,
                    barPercentage: 0.7,
                    categoryPercentage: 0.8
                }]
            },
            options: evolOptions
        });
    } else {
        let seMap = {};
        getResidenciaData(currentComuna).forEach(item => {
            Object.values(item.datos_se || {}).forEach(vacSEs => {
                Object.entries(vacSEs).forEach(([se, count]) => {
                    const seNum = parseInt(se);
                    if (!seMap[seNum]) seMap[seNum] = 0;
                    seMap[seNum] += count;
                });
            });
        });
        
        let seMap2025 = {};
        const historico_2025 = (window.COVID_DATA_2025 && window.COVID_DATA_2025.data_residencia) ? window.COVID_DATA_2025.data_residencia : [];
        if (historico_2025.length > 0) {
             const data2025_filtered = currentComuna === 'all' ? historico_2025 : historico_2025.filter(i => i.comuna.toUpperCase() === currentComuna.toUpperCase());
             data2025_filtered.forEach(item => {
                  Object.values(item.datos_se || {}).forEach(vacSEs => {
                      Object.entries(vacSEs).forEach(([se, count]) => {
                          const seNum = parseInt(se);
                          if (!seMap2025[seNum]) seMap2025[seNum] = 0;
                          seMap2025[seNum] += count;
                      });
                  });
             });
        }

        const keys2026 = Object.keys(seMap).map(k => parseInt(k));
        const maxSE2026 = keys2026.length > 0 ? Math.max(...keys2026) : 0;
        const minSE2026 = keys2026.length > 0 ? Math.min(...keys2026) : Infinity;
        
        const allKeysSet = new Set([...keys2026, ...Object.keys(seMap2025).map(k => parseInt(k))]);
        const seKeys = Array.from(allKeysSet).filter(se => se >= 10).sort((a,b) => a - b);
        
        let labels = [];
        let dosisSemanales = [];
        let avanceAcumulado = [];
        
        let cumulative = 0;
        let totalAcum2025 = 0;
        
        // Sumar dosis previas a SE 10 para que los acumulados arranquen con la base correcta
        Object.keys(seMap).forEach(k => {
            const se = parseInt(k);
            if (se < 10) cumulative += seMap[se];
        });
        Object.keys(seMap2025).forEach(k => {
            const se = parseInt(k);
            if (se < 10) totalAcum2025 += seMap2025[se];
        });
        
        const pobObjetivo = getPoblacionObjetivo(currentComuna);
        
        if (seKeys.length === 0) {
            labels.push('Sin Datos');
            dosisSemanales.push(0);
            avanceAcumulado.push(0);
        } else {
            seKeys.forEach(se => {
                labels.push('SE ' + se);
                if (se >= minSE2026 && se <= maxSE2026) {
                    const count = seMap[se] || 0;
                    dosisSemanales.push(count);
                    cumulative += count;
                    avanceAcumulado.push(pobObjetivo > 0 ? (cumulative / pobObjetivo * 100) : 0);
                } else {
                    dosisSemanales.push(null);
                    avanceAcumulado.push(null);
                }
            });
        }
        
        let dosisAcumuladas2025 = [];
        if (Object.keys(seMap2025).length > 0) {
            seKeys.forEach(se => {
                const count = seMap2025[se] || 0;
                totalAcum2025 += count;
                dosisAcumuladas2025.push(pobObjetivo > 0 ? (totalAcum2025 / pobObjetivo * 100) : 0);
            });
        }
        const dualOptions = {
            ...baseOptionsEvol,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { 
                    ...baseOptionsEvol.scales.x, 
                    grid: { display: true, color: '#e2e8f0', drawBorder: false, drawTicks: false },
                    ticks: { ...baseOptionsEvol.scales.x.ticks, padding: 15 },
                    title: { display: true, text: view === 'SE' ? 'Semana Epidemiológica' : 'Meses', color: '#475569', font: { weight: 'bold', size: 13 }, padding: { top: 25, bottom: 15 } }
                },
                y: {
                    ...baseOptionsEvol.scales.y,
                    type: 'linear', display: true, position: 'left',
                    min: 0,
                    max: 100,
                    title: { display: true, text: '% Cobertura Acumulada', color: '#475569', font: { weight: 'bold' } },
                    grid: { color: '#e2e8f0', drawBorder: false, drawTicks: false },
                    ticks: { ...baseOptionsEvol.scales.y.ticks, padding: 8, callback: v => v + '%' }
                },
                y1: {
                    type: 'linear', display: true, position: 'right',
                    title: { display: true, text: 'N° Dosis Administradas por SE', color: '#475569', font: { weight: 'bold', size: 11 } },
                    grid: { drawOnChartArea: false, drawTicks: false },
                    ticks: { padding: 8 },
                    grace: '10%'
                }
            },
            plugins: {
                ...baseOptionsEvol.plugins,
                tooltip: { ...baseOptionsEvol.plugins.tooltip, mode: 'index', intersect: false },
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        color: '#475569',
                        font: { weight: '600' }
                    },
                    padding: { bottom: 30 }
                }
            }
        };

        const canvasEvol = document.getElementById('chartEvolucion');
        const ctxEvol = canvasEvol ? canvasEvol.getContext('2d') : null;
        let gradientFill = ctxEvol ? ctxEvol.createLinearGradient(0, 0, 0, 400) : null;
        if (gradientFill) {
            gradientFill.addColorStop(0, 'rgba(15, 105, 180, 0.5)');
            gradientFill.addColorStop(1, 'rgba(15, 105, 180, 0.0)');
        } else {
            gradientFill = 'rgba(2, 132, 199, 0.1)';
        }
        let barGradient = ctxEvol ? ctxEvol.createLinearGradient(0, 0, 0, 400) : null;
        if (barGradient) {
            barGradient.addColorStop(0, 'rgba(56, 189, 248, 0.7)');
            barGradient.addColorStop(1, 'rgba(14, 165, 233, 0.7)');
        } else {
            barGradient = '#38bdf8';
        }

        const datasets = [];
        
        datasets.push({
            type: 'line', label: 'Meta (85%)', data: labels.map(() => 85),
            borderColor: '#ef4444', backgroundColor: 'transparent', borderWidth: 2,
            borderDash: [5, 5], yAxisID: 'y', order: 0, pointRadius: 0,
            pointStyle: 'line',
            datalabels: { display: false }
        });
        
        if (Object.keys(seMap2025).length > 0) {
             datasets.push({
                type: 'line', label: 'Cierre Histórico 2025', data: dosisAcumuladas2025,
                borderColor: '#64748b', backgroundColor: 'transparent', borderWidth: 2.5,
                borderDash: [], yAxisID: 'y', tension: 0.4, order: 1, pointRadius: 0,
                pointStyle: 'line',
                datalabels: { display: false }
             });
        }
        
        datasets.push({
            type: 'line', label: 'Cobertura acumulada 2026 (%)', data: avanceAcumulado,
            borderColor: '#0f69b4', backgroundColor: gradientFill, borderWidth: 3,
            yAxisID: 'y', tension: 0.4, order: 2, fill: true,
            pointBackgroundColor: '#ffffff', pointBorderColor: '#0f69b4', pointBorderWidth: 2, pointHoverRadius: 8,
            pointRadius: avanceAcumulado.map(v => v !== null && v < 0.5 ? 0 : 4),
            pointHoverBackgroundColor: '#0f69b4', pointHoverBorderColor: '#ffffff', pointHoverBorderWidth: 2,
            pointStyle: 'circle',
            datalabels: {
                display: function(context) {
                    const data = context.dataset.data;
                    const idx = context.dataIndex;
                    if (data[idx] === null) return false;
                    if (idx === data.length - 1) return true;
                    return data[idx + 1] === null;
                },
                align: function(context) {
                    return context.dataset.data[context.dataIndex] < 10 ? 'end' : 'left';
                },
                anchor: function(context) {
                    return context.dataset.data[context.dataIndex] < 10 ? 'end' : 'center';
                },
                offset: function(context) {
                    return context.dataset.data[context.dataIndex] < 10 ? 25 : 12;
                },
                backgroundColor: '#ffffff',
                borderColor: '#0f69b4',
                borderWidth: 1.5,
                borderRadius: 6,
                padding: {top: 4, bottom: 4, left: 6, right: 6},
                color: '#0f69b4',
                font: { weight: '800', size: 12 },
                formatter: function(value) {
                    return value.toLocaleString('es-CL', {minimumFractionDigits: 0, maximumFractionDigits: 1}) + '%';
                }
            }
        });
        
        datasets.push({
            type: 'bar', label: 'Dosis administradas por semana', data: dosisSemanales,
            backgroundColor: barGradient, borderColor: '#38bdf8', borderWidth: 1,
            hoverBackgroundColor: 'rgba(56, 189, 248, 1)',
            yAxisID: 'y1', order: 3, borderRadius: 8, barPercentage: 0.7, categoryPercentage: 0.8,
            pointStyle: 'rectRounded',
            datalabels: { display: false }
        });

        chartInstances['chartEvolucion'] = new Chart(document.getElementById('chartEvolucion'), {
            type: 'bar',
            data: { labels: labels, datasets: datasets },
            options: dualOptions
        });
    }

    // Top Estabs and Tipo de Centro charts removed as part of simplification
}


/* --- table.js --- */
/* ══════════════════════════════════════════════════════════════════════════════
   Dashboard COVID-19 · Table Module
   Matriz técnica, filtros multi-select y exportación Excel
   ══════════════════════════════════════════════════════════════════════════════ */


// ── Multi-Select Logic ───────────────────────────────────────────────────────
function setupMultiSelect(optionsListId, selectAllId, multiSelectId, defaultText, emptyText, dataList, valueFn, labelFn, preSelected = null) {
    const optionsList = document.getElementById(optionsListId);
    if (!optionsList) return;

    optionsList.innerHTML = '';
    dataList.forEach(item => {
        const val = valueFn(item);
        const label = labelFn(item);
        const isChecked = preSelected ? preSelected.includes(val) : true;
        const labelEl = document.createElement('label');
        labelEl.innerHTML = `<input type="checkbox" value="${val}" class="${optionsListId}-cb" ${isChecked ? 'checked' : ''}> ${label}`;
        optionsList.appendChild(labelEl);
    });

    const oldSelectAllCb = document.getElementById(selectAllId);
    if(!oldSelectAllCb) return;
    const selectAllCb = oldSelectAllCb.cloneNode(true);
    oldSelectAllCb.parentNode.replaceChild(selectAllCb, oldSelectAllCb);
    
    if (dataList.length <= 1) selectAllCb.parentNode.style.display = 'none';
    else selectAllCb.parentNode.style.display = '';
    
    if (!optionsList.dataset.initialized) {
        document.addEventListener('click', (e) => {
            const container = document.getElementById(multiSelectId);
            if (container && !container.contains(e.target)) container.classList.remove('open');
        });
        optionsList.dataset.initialized = 'true';
    }

    const cbs = document.querySelectorAll(`.${optionsListId}-cb`);
    
    selectAllCb.addEventListener('change', (e) => {
        cbs.forEach(cb => cb.checked = e.target.checked);
        updateSelectText();
        renderTable();
    });

    cbs.forEach(cb => {
        cb.addEventListener('change', () => {
            selectAllCb.checked = Array.from(cbs).every(c => c.checked);
            updateSelectText();
            renderTable();
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
    updateSelectText();
}

// ── Dynamic Filters ──────────────────────────────────────────────────────────
function updateDynamicFilters() {
    const DATA = getData();
    if(!DATA) return;
    
    const selectedComunas = Array.from(document.querySelectorAll('.comunaOptionsList-cb:checked')).map(c => c.value);
    const preCom = selectedComunas.length ? selectedComunas : COMUNAS;
    setupMultiSelect('comunaOptionsList', 'comunaSelectAll', 'matrizComunaMultiSelect', 'Todas las Comunas', 'Ninguna', COMUNAS, c=>c, c=>c, preCom);
    
    const applySubFilters = () => {
        const coms = Array.from(document.querySelectorAll('.comunaOptionsList-cb:checked')).map(c => c.value);
        const estabQuery = (document.getElementById('searchEstab')?.value || '').toLowerCase();
        
        let filtered = DATA.data_ocurrencia.filter(d => coms.includes(d.comuna) && d.establecimiento.toLowerCase().includes(estabQuery));
        
        let validVacs = new Set();
        let validCrits = new Set();
        filtered.forEach(d => {
            Object.keys(d.datos_mes || {}).forEach(v => validVacs.add(v));
            validCrits.add(d.criterio);
        });
        
        const isAllVacs = document.getElementById('vacunaBaseSelectAll')?.checked;
        const selVacs = isAllVacs ? null : Array.from(document.querySelectorAll('.vacunaBaseOptionsList-cb:checked')).map(c => c.value);
        setupMultiSelect('vacunaBaseOptionsList', 'vacunaBaseSelectAll', 'matrizVacunaBaseMultiSelect', 'Todas las Vacunas', 'Ninguna', [...validVacs].sort(), v=>v, v=>v, selVacs);
        
        const isAllCrits = document.getElementById('criterioSelectAll')?.checked;
        const selCrits = isAllCrits ? null : Array.from(document.querySelectorAll('.criterioOptionsList-cb:checked')).map(c => c.value);
        setupMultiSelect('criterioOptionsList', 'criterioSelectAll', 'matrizCriterioMultiSelect', 'Todos los Criterios', 'Ninguno', [...validCrits].sort(), v=>v, v=>v, selCrits);
        
        document.querySelectorAll('.vacunaBaseOptionsList-cb, .criterioOptionsList-cb').forEach(cb => cb.addEventListener('change', renderTable));
        document.getElementById('vacunaBaseSelectAll')?.addEventListener('change', renderTable);
        document.getElementById('criterioSelectAll')?.addEventListener('change', renderTable);
        
        const corteSelect = document.getElementById('fechaCorteSelect');
        if (corteSelect && !corteSelect.dataset.initialized) {
            corteSelect.addEventListener('change', renderTable);
            corteSelect.dataset.initialized = 'true';
        }
        
        renderTable();
    };

    document.querySelectorAll('.comunaOptionsList-cb').forEach(cb => cb.addEventListener('change', applySubFilters));
    document.getElementById('comunaSelectAll')?.addEventListener('change', applySubFilters);
    document.getElementById('searchEstab')?.addEventListener('input', applySubFilters);
    
    applySubFilters();
}

// ── Render Table ─────────────────────────────────────────────────────────────
function renderTable() {
    const DATA = getData();
    if (!DATA) return;
    const container = document.getElementById('tableProdContainer');
    const estabQuery = (document.getElementById('searchEstab').value || '').toLowerCase();
    
    const comCbs = document.querySelectorAll('.comunaOptionsList-cb');
    const comunasActivas = comCbs.length ? Array.from(comCbs).filter(c => c.checked).map(c=>c.value) : COMUNAS;
    
    const vacCbs = document.querySelectorAll('.vacunaBaseOptionsList-cb');
    const vacActivas = vacCbs.length ? Array.from(vacCbs).filter(c => c.checked).map(c=>c.value) : DATA.headers;
    
    const critCbs = document.querySelectorAll('.criterioOptionsList-cb');
    let critsActivos = null;
    if(critCbs.length) critsActivos = Array.from(critCbs).filter(c => c.checked).map(c=>c.value);

    let filtered = DATA.data_ocurrencia.filter(d => 
        comunasActivas.includes(d.comuna) && 
        d.establecimiento.toLowerCase().includes(estabQuery) &&
        (!critsActivos || critsActivos.includes(d.criterio))
    );
    
    const estabMap = {};
    filtered.forEach(d => {
        if (!estabMap[d.establecimiento]) estabMap[d.establecimiento] = { comuna: d.comuna, total: 0, vacs: {} };
        Object.keys(d.datos_mes || {}).forEach(v => {
            if (vacActivas.includes(v)) {
                if (!estabMap[d.establecimiento].vacs[v]) estabMap[d.establecimiento].vacs[v] = 0;
                
                const corteEl = document.getElementById('fechaCorteSelect');
                let maxMonth = 12;
                if (corteEl && corteEl.value) {
                    if (corteEl.value.toLowerCase().includes('actual')) {
                        maxMonth = 12;
                    } else {
                        const parts = corteEl.value.split('/');
                        if (parts.length >= 2) {
                            maxMonth = parseInt(parts[1], 10);
                        }
                    }
                }
                
                const sum = Object.entries(d.datos_mes[v] || {})
                                  .filter(([m, _]) => parseInt(m) <= maxMonth)
                                  .reduce((a, [_, count]) => a + count, 0);
                                  
                estabMap[d.establecimiento].vacs[v] += sum;
                estabMap[d.establecimiento].total += sum;
            }
        });
    });
    
    const estabs = Object.keys(estabMap).sort((a,b) => estabMap[b].total - estabMap[a].total);
    
    const comunasMapHtml = {};
    estabs.forEach(e => {
        if (estabMap[e].total === 0) return;
        const c = estabMap[e].comuna;
        if (!comunasMapHtml[c]) comunasMapHtml[c] = [];
        comunasMapHtml[c].push(e);
    });

    const sortedComunasHtml = Object.keys(comunasMapHtml).sort();
    
    let htmlParts = [];
    htmlParts.push(`<table class="matriz-table">
        <thead>
            <tr>
                <th>Comuna</th>
                <th>Establecimiento</th>
                ${vacActivas.map(h => `<th>${h}</th>`).join('')}
                <th>Total</th>
            </tr>
        </thead>
        <tbody>`);
        
    if (sortedComunasHtml.length === 0) {
        htmlParts.push(`<tr><td colspan="${vacActivas.length + 3}" style="text-align:center;">No hay datos para mostrar</td></tr>`);
    } else {
        let grandTotalVacs = {};
        vacActivas.forEach(v => grandTotalVacs[v] = 0);
        let grandTotalAll = 0;

        sortedComunasHtml.forEach(comuna => {
            const estabsEnComuna = comunasMapHtml[comuna];
            
            let subtotalVacs = {};
            vacActivas.forEach(v => subtotalVacs[v] = 0);
            let subtotalAll = 0;
            
            estabsEnComuna.forEach(e => {
                htmlParts.push(`<tr>
                    <td>${comuna}</td>
                    <td>${e}</td>
                    ${vacActivas.map(h => {
                        const v = estabMap[e].vacs[h] || 0;
                        subtotalVacs[h] += v;
                        grandTotalVacs[h] += v;
                        return `<td class="num">${fmt(v)}</td>`;
                    }).join('')}
                    <td class="num total-col">${fmt(estabMap[e].total)}</td>
                </tr>`);
                subtotalAll += estabMap[e].total;
                grandTotalAll += estabMap[e].total;
            });
            
            htmlParts.push(`<tr class="subtotal-row">
                <td></td>
                <td style="text-align: center;">Subtotal ${comuna}</td>
                ${vacActivas.map(h => `<td class="num">${fmt(subtotalVacs[h])}</td>`).join('')}
                <td class="num total-col">${fmt(subtotalAll)}</td>
            </tr>`);
        });
        
        htmlParts.push(`<tr class="grand-total">
            <td></td>
            <td style="text-align: center; font-weight: 900; color: #fff;">Total General</td>
            ${vacActivas.map(h => `<td class="num" style="font-weight: 900; color: #fff;">${fmt(grandTotalVacs[h])}</td>`).join('')}
            <td class="num total-col" style="font-weight: 900; color: #fff;">${fmt(grandTotalAll)}</td>
        </tr>`);
    }
    
    htmlParts.push(`</tbody></table>`);
    requestAnimationFrame(() => {
        container.innerHTML = htmlParts.join('');
    });
}

// ── Export Excel ──────────────────────────────────────────────────────────────
function setupExcelExport() {
    const btnExcel = document.getElementById('btnExportExcel');
    if (!btnExcel) return;

    btnExcel.addEventListener('click', () => {
        const currentYear = getCurrentYear();
        const DATA = getData();
        if (typeof XLSX === 'undefined') { alert("Librería Excel no cargada."); return; }
        const table = document.querySelector('.matriz-table');
        if (!table) return;

        const thElements = Array.from(table.querySelectorAll('thead th'));
        const headerNames = thElements.map(th => th.textContent);

        const dataRows = [];
        
        dataRows.push([]);
        dataRows.push([`REPORTE COVID-19 ${currentYear}`]);
        dataRows.push([`Servicio de Salud Osorno`]);
        dataRows.push([`Reporte por Ocurrencia`]);
        dataRows.push([]);
        dataRows.push([`INFORMACIÓN DEL REPORTE`]);

        const today = new Date();
        const dateStr = today.toLocaleDateString('es-CL');
        const cutoffDate = (DATA && DATA.fecha_actualizacion) ? DATA.fecha_actualizacion : dateStr;
        
        const critNodes = document.querySelectorAll('#matrizCriterioMultiSelect input:checked:not([value="all"])');
        const isAllCrit = document.getElementById('criterioSelectAll')?.checked;
        let criterioText = "Todos";
        if (!isAllCrit && critNodes.length > 0) {
            criterioText = Array.from(critNodes).map(n => n.parentElement.textContent.trim()).join(", ");
        }

        const comNodes = document.querySelectorAll('#matrizComunaMultiSelect input:checked:not([value="all"])');
        const isAllCom = document.getElementById('comunaSelectAll')?.checked;
        let comunaText = "Todas";
        if (!isAllCom && comNodes.length > 0) {
            comunaText = Array.from(comNodes).map(n => n.parentElement.textContent.trim()).join(", ");
        }

        const corteEl = document.getElementById('fechaCorteSelect');
        const corteSelectedText = corteEl ? corteEl.options[corteEl.selectedIndex].text : `Actual (${cutoffDate})`;

        dataRows.push([`- Comuna:`, comunaText]);
        dataRows.push([`- Periodo Informado:`, `Campaña Anual ${currentYear}`]);
        dataRows.push([`- Filtro Fecha de Corte:`, corteSelectedText]);
        dataRows.push([`- Fuente:`, `DEIS - MINSAL`]);
        dataRows.push([`- Fecha de Actualización:`, `Actual (${cutoffDate})`]);
        dataRows.push([]);
        dataRows.push(headerNames);

        const trElements = Array.from(table.querySelectorAll('tbody tr'));
        const extractedData = [];
        trElements.forEach(tr => {
            if (tr.classList.contains('grand-total') || tr.classList.contains('subtotal-row')) return;
            const tds = Array.from(tr.querySelectorAll('td'));
            if (tds.length === 1) return;
            
            const rowData = tds.map(td => {
                const txt = td.textContent.replace(/\./g, '');
                return isNaN(txt) ? txt : Number(txt);
            });
            
            extractedData.push(rowData);
        });

        const comunasMap = {};
        extractedData.forEach(row => {
            const comuna = row[0];
            if (!comunasMap[comuna]) comunasMap[comuna] = [];
            comunasMap[comuna].push(row);
        });
        
        const sortedComunas = Object.keys(comunasMap).sort();
        const subtotalRowIndices = new Set();
        
        sortedComunas.forEach(comuna => {
            const rows = comunasMap[comuna];
            let comunaSums = new Array(headerNames.length).fill(0);
            
            rows.forEach(row => {
                dataRows.push(row);
                for (let i = 2; i < row.length; i++) {
                    comunaSums[i] += (Number(row[i]) || 0);
                }
            });
            
            let subRow = new Array(headerNames.length).fill("");
            subRow[0] = "";
            subRow[1] = `Subtotal ${comuna}`;
            for (let i = 2; i < subRow.length; i++) {
                subRow[i] = comunaSums[i];
            }
            dataRows.push(subRow);
            subtotalRowIndices.add(dataRows.length - 1);
        });

        if (sortedComunas.length > 0) {
            let grandTotalRow = new Array(headerNames.length).fill("");
            grandTotalRow[0] = "";
            grandTotalRow[1] = "Total General";
            for (let i = 2; i < headerNames.length; i++) grandTotalRow[i] = 0;
            
            sortedComunas.forEach(comuna => {
                const rows = comunasMap[comuna];
                rows.forEach(row => {
                    for (let i = 2; i < row.length; i++) {
                        grandTotalRow[i] += (Number(row[i]) || 0);
                    }
                });
            });
            dataRows.push(grandTotalRow);
            subtotalRowIndices.add(dataRows.length - 1);
        }

        const ws = XLSX.utils.aoa_to_sheet(dataRows);

        const titleStyle = { font: { bold: true, sz: 14 } };
        const subTitleStyle = { font: { bold: true, sz: 11 } };
        const infoTitleStyle = { font: { bold: true, sz: 10, underline: true } };
        const infoLabelStyle = { font: { bold: true, sz: 10 } };
        const infoValStyle = { font: { sz: 10 } };

        const headerStyle = {
            font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 },
            fill: { fgColor: { rgb: "17365D" } },
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
            border: {
                top: { style: "thin", color: { rgb: "000000" } },
                bottom: { style: "thin", color: { rgb: "000000" } },
                left: { style: "thin", color: { rgb: "000000" } },
                right: { style: "thin", color: { rgb: "000000" } }
            }
        };
        
        const cellStyleWhiteLeft = {
            font: { sz: 10 },
            alignment: { horizontal: "left", vertical: "center" },
            border: {
                top: { style: "thin", color: { rgb: "000000" } },
                bottom: { style: "thin", color: { rgb: "000000" } },
                left: { style: "thin", color: { rgb: "000000" } },
                right: { style: "thin", color: { rgb: "000000" } }
            }
        };

        const cellStyleWhiteCenter = {
            font: { sz: 10 },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
                top: { style: "thin", color: { rgb: "000000" } },
                bottom: { style: "thin", color: { rgb: "000000" } },
                left: { style: "thin", color: { rgb: "000000" } },
                right: { style: "thin", color: { rgb: "000000" } }
            }
        };

        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellRef = XLSX.utils.encode_cell({r: R, c: C});
                if (!ws[cellRef]) continue;
                
                if (R === 1) {
                    ws[cellRef].s = titleStyle;
                } else if (R === 2 || R === 3) {
                    ws[cellRef].s = subTitleStyle;
                } else if (R === 5) {
                    ws[cellRef].s = infoTitleStyle;
                } else if (R >= 6 && R <= 10) {
                    if (C === 0) ws[cellRef].s = infoLabelStyle;
                    if (C === 1) ws[cellRef].s = infoValStyle;
                } else if (R === 12) {
                    ws[cellRef].s = headerStyle;
                } else if (R > 12) {
                    let isTextCol = (C === 0 || C === 1);
                    let cellS = isTextCol ? { ...cellStyleWhiteLeft } : { ...cellStyleWhiteCenter };
                    
                    const isGrandTotal = (R === range.e.r);
                    
                    if (isGrandTotal) {
                        cellS.font = { ...cellS.font, bold: true, color: { rgb: "FFFFFF" } };
                        cellS.fill = { fgColor: { rgb: "17365D" } };
                        if (C === 1) {
                            cellS.alignment = { horizontal: "center", vertical: "center" };
                        }
                    } else if (subtotalRowIndices.has(R)) {
                        cellS.font = { ...cellS.font, bold: true };
                        cellS.fill = { fgColor: { rgb: "E9ECEF" } };
                        if (C === 1) {
                            cellS.alignment = { horizontal: "center", vertical: "center" };
                        }
                    }
                    
                    if (C === range.e.c) {
                        cellS.font = { ...cellS.font, bold: true, color: { rgb: "FFFFFF" } };
                        if (subtotalRowIndices.has(R)) {
                            cellS.fill = { fgColor: { rgb: "366092" } };
                        } else {
                            cellS.fill = { fgColor: { rgb: "17365D" } };
                        }
                    }
                    
                    ws[cellRef].s = cellS;
                    
                    if (!isTextCol) {
                        ws[cellRef].z = '#,##0';
                    }
                }
            }
        }

        const EXTEND_ROWS = 30;
        const EXTEND_COLS = 10;
        const originalMaxR = range.e.r;
        const originalMaxC = range.e.c;
        const maxR = originalMaxR + EXTEND_ROWS;
        const maxC = Math.max(originalMaxC + EXTEND_COLS, 15);
        
        for (let R = 0; R <= maxR; ++R) {
            for (let C = 0; C <= maxC; ++C) {
                const cellRef = XLSX.utils.encode_cell({r: R, c: C});
                if (!ws[cellRef]) {
                    ws[cellRef] = { t: 's', v: '' };
                }
                if (!ws[cellRef].s) {
                    ws[cellRef].s = {};
                }
                if (R < 12 || R > originalMaxR || C > originalMaxC) {
                    if (!ws[cellRef].s.fill) {
                        ws[cellRef].s.fill = { fgColor: { rgb: "FFFFFF" } };
                    }
                }
            }
        }
        ws['!ref'] = XLSX.utils.encode_range({s: {r: 0, c: 0}, e: {r: maxR, c: maxC}});

        ws['!merges'] = [
            { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } },
            { s: { r: 3, c: 0 }, e: { r: 3, c: 4 } },
            { s: { r: 5, c: 0 }, e: { r: 5, c: 4 } }
        ];

        ws['!cols'] = [
            { wch: 15 },
            { wch: 40 }
        ];
        for (let i = 2; i < headerNames.length; i++) ws['!cols'].push({ wch: 15 });

        ws['!views'] = [{ showGridLines: false }];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Produccion");
        XLSX.writeFile(wb, `Matriz_COVID_Ocurrencia_${currentYear}.xlsx`);
    });
}


/* --- epidemiology.js --- */
/* ══════════════════════════════════════════════════════════════════════════════
   Dashboard COVID-19 · Epidemiology Module v2 (27-Jul-2026)
   Ayudas interpretativas con análisis dinámico por provincia/comuna
   ══════════════════════════════════════════════════════════════════════════════ */


// ── Textos de Ayuda Epidemiológica ───────────────────────────────────────────
function getCovidHelpTexts(year, filter = 'all') {
    const DATA = getData();
    const currentYear = year || 2026;
    const isAll = (filter === 'all');
    const locName = isAll ? 'la provincia de Osorno' : 'la comuna de ' + filter;
    const locNameAdj = isAll ? 'provincial' : 'comunal';

    const contextBanner = `<div style="background: var(--accent-blue, #0f69b4); color: white; padding: 10px 14px; border-radius: 6px; margin-bottom: 16px; font-weight: bold; font-size: 0.95rem;">
        <i class="fa-solid fa-location-dot" style="margin-right: 8px;"></i>Vigilancia Epidemiológica Local (${currentYear}): ${isAll ? "Provincia de Osorno" : filter}
    </div>
    <div style="background: rgba(16, 185, 129, 0.1); padding: 10px 14px; border-radius: 6px; margin-bottom: 16px; font-size: 0.85rem; color: #047857; border: 1px solid rgba(16, 185, 129, 0.3);">
        <i class="fa-solid fa-check-double" style="margin-right: 6px;"></i><strong>Criterio de Calidad DEIS:</strong> Datos depurados: se excluyen Errores Programáticos (EPRO) y registros invalidados. Sólo se contabilizan inmunizaciones biológicamente válidas.
    </div>`;

    // ── Cálculos Dinámicos ────────────────────────────────────────────────────
    let dynamicGrupo = '';
    let dynamicVacunas = '';
    let dynamicEvolucion = '';
    let dynamicTop = '';
    let dynamicCobertura = '';
    let dynamicBrecha = '';

    if (DATA) {
        try {
            // 1. Grupos objetivo (Residencia) ─────────────────────────────────
            const crits = {};
            getResidenciaData(filter).forEach(d => {
                if (!crits[d.criterio]) crits[d.criterio] = 0;
                crits[d.criterio] += d.total;
            });
            const critSorted = Object.entries(crits).sort((a, b) => b[1] - a[1]);
            const totalDosisRe = critSorted.reduce((s, [, v]) => s + v, 0);
            if (critSorted.length > 0) {
                const topGrupo = critSorted[0];
                const bottomGrupo = critSorted[critSorted.length - 1];
                const pctTop = totalDosisRe > 0 ? ((topGrupo[1] / totalDosisRe) * 100).toFixed(1).replace('.', ',') : '0,0';
                const pctBottom = totalDosisRe > 0 ? ((bottomGrupo[1] / totalDosisRe) * 100).toFixed(1).replace('.', ',') : '0,0';
                dynamicGrupo = `<div style="background:rgba(16,185,129,0.08);padding:14px 16px;border-radius:8px;border:1px solid rgba(16,185,129,0.2);margin-top:16px;">
                    <strong style="color:#047857;"><i class="fa-solid fa-microchip" style="margin-right:6px;"></i>Inteligencia Epidemiológica Dirigida: ${locName}</strong>
                    <p style="margin:8px 0 0 0;">La vigilancia activa indica que el grupo <strong>"${topGrupo[0]}"</strong> concentra la mayor cobertura con <strong>${fmt(topGrupo[1])} dosis (${pctTop}%)</strong> de las inoculaciones válidas ${locNameAdj}es. En contraste, el grupo <strong>"${bottomGrupo[0]}"</strong> presenta cobertura marginal (<strong>${fmt(bottomGrupo[1])} dosis, ${pctBottom}%</strong>). Se requiere focalizar Búsqueda Activa (BAC) y estrategias extramurales en este grupo para el control endémico ${currentYear}.</p>
                </div>`;
            }

            // 2. Distribución vacunas + análisis de plataformas ───────────────
            const resTotals = getResidenciaTotals(filter);
            const vacData = Object.entries(resTotals).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
            if (vacData.length > 0) {
                const totalVac = vacData.reduce((acc, val) => acc + val[1], 0);
                const topVac = vacData[0];
                const pct = ((topVac[1] / totalVac) * 100).toFixed(1).replace('.', ',');
                const hasModerna = resTotals['Moderna LP.8.1'] > 0;
                const hasPfizer = resTotals['Pfizer LP.8.1'] > 0;
                const ambas = hasModerna && hasPfizer;
                const pfPct = totalVac > 0 ? ((resTotals['Pfizer LP.8.1'] / totalVac) * 100).toFixed(1).replace('.', ',') : '0,0';
                const modPct = totalVac > 0 ? ((resTotals['Moderna LP.8.1'] / totalVac) * 100).toFixed(1).replace('.', ',') : '0,0';
                dynamicVacunas = `<div style="background:rgba(16,185,129,0.08);padding:14px 16px;border-radius:8px;border:1px solid rgba(16,185,129,0.2);margin-top:16px;">
                    <strong style="color:#047857;"><i class="fa-solid fa-microchip" style="margin-right:6px;"></i>Análisis de Plataformas Biológicas: ${locName}</strong>
                    <p style="margin:8px 0 0 0;">El esquema predominante corresponde a la plataforma <strong>${topVac[0]}</strong>, con el <strong>${pct}%</strong> de las inoculaciones válidas.${ambas ? ` La distribución dual (Moderna LP.8.1: <strong>${modPct}%</strong> | Pfizer LP.8.1: <strong>${pfPct}%</strong>) refleja la política de disponibilidad de stock en la red local. Ambas plataformas XBB/LP.8.1 ofrecen cobertura cruzada frente a variantes JN.1 y sus derivados circulantes en ${currentYear}.` : ` Garantizar stock en cadena de frío para mantener la continuidad de la plataforma activa frente a variantes dominantes ${currentYear}.`}</p>
                </div>`;
            }

            // 3. Evolución mensual + peak ──────────────────────────────────────
            const monthlyTotals = Array(12).fill(0);
            getResidenciaData(filter).forEach(item => {
                if (item.datos_mes) {
                    Object.values(item.datos_mes).forEach(vacMonths => {
                        Object.entries(vacMonths).forEach(([m, count]) => {
                            const mIdx = parseInt(m) - 1;
                            if (mIdx >= 0 && mIdx < 12) monthlyTotals[mIdx] += count;
                        });
                    });
                }
            });
            const totalMeses = monthlyTotals.reduce((s, v) => s + v, 0);
            const maxV = Math.max(...monthlyTotals);
            const maxMonthIdx = monthlyTotals.indexOf(maxV);
            const activeMeses = monthlyTotals.filter(v => v > 0).length;
            const promMes = activeMeses > 0 ? Math.round(totalMeses / activeMeses) : 0;
            if (maxMonthIdx >= 0 && maxV > 0) {
                const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
                const tendencia = monthlyTotals[maxMonthIdx] > promMes * 1.5 ? 'concentración campañística marcada' : 'distribución relativamente homogénea a lo largo de la campaña';
                dynamicEvolucion = `<div style="background:rgba(16,185,129,0.08);padding:14px 16px;border-radius:8px;border:1px solid rgba(16,185,129,0.2);margin-top:16px;">
                    <strong style="color:#047857;"><i class="fa-solid fa-microchip" style="margin-right:6px;"></i>Análisis de Curva Epidémica: ${locName}</strong>
                    <p style="margin:8px 0 0 0;">El clímax de la curva de inoculación se registra en <strong>${meses[maxMonthIdx]}</strong> con <strong>${fmt(maxV)} dosis</strong> (promedio mensual: ${fmt(promMes)} dosis). El patrón temporal evidencia una <em>${tendencia}</em>. ${maxMonthIdx < 6 ? 'Un peak temprano sugiere alta respuesta al llamado inicial de campaña — riesgo: meseta prematura en grupos rezagados.' : 'Un peak tardío podría indicar necesidad de reforzar la comunicación en etapas iniciales de próximas campañas.'} En este contexto, la estrategia extramural (operativos móviles en ELEAM y domicilios) es crítica para sostener la cadencia de inmunización.</p>
                </div>`;
            }

            // 4. Top establecimientos ──────────────────────────────────────────
            const estabTotals = {};
            getOcurrenciaData(filter).forEach(item => {
                if (!estabTotals[item.establecimiento]) estabTotals[item.establecimiento] = 0;
                estabTotals[item.establecimiento] += item.total;
            });
            const estabSorted = Object.entries(estabTotals).sort((a, b) => b[1] - a[1]);
            if (estabSorted.length > 0) {
                const top3 = estabSorted.slice(0, 3);
                const totalOc = estabSorted.reduce((s, [, v]) => s + v, 0);
                const pctTop1 = totalOc > 0 ? ((top3[0][1] / totalOc) * 100).toFixed(1).replace('.', ',') : '0';
                dynamicTop = `<div style="background:rgba(16,185,129,0.08);padding:14px 16px;border-radius:8px;border:1px solid rgba(16,185,129,0.2);margin-top:16px;">
                    <strong style="color:#047857;"><i class="fa-solid fa-microchip" style="margin-right:6px;"></i>Nodos de Alta Producción: ${locName}</strong>
                    <p style="margin:8px 0 0 0;">El nodo primario estratégico <strong>${top3[0][0]}</strong> lidera con <strong>${fmt(top3[0][1])} dosis (${pctTop1}%)</strong> de la producción ${locNameAdj}.${top3.length > 1 ? ` Le siguen ${top3.slice(1).map(([n, v]) => `<strong>${n.length > 30 ? n.slice(0, 28) + '…' : n}</strong> (${fmt(v)})`).join(' y ')}.` : ''} Una concentración excesiva en un solo nodo incrementa el riesgo de disrupción de la red ante fallos operativos (corte de suministro, ausentismo RRHH). Se recomienda redistribución estratégica de la demanda.</p>
                </div>`;
            }

            // 5. Análisis brecha Ocurrencia vs Residencia ─────────────────────
            const totalOc = getOcurrenciaData(filter).reduce((s, d) => s + d.total, 0);
            const totalRe = getResidenciaData(filter).reduce((s, d) => s + d.total, 0);
            if (totalOc > 0 && totalRe > 0) {
                const brecha = totalOc - totalRe;
                const pctBrecha = Math.abs((brecha / totalRe) * 100).toFixed(1).replace('.', ',');
                const dir = brecha > 0 ? 'positiva' : 'negativa';
                dynamicBrecha = `<div style="background:rgba(245,158,11,0.07);padding:14px 16px;border-radius:8px;border:1px solid rgba(245,158,11,0.2);margin-top:12px;">
                    <strong style="color:#92400e;"><i class="fa-solid fa-arrows-left-right" style="margin-right:6px;"></i>Balance Ocurrencia vs Residencia: ${locName}</strong>
                    <p style="margin:8px 0 0 0;">Dosis por ocurrencia: <strong>${fmt(totalOc)}</strong> | Dosis por residencia: <strong>${fmt(totalRe)}</strong>. Brecha <em>${dir}</em>: <strong>${brecha > 0 ? '+' : ''}${fmt(brecha)} (${pctBrecha}%)</strong>. ${brecha > 0 ? 'El diferencial positivo indica <strong>afluencia extraprovincial</strong> a los establecimientos locales — la red asistencial de Osorno capta vacunados de comunas o servicios de salud vecinos, lo que aumenta su carga real de producción.' : 'El diferencial negativo indica que residentes de la provincia se vacunan fuera del territorio provincial, sugiriendo movilidad intrarregional o acceso preferencial a puntos de vacunación externos.'}</p>
                </div>`;
            }

            // 6. Análisis de cobertura por criterio ───────────────────────────
            if (DATA.metas && DATA.velocidad_promedio) {
                const vel = DATA.velocidad_promedio;
                if (vel > 0) {
                    dynamicCobertura = `<div style="background:rgba(15,105,180,0.06);padding:14px 16px;border-radius:8px;border:1px solid rgba(15,105,180,0.15);margin-top:12px;">
                        <strong style="color:#0f69b4;"><i class="fa-solid fa-gauge-high" style="margin-right:6px;"></i>Velocidad de Campaña: ${locName}</strong>
                        <p style="margin:8px 0 0 0;">La cadencia actual de la campaña es de <strong>${fmt(vel)} dosis/semana</strong> a nivel provincial. ${vel < 50 ? 'Velocidad <span style="color:#dc2626;font-weight:bold;">crítica</span>: se requiere activación urgente de estrategias extramurales para acelerar la cadencia.' : vel < 150 ? 'Velocidad <span style="color:#f59e0b;font-weight:bold;">moderada</span>: hay margen de mejora mediante operativos focalizados en grupos rezagados.' : 'Velocidad <span style="color:#059669;font-weight:bold;">aceptable</span>: mantener ritmo actual con monitoreo semanal.'}</p>
                    </div>`;
                }
            }

        } catch (e) {
            console.error('Error al calcular ayuda dinámica COVID:', e);
        }
    }

    return {
        grupoObjetivo: {
            title: `Estratificación de Cobertura por Grupo Objetivo — ${locName}`,
            body: `${contextBanner}
            <div style="color:var(--text-primary,#334155);font-size:0.92rem;line-height:1.6;text-align:justify;">
                <div style="background:rgba(15,105,180,0.04);padding:14px 16px;border-radius:8px;border:1px solid rgba(15,105,180,0.12);margin-bottom:16px;">
                    <strong style="color:var(--accent-blue,#0f69b4);"><i class="fa-solid fa-microscope" style="margin-right:6px;"></i>Justificación Epidemiológica</strong>
                    <p style="margin:8px 0 0 0;">La priorización de cohortes vulnerables es la piedra angular para minimizar cuadros graves y el colapso de UPC. En la endemia de ${currentYear}, <strong>una cobertura global alta enmascara frecuentemente bolsones de susceptibilidad</strong> en nichos de alto riesgo clínico (mayores de 60 años, inmunocomprometidos, personal ELEAM).</p>
                </div>
                ${dynamicGrupo}
                <div style="margin-top:16px;">
                    <strong><i class="fa-solid fa-eye" style="margin-right:6px;color:var(--accent-blue,#0f69b4);"></i>Decisiones Basadas en Evidencia</strong>
                    <ul style="padding-left:20px;margin:8px 0 0 0;">
                        <li style="margin-bottom:8px;">Este indicador visibiliza el volumen real de dosis administradas tras el filtrado de calidad (sin EPRO), asegurando un panorama clínico fidedigno del estado inmunitario local.</li>
                        <li style="margin-bottom:8px;"><strong>Riesgo Severo:</strong> Una brecha en adultos mayores incrementa exponencialmente el riesgo de morbimortalidad frente a variantes LP.8.1 circulantes en ${currentYear}.</li>
                        <li><strong>Respuesta Inmediata:</strong> Diseñar operativos móviles extramurales enfocados en los grupos subrepresentados en ${locName}.</li>
                    </ul>
                </div>
            </div>`
        },
        distribucionVacunas: {
            title: `Trazabilidad del Arsenal Biológico y Tecnologías LP.8.1 — ${locName}`,
            body: `${contextBanner}
            <div style="color:var(--text-primary,#334155);font-size:0.92rem;line-height:1.6;text-align:justify;">
                <div style="background:rgba(100,116,139,0.04);padding:14px 16px;border-radius:8px;border:1px solid rgba(100,116,139,0.12);margin-bottom:16px;">
                    <strong style="color:#475569;"><i class="fa-solid fa-vials" style="margin-right:6px;"></i>Farmacovigilancia y Logística Sanitaria ${currentYear}</strong>
                    <p style="margin:8px 0 0 0;">Las vacunas COVID-19 activas en ${currentYear} corresponden a plataformas actualizadas (LP.8.1: Moderna/Pfizer), eficaces frente a la variante XBB y sus derivados JN.1. Este desglose certifica las plataformas biológicas efectivamente administradas, excluyendo dosis invalidadas — indicador vital para control de lotes y vigilancia ESAVI.</p>
                </div>
                ${dynamicVacunas}
                <div style="margin-top:16px;">
                    <strong><i class="fa-solid fa-bullseye" style="margin-right:6px;color:var(--accent-blue,#0f69b4);"></i>Aplicación Operativa en Red</strong>
                    <ul style="padding-left:20px;margin:8px 0 0 0;">
                        <li style="margin-bottom:8px;">Monitorizar concordancia entre protocolos MINSAL vigentes y ejecución de la red primaria local.</li>
                        <li>Estimar velocidad de consumo de biológicos para resguardar disponibilidad ininterrumpida en la Cámara de Frío jurisdiccional.</li>
                    </ul>
                </div>
            </div>`
        },
        evolucionMensual: {
            title: `Curva Epidémica de la Campaña de Inmunización (Residencia) — ${locName}`,
            body: `${contextBanner}
            <div style="color:var(--text-primary,#334155);font-size:0.92rem;line-height:1.6;text-align:justify;">
                <div style="background:rgba(245,158,11,0.06);padding:14px 16px;border-radius:8px;border:1px solid rgba(245,158,11,0.15);margin-bottom:16px;">
                    <strong style="color:#92400e;"><i class="fa-solid fa-chart-line" style="margin-right:6px;"></i>Dinámica de Protección Poblacional ${currentYear}</strong>
                    <p style="margin:8px 0 0 0;">El registro temporal de las inoculaciones efectivas documenta cómo la demanda espontánea responde a los lineamientos sanitarios. Una curva ascendente temprana es el pilar preventivo para aplanar futuras olas de contagio por variantes LP.8.1.</p>
                </div>
                ${dynamicEvolucion}
                ${dynamicCobertura}
                <div style="margin-top:16px;">
                    <strong><i class="fa-solid fa-eye" style="margin-right:6px;color:var(--accent-blue,#0f69b4);"></i>Patrones Interpretativos</strong>
                    <ul style="padding-left:20px;margin:8px 0 0 0;">
                        <li style="margin-bottom:8px;"><strong>Fase de Aceleración:</strong> Impulsada por aumento en la percepción de riesgo o inyección de recursos comunicacionales (SEREMI de Salud).</li>
                        <li style="margin-bottom:8px;"><strong>Estabilización de Demanda:</strong> Un plateau precoz exige barridos territoriales de rescate en grupos subrepresentados.</li>
                        <li>La solidez descansa en la exclusión de EPROs, ilustrando estrictamente la inmunidad comprobada en ${locName}.</li>
                    </ul>
                </div>
            </div>`
        },
        topEstablecimientos: {
            title: `Rendimiento Analítico de Nodos Asistenciales (Ocurrencia) — ${locName}`,
            body: `${contextBanner}
            <div style="color:var(--text-primary,#334155);font-size:0.92rem;line-height:1.6;text-align:justify;">
                <div style="background:rgba(16,185,129,0.08);padding:14px 16px;border-radius:8px;border:1px solid rgba(16,185,129,0.2);margin-bottom:16px;">
                    <strong style="color:#047857;"><i class="fa-solid fa-people-carry-box" style="margin-right:6px;"></i>Carga de Enfermedad e Impacto Asistencial</strong>
                    <p style="margin:8px 0 0 0;">Esta visualización mapea el <strong>volumen de producción biomédica real</strong> lograda en la infraestructura física de cada centro de salud, entregando una radiografía operativa fundamental para la toma de decisiones en el escenario endémico ${currentYear}.</p>
                </div>
                ${dynamicTop}
                ${dynamicBrecha}
                <div style="margin-top:16px;">
                    <strong><i class="fa-solid fa-scale-unbalanced" style="margin-right:6px;color:var(--accent-blue,#0f69b4);"></i>Gestión Predictiva del Riesgo</strong>
                    <ul style="padding-left:20px;margin:8px 0 0 0;">
                        <li style="margin-bottom:8px;">Detecta precozmente la sobrecarga que precipita fallos en bioseguridad, ruptura de la red de frío o EPRO por fatiga en nodos de alta presión.</li>
                        <li>Facilita reasignación dinámica de RRHH desde nodos infrautilizados hacia puntos calientes de vacunación.</li>
                    </ul>
                </div>
            </div>`
        },
        tipoCentro: {
            title: `Resolutividad según Complejidad de la Red Asistencial — ${locName}`,
            body: `${contextBanner}
            <div style="color:var(--text-primary,#334155);font-size:0.92rem;line-height:1.6;text-align:justify;">
                <p>La estratificación por nivel de atención (Hospital, CESFAM, CECOSF, Posta Rural) modela la capilaridad de la política COVID-19 dentro de la geografía y el tejido social ${locNameAdj} durante ${currentYear}.</p>
                <div style="margin-top:16px;">
                    <strong><i class="fa-solid fa-lightbulb" style="margin-right:6px;color:#f59e0b;"></i>Integración Territorial RISS</strong>
                    <ul style="padding-left:20px;margin:8px 0 0 0;">
                        <li style="margin-bottom:8px;"><strong>Equidad Sanitaria:</strong> Una sólida participación de la salud rural y periférica (Postas, CECOSF) certifica intervención exitosa frente a determinantes sociales crónicos en poblaciones dispersas de ${locName}.</li>
                        <li><strong>Contención del Riesgo Clínico Crítico:</strong> Las vacunaciones hospitalarias operan como el último cortafuegos antes del alta de pacientes inmunodeprimidos — previniendo reingresos a UPC en la red ${currentYear}.</li>
                    </ul>
                </div>
            </div>`
        }
    };
}

// ── Modal Help ───────────────────────────────────────────────────────────────
function openHelpModal(chartId, btnElement) {
    const filter = document.getElementById('globalComunaFilter')?.value || 'all';
    const data = getCovidHelpTexts(getCurrentYear(), filter)[chartId];
    if (!data) return;

    const card = btnElement.closest('.chart-card, .card');

    let overlay = document.getElementById('spotlightOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'spotlightOverlay';
        overlay.className = 'spotlight-overlay';
        overlay.onclick = closeHelpModal;
        const container = document.querySelector('.dashboard-container') || document.body;
        container.appendChild(overlay);
    }
    overlay.style.display = 'block';
    void overlay.offsetWidth;
    overlay.style.opacity = '1';

    if (card) {
        card.classList.add('spotlight-active');
        window.currentSpotlightCard = card;

        const modal = document.getElementById('helpModal');
        if (!modal) return;

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

            if (spaceLeft > spaceRight) {
                if (spaceLeft >= modalRect.width + 10) {
                    modalLeft = cardRect.left - modalRect.width - 20;
                } else {
                    modalLeft = Math.max(20, (viewportWidth - modalRect.width) / 2);
                    modalTop = cardRect.top + 60;
                }
            } else {
                if (spaceRight >= modalRect.width + 10) {
                    modalLeft = cardRect.right + 20;
                } else {
                    modalLeft = Math.max(20, (viewportWidth - modalRect.width) / 2);
                    modalTop = cardRect.top + 60;
                }
            }

            if (modalTop + modalRect.height > viewportHeight - 20) {
                modalTop = viewportHeight - modalRect.height - 20;
            }
            if (modalTop < 20) modalTop = 20;

            modal.style.top = modalTop + 'px';
            modal.style.left = modalLeft + 'px';
            modal.style.opacity = '1';
            modal.style.transform = 'translateY(0)';
        }, 10);
    }
}

function closeHelpModal() {
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
}


/* --- map.js --- */
/* ══════════════════════════════════════════════════════════════════════════════
   Dashboard COVID-19 · Map Module (Leaflet)
   Análisis Territorial con Polígonos Coropléticos + Marcadores de Red Asistencial
   ══════════════════════════════════════════════════════════════════════════════ */


let mapInstance = null;
let geojsonLayer = null;
let markersLayerGroup = null;

// ── Helpers ──────────────────────────────────────────────────────────────────
const normalize = (str) => {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

function abbreviate(name) {
    if (!name) return "";
    return name
        .replace(/Centro de Salud Familiar/gi, 'CESFAM')
        .replace(/Posta de Salud Rural/gi, 'PSR')
        .replace(/Centro Comunitario de Salud Familiar/gi, 'CECOSF')
        .replace(/Hospital/gi, 'Hosp.');
}

// Color para intensidad relativa de vacunación (polígonos)
const getColor = (val, max) => {
    if (max === 0) return "#e2e8f0";
    const pct = val / max;
    return pct > 0.8 ? '#10b981' :  // Alto - verde
           pct > 0.5 ? '#f59e0b' :  // Medio - ámbar
                       '#ef4444';   // Bajo - rojo
};

// ── Init Map ─────────────────────────────────────────────────────────────────
function initMap() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer || typeof L === 'undefined') return;

    if (!mapInstance) {
        // Centrar en la Provincia de Osorno completa
        mapInstance = L.map('map', { zoomControl: true }).setView([-40.5739, -73.1336], 9);
        mapInstance.zoomControl.setPosition('bottomright');

        // Capa base Google Maps (misma que Influenza)
        L.tileLayer("https://mt0.google.com/vt/lyrs=m&hl=es&x={x}&y={y}&z={z}", {
            attribution: "© Google Maps", opacity: 0.95
        }).addTo(mapInstance);

        L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(mapInstance);
    }

    // Renderizar datos inmediatamente si ya hay data cargada
    renderTerritoryMap();
}

// ── Render Territory Map (Polígonos + Marcadores) ────────────────────────────
function renderTerritoryMap() {
    if (!mapInstance) return;
    const DATA = getData();
    if (!DATA) return;

    const filter = getCurrentComuna() || 'all';
    const filterNorm = filter === 'all' ? 'all' : normalize(filter);

    // Limpiar capas previas
    if (geojsonLayer) { mapInstance.removeLayer(geojsonLayer); geojsonLayer = null; }
    if (markersLayerGroup) { mapInstance.removeLayer(markersLayerGroup); markersLayerGroup = null; }

    // ── 1. Calcular totales por comuna ───────────────────────────────────────
    const comunaTotals = {};
    let maxDosis = 1;
    getOcurrenciaData('all').forEach(d => {
        const normComuna = normalize(d.comuna);
        comunaTotals[normComuna] = (comunaTotals[normComuna] || 0) + d.total;
    });
    Object.values(comunaTotals).forEach(val => {
        if (val > maxDosis) maxDosis = val;
    });

    const bounds = [];

    // ── 2. Polígonos de Comunas (Capa Coroplética) ───────────────────────────
    if (typeof COMUNAS_GEOJSON !== 'undefined' && COMUNAS_GEOJSON.features) {
        geojsonLayer = L.geoJSON(COMUNAS_GEOJSON, {
            style: feature => {
                const nGeo = normalize(feature.properties.nombre || '');
                const key = Object.keys(comunaTotals).find(k => normalize(k) === nGeo);
                const val = key ? comunaTotals[key] : 0;
                const isFiltered = filter !== 'all' && !nGeo.includes(filterNorm) && !filterNorm.includes(nGeo);

                return {
                    fillColor: val > 0 ? getColor(val, maxDosis) : "#e2e8f0",
                    fillOpacity: isFiltered ? 0.05 : 0.3,
                    color: "#ffffff", weight: 1.5
                };
            },
            onEachFeature: (feature, layer) => {
                const nGeo = normalize(feature.properties.nombre || '');
                const key = Object.keys(comunaTotals).find(k => normalize(k) === nGeo);
                const val = key ? comunaTotals[key] : 0;
                const display = (feature.properties.nombre || '').toUpperCase();

                const html = val > 0
                    ? `<div style="min-width:160px">
                           <strong style="color:#312e81">${display}</strong><br>
                           <div style="margin-top:5px; padding-top:5px; border-top:1px dashed #cbd5e1; font-size:0.9em">
                               Dosis Administradas: <b>${fmt(val)}</b><br>
                               Participación: <b>${((val / Object.values(comunaTotals).reduce((a,b)=>a+b,0)) * 100).toFixed(1)}%</b>
                           </div>
                       </div>`
                    : `<strong>${display}</strong><br>Sin datos de vacunación`;
                layer.bindPopup(html);
                layer.on('mouseover', () => layer.setStyle({ fillOpacity: 0.55, weight: 2.5 }));
                layer.on('mouseout', () => {
                    const isFiltered = filter !== 'all' && !nGeo.includes(filterNorm) && !filterNorm.includes(nGeo);
                    layer.setStyle({ fillOpacity: isFiltered ? 0.05 : 0.3, weight: 1.5 });
                });
            }
        }).addTo(mapInstance);
    }

    // ── 3. Marcadores de Establecimientos ─────────────────────────────────────
    if (typeof ESTABLECIMIENTOS_GEOJSON !== 'undefined') {
        markersLayerGroup = L.layerGroup();

        ESTABLECIMIENTOS_GEOJSON.features.forEach(f => {
            const p = f.properties;
            const cE = normalize(p.Nombre_com || '');

            // Filtro por comuna
            const isVisible = filter === 'all' || cE.includes(filterNorm) || filterNorm.includes(cE);
            if (!isVisible) return;

            // Buscar datos de vacunación para este establecimiento
            const estabData = DATA.data_ocurrencia.find(d =>
                d.establecimiento.includes(abbreviate(p.Nombre_Oficial)) ||
                p.Nombre_Oficial.includes(d.establecimiento)
            );

            const vacEstablecimiento = estabData ? estabData.total : 0;

            // Color del marcador basado en intensidad comunal
            const comunaKey = Object.keys(comunaTotals).find(k => normalize(k) === cE);
            const comunaTotal = comunaKey ? comunaTotals[comunaKey] : 0;
            const col = vacEstablecimiento > 0 ? getColor(comunaTotal, maxDosis) : "#94a3b8";

            const coords = [f.geometry.coordinates[1], f.geometry.coordinates[0]];
            bounds.push(coords);

            // Jerarquía visual por tipo de establecimiento
            let iconHtml = '<i class="fa-solid fa-house-medical"></i>';
            let estabClass = 'posta';
            let iconSize = [24, 24];
            const type = (p.Tipo_estab || "").toLowerCase();

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
                html: `<div class="estab-marker ${estabClass}" style="background-color: ${col}; width: 100%; height: 100%;">${iconHtml}</div>`,
                className: '',
                iconSize: iconSize,
                iconAnchor: [iconSize[0]/2, iconSize[1]/2]
            });

            const marker = L.marker(coords, { icon: customIcon }).bindPopup(`
                <div style="text-align:center;">
                    <b style="color:#0f172a; font-size:1.1em;">${p.Nombre_Oficial}</b><br>
                    <span style="color:#64748b; font-size:0.9em;">${p.Tipo_estab} · ${p.Nombre_com}</span><br>
                    <div style="margin-top:8px; padding:4px; background:${col}20; color:${col}; border-radius:4px; font-weight:bold;">
                        Dosis: ${fmt(vacEstablecimiento)}
                    </div>
                </div>
            `);

            marker.on('click', () => {
                openSidePanel(p, vacEstablecimiento, comunaTotal, maxDosis);
            });

            markersLayerGroup.addLayer(marker);
        });

        mapInstance.addLayer(markersLayerGroup);
    }

    // ── 4. Encuadre ──────────────────────────────────────────────────────────
    if (filter === 'all') {
        mapInstance.flyTo([-40.5739, -73.1336], 9);
    } else if (bounds.length > 0) {
        mapInstance.flyToBounds(bounds, { padding: [40, 40] });
    }
}

// ── Side Panel ───────────────────────────────────────────────────────────────
function openSidePanel(props, vacEstablecimiento, comunaTotal, maxDosis) {
    const panel = document.getElementById('mapSidePanel');
    if (!panel) return;

    panel.classList.add('active');
    const titleEl = document.getElementById('panelTitle');
    if (titleEl) titleEl.textContent = props.Nombre_Oficial;
    const typeEl = document.getElementById('panelType');
    if (typeEl) typeEl.textContent = props.Tipo_estab;
    const comunaEl = document.getElementById('panelComuna');
    if (comunaEl) comunaEl.textContent = props.Nombre_com;

    // Vacunados del establecimiento
    const coverageEl = document.getElementById('panelCoverage');
    if (coverageEl) coverageEl.textContent = fmt(vacEstablecimiento);

    // Barra de progreso relativa al máximo comunal
    const progressEl = document.getElementById('panelProgress');
    if (progressEl) {
        const pct = comunaTotal > 0 ? Math.min(100, (vacEstablecimiento / comunaTotal) * 100) : 0;
        progressEl.style.width = pct + '%';
        const col = getColor(comunaTotal, maxDosis);
        progressEl.style.background = col;
    }

    const extra = document.getElementById('panelExtraInfo');
    if (extra) {
        extra.innerHTML = `
            <div style="font-size:0.75rem; color:#94a3b8; margin-bottom:10px;">CONTEXTO COMUNAL (${(props.Nombre_com || '').toUpperCase()})</div>
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Total Dosis Comuna:</span> <b>${fmt(comunaTotal)}</b></div>
            <div style="display:flex; justify-content:space-between; margin-bottom:5px; color:#a78bfa; font-weight:bold;"><span>Aporte de este centro:</span> <b>${comunaTotal > 0 ? ((vacEstablecimiento / comunaTotal) * 100).toFixed(1) : 0}%</b></div>
            <div style="margin-top:15px; font-size:0.7rem; font-style:italic; opacity:0.7;">Fuente: DEIS - MINSAL</div>
        `;
    }
}

window.closeSidePanel = function() {
    const panel = document.getElementById('mapSidePanel');
    if (panel) panel.classList.remove('active');
};

// ── Alias: updateMapData ahora llama a renderTerritoryMap ─────────────────────
function updateMapData() {
    renderTerritoryMap();
}

// ── Actualizar capa base al cambiar tema ─────────────────────────────────────
function updateMapTheme() {
    // Google Maps tiles don't have a dark mode variant, so we keep the same
    // If desired, can switch to CartoDB dark tiles here in the future
}


/* --- pdf-export.js --- */
/* ══════════════════════════════════════════════════════════════════════════════
   Dashboard COVID-19 · PDF Export Module
   Exportación de reportes tabulares (Matriz Técnica) con html2pdf.js
   ══════════════════════════════════════════════════════════════════════════════ */


function exportToPDF() {
    if (typeof html2pdf === 'undefined') {
        alert("Librería PDF no cargada.");
        return;
    }

    const currentYear = getCurrentYear();
    const DATA = getData();
    const table = document.querySelector('.matriz-table');
    if (!table) {
        alert("No hay datos en la tabla para exportar.");
        return;
    }

    const btnPdf = document.getElementById('btnExportPDF');
    const originalText = btnPdf.innerHTML;
    btnPdf.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';
    btnPdf.disabled = true;

    // 1. Extraer Datos (Igual que en Excel)
    const thElements = Array.from(table.querySelectorAll('thead th'));
    const headerNames = thElements.map(th => th.textContent);

    const trElements = Array.from(table.querySelectorAll('tbody tr'));
    const extractedData = [];
    trElements.forEach(tr => {
        if (tr.classList.contains('grand-total') || tr.classList.contains('subtotal-row')) return;
        const tds = Array.from(tr.querySelectorAll('td'));
        if (tds.length === 1) return;
        
        const rowData = tds.map(td => {
            const txt = td.textContent.replace(/\./g, '');
            return isNaN(txt) ? txt : Number(txt);
        });
        extractedData.push(rowData);
    });

    const comunasMap = {};
    extractedData.forEach(row => {
        const comuna = row[0];
        if (!comunasMap[comuna]) comunasMap[comuna] = [];
        comunasMap[comuna].push(row);
    });
    
    const sortedComunas = Object.keys(comunasMap).sort();
    const dataRows = [];
    
    sortedComunas.forEach(comuna => {
        const rows = comunasMap[comuna];
        let comunaSums = new Array(headerNames.length).fill(0);
        
        rows.forEach(row => {
            dataRows.push({ type: 'data', data: row });
            for (let i = 2; i < row.length; i++) {
                comunaSums[i] += (Number(row[i]) || 0);
            }
        });
        
        let subRow = new Array(headerNames.length).fill("");
        subRow[0] = "";
        subRow[1] = `Subtotal ${comuna}`;
        for (let i = 2; i < subRow.length; i++) {
            subRow[i] = comunaSums[i];
        }
        dataRows.push({ type: 'subtotal', data: subRow });
    });

    if (sortedComunas.length > 0) {
        let grandTotalRow = new Array(headerNames.length).fill("");
        grandTotalRow[0] = "";
        grandTotalRow[1] = "Total General";
        for (let i = 2; i < headerNames.length; i++) grandTotalRow[i] = 0;
        
        sortedComunas.forEach(comuna => {
            const rows = comunasMap[comuna];
            rows.forEach(row => {
                for (let i = 2; i < row.length; i++) {
                    grandTotalRow[i] += (Number(row[i]) || 0);
                }
            });
        });
        dataRows.push({ type: 'grandtotal', data: grandTotalRow });
    }

    // Filtros aplicados
    const today = new Date();
    const dateStr = today.toLocaleDateString('es-CL');
    const cutoffDate = (DATA && DATA.fecha_actualizacion) ? DATA.fecha_actualizacion : dateStr;
    
    const critNodes = document.querySelectorAll('#matrizCriterioMultiSelect input:checked:not([value="all"])');
    const isAllCrit = document.getElementById('criterioSelectAll')?.checked;
    let criterioText = "Todos";
    if (!isAllCrit && critNodes.length > 0) {
        criterioText = Array.from(critNodes).map(n => n.parentElement.textContent.trim()).join(", ");
    }

    const comNodes = document.querySelectorAll('#matrizComunaMultiSelect input:checked:not([value="all"])');
    const isAllCom = document.getElementById('comunaSelectAll')?.checked;
    let comunaText = "Todas";
    if (!isAllCom && comNodes.length > 0) {
        comunaText = Array.from(comNodes).map(n => n.parentElement.textContent.trim()).join(", ");
    }

    // 2. Construir HTML para el PDF
    const reportDiv = document.createElement('div');
    reportDiv.style.padding = '20px';
    reportDiv.style.fontFamily = "'Inter', sans-serif";
    reportDiv.style.color = '#1e293b';
    reportDiv.style.backgroundColor = '#ffffff';

    // Encabezado
    reportDiv.innerHTML = `
        <div style="border-bottom: 3px solid #0f69b4; padding-bottom: 10px; margin-bottom: 20px;">
            <h1 style="color: #0f69b4; margin: 0; font-size: 24px; text-transform: uppercase;">Reporte COVID-19 ${currentYear}</h1>
            <h2 style="color: #475569; margin: 5px 0 0 0; font-size: 16px;">Servicio de Salud Osorno - Reporte por Ocurrencia</h2>
        </div>
        <div style="margin-bottom: 20px; font-size: 12px; color: #334155;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="width: 50%; vertical-align: top;">
                        <strong style="text-decoration: underline;">INFORMACIÓN DEL REPORTE</strong><br>
                        <strong>Comuna:</strong> ${comunaText}<br>
                        <strong>Periodo Informado:</strong> Campaña Anual ${currentYear}<br>
                        <strong>Criterios Seleccionados:</strong> ${criterioText}<br>
                    </td>
                    <td style="width: 50%; vertical-align: top; text-align: right;">
                        <strong>Filtro Fecha de Corte:</strong> Actual (${cutoffDate})<br>
                        <strong>Fuente:</strong> DEIS - MINSAL<br>
                        <strong>Fecha de Actualización:</strong> Actual (${cutoffDate})<br>
                    </td>
                </tr>
            </table>
        </div>
    `;

    // Tabla de Datos
    const tableHTML = document.createElement('table');
    tableHTML.style.width = '100%';
    tableHTML.style.borderCollapse = 'collapse';
    tableHTML.style.fontSize = '9px'; // Letra pequeña para que quepa en A4 Horizontal

    // Thead
    let theadStr = '<thead><tr>';
    headerNames.forEach(h => {
        theadStr += `<th style="background-color: #17365D; color: white; padding: 6px 4px; border: 1px solid #000; text-align: center; font-weight: bold;">${h}</th>`;
    });
    theadStr += '</tr></thead>';
    tableHTML.innerHTML = theadStr;

    // Tbody
    const tbody = document.createElement('tbody');
    dataRows.forEach(rowObj => {
        const tr = document.createElement('tr');
        
        let bgColor = '#ffffff';
        let color = '#000000';
        let fontWeight = 'normal';

        if (rowObj.type === 'subtotal') {
            bgColor = '#E9ECEF';
            fontWeight = 'bold';
        } else if (rowObj.type === 'grandtotal') {
            bgColor = '#17365D';
            color = '#ffffff';
            fontWeight = 'bold';
        }

        rowObj.data.forEach((cellVal, idx) => {
            const td = document.createElement('td');
            td.style.border = '1px solid #000';
            td.style.padding = '4px';
            td.style.fontWeight = fontWeight;
            td.style.backgroundColor = bgColor;
            td.style.color = color;

            if (idx === 0 || idx === 1) {
                td.style.textAlign = 'left';
            } else {
                td.style.textAlign = 'center';
            }

            // Color specific for subtotal numbers
            if (rowObj.type === 'subtotal' && idx >= 2) {
                td.style.backgroundColor = '#366092';
                td.style.color = '#ffffff';
            }

            // Darker background for the last column (Total column)
            if (idx === rowObj.data.length - 1) {
                td.style.fontWeight = 'bold';
                td.style.color = '#ffffff';
                if (rowObj.type === 'subtotal') {
                    td.style.backgroundColor = '#366092';
                } else {
                    td.style.backgroundColor = '#17365D';
                }
            }

            td.textContent = (idx >= 2 && typeof cellVal === 'number') ? fmt(cellVal) : cellVal;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    
    tableHTML.appendChild(tbody);
    reportDiv.appendChild(tableHTML);

    // Disclaimer Footer
    const footer = document.createElement('div');
    footer.innerHTML = `
        <div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #cbd5e1; font-size: 8px; color: #64748b; text-align: center;">
            Documento generado automáticamente por el Sistema de Geointeligencia Epidemiológica. <br>
            Los datos representados excluyen Errores Programáticos (EPRO) según norma técnica MINSAL.
        </div>
    `;
    reportDiv.appendChild(footer);

    // No agregar al DOM, html2pdf puede procesar el elemento o string HTML
    // directamente. Pasaremos el HTML interno.

    // Opciones html2pdf
    const opt = {
        margin:       10,
        filename:     `Reporte_COVID_${currentYear}_Ocurrencia.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(reportDiv).save().then(() => {
        btnPdf.innerHTML = originalText;
        btnPdf.disabled = false;
    }).catch(err => {
        console.error("Error generating PDF", err);
        btnPdf.innerHTML = originalText;
        btnPdf.disabled = false;
        alert("Ocurrió un error al generar el PDF.");
    });
}

// Hacerlo disponible globalmente
window.exportToPDF = exportToPDF;


/* --- app.js --- */
/* ══════════════════════════════════════════════════════════════════════════════
   Dashboard COVID-19 · Main App (Orchestrator)
   Inicialización, eventos y coordinación de módulos
   ══════════════════════════════════════════════════════════════════════════════ */






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


} catch(e) { alert('BUNDLE ERROR: ' + e.message + '\n' + e.stack); console.error(e); }
