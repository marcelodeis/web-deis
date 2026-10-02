const fs = require('fs');
let code = fs.readFileSync('dashboard_data_2026.js', 'utf8'); // or whatever year
let script = fs.readFileSync('script.js', 'utf8');

// I'll just check if dashboard_data_2026.js exists, if not use 2025
let filename = fs.existsSync('dashboard_data_2026.js') ? 'dashboard_data_2026.js' : 'dashboard_data_2025.js';
code = fs.readFileSync(filename, 'utf8');
eval(code);

let varName = filename === 'dashboard_data_2026.js' ? DASHBOARD_DATA_2026 : DASHBOARD_DATA_2025;

let firstComuna = varName.data_residencia[0];
let sumDatos = 0;
for (let g in firstComuna.datos) {
    if (g !== 'Otras prioridades') sumDatos += firstComuna.datos[g];
}
let sumAll = 0;
for (let g in firstComuna.datos) sumAll += firstComuna.datos[g];

console.log("Comuna:", firstComuna.comuna);
console.log("Total property:", firstComuna.total);
console.log("Sum all datos:", sumAll);
console.log("Sum valid datos:", sumDatos);
console.log("Otras prioridades:", firstComuna.datos['Otras prioridades']);
