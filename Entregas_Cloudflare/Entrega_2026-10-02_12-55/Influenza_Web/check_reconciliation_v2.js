const fs = require('fs');

const data = JSON.parse(fs.readFileSync('dashboard_data_2026.json', 'utf8'));

function isGrupoElegibleParaCobertura(grupo) {
    if (!grupo) return false;
    const lowerGroup = grupo.toLowerCase();
    if (lowerGroup === 'poblacion general' || lowerGroup === 'población general') {
        return false;
    }
    return true;
}

// 1. Calcular el Universo Objetivo (Denominador)
let metasTotal = 0;

if (data.metas) {
    for (const [comuna, meta] of Object.entries(data.metas)) {
        metasTotal += meta.Total;
    }
}

// 2. Calcular los Vacunados (Numerador)
const totalV = data.data_residencia.reduce((s, i) => s + (i.total || 0), 0); // Dosis totales administradas

const targetDosesSum = data.data_residencia.reduce((s, i) => {
    let validSum = 0;
    Object.entries(i.datos).forEach(([g,v]) => {
        if (isGrupoElegibleParaCobertura(g)) validSum += v;
    });
    return s + validSum;
}, 0);

console.log("=== CONCILIACIÓN FINAL ===");
console.log("Numerador (targetDosesSum):", targetDosesSum);
console.log("Denominador (metasTotal):", metasTotal);
console.log("Cobertura (%):", ((targetDosesSum / metasTotal) * 100).toFixed(1) + "%");
console.log("Meta absoluta 85%:", Math.ceil(metasTotal * 0.85));
console.log("Brecha absoluta a 85%:", Math.max(0, Math.ceil(metasTotal * 0.85) - targetDosesSum));
