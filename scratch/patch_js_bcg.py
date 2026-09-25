import os, io, re

js_path = r'C:\Antigravity IDE\WEB DEIS\Programáticas_Web\app_v9.js'

with io.open(js_path, 'r', encoding='utf-8') as f:
    js_content = f.read()

fetch_logic = """
// --- LOGICA DE PROGRAMATICAS FORMATO BCG ---
let rescatesDataV5 = null;
let currentTerritory = 'residencia'; // 'residencia' o 'ocurrencia'

$(document).ready(function() {
    loadRescatesJSONV5();
});

function loadRescatesJSONV5() {
    fetch('programaticas_rescates.json?v=' + new Date().getTime())
        .then(response => response.json())
        .then(data => {
            rescatesDataV5 = data;
            $('#header-base').html(`<i class="fas fa-database"></i> Base Procesada: ${data.base_procesada}`);
            $('#header-corte').html(`<i class="fas fa-calendar-check"></i> Datos v&aacute;lidos hasta: ${data.fecha_corte_evaluacion}`);
            renderRescatesV5();
        })
        .catch(err => {
            console.error("Error cargando JSON de rescates:", err);
            const ids = ['hexa2','neumo2','menb2','hexa3','srp2','vari2'];
            ids.forEach(id => {
                const el = document.getElementById(`prog-${id}-brecha`);
                if(el) el.innerHTML = '<span style="font-size:1.5rem;color:#94a3b8;"><i class="fas fa-exclamation-circle"></i> No disponible</span>';
            });
        });
}

window.setTerritoryFilter = function(territory) {
    currentTerritory = territory;
    $('#btn-residencia').css({'background': 'transparent', 'box-shadow': 'none', 'color': '#64748b'});
    $('#btn-ocurrencia').css({'background': 'transparent', 'box-shadow': 'none', 'color': '#64748b'});
    $(`#btn-${territory}`).css({'background': 'white', 'box-shadow': '0 1px 3px rgba(0,0,0,0.1)', 'color': '#0f172a'});
    renderRescatesV5();
}

const mapIdsV5 = {
    'hexa2': 'Hexavalente 2.',
    'hexa3': 'Hexavalente 3.',
    'neumo2': 'Neumoccica 2.',
    'menb2': 'Meningoccica B 2.',
    'srp2': 'SRP 2.',
    'vari2': 'Varicela 2.'
};

function formatNumV5(num) {
    return num.toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, ".");
}

function renderRescatesV5() {
    if(!rescatesDataV5) return;
    const d = currentTerritory === 'residencia' ? rescatesDataV5.residencia : rescatesDataV5.ocurrencia;
    
    for(const [prefix, jsonName] of Object.entries(mapIdsV5)) {
        if(d[jsonName]) {
            const m = d[jsonName];
            
            // Logic mapping BCG format to Programaticas JSON
            const elegible = m.UNIVERSO_EVALUABLE || 0;
            const fallecidos = m.FALLECIDOS || 0;
            const fuera = m.FUERA_COHORTE_EDAD || 0;
            
            const excluidos = fallecidos + fuera;
            const universoTotal = elegible + excluidos;
            
            const alDia = m.ESQUEMA_AL_DIA || 0;
            const aunNo = m.AUN_NO_CORRESPONDE || 0;
            const errorSec = m.ERROR_SECUENCIA || 0;
            
            const conRegistro = alDia + aunNo + errorSec;
            
            const rescateActivo = m.RESCATE_ACTIVO || 0;
            const pct = elegible > 0 ? ((rescateActivo / elegible) * 100).toFixed(1) : 0.0;
            
            $(`#prog-${prefix}-brecha`).html(formatNumV5(rescateActivo));
            $(`#prog-${prefix}-pct-brecha`).html(`${pct}% del universo elegible`);
            
            $(`#prog-${prefix}-uni`).text(formatNumV5(universoTotal));
            $(`#prog-${prefix}-exc`).text(formatNumV5(excluidos));
            $(`#prog-${prefix}-elegible`).text(formatNumV5(elegible));
            
            const pctRegistro = elegible > 0 ? ((conRegistro / elegible) * 100).toFixed(1) : 0.0;
            $(`#prog-${prefix}-vac`).text(`${formatNumV5(conRegistro)} (${pctRegistro}%)`);
        } else {
            $(`#prog-${prefix}-brecha`).html('<span style="font-size:1.5rem;color:#94a3b8;"><i class="fas fa-exclamation-circle"></i> No disponible</span>');
        }
    }
}
// -----------------------------------
"""

if "// --- LOGICA DE PROGRAMATICAS FORMATO BCG ---" not in js_content:
    with io.open(js_path, 'a', encoding='utf-8') as f:
        f.write("\n\n" + fetch_logic)
        
print("JS patched successfully!")
