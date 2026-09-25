import io

js_path = r'C:\Antigravity IDE\WEB DEIS\Programáticas_Web\app_v9.js'

with io.open(js_path, 'r', encoding='utf-8') as f:
    js_content = f.read()

new_logic = """
window.abrirReporteProgramaticas = function(prefix) {
    if(!window.rescatesDataV5) return;
    const jsonName = mapIdsV5[prefix];
    if(!jsonName || !window.rescatesDataV5[jsonName]) return;
    
    const comunas = window.rescatesDataV5[jsonName].comunas || {};
    
    let rescateActivo = 0;
    let alDia = 0;
    let aunNo = 0;
    let errorSec = 0;
    let fallecidos = 0;
    let fuera = 0;
    let sinEvidencia = 0;
    
    let comunaTotals = {};
    let estabTotals = [];
    let causales = { 'Fallecido': 0, 'Fuera de Cohorte (Edad)': 0, 'Sin evidencia de Residencia': 0 };
    
    for(const comunaName in comunas) {
        const establecimientos = comunas[comunaName];
        let comunaRescate = 0;
        let comunaElegibles = 0;
        
        for(const estabName in establecimientos) {
            const m = establecimientos[estabName];
            const r = (m.RESCATE_ACTIVO || 0);
            const a = (m.ESQUEMA_AL_DIA || 0);
            const n = (m.AUN_NO_CORRESPONDE || 0);
            const e = (m.ERROR_SECUENCIA || 0);
            
            const f = (m.FALLECIDO || 0);
            const fu = (m.FUERA_COHORTE_EDAD || 0);
            const s = (m.SIN_EVIDENCIA_RESIDENCIA || 0);
            
            rescateActivo += r;
            alDia += a;
            aunNo += n;
            errorSec += e;
            fallecidos += f;
            fuera += fu;
            sinEvidencia += s;
            
            const estabElegibles = r + a + n + e;
            comunaRescate += r;
            comunaElegibles += estabElegibles;
            
            causales['Fallecido'] += f;
            causales['Fuera de Cohorte (Edad)'] += fu;
            causales['Sin evidencia de Residencia'] += s;
            
            if (r > 0) {
                estabTotals.push({ estab: estabName, comuna: comunaName, rescates: r });
            }
        }
        
        if (comunaElegibles > 0) {
            comunaTotals[comunaName] = { rescates: comunaRescate, elegibles: comunaElegibles };
        }
    }
    
    const conRegistro = alDia + aunNo + errorSec;
    const elegible = conRegistro + rescateActivo;
    const excluidos = fallecidos + fuera + sinEvidencia;
    const universoTotal = elegible + excluidos;
    
    const pctRegistro = elegible > 0 ? ((conRegistro / elegible) * 100).toFixed(1) : "0.0";
    const pctSin = elegible > 0 ? ((rescateActivo / elegible) * 100).toFixed(1) : "0.0";
    
    // Configurar Modal
    document.getElementById('progModalTitle').innerText = `Reporte de Seguimiento – ${jsonName}`;
    document.getElementById('progModalCorte').innerText = window.rescatesDataV5.fecha_corte_evaluacion || '20/08/2026';
    
    document.getElementById('progModalKpiNacidos').innerText = formatNumV5(universoTotal);
    document.getElementById('progModalKpiElegibles').innerText = formatNumV5(elegible);
    document.getElementById('progModalKpiCon').innerHTML = `${formatNumV5(conRegistro)} <span style="font-size:0.9rem; color:#64748b;">– ${pctRegistro.replace('.', ',')}%</span>`;
    document.getElementById('progModalKpiSin').innerHTML = `${formatNumV5(rescateActivo)} <span style="font-size:0.9rem; color:#64748b;">– ${pctSin.replace('.', ',')}%</span>`;
    
    document.getElementById('progModalResumenTexto').innerText = `De los ${formatNumV5(elegible)} menores elegibles para seguimiento, ${formatNumV5(conRegistro)} presentan registro de vacunación identificado (${pctRegistro.replace('.', ',')} %) y ${formatNumV5(rescateActivo)} se encuentran pendientes de vacunación (${pctSin.replace('.', ',')} %) (Rescate Activo).`;
    
    document.getElementById('progModalFlujoNacidos').innerText = `${formatNumV5(universoTotal)} Universo Total (Suma Nominal)`;
    document.getElementById('progModalFlujoExcluidos').innerText = `− ${formatNumV5(excluidos)} excluidos del seguimiento`;
    document.getElementById('progModalFlujoElegibles').innerText = `${formatNumV5(elegible)} Universo elegible`;
    document.getElementById('progModalFlujoFinal').innerHTML = `<span style="color:#10b981">${formatNumV5(conRegistro)} con registro</span> | <span style="color:#f97316">${formatNumV5(rescateActivo)} sin registro (Rescate)</span>`;
    
    // Comunas
    const tbodyCom = document.getElementById('progModalTbodyComuna');
    tbodyCom.innerHTML = '';
    const sortedComunas = Object.entries(comunaTotals).sort((a, b) => b[1].rescates - a[1].rescates);
    for(const [com, vals] of sortedComunas) {
        const pct = vals.elegibles > 0 ? ((vals.rescates / vals.elegibles) * 100).toFixed(1) : "0.0";
        tbodyCom.innerHTML += `<tr><td>${com}</td><td style="text-align:right;">${formatNumV5(vals.elegibles)}</td><td style="text-align:right;">${formatNumV5(vals.rescates)}</td><td style="text-align:right;">${pct.replace('.', ',')} %</td></tr>`;
    }
    
    // Establecimientos (Top 10)
    const tbodyEstab = document.getElementById('progModalTbodyHospital');
    tbodyEstab.innerHTML = '';
    estabTotals.sort((a, b) => b.rescates - a.rescates);
    const top10 = estabTotals.slice(0, 10);
    for(const t of top10) {
        tbodyEstab.innerHTML += `<tr><td>${t.estab}</td><td style="text-align:right;">${t.comuna}</td><td style="text-align:right; font-weight:bold; color:#f97316;">${formatNumV5(t.rescates)}</td></tr>`;
    }
    if (estabTotals.length === 0) {
        tbodyEstab.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#64748b;">No hay rescates activos</td></tr>`;
    }
    
    // Excluidos
    const tbodyExc = document.getElementById('progModalTbodyExclusiones');
    tbodyExc.innerHTML = '';
    const sortedCausales = Object.entries(causales).sort((a, b) => b[1] - a[1]);
    for(const [c, v] of sortedCausales) {
        tbodyExc.innerHTML += `<tr><td>${c}</td><td style="text-align:right;">${formatNumV5(v)}</td></tr>`;
    }
    
    // Descarga
    const fileNames = {
        'hexa2': 'Rescates_Hexavalente_2_Pendientes_2026.xlsx',
        'hexa3': 'Rescates_Hexavalente_3_Pendientes_2026.xlsx',
        'neumo2': 'Rescates_Neumococica_2_Pendientes_2026.xlsx',
        'menb2': 'Rescates_Meningococica_B_2_Pendientes_2026.xlsx',
        'srp2': 'Rescates_SRP_2_Pendientes_2026.xlsx',
        'vari2': 'Rescates_Varicela_2_Pendientes_2026.xlsx'
    };
    const btnDescarga = document.getElementById('progModalDownloadBtn');
    btnDescarga.setAttribute('href', fileNames[prefix] || '#');
    document.getElementById('progModalDownloadTxt').innerText = `Descargar nómina de ${formatNumV5(rescateActivo)} casos`;
    
    // Mostrar
    document.getElementById('progModalBackdrop').style.display = 'block';
    document.getElementById('progModalWindow').style.display = 'block';
    document.body.style.overflow = 'hidden';
};

window.cerrarReporteProgramaticas = function() {
    document.getElementById('progModalBackdrop').style.display = 'none';
    document.getElementById('progModalWindow').style.display = 'none';
    document.body.style.overflow = 'auto';
};
"""

# Append or replace if already exists
if 'window.abrirReporteProgramaticas = function' in js_content:
    import re
    js_content = re.sub(r'window\.abrirReporteProgramaticas\s*=\s*function[\s\S]*?(?=\n\n|\Z)', new_logic.strip(), js_content)
else:
    js_content += '\n' + new_logic

with io.open(js_path, 'w', encoding='utf-8') as f:
    f.write(js_content)

print('JS function injected successfully!')
