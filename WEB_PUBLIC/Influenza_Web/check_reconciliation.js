const fs = require('fs');

const data = JSON.parse(fs.readFileSync('dashboard_data_2026.json', 'utf8'));

// 1. Calcular el Universo Objetivo (Denominador)
let metasTotal = 0;
let metasCriterios = {};

if (data.metas) {
    for (const [comuna, meta] of Object.entries(data.metas)) {
        metasTotal += meta.Total;
        for (const [grupo, valor] of Object.entries(meta.Criterios || {})) {
            metasCriterios[grupo] = (metasCriterios[grupo] || 0) + valor;
        }
    }
}

console.log("=== DENOMINADOR (Universo Objetivo) ===");
console.log("Total General (Suma de metas.Total):", metasTotal);
console.log("Desglose por Criterio:");
let sumaDesgloseMetas = 0;
for (const [grupo, valor] of Object.entries(metasCriterios)) {
    console.log(`  - ${grupo}: ${valor}`);
    sumaDesgloseMetas += valor;
}
console.log("Suma del desglose de criterios:", sumaDesgloseMetas);

// 2. Calcular los Vacunados (Numerador)
// De script.js:
// const targetDosesSum = data.reduce((s, i) => {
//     let validSum = 0;
//     Object.entries(i.datos).forEach(([g,v]) => {
//         if (g !== 'Otras prioridades') validSum += v;
//     });
//     return s + validSum;
// }, 0);

let numeradorTotal = 0;
let numeradorTotalConOtrasPrioridades = 0;
let vacunadosCriterios = {};

if (data.data_residencia) {
    for (const item of data.data_residencia) {
        for (const [grupo, valor] of Object.entries(item.datos)) {
            vacunadosCriterios[grupo] = (vacunadosCriterios[grupo] || 0) + valor;
            numeradorTotalConOtrasPrioridades += valor;
            if (grupo !== 'Otras prioridades') {
                numeradorTotal += valor;
            }
        }
    }
}

console.log("\n=== NUMERADOR (Vacunados) ===");
console.log("Desglose por Criterio:");
for (const [grupo, valor] of Object.entries(vacunadosCriterios)) {
    console.log(`  - ${grupo}: ${valor}`);
}
console.log("Total General (incluyendo 'Otras prioridades'):", numeradorTotalConOtrasPrioridades);
console.log("Numerador Calculado (EXCLUYENDO 'Otras prioridades'):", numeradorTotal);
