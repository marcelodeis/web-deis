const fs = require('fs');
let code = fs.readFileSync('dashboard_data_2026.js', 'utf8');
let dashboardData = {};
eval(code.replace('const DASHBOARD_DATA_2026 =', 'dashboardData ='));

let isComuna = false;
let filter = 'all';

let dosisTotal1 = dashboardData.data_residencia.filter(d => isComuna ? d.comuna === filter : true)
                   .reduce((s, d) => s + d.total, 0);

let dosisTotal2 = dashboardData.data_residencia.filter(d => isComuna ? d.comuna === filter : true)
                   .reduce((s, d) => {
                       let validSum = 0;
                       Object.entries(d.datos).forEach(([g,v]) => {
                           if (g !== 'Otras prioridades') validSum += v;
                       });
                       return s + validSum;
                   }, 0);

console.log("Original dosisTotal:", dosisTotal1);
console.log("New dosisTotal (no otras prioridades):", dosisTotal2);

// Check currentBaseResi from window logic
let currentBaseResi = dashboardData.data_residencia; // default
console.log("currentBaseResi logic gives:", dosisTotal2);
