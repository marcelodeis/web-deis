const fs = require('fs');

const js = fs.readFileSync('c:/Antigravity IDE/WEB DEIS/Influenza_Web/autoconsulta.js', 'utf8');

// Mock DOM
global.document = {
    getElementById: (id) => ({
        style: {},
        innerHTML: '',
        value: '',
        appendChild: () => {},
        classList: { add: () => {}, remove: () => {} },
        getContext: () => ({}),
        addEventListener: () => {}
    }),
    createElement: () => ({
        style: {},
        innerHTML: '',
        getContext: () => ({}),
        appendChild: () => {}
    })
};
global.window = {
    location: { href: 'http://localhost/influenza' }
};

// Evaluate the script to get Autoconsulta
let Autoconsulta;
try {
    eval(js);
} catch (e) {
    console.error("Eval error:", e);
    process.exit(1);
}

Autoconsulta._state = {
    results: {
        totalRecibidos: 100,
        total: 100,
        si: 80,
        no: 20,
        vacios: 0,
        pctSi: '80.0',
        pctNo: '20.0',
        columnaDetectada: 'RUT',
        statsComunas: {
            'Osorno': {
                'Centro A': { si: 40, no: 10, causales: {'SIN REGISTRO / CAUSAL NO ESPECIFICADA': 5} },
                'Centro B': { si: 40, no: 10, causales: {'SIN REGISTRO / CAUSAL NO ESPECIFICADA': 5} }
            }
        },
        duplicados: 0,
        invalidos: 0,
        cohorteFinal: 100
    },
    chartData: null
};

// Mock Chart
global.Chart = class { constructor() {} };

try {
    Autoconsulta.showResults();
    console.log("SUCCESS! No crash in showResults.");
} catch (e) {
    console.error("CRASH in showResults:", e.stack);
}
