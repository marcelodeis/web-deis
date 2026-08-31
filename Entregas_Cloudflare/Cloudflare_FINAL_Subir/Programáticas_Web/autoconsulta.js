/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   AUTOCONSULTA DE ESTADO DE VACUNACIÓN - PROGRAMÁTICAS         ║
 * ║   Módulo de cruce de RUNs en navegador                         ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

function calcularDvChile(cuerpoNumerico) {
    try {
        let suma = 0;
        let multiplicador = 2;
        for (let i = cuerpoNumerico.length - 1; i >= 0; i--) {
            suma += parseInt(cuerpoNumerico[i], 10) * multiplicador;
            multiplicador = multiplicador < 7 ? multiplicador + 1 : 2;
        }
        const resto = 11 - (suma % 11);
        if (resto === 11) return '0';
        if (resto === 10) return 'k';
        return String(resto);
    } catch (e) {
        return '?';
    }
}

function normalizarRunSinDv(val) {
    if (val === null || val === undefined) return '';
    let s = String(val).trim().toLowerCase()
        .replace(/\./g, '')
        .replace(/-/g, '')
        .replace(/\s/g, '');
    if (!s) return '';
    if (s.endsWith('k')) return s.slice(0, -1);
    if (/^\d+$/.test(s)) {
        if (s.length <= 1) return s;
        const cuerpoCandidato = s.slice(0, -1);
        const dvCandidato = s.slice(-1);
        const dvEsperado = calcularDvChile(cuerpoCandidato);
        if (dvCandidato === dvEsperado) return cuerpoCandidato;
        return s; // asume que no tenía DV y era todo cuerpo
    }
    return s;
}

function detectarColumnaRun(headers) {
    const keywords = ['run', 'rut', 'rutificado', 'rún', 'r.u.n', 'r.u.t'];
    for (let i = 0; i < headers.length; i++) {
        const h = String(headers[i]).trim().toLowerCase();
        for (const kw of keywords) {
            if (h === kw || h.includes(kw)) return i;
        }
    }
    return -1;
}

const Autoconsulta = {
    _state: {
        originalWorkbook: null,
        processedWorkbook: null,
        fileName: '',
        results: null
    },

    init() {
        const modal = document.getElementById('autoconsultaModal');
        const btnOpen = document.getElementById('btnOpenAutoconsulta');
        const btnClose = document.getElementById('btnCloseAutoconsulta');
        
        if (btnOpen && modal) {
            btnOpen.addEventListener('click', (e) => {
                e.preventDefault();
                modal.classList.add('show');
            });
        }
        if (btnClose && modal) {
            btnClose.addEventListener('click', () => modal.classList.remove('show'));
        }

        const dropZone = document.getElementById('autoconsultaDropZone');
        const fileInput = document.getElementById('autoconsultaFileInput');
        const btnDownload = document.getElementById('autoconsultaBtnDownload');
        const btnReset = document.getElementById('autoconsultaBtnReset');

        if (!dropZone || !fileInput) return;

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) this.processFile(e.dataTransfer.files[0]);
        });
        dropZone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) this.processFile(e.target.files[0]);
        });
        if (btnDownload) btnDownload.addEventListener('click', () => this.downloadResult());
        if (btnReset) btnReset.addEventListener('click', () => this.reset());
    },

    showProgress(msg, percentage) {
        document.getElementById('autoconsultaDropZone').style.display = 'none';
        document.getElementById('autoconsultaProgress').style.display = 'block';
        document.getElementById('autoconsultaResults').style.display = 'none';
        
        document.getElementById('autoconsultaProgressText').innerHTML = msg;
        document.getElementById('autoconsultaProgressBar').style.width = percentage + '%';
    },

    updateProgress(percentage, msg) {
        document.getElementById('autoconsultaProgressBar').style.width = percentage + '%';
        if (msg) document.getElementById('autoconsultaProgressText').innerHTML = msg;
    },

    showError(msg) {
        alert(msg);
        this.reset();
    },

    showResults(stats) {
        document.getElementById('autoconsultaProgress').style.display = 'none';
        document.getElementById('autoconsultaResults').style.display = 'block';
        document.getElementById('acTotalProcesados').innerText = stats.total;
        document.getElementById('acTotalVacunados').innerText = stats.vacunados;
    },

    reset() {
        this._state.originalWorkbook = null;
        this._state.processedWorkbook = null;
        this._state.fileName = '';
        this._state.results = null;
        
        document.getElementById('autoconsultaFileInput').value = '';
        document.getElementById('autoconsultaDropZone').style.display = 'block';
        document.getElementById('autoconsultaProgress').style.display = 'none';
        document.getElementById('autoconsultaResults').style.display = 'none';
    },

    processFile(file) {
        if (!window.PROGRAMATICAS_RUNS_INDEX) {
            this.showError("El índice de vacunas no ha cargado. Por favor asegúrese de tener programaticas_runs_index.js vinculado.");
            return;
        }

        const validExtensions = ['.xlsx', '.xls', '.xlsm', '.csv'];
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        if (!validExtensions.includes(ext)) {
            this.showError('El archivo debe ser un Excel (.xlsx, .xls) o CSV');
            return;
        }

        this._state.fileName = file.name;
        this.showProgress('Leyendo archivo... <i class="fas fa-spinner fa-spin"></i>', 10);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.updateProgress(30, 'Analizando celdas...');
                setTimeout(() => this._procesarWorkbook(e.target.result), 50);
            } catch (err) {
                this.showError('Error al leer: ' + err.message);
            }
        };
        reader.onerror = () => this.showError('Error al leer el archivo.');
        reader.readAsArrayBuffer(file);
    },

    _procesarWorkbook(arrayBuffer) {
        let workbook;
        try {
            workbook = XLSX.read(arrayBuffer, { type: 'array' });
        } catch (e) {
            this.showError('Error al decodificar Excel. Necesita SheetJS (XLSX). Detalle: ' + (e.message || e));
            return;
        }

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        if (!sheet || !sheet['!ref']) {
            this.showError('El Excel está vacío.');
            return;
        }

        // Leer como array 2D
        let data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        if (data.length < 1) {
            this.showError('El Excel no tiene datos.');
            return;
        }

        const headers = data[0];
        const colRunIndex = detectarColumnaRun(headers);
        if (colRunIndex === -1) {
            this.showError('No se encontró ninguna columna llamada RUN, RUT, o similar.');
            return;
        }

        this.updateProgress(60, 'Cruzando RUNs con base Programáticas... <i class="fas fa-cogs"></i>');

        setTimeout(() => {
            // Fase 1: Identificar todas las vacunas únicas que existen para ESTOS RUNs
            const vacunasEncontradas = new Set();
            for (let i = 1; i < data.length; i++) {
                const runRaw = data[i][colRunIndex];
                const runNorm = normalizarRunSinDv(runRaw);
                const vacunas = window.PROGRAMATICAS_RUNS_INDEX[runNorm];
                if (vacunas) {
                    Object.keys(vacunas).forEach(v => vacunasEncontradas.add(v));
                }
            }

            const vacunasList = Array.from(vacunasEncontradas).sort();

            // Fase 2: Expandir cabeceras "Hacia la derecha"
            vacunasList.forEach(vac => {
                headers.push(vac);
                headers.push(`${vac} - Dosis`);
            });

            // Fase 3: Llenar los datos
            let countVacunados = 0;
            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                const runRaw = row[colRunIndex];
                const runNorm = normalizarRunSinDv(runRaw);
                const vacunas = window.PROGRAMATICAS_RUNS_INDEX[runNorm];
                
                if (vacunas) {
                    countVacunados++;
                }

                // Por cada vacuna encontrada, agregar columnas a esta fila
                vacunasList.forEach(vac => {
                    if (vacunas && vacunas[vac]) {
                        row.push("SI");
                        row.push(vacunas[vac]); // Ej: "1ra, 2da"
                    } else {
                        row.push("NO");
                        row.push("");
                    }
                });
            }

            this.updateProgress(90, 'Generando archivo de salida...');

            setTimeout(() => {
                const newWs = XLSX.utils.aoa_to_sheet(data);
                
                // Aplicar estilos a las celdas grises (cabeceras nuevas)
                const originalHeadersLen = headers.length - (vacunasList.length * 2);
                
                if (typeof XLSX.utils.decode_cell !== "undefined") {
                    for (let c = originalHeadersLen; c < headers.length; c++) {
                        const cellRef = XLSX.utils.encode_cell({ r: 0, c: c });
                        if (newWs[cellRef]) {
                            newWs[cellRef].s = {
                                fill: { fgColor: { rgb: "404040" } },
                                font: { color: { rgb: "FFFFFF" }, bold: true },
                                alignment: { horizontal: "center" }
                            };
                        }
                        
                        // Aplicar relleno gris claro a las columnas de vacunas desde fila 2
                        if (headers[c] && typeof headers[c] === 'string' && !headers[c].includes(' - Dosis')) {
                            for (let r = 1; r < data.length; r++) {
                                const dataCellRef = XLSX.utils.encode_cell({ r: r, c: c });
                                if (newWs[dataCellRef]) {
                                    newWs[dataCellRef].s = {
                                        fill: { fgColor: { rgb: "F2F2F2" } }
                                    };
                                }
                            }
                        }
                    }
                }

                const newWb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(newWb, newWs, "Cruce Programáticas");
                
                this._state.processedWorkbook = newWb;
                this.showResults({
                    total: data.length - 1,
                    vacunados: countVacunados
                });

            }, 50);
        }, 50);
    },

    downloadResult() {
        if (!this._state.processedWorkbook) return;
        const nameParts = this._state.fileName.split('.');
        nameParts.pop(); 
        const base = nameParts.join('.');
        
        const outName = `${base}_CRUCE_PROGRAMATICAS.xlsx`;
        XLSX.writeFile(this._state.processedWorkbook, outName);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Autoconsulta.init();
});
