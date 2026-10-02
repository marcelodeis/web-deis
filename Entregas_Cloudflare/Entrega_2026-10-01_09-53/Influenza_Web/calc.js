const fs = require('fs');
const d = JSON.parse(fs.readFileSync('dashboard_data_2026.json', 'utf8'));

let sumVac = 0;
let sumMeta = 0;

for(let r of d.data_residencia) { 
    sumVac += r.total; 
    let metaComuna = d.metas[r.comuna] ? (d.metas[r.comuna].Total || 0) : 0;
    sumMeta += metaComuna; 
    console.log(r.comuna + ': ' + r.total + ' / ' + metaComuna + ' (' + ((r.total/(metaComuna || 1))*100).toFixed(1) + '%)'); 
} 

console.log('Tot Vac: ' + sumVac); 
console.log('Tot Meta: ' + sumMeta); 
console.log('Cob Prov: ' + ((sumVac/sumMeta)*100).toFixed(1) + '%');
