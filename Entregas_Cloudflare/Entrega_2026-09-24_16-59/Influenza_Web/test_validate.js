const fs = require('fs');

const d = JSON.parse(fs.readFileSync('temp_regen/dashboard_data_2026.json', 'utf8'));

// 1. Otras prioridades
let otrasP = 0;
let pobGen = 0;
d.data_residencia.forEach(c => {
    otrasP += c.datos['Otras prioridades'] || 0;
    pobGen += c.datos['Población general'] || c.datos['Poblacion general'] || 0;
});
let metaOtras = 0;
Object.values(d.metas).forEach(m => {
    metaOtras += m.Criterios['Otras prioridades'] || 0;
});
const pctOtras = metaOtras > 0 ? (otrasP / metaOtras) * 100 : 0;

// Numerador y Denominador provincial
let numProv = 0;
let metaProv = 0;

// function isGrupoElegibleParaCobertura
const GRUPOS_EXCLUIDOS_NUMERADOR = ['Población general', 'Poblacion general'];
d.data_residencia.forEach(c => {
    Object.entries(c.datos).forEach(([g, v]) => {
        if (!GRUPOS_EXCLUIDOS_NUMERADOR.includes(g)) {
            numProv += v;
        }
    });
});

Object.values(d.metas).forEach(m => {
    metaProv += m.Total || 0;
});

const coberturaFinal = (numProv / metaProv) * 100;
const meta85 = Math.round(metaProv * 0.85);
const brechaAbs = meta85 - numProv;

console.log("=== VALIDACIONES REQUERIDAS ===");
console.log(`Otras prioridades: ${otrasP} vacunados / ${metaOtras} meta = ${pctOtras.toFixed(1)}%`);
console.log(`Poblacion general: ${pobGen} registros`);
console.log(`Numerador programatico: ${numProv}`);
console.log(`Denominador: ${metaProv}`);
console.log(`Cobertura final: ${coberturaFinal.toFixed(1)}%`);
console.log(`Brecha absoluta 85%: ${brechaAbs} personas`);

// Avance semanal ultimo punto
const seData = d.avance_semanal['TOTAL_PROVINCIAL'];
const maxSe = Math.max(...Object.keys(seData).map(Number));
let sumSe = 0;
for(let i=9; i<=maxSe; i++) {
    sumSe += seData[i] || 0;
}
console.log(`Numerador Avance Semanal (suma SE): ${sumSe}`);
