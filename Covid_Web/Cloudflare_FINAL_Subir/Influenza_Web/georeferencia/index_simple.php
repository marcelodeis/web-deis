<?php
// index_simple.php - Dashboard con datos inyectados directamente por PHP (sin fetch adicional)
$archivoGeojson = __DIR__ . '/Establecimientos_Provincia_Osorno.geojson';
$geojsonData = null;
if (file_exists($archivoGeojson)) {
    $contenido = file_get_contents($archivoGeojson);
    $geojsonData = json_decode($contenido, true);
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Red Asistencial Provincia de Osorno</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
:root{--bg:#f5f7fa;--card:#fff;--accent:#0056b3;--alert:#dc3545;--success:#28a745;--warning:#ffc107}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:var(--bg);color:#222;height:100vh;display:flex;flex-direction:column;overflow:hidden}
header{background:var(--accent);color:#fff;padding:1rem;text-align:center;flex-shrink:0}
header h1{font-size:1.3rem}header p{font-size:.85rem;opacity:.9}
.controls{display:flex;gap:1rem;padding:.8rem 1rem;background:var(--card);box-shadow:0 2px 6px rgba(0,0,0,.08);flex-wrap:wrap;flex-shrink:0}
.controls select,.controls button{padding:.5rem .8rem;border:1px solid #cbd5e1;border-radius:6px;min-width:160px;font-size:.9rem}
.controls button{background:var(--accent);color:#fff;cursor:pointer;border:none}
.controls button:hover{background:#004494}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.8rem;padding:.8rem 1rem;flex-shrink:0}
.stat-card{background:var(--card);padding:.7rem;border-radius:8px;text-align:center;box-shadow:0 2px 4px rgba(0,0,0,.05)}
.stat-card h4{font-size:.75rem;color:#64748b;text-transform:uppercase;letter-spacing:.5px}
.stat-card span{font-size:1.3rem;font-weight:700;color:var(--accent)}
.main{flex:1;display:grid;grid-template-columns:380px 1fr;gap:1rem;padding:0 1rem 1rem;min-height:0}
#sidebar{background:var(--card);border-radius:8px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,.08);display:flex;flex-direction:column}
#sidebar-header{padding:.8rem 1rem;background:#f8fafc;border-bottom:1px solid #e2e8f0}
#sidebar-header h3{font-size:1rem;color:#334155}#sidebar-header small{color:#64748b}
#list-container{flex:1;overflow-y:auto;padding:.5rem}
.est-item{padding:.7rem .8rem;border-radius:6px;cursor:pointer;transition:all .15s;border:1px solid transparent;margin-bottom:4px}
.est-item:hover{background:#f1f5f9;border-color:#cbd5e1}
.est-item.active{background:#e0f2fe;border-color:#7dd3fc}
.est-item .est-nombre{font-weight:600;font-size:.88rem;color:#1e293b;margin-bottom:2px}
.est-item .est-meta{font-size:.78rem;color:#64748b;display:flex;gap:.6rem;flex-wrap:wrap}
.est-item .est-meta span{display:flex;align-items:center;gap:3px}
.est-item .dot{display:inline-block;width:8px;height:8px;border-radius:50%}
#map{border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,.15);height:100%}
.legend{background:#fff;padding:8px 10px;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,.2);font-size:.8rem;max-width:220px}
.legend h4{margin-bottom:6px;font-size:.85rem;color:#334155}
.legend-item{display:flex;align-items:center;gap:6px;margin:3px 0;font-size:.78rem}
.legend-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
@media(max-width:900px){.main{grid-template-columns:1fr;grid-template-rows:1fr 1fr}#sidebar{max-height:400px}}
</style>
</head>
<body>
<header>
  <h1>Red Asistencial Provincia de Osorno</h1>
  <p>Georreferenciacion de establecimientos de salud - DEIS 2025</p>
</header>

<div class="controls">
  <select id="filtro-comuna"><option value="todas">Todas las comunas</option></select>
  <select id="filtro-tipo"><option value="todos">Todos los tipos</option></select>
  <button onclick="resetFiltros()">Reiniciar</button>
  <button onclick="exportCSV()">Exportar CSV</button>
</div>

<div class="stats">
  <div class="stat-card"><h4>Total</h4><span id="stat-total">0</span></div>
  <div class="stat-card"><h4>Filtrados</h4><span id="stat-filtrados">0</span></div>
  <div class="stat-card"><h4>Comunas</h4><span id="stat-comunas">0</span></div>
  <div class="stat-card"><h4>Tipos</h4><span id="stat-tipos">0</span></div>
</div>

<div class="main">
  <div id="sidebar">
    <div id="sidebar-header">
      <h3>Establecimientos</h3>
      <small>Haz clic para georreferenciar en el mapa</small>
    </div>
    <div id="list-container"></div>
  </div>
  <div id="map"></div>
</div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<?php if ($geojsonData): ?>
<script>
const ESTABLECIMIENTOS_GEOJSON = <?php echo json_encode($geojsonData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?>;
</script>
<?php endif; ?>
<script>
const COLORES = {
  'Hospital':'#dc3545',
  'Centro de Salud Familiar (CESFAM)':'#0056b3',
  'Centro Comunitario de Salud Familiar (CECOSF)':'#28a745',
  'Posta de Salud Rural (PSR)':'#ffc107',
  'Servicio de Atencion Primaria de Urgencia (SAPU)':'#17a2b8',
  'Centro Comunitario de Salud Mental  (COSAM)':'#6f42c1',
  'Servicio de Urgencia Rural (SUR)':'#fd7e14',
  'Centro de Salud Privado':'#e83e8c',
  'Clinica':'#20c997',
  'Clinica Dental':'#6610f2',
  'Laboratorio Clinico':'#795548',
  'Vacunatorio':'#ff5722',
  'Direccion Servicio de Salud':'#343a40',
  'Centro de Referencia de Salud (CRS)':'#009688',
  'Centro de Dialisis':'#3f51b5',
  'Centro de Rehabilitacion':'#8bc34a',
  'Centro de Salud Mental':'#9c27b0',
  'Centro de Apoyo Comunitario para personas con Demencia':'#00bcd4',
  'Centro de Tratamiento de Adicciones (CTA)':'#ff9800',
  'Programa de Reparacion y Atencion Integral de Salud (PRAIS)':'#607d8b',
  'Unidad de Salud Funcionarios':'#795548',
  'Unidad de Procedimientos Movil':'#9e9e9e',
  'Otro':'#64748b'
};

function getColor(tipo){ return COLORES[tipo] || '#64748b'; }

const map = L.map('map').setView([-40.65,-73.15],9);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors'}).addTo(map);

const markersLayer = L.layerGroup().addTo(map);
let allFeatures = [];
let currentFeatures = [];
let markerMap = new Map();

function init(){
  if(typeof ESTABLECIMIENTOS_GEOJSON === 'undefined' || !ESTABLECIMIENTOS_GEOJSON){
    document.getElementById('list-container').innerHTML = '<div style="padding:1rem;color:var(--alert)"><strong>Error:</strong> No se encontraron los datos.</div>';
    return;
  }
  allFeatures = ESTABLECIMIENTOS_GEOJSON.features || [];
  populateFilters();
  applyFilters();
}

function populateFilters(){
  const comSel = document.getElementById('filtro-comuna');
  const tipSel = document.getElementById('filtro-tipo');
  const comunas = new Set();
  const tipos = new Set();
  allFeatures.forEach(f=>{
    const p = f.properties || {};
    comunas.add(p.nom_comuna || p.nom_com || 'Sin comuna');
    tipos.add(p.tipo || 'Otro');
  });
  Array.from(comunas).sort().forEach(c=>comSel.add(new Option(c,c)));
  Array.from(tipos).sort().forEach(t=>tipSel.add(new Option(t,t)));
}

function getFiltered(){
  const comuna = document.getElementById('filtro-comuna').value;
  const tipo = document.getElementById('filtro-tipo').value;
  return allFeatures.filter(f=>{
    const p = f.properties || {};
    const c = p.nom_comuna || p.nom_com || 'Sin comuna';
    const t = p.tipo || 'Otro';
    if(comuna !== 'todas' && c !== comuna) return false;
    if(tipo !== 'todos' && t !== tipo) return false;
    return true;
  });
}

function applyFilters(){
  currentFeatures = getFiltered();
  renderList();
  renderMap();
  updateStats();
}

function renderList(){
  const container = document.getElementById('list-container');
  container.innerHTML = '';
  if(currentFeatures.length === 0){
    container.innerHTML = '<div style="padding:1rem;color:#64748b;text-align:center">No se encontraron establecimientos con los filtros seleccionados.</div>';
    return;
  }
  currentFeatures.forEach((f, idx)=>{
    const p = f.properties || {};
    const comuna = p.nom_comuna || p.nom_com || 'Sin comuna';
    const tipo = p.tipo || 'Otro';
    const nombre = p.nombre || 'Sin nombre';
    const direccion = p.direccion || '';
    const color = getColor(tipo);
    const div = document.createElement('div');
    div.className = 'est-item';
    div.dataset.idx = idx;
    div.innerHTML = `<div class="est-nombre">${nombre}</div>
      <div class="est-meta">
        <span><span class="dot" style="background:${color}"></span> ${tipo}</span>
        <span>${comuna}</span>
        ${direccion ? `<span>${direccion}</span>` : ''}
      </div>`;
    div.addEventListener('click', ()=>{
      document.querySelectorAll('.est-item').forEach(el=>el.classList.remove('active'));
      div.classList.add('active');
      focusFeature(f);
    });
    container.appendChild(div);
  });
}

function renderMap(){
  markersLayer.clearLayers();
  markerMap.clear();
  const bounds = [];
  currentFeatures.forEach((f, idx)=>{
    const p = f.properties || {};
    const geom = f.geometry;
    if(!geom || geom.type !== 'Point') return;
    const [lon, lat] = geom.coordinates;
    if(lat == null || lon == null) return;
    const tipo = p.tipo || 'Otro';
    const color = getColor(tipo);
    const icon = L.divIcon({
      html: `<div style="width:14px;height:14px;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 2px 5px rgba(0,0,0,.4)"></div>`,
      iconSize: [14,14], className: ''
    });
    const marker = L.marker([lat, lon], {icon}).bindPopup(`
      <div style="min-width:220px">
        <h3 style="margin:0 0 6px;color:${color};font-size:1rem">${p.nombre || 'Sin nombre'}</h3>
        <div style="font-size:.85rem;color:#555">
          <div><strong>Tipo:</strong> ${tipo}</div>
          <div><strong>Comuna:</strong> ${p.nom_comuna || p.nom_com || ''}</div>
          ${p.direccion ? `<div><strong>Direccion:</strong> ${p.direccion}</div>` : ''}
          ${p.dependenc ? `<div><strong>Dependencia:</strong> ${p.dependenc}</div>` : ''}
          ${p.prestador ? `<div><strong>Prestador:</strong> ${p.prestador}</div>` : ''}
          ${p.estado ? `<div><strong>Estado:</strong> ${p.estado}</div>` : ''}
          ${p.urgencia ? `<div><strong>Urgencia:</strong> ${p.urgencia}</div>` : ''}
          <div style="margin-top:6px;font-size:.75rem;color:#888">Lat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(5)}</div>
        </div>
      </div>`);
    marker.addTo(markersLayer);
    markerMap.set(idx, marker);
    bounds.push([lat, lon]);
  });
  if(bounds.length > 0) map.fitBounds(bounds, {padding: [60,60], maxZoom: 15});
  updateLegend();
}

function updateLegend(){
  let legendDiv = document.querySelector('.legend');
  if(!legendDiv){
    const legend = L.control({position: 'bottomright'});
    legend.onAdd = function(){
      const div = L.DomUtil.create('div', 'legend');
      div.innerHTML = '<h4>Tipos</h4>';
      return div;
    };
    legend.addTo(map);
    legendDiv = document.querySelector('.legend');
  }
  const tiposVisibles = new Set();
  currentFeatures.forEach(f=> tiposVisibles.add(f.properties?.tipo || 'Otro'));
  let html = '<h4>Tipos de establecimiento</h4>';
  Array.from(tiposVisibles).sort().forEach(t=>{
    html += `<div class="legend-item"><span class="legend-dot" style="background:${getColor(t)}"></span>${t}</div>`;
  });
  legendDiv.innerHTML = html;
}

function focusFeature(feature){
  const geom = feature.geometry;
  if(!geom || geom.type !== 'Point') return;
  const [lon, lat] = geom.coordinates;
  if(lat == null || lon == null) return;
  map.flyTo([lat, lon], 16, {duration: 1.5});
  const idx = currentFeatures.indexOf(feature);
  if(idx >= 0){
    const marker = markerMap.get(idx);
    if(marker) setTimeout(()=>marker.openPopup(), 1600);
  }
}

function updateStats(){
  document.getElementById('stat-total').textContent = allFeatures.length;
  document.getElementById('stat-filtrados').textContent = currentFeatures.length;
  document.getElementById('stat-comunas').textContent = new Set(allFeatures.map(f=>f.properties?.nom_comuna || f.properties?.nom_com || 'Sin comuna')).size;
  document.getElementById('stat-tipos').textContent = new Set(allFeatures.map(f=>f.properties?.tipo || 'Otro')).size;
}

function resetFiltros(){
  document.getElementById('filtro-comuna').value = 'todas';
  document.getElementById('filtro-tipo').value = 'todos';
  applyFilters();
}

function exportCSV(){
  const headers = ['cod_vig','cod_ant','nombre','tipo','ambito','comuna','direccion','dependencia','prestador','estado','urgencia','latitud','longitud'];
  const rows = [headers.join(',')];
  currentFeatures.forEach(f=>{
    const p = f.properties || {};
    const geom = f.geometry;
    const lat = geom?.coordinates?.[1] ?? p.latitud ?? '';
    const lon = geom?.coordinates?.[0] ?? p.longitud ?? '';
    const vals = [
      p.cod_vig ?? '', p.cod_ant ?? '', p.nombre ?? '', p.tipo ?? '', p.ambito ?? '',
      p.nom_comuna || p.nom_com || '', p.direccion ?? '', p.dependenc ?? '', p.prestador ?? '',
      p.estado ?? '', p.urgencia ?? '', lat, lon
    ];
    rows.push(vals.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','));
  });
  const blob = new Blob(['\ufeff'+rows.join('\n')], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Establecimientos_Provincia_Osorno.csv';
  a.click();
}

let filterTimeout;
document.getElementById('filtro-comuna').addEventListener('change', ()=>{ clearTimeout(filterTimeout); filterTimeout = setTimeout(applyFilters, 50); });
document.getElementById('filtro-tipo').addEventListener('change', ()=>{ clearTimeout(filterTimeout); filterTimeout = setTimeout(applyFilters, 50); });

init();
</script>
</body>
</html>
