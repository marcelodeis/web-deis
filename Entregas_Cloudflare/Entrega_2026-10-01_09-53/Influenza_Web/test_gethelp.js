const fs = require('fs');
let code = fs.readFileSync('script.js', 'utf8');

// Mock DOM
global.document = {
    getElementById: (id) => {
        if (id === 'globalComunaFilter') return { value: 'all', options: [], selectedIndex: -1 };
        return null;
    }
};
global.window = {};
global.dashboardData = {
    data_residencia: [ {comuna: 'Osorno', total: 100, datos: {}} ],
    metas: { Osorno: {Total: 200, Criterios: {}} }
};
global.charts = {};

eval(code);

try {
    const data = getHelpTextData('global');
    console.log(data);
} catch (e) {
    console.error("ERROR CAUGHT:");
    console.error(e);
}
