/* ══════════════════════════════════════════════════════════════════════════════
   Dashboard COVID-19 · Data Module
   Constantes, estado global y funciones de acceso a datos
   ══════════════════════════════════════════════════════════════════════════════ */

// ── Constantes ───────────────────────────────────────────────────────────────
export const COMUNAS = ["Osorno", "Puerto Octay", "Purranque", "Puyehue", "Río Negro", "San Juan de la Costa", "San Pablo"];
export const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const PALETTE = [
    '#0f69b4', // Azul Minsal
    '#0ea5e9', // Celeste
    '#10b981', // Verde
    '#f59e0b', // Ambar
    '#8b5cf6', // Morado
    '#ef4444', // Rojo
    '#14b8a6', // Teal
    '#f43f5e'  // Rose
];

export const COMUNA_COLORS = {};
COMUNAS.forEach((c, i) => COMUNA_COLORS[c.toUpperCase()] = PALETTE[i % PALETTE.length]);

// ── Estado Global ────────────────────────────────────────────────────────────
const state = {
    currentYear: '2026',
    DATA: null,
    currentComuna: 'all',
    DATA_BY_YEAR: {}
};

export function getState() { return state; }
export function getCurrentYear() { return state.currentYear; }
export function getData() { return state.DATA; }
export function getCurrentComuna() { return state.currentComuna; }

export function setCurrentYear(year) { state.currentYear = year; }
export function setData(data) { state.DATA = data; }
export function setCurrentComuna(comuna) { state.currentComuna = comuna; }
export function setDataForYear(year, data) { state.DATA_BY_YEAR[year] = data; }
export function getDataForYear(year) { return state.DATA_BY_YEAR[year] || null; }

// ── Carga de Datos (Async JSON) ──────────────────────────────────────────────
const dataCache = {};

export async function loadYearData(year) {
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

export async function initData() {
    // Cargar ambos años
    await loadYearData('2025');
    await loadYearData('2026');
    state.currentYear = '2026';
    state.DATA = state.DATA_BY_YEAR['2026'];
}

// ── Utilidades ───────────────────────────────────────────────────────────────
export function fmt(n) {
    return (n || 0).toLocaleString('es-CL');
}

export function shortenEstabName(name) {
    if (!name) return '';
    let n = name;
    n = n.replace(/Centro de Salud Familiar/gi, 'CESFAM');
    n = n.replace(/Centro Comunitario de Salud Familiar/gi, 'CECOSF');
    n = n.replace(/Hospital Base San José de Osorno/gi, 'HBSJO');
    n = n.replace(/Hospital/gi, 'Hosp.');
    n = n.replace(/Clínica Alemana de Osorno/gi, 'C. Alemana');
    return n.length > 35 ? n.substring(0, 32) + '...' : n;
}

export function getTipoEstablecimiento(nombre) {
    let n = nombre.toUpperCase();
    if (n.includes('HOSPITAL')) return 'Hospitales';
    if (n.includes('CLÍNICA') || n.includes('CLINICA') || n.includes('PRIVAD')) return 'Clínicas Privadas';
    if (n.includes('CESFAM') || n.includes('FAMILIAR')) return 'CESFAM';
    if (n.includes('CECOSF') || n.includes('COMUNITARIO')) return 'CECOSF';
    if (n.includes('POSTA')) return 'Postas Rurales';
    return 'Otros';
}

// ── Data Access ──────────────────────────────────────────────────────────────
export function getResidenciaTotals(comuna) {
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

export function getResidenciaData(comuna) {
    const DATA = state.DATA;
    if (!DATA) return [];
    if (comuna === 'all') return DATA.data_residencia;
    return DATA.data_residencia.filter(item => item.comuna.toUpperCase() === comuna.toUpperCase());
}

export function getOcurrenciaData(comuna) {
    const DATA = state.DATA;
    if (!DATA) return [];
    if (comuna === 'all') return DATA.data_ocurrencia;
    return DATA.data_ocurrencia.filter(d => d.comuna.toUpperCase() === comuna.toUpperCase());
}

export function getPoblacionObjetivo(comuna) {
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
