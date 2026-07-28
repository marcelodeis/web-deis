/* ══════════════════════════════════════════════════════════════════════════════
   Dashboard COVID-19 · Map Module (Leaflet)
   Análisis Territorial con Polígonos Coropléticos + Marcadores de Red Asistencial
   ══════════════════════════════════════════════════════════════════════════════ */

import { getData, getOcurrenciaData, getCurrentComuna, fmt } from './data.js';

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
export function initMap() {
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
export function renderTerritoryMap() {
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
export function updateMapData() {
    renderTerritoryMap();
}

// ── Actualizar capa base al cambiar tema ─────────────────────────────────────
export function updateMapTheme() {
    // Google Maps tiles don't have a dark mode variant, so we keep the same
    // If desired, can switch to CartoDB dark tiles here in the future
}
