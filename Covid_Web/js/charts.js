/* ══════════════════════════════════════════════════════════════════════════════
   Dashboard COVID-19 · Charts Module
   Renderizado de gráficos Chart.js y KPIs
   ══════════════════════════════════════════════════════════════════════════════ */

import { getData, getCurrentComuna, PALETTE, MONTH_NAMES, fmt, shortenEstabName, getTipoEstablecimiento, getResidenciaTotals, getResidenciaData, getOcurrenciaData, getPoblacionObjetivo } from './data.js';

const chartInstances = {};

// ── Utilidades de Gráficos ───────────────────────────────────────────────────
export function destroyChart(id) {
    if (chartInstances[id]) {
        chartInstances[id].destroy();
        delete chartInstances[id];
    }
}

export function animateValue(obj, end, duration = 800) {
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

export function downloadChartImage(canvasId, fileName) {
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
export function renderKPIs() {
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
export function renderCharts() {
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
