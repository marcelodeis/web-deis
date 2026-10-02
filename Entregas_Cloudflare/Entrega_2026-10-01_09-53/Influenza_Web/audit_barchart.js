const fs = require('fs');
const d = JSON.parse(fs.readFileSync('dashboard_data_2026.json', 'utf8'));

const comunasTest = ['Osorno', 'Puerto Octay', 'Purranque'];

function isGrupoElegibleParaCobertura(g) {
    return g !== 'Estrategia Capullo' && g !== 'Población general' && g !== 'Poblacion general';
}

console.log("=== AUDITORIA NAN RENDERBARCHART ===\n");

comunasTest.forEach(c => {
    console.log(`\n--- Comuna: ${c} ---`);
    
    // 1. Estructura original de datos
    const items = d.data_ocurrencia.filter(i => i.comuna === c);
    console.log("Muestra de estructura original (1er establecimiento):");
    if(items.length > 0) {
        const sample = items[0].datos['Personas mayores de 60 años y más (año 1966)'];
        console.log(`Grupo 'Personas mayores...':`, sample);
        console.log(`Tipo de dato recibido ('v'):`, typeof sample);
    }
    
    // 2. Suma obtenida (simulando el error actual)
    const totalVacErroneo = items.reduce((s, i) => {
        let validSum = 0;
        if (i.datos) {
            Object.entries(i.datos).forEach(([g,v]) => {
                if (isGrupoElegibleParaCobertura(g)) validSum += v;
            });
        }
        return s + validSum;
    }, 0);
    console.log(`Suma obtenida (Código Actual - ERRÓNEO): ${totalVacErroneo}`);
    
    // 3. Suma corregida
    const totalVacCorrecto = items.reduce((s, i) => {
        let validSum = 0;
        if (i.datos) {
            Object.entries(i.datos).forEach(([g,v]) => {
                if (isGrupoElegibleParaCobertura(g)) {
                    if (typeof v === 'object' && v !== null) {
                        validSum += Object.values(v).reduce((a, b) => a + b, 0);
                    } else {
                        validSum += v;
                    }
                }
            });
        }
        return s + validSum;
    }, 0);
    console.log(`Suma corregida (Numerador Real Ocurrencia): ${totalVacCorrecto}`);
    
    // 4. Denominador utilizado
    const meta = d.metas[c] ? d.metas[c].Total : 0;
    console.log(`Denominador utilizado (getMetaTotal): ${meta}`);
    
    // 5. Valor porcentual
    const pctErroneo = meta > 0 ? (totalVacErroneo / meta) * 100 : 0;
    const pctCorrecto = meta > 0 ? (totalVacCorrecto / meta) * 100 : 0;
    console.log(`Valor porcentual actual en UI: ${pctErroneo}% (esto es lo que causa NaN)`);
    console.log(`Valor porcentual final esperado: ${pctCorrecto.toFixed(1)}%`);
});
