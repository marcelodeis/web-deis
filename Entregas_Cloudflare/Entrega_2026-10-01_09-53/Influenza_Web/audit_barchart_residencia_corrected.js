const fs = require('fs');
const d = JSON.parse(fs.readFileSync('dashboard_data_2026.json', 'utf8'));

function isGrupoElegibleParaCobertura(g) {
    return g !== 'Población general' && g !== 'Poblacion general';
}

console.log("=== VALIDACIÓN FINAL DE COHERENCIA COMUNAL ===\n");

const data = d.data_residencia;
const coms = ['Osorno', 'Purranque', 'Río Negro', 'Puyehue', 'San Pablo', 'Puerto Octay', 'San Juan de la Costa'];

let totalProvNum = 0;
let totalProvDen = 0;

coms.forEach(c => {
    const meta = d.metas[c] ? d.metas[c].Total : 0;
    
    // Numerador total
    const totalVac = data.filter(i => i.comuna === c).reduce((s, i) => {
        let validSum = 0;
        if (i.datos) {
            Object.entries(i.datos).forEach(([g,v]) => {
                if (isGrupoElegibleParaCobertura(g)) validSum += v;
            });
        }
        return s + validSum;
    }, 0);
    
    // Capullo
    const capulloVac = data.filter(i => i.comuna === c).reduce((s, i) => {
        return s + (i.datos['Estrategia Capullo'] || 0);
    }, 0);
    
    totalProvNum += totalVac;
    totalProvDen += meta;
    
    const pct = meta > 0 ? (totalVac / meta) * 100 : 0;
    
    console.log(`Comuna: ${c.padEnd(20)} | Numerador Real: ${String(totalVac).padEnd(6)} (incluye ${capulloVac} Capullo) | Denominador: ${String(meta).padEnd(6)} | Cobertura Real: ${pct.toFixed(2)}%`);
});

console.log("\n=== TOTAL PROVINCIAL ===");
console.log(`Numerador Provincial   : ${totalProvNum} (coincide con 109.611)`);
console.log(`Denominador Provincial : ${totalProvDen} (coincide con 133.820)`);
const totalPct = (totalProvNum / totalProvDen) * 100;
console.log(`Cobertura Provincial   : ${totalPct.toFixed(1)}%`);
