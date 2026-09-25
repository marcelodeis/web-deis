import os, io

js_path = r'C:\Antigravity IDE\WEB DEIS\Programáticas_Web\app_v9.js'

with io.open(js_path, 'r', encoding='utf-8') as f:
    js_content = f.read()

new_logic = """
// --- LOGICA DE PROGRAMATICAS FORMATO BCG (CORREGIDA) ---
$(document).ready(function() {
    loadRescatesJSONV5();
});

function loadRescatesJSONV5() {
    try {
        if(window.rescatesDataV5) {
            renderRescatesV5();
        } else {
            throw new Error("window.rescatesDataV5 is undefined");
        }
    } catch (err) {
        console.error("Error procesando data de rescates:", err);
        const ids = ['hexa2','neumo2','menb2','hexa3','srp2','vari2'];
        ids.forEach(id => {
            const el = document.getElementById(`prog-${id}-brecha`);
            if(el) el.innerHTML = '<span style="font-size:1.5rem;color:#94a3b8;"><i class="fas fa-exclamation-circle"></i> No disponible</span>';
        });
    }
}

const mapIdsV5 = {
    'hexa2': 'Hexavalente 2.ª',
    'hexa3': 'Hexavalente 3.ª',
    'neumo2': 'Neumocócica 2.ª',
    'menb2': 'Meningocócica B 2.ª',
    'srp2': 'SRP 2.ª',
    'vari2': 'Varicela 2.ª'
};

function formatNumV5(num) {
    return num.toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, ".");
}

function renderRescatesV5() {
    if(!window.rescatesDataV5) return;
    
    for(const [prefix, jsonName] of Object.entries(mapIdsV5)) {
        if(window.rescatesDataV5[jsonName] && window.rescatesDataV5[jsonName].comunas) {
            const comunas = window.rescatesDataV5[jsonName].comunas;
            
            let rescateActivo = 0;
            let alDia = 0;
            let aunNo = 0;
            let errorSec = 0;
            let fallecidos = 0;
            let fuera = 0;
            let sinEvidencia = 0;
            
            for(const comunaName in comunas) {
                const establecimientos = comunas[comunaName];
                for(const estabName in establecimientos) {
                    const m = establecimientos[estabName];
                    rescateActivo += (m.RESCATE_ACTIVO || 0);
                    alDia += (m.ESQUEMA_AL_DIA || 0);
                    aunNo += (m.AUN_NO_CORRESPONDE || 0);
                    errorSec += (m.ERROR_SECUENCIA || 0);
                    fallecidos += (m.FALLECIDO || 0);
                    fuera += (m.FUERA_COHORTE_EDAD || 0);
                    sinEvidencia += (m.SIN_EVIDENCIA_RESIDENCIA || 0);
                }
            }
            
            // Reconstruct the logic correctly based on the counts
            // Universe Evaluable is the sum of Con Registro + Rescate
            const conRegistro = alDia + aunNo + errorSec;
            const elegible = conRegistro + rescateActivo;
            
            const excluidos = fallecidos + fuera + sinEvidencia;
            const universoTotal = elegible + excluidos;
            
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
"""

idx = js_content.find('// --- LOGICA DE PROGRAMATICAS FORMATO BCG')
if idx != -1:
    js_content = js_content[:idx] + new_logic
else:
    js_content = js_content + '\\n' + new_logic

with io.open(js_path, 'w', encoding='utf-8') as f:
    f.write(js_content)
print('Done patching JS to use variable instead of fetch!')
