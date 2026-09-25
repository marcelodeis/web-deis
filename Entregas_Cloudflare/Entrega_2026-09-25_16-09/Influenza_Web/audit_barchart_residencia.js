const fs = require('fs');
const d = JSON.parse(fs.readFileSync('dashboard_data_2026.json', 'utf8'));

function isGrupoElegibleParaCobertura(g) {
    return g !== 'Estrategia Capullo' && g !== 'Población general' && g !== 'Poblacion general';
}

console.log("=== VALIDACIÓN RENDERBARCHART (BASE RESIDENCIA) ===\n");

const data = d.data_residencia;
const coms = [...new Set(data.map(i => i.comuna))];

coms.forEach(c => {
    const meta = d.metas[c] ? d.metas[c].Total : 0;
    const totalVac = data.filter(i => i.comuna === c).reduce((s, i) => {
        let validSum = 0;
        if (i.datos) {
            Object.entries(i.datos).forEach(([g,v]) => {
                if (isGrupoElegibleParaCobertura(g)) validSum += v;
            });
        }
        return s + validSum;
    }, 0);
    
    const pct = meta > 0 ? (totalVac / meta) * 100 : 0;
    
    console.log(`Comuna: ${c.padEnd(20)} | Numerador: ${String(totalVac).padEnd(6)} | Denominador: ${String(meta).padEnd(6)} | Cobertura: ${pct.toFixed(1)}%`);
});
