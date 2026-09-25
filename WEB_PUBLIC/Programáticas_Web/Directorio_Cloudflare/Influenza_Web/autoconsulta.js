/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   AUTOCONSULTA DE ESTADO DE VACUNACIÓN - INFLUENZA             ║
 * ║   Módulo de cruce de RUNs en navegador                         ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Lee un Excel subido por el usuario, normaliza los RUNs,
 * cruza contra INFLUENZA_RUNS_INDEX (Set pre-generado),
 * y genera un Excel de salida con columna INFLUENZA (SI/NO).
 *
 * Dependencias:
 *   - SheetJS (xlsx-js-style) — ya cargado en el proyecto
 *   - influenza_runs_index.js — Set con RUNs vacunados
 */

// ══════════════════════════════════════════════════════════════════
//  NORMALIZACIÓN DE RUN (port del algoritmo Python módulo 11)
// ══════════════════════════════════════════════════════════════════

/**
 * Calcula el dígito verificador (DV) oficial de un RUN chileno.
 * Algoritmo módulo 11 con multiplicadores 2-7 en ciclo.
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

/**
 * Normaliza un RUN chileno extrayendo SIEMPRE el cuerpo sin DV.
 * Maneja: 12.345.678-9, 12345678-9, 123456789, 12345678, con K, espacios, etc.
 */
function normalizarRunSinDv(val) {
    if (val === null || val === undefined) return '';

    let s = String(val).trim().toLowerCase()
        .replace(/\./g, '')
        .replace(/-/g, '')
        .replace(/\s/g, '');

    if (!s) return '';

    // Caso 1: termina en 'k' → definitivamente tiene DV
    if (s.endsWith('k')) {
        return s.slice(0, -1);
    }

    // Caso 2: todo numérico
    if (/^\d+$/.test(s)) {
        if (s.length <= 1) return s;

        const cuerpoCandidato = s.slice(0, -1);
        const dvCandidato = s.slice(-1);
        const dvEsperado = calcularDvChile(cuerpoCandidato);

        if (dvCandidato === dvEsperado) {
            return cuerpoCandidato;
        } else {
            return s;
        }
    }

    // Caso 3: caracteres inesperados
    return s;
}


// ══════════════════════════════════════════════════════════════════
//  DETECCIÓN AUTOMÁTICA DE COLUMNA RUN
// ══════════════════════════════════════════════════════════════════

/**
 * Busca en los headers del Excel la columna que contiene RUNs.
 * Retorna el índice de la columna o -1 si no la encuentra.
 */
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


// ══════════════════════════════════════════════════════════════════
//  MÓDULO PRINCIPAL DE AUTOCONSULTA
// ══════════════════════════════════════════════════════════════════

const Autoconsulta = {
    /**
     * Estado interno del módulo
     */
    _state: {
        originalWorkbook: null,
        processedWorkbook: null,
        fileName: '',
        results: null
    },

    /**
     * Inicializa los event listeners del módulo.
     * Llamar una sola vez en DOMContentLoaded.
     */
    init() {
        const dropZone = document.getElementById('autoconsultaDropZone');
        const fileInput = document.getElementById('autoconsultaFileInput');
        const btnDownload = document.getElementById('autoconsultaBtnDownload');
        const btnReset = document.getElementById('autoconsultaBtnReset');

        if (!dropZone || !fileInput) return;

        // Drag & Drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0) this.processFile(files[0]);
        });

        // Click en zona de drop
        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        // Input file change
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.processFile(e.target.files[0]);
            }
        });

        // Botón descargar
        if (btnDownload) {
            btnDownload.addEventListener('click', () => this.downloadResult());
        }

        // Botón reiniciar
        if (btnReset) {
            btnReset.addEventListener('click', () => this.reset());
        }
    },

    /**
     * Procesa el archivo Excel subido por el usuario.
     */
    processFile(file) {
        // Validar tamaño (máximo 150MB para evitar que el navegador se quede sin memoria)
        const maxSize = 150 * 1024 * 1024; // 150MB
        if (file.size > maxSize) {
            this.showError('El archivo es demasiado grande (máximo 150MB). Por favor divida su Excel para consultarlo. El error "out of memory" se produce al intentar cargar archivos gigantes en el navegador.');
            return;
        }

        // Validar extensión
        const validExtensions = ['.xlsx', '.xls', '.xlsm'];
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        if (!validExtensions.includes(ext)) {
            this.showError('El archivo debe ser un Excel (.xlsx, .xls, .xlsm)');
            return;
        }

        this._state.fileName = file.name;
        this.showProgress('Leyendo archivo de su computadora... <i class="fas fa-mug-hot"></i>', 5);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.updateProgress(15, 'Analizando celdas del Excel... (Esto puede tomar unos segundos)');
                setTimeout(() => {
                    this._procesarWorkbook(e.target.result);
                }, 100);
            } catch (err) {
                console.error("Error en onload:", err);
                const msg = err.message || (typeof err === 'string' ? err : JSON.stringify(err));
                this.showError('Error al leer el archivo: ' + msg);
            }
        };

        reader.onerror = () => {
            this.showError('Error al leer el archivo. Intente nuevamente.');
        };

        reader.readAsArrayBuffer(file);
    },

    /**
     * Procesa el workbook internamente.
     */
    _procesarWorkbook(arrayBuffer) {
        let workbook;
        try {
            workbook = XLSX.read(arrayBuffer, { type: 'array' });
        } catch(e) {
            this.showError('Error al decodificar el Excel. El archivo podría estar corrupto o usar un formato no soportado.');
            return;
        }

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        if (!sheet || !sheet['!ref']) {
            this.showError('El archivo Excel está vacío.');
            return;
        }

        // Recalcular la última fila real (ignorar filas vacías al final de la hoja)
        // En lugar de iterar un millón de filas, escaneamos solo las celdas que realmente existen
        const range = XLSX.utils.decode_range(sheet['!ref']);
        let trueEndRow = range.s.r;
        for (const key of Object.keys(sheet)) {
            if (key.startsWith('!')) continue;
            
            const cellRef = XLSX.utils.decode_cell(key);
            if (cellRef.r > trueEndRow) {
                const cell = sheet[key];
                if (cell && cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== '') {
                    trueEndRow = cellRef.r;
                }
            }
        }
        range.e.r = trueEndRow; // Ajustar el final real de los datos

        if (range.e.r === range.s.r) {
            this.showError('El archivo no tiene datos suficientes (solo 1 fila).');
            return;
        }

        // Detectar columna RUN
        let runColIdx = -1;
        let detectedHeader = '';
        const keywords = ['run', 'rut', 'rutificado', 'rún', 'r.u.n', 'r.u.t'];

        for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = sheet[XLSX.utils.encode_cell({r: range.s.r, c: c})];
            if (cell && cell.v) {
                const headerText = String(cell.v).toLowerCase().trim();
                if (keywords.some(kw => headerText.includes(kw))) {
                    runColIdx = c;
                    detectedHeader = String(cell.v);
                    break;
                }
            }
        }

        if (runColIdx === -1) {
            // Si no detecta RUT/RUN, usa la primera columna por defecto
            runColIdx = range.s.c;
            const fallbackCell = sheet[XLSX.utils.encode_cell({r: range.s.r, c: runColIdx})];
            detectedHeader = fallbackCell ? String(fallbackCell.v) : 'Columna A';
        }

        this.updateProgress(30, `Columna detectada: "${detectedHeader}". Iniciando cruce de datos...`);

        // Detectar columnas de comuna, centro y causales de rechazo
        let comunaColIdx = -1;
        let centroColIdx = -1;
        let rechazoColIdx = -1;
        const keywordsComuna = ['nombre_comuna', 'comuna'];
        const keywordsCentro = ['nombre_centro', 'centro', 'establecimiento', 'nombre establecimiento'];
        const keywordsRechazo = ['causal', 'rechazo', 'motivo', 'causa', 'observacion'];

        for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = sheet[XLSX.utils.encode_cell({r: range.s.r, c: c})];
            if (cell && cell.v) {
                const headerText = String(cell.v).toLowerCase().trim();
                if (keywordsComuna.includes(headerText) && comunaColIdx === -1) comunaColIdx = c;
                if (keywordsCentro.includes(headerText) && centroColIdx === -1) centroColIdx = c;
                if (keywordsRechazo.some(kw => headerText.includes(kw)) && rechazoColIdx === -1) rechazoColIdx = c;
            }
        }
        
        // Estructura para almacenar estadísticas
        const statsComunas = {};
    

        // Verificar índice
        if (typeof INFLUENZA_RUNS_INDEX === 'undefined') {
            this.showError('El índice de vacunación no está disponible. Contacte al administrador del sistema.');
            return;
        }

        // Crear header de INFLUENZA
        const newColIdx = range.e.c + 1;
        const headerCellRef = XLSX.utils.encode_cell({r: range.s.r, c: newColIdx});
        sheet[headerCellRef] = { t: 's', v: 'INFLUENZA' };

        // Estilos para la cabecera (solo funcionarán con js-style)
        sheet[headerCellRef].s = {
            font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
            fill: { fgColor: { rgb: '0F69B4' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: {
                top: { style: 'thin', color: { rgb: '000000' } },
                bottom: { style: 'thin', color: { rgb: '000000' } },
                left: { style: 'thin', color: { rgb: '000000' } },
                right: { style: 'thin', color: { rgb: '000000' } }
            }
        };

        
        let colRechazosSiNo = -1;
        let colCausalText = -1;
        if (rechazoColIdx !== -1) {
            colRechazosSiNo = newColIdx + 1;
            colCausalText = newColIdx + 2;
            
            const headerRechazosRef = XLSX.utils.encode_cell({r: range.s.r, c: colRechazosSiNo});
            sheet[headerRechazosRef] = { t: 's', v: 'RECHAZOS' };
            sheet[headerRechazosRef].s = sheet[headerCellRef].s;

            const headerCausalRef = XLSX.utils.encode_cell({r: range.s.r, c: colCausalText});
            sheet[headerCausalRef] = { t: 's', v: 'Causal de Rechazo' };
            sheet[headerCausalRef].s = sheet[headerCellRef].s;
        }

        let siCount = 0;
        let noCount = 0;
        let vaciosCount = 0;
        let duplicadosCount = 0;
        let invalidosCount = 0;
        const seenRuns = new Set();

        let currentRow = range.s.r + 1;
        const totalDataRows = range.e.r - range.s.r;
        const batchSize = 25000; // Chunk gigante ya que la operación es muy ligera

        const procesarLote = () => {
            try {
                const end = Math.min(currentRow + batchSize, range.e.r + 1);
                
                for (; currentRow < end; currentRow++) {
                    const runCell = sheet[XLSX.utils.encode_cell({r: currentRow, c: runColIdx})];
                    const rawRun = runCell ? runCell.v : '';
                    const runStr = String(rawRun || '').trim();

                    let result = 'NO';

                    let esValidoYUnico = false;
                    if (!runStr) {
                        vaciosCount++;
                        invalidosCount++;
                    } else {
                        const runNorm = normalizarRunSinDv(runStr);
                        if (!runNorm || !/^\d+$/.test(runNorm)) {
                            invalidosCount++;
                        } else if (seenRuns.has(runNorm)) {
                            duplicadosCount++;
                            if (INFLUENZA_RUNS_INDEX.has(runNorm)) {
                                result = 'SI';
                            }
                        } else {
                            seenRuns.add(runNorm);
                            esValidoYUnico = true;
                            if (INFLUENZA_RUNS_INDEX.has(runNorm)) {
                                result = 'SI';
                                siCount++;
                            } else {
                                noCount++;
                            }
                        }
                    }

                    
                    if (esValidoYUnico && comunaColIdx !== -1 && centroColIdx !== -1) {
                        const cellComuna = sheet[XLSX.utils.encode_cell({r: currentRow, c: comunaColIdx})];
                        const cellCentro = sheet[XLSX.utils.encode_cell({r: currentRow, c: centroColIdx})];
                        
                        const valComuna = cellComuna && cellComuna.v ? String(cellComuna.v).trim().toUpperCase() : 'SIN COMUNA';
                        const valCentro = cellCentro && cellCentro.v ? String(cellCentro.v).trim().toUpperCase() : 'SIN CENTRO';
                        
                        if (!statsComunas[valComuna]) statsComunas[valComuna] = {};
                        if (!statsComunas[valComuna][valCentro]) statsComunas[valComuna][valCentro] = { si: 0, no: 0, causales: {} };
                        
                        if (result === 'SI') {
                            statsComunas[valComuna][valCentro].si++;
                        } else {
                            statsComunas[valComuna][valCentro].no++;
                            
                            let causalText = 'SIN REGISTRO / CAUSAL NO ESPECIFICADA';
                            if (rechazoColIdx !== -1) {
                                const cellRechazo = sheet[XLSX.utils.encode_cell({r: currentRow, c: rechazoColIdx})];
                                if (cellRechazo && cellRechazo.v) causalText = String(cellRechazo.v).trim().toUpperCase();
                            }
                            
                            if (!statsComunas[valComuna][valCentro].causales[causalText]) {
                                statsComunas[valComuna][valCentro].causales[causalText] = 0;
                            }
                            statsComunas[valComuna][valCentro].causales[causalText]++;
                        }
                    }
                    // Escribir celda resultado
                    sheet[XLSX.utils.encode_cell({r: currentRow, c: newColIdx})] = { t: 's', v: result };
                    
                    if (rechazoColIdx !== -1) {
                        let originalCausalText = '';
                        const cellRechazoRow = sheet[XLSX.utils.encode_cell({r: currentRow, c: rechazoColIdx})];
                        if (cellRechazoRow && cellRechazoRow.v) {
                            originalCausalText = String(cellRechazoRow.v).trim();
                        }
                        
                        let isRechazo = 'NO';
                        if (originalCausalText !== '') {
                            isRechazo = 'SI';
                        }
                        
                        // Solo llenamos texto si hay, sino en blanco. "SI/NO segun corresponda"
                        sheet[XLSX.utils.encode_cell({r: currentRow, c: colRechazosSiNo})] = { t: 's', v: isRechazo };
                        sheet[XLSX.utils.encode_cell({r: currentRow, c: colCausalText})] = { t: 's', v: originalCausalText };
                    }
                }

                if (currentRow <= range.e.r) {
                    const pct = 30 + Math.floor(((currentRow - range.s.r) / totalDataRows) * 60);
                    this.updateProgress(pct, `Cruzando filas... (${currentRow.toLocaleString('es-CL')} de ${totalDataRows.toLocaleString('es-CL')})`);
                    setTimeout(procesarLote, 0); // liberar thread
                } else {
                    // Actualizar el rango del sheet
                    range.e.c = (rechazoColIdx !== -1) ? colCausalText : newColIdx;
                    sheet['!ref'] = XLSX.utils.encode_range(range);

                    this._finalizarProcesamiento(workbook, detectedHeader, totalDataRows, siCount, noCount, vaciosCount, duplicadosCount, invalidosCount, statsComunas);
                }
            } catch (err) {
                console.error("Error procesando lote:", err);
                const msg = err.message || (typeof err === 'string' ? err : JSON.stringify(err));
                this.showError('Error durante el cruce: ' + msg);
            }
        };

        setTimeout(procesarLote, 50);
    },

    /**
     * Termina el procesamiento y renderiza.
     */
    _finalizarProcesamiento(workbook, detectedHeader, totalRows, siCount, noCount, vaciosCount, duplicadosCount, invalidosCount, statsComunas) {
        this.updateProgress(95, 'Proceso finalizado. Preparando descarga...');

        this._state.results = {
            totalRecibidos: totalRows,
            total: siCount + noCount, // Cohorte final
            si: siCount,
            no: noCount,
            vacios: vaciosCount,
            pctSi: (siCount + noCount) > 0 ? ((siCount / (siCount + noCount)) * 100).toFixed(1) : '0.0',
            pctNo: (siCount + noCount) > 0 ? ((noCount / (siCount + noCount)) * 100).toFixed(1) : '0.0',
            columnaDetectada: detectedHeader,
            statsComunas: statsComunas,
            duplicados: duplicadosCount,
            invalidos: invalidosCount,
            cohorteFinal: siCount + noCount
        };

        this._state.processedWorkbook = workbook;

        setTimeout(() => {
            this.updateProgress(100, '¡Todo listo!');
            setTimeout(() => this.showResults(), 300);
        }, 100);
    },

    /**
     * Muestra el panel de resultados con estadísticas.
     */
    showResults() {
        const r = this._state.results;
        if (!r) return;

        const dropZone = document.getElementById('autoconsultaDropZone');
        const progressArea = document.getElementById('autoconsultaProgress');
        const resultsArea = document.getElementById('autoconsultaResults');
        const errorArea = document.getElementById('autoconsultaError');

        if (dropZone) dropZone.style.display = 'none';
        if (progressArea) progressArea.style.display = 'none';
        if (errorArea) errorArea.style.display = 'none';

        // Construir HTML de resultados
        const pctSi = parseFloat(r.pctSi);
        const pctNo = parseFloat(r.pctNo);


        // Generar HTML del Mini-Informe Estadístico
        let statsHTML = '';
        if (r.statsComunas && Object.keys(r.statsComunas).length > 0) {
            statsHTML += `
                <div class="autoconsulta-mini-informe">
                    <h4 class="autoconsulta-info-title" style="margin-top: 1.5rem; border-top: 1px solid rgba(0,0,0,0.1); padding-top: 1.5rem;">
                        <i class="fas fa-chart-bar"></i> Resumen por Establecimiento (Provincia de Osorno)
                    </h4>
                    <div class="autoconsulta-stats-grid">
            `;
            
            for (const [comuna, centros] of Object.entries(r.statsComunas).sort()) {
                statsHTML += `
                    <div class="autoconsulta-comuna-card">
                        <div class="autoconsulta-comuna-header">
                            <i class="fas fa-map-marker-alt"></i> ${comuna}
                        </div>
                        <div class="autoconsulta-centro-list">
                `;
                
                // Ordenar centros por nombre
                const sortedCentros = Object.entries(centros).sort();
                for (const [centro, stats] of sortedCentros) {
                    const total = stats.si + stats.no;
                    const pctSi = total > 0 ? Math.round((stats.si / total) * 100) : 0;
                    
                    statsHTML += `
                            <div class="autoconsulta-centro-item" title="Interpretación:
✓ ${stats.si} personas con registro de vacuna Influenza 2026.
× ${stats.no} personas sin registro de vacuna Influenza 2026.">
                                <div class="autoconsulta-centro-name" title="${centro}">${centro}</div>
                                <div class="autoconsulta-centro-stats">
                                    <div class="autoconsulta-centro-bar-container">
                                        <div class="autoconsulta-centro-bar-si" style="width: ${pctSi}%"></div>
                                    </div>
                                    <div class="autoconsulta-centro-numbers">
                                        <span class="text-si"><i class="fas fa-check"></i> ${stats.si}</span>
                                        <span class="text-no"><i class="fas fa-times"></i> ${stats.no}</span>
                                    </div>
                                </div>
                            </div>
                    `;
                }
                
                statsHTML += `
                        </div>
                    </div>
                `;
            }
            
            statsHTML += `
                    </div>
                </div>
            `;
        }

        // --- Lógica Avanzada de Síntesis Epidemiológica ---
        let bestComuna = { name: '', pct: -1, total: 0 };
        let worstComuna = { name: '', pct: 101, total: 0 };
        let worstCentro = { name: '', comuna: '', noCount: -1 };
        
        let totalComunas = 0;
        let totalCentros = 0;

        let totalRechazos = 0;
        const topRechazos = [];

        if (r.statsComunas) {
            for (const [comuna, centros] of Object.entries(r.statsComunas)) {
                totalComunas++;
                let cSi = 0;
                let cNo = 0;
                for (const [centro, stats] of Object.entries(centros)) {
                    totalCentros++;
                    cSi += stats.si;
                    cNo += stats.no;
                    
                    const cTotal = stats.si + stats.no;
                    if (stats.no > 0) {
                        totalRechazos += stats.no;
                        const countRezago = stats.causales['SIN REGISTRO / CAUSAL NO ESPECIFICADA'] || 0;
                        const countRechazo = stats.no - countRezago;
                        
                        topRechazos.push({ 
                            comuna, 
                            centro, 
                            causales: stats.causales, 
                            totalNo: stats.no,
                            totalRezago: countRezago,
                            totalRechazo: countRechazo,
                            cohorte: cTotal,
                            pctLocal: cTotal > 0 ? (stats.no / cTotal) * 100 : 0
                        });
                    }
                    
                    if (stats.no > worstCentro.noCount) {
                        worstCentro = { name: centro, comuna: comuna, noCount: stats.no };
                    }
                }
                let cTotal = cSi + cNo;
                if (cTotal > 0) {
                    let cPct = (cSi / cTotal) * 100;
                    if (cPct > bestComuna.pct || (cPct === bestComuna.pct && cTotal > bestComuna.total)) {
                        bestComuna = { name: comuna, pct: cPct, total: cTotal };
                    }
                    if (cPct < worstComuna.pct || (cPct === worstComuna.pct && cTotal > worstComuna.total)) {
                        worstComuna = { name: comuna, pct: cPct, total: cTotal };
                    }
                }
            }
        }

        // Sort by totalNo descending
        topRechazos.sort((a, b) => b.totalNo - a.totalNo);
        
        // Calculations for Hallazgos Principales
        let diffExtremosPP = 0;
        if (bestComuna.name !== '' && worstComuna.name !== '') {
            let bestRounded = parseFloat(bestComuna.pct.toFixed(1));
            let worstRounded = parseFloat(worstComuna.pct.toFixed(1));
            diffExtremosPP = (bestRounded - worstRounded).toFixed(1);
        }
        
        let brechaTop2 = 0;
        let brechaTop4 = 0;
        let brechaTop10 = 0;
        
        for (let i = 0; i < topRechazos.length; i++) {
            if (i < 2) brechaTop2 += topRechazos[i].totalNo;
            if (i < 4) brechaTop4 += topRechazos[i].totalNo;
            if (i < 10) brechaTop10 += topRechazos[i].totalNo;
        }
        
        const pctTop2 = totalRechazos > 0 ? ((brechaTop2 / totalRechazos) * 100).toFixed(1) : 0;
        const pctTop4 = totalRechazos > 0 ? ((brechaTop4 / totalRechazos) * 100).toFixed(1) : 0;
        const pctTop10 = totalRechazos > 0 ? ((brechaTop10 / totalRechazos) * 100).toFixed(1) : 0;

        let brecha80 = 0;
        let top80Count = 0;
        let threshold = totalRechazos * 0.8;
        let accumulated = 0;
        for (let i = 0; i < topRechazos.length; i++) {
            accumulated += topRechazos[i].totalNo;
            top80Count++;
            if (accumulated >= threshold) {
                brecha80 = accumulated;
                break;
            }
        }
        const pctTop80 = totalRechazos > 0 ? ((brecha80 / totalRechazos) * 100).toFixed(1) : 0;

        // Calcular mediana comunal de % con registro
        const comunaPcts = [];
        if (r.statsComunas) {
            for (const [comuna, centros] of Object.entries(r.statsComunas)) {
                let cSiM = 0, cNoM = 0;
                for (const stats of Object.values(centros)) { cSiM += stats.si; cNoM += stats.no; }
                const cTotalM = cSiM + cNoM;
                if (cTotalM > 0) comunaPcts.push((cSiM / cTotalM) * 100);
            }
        }
        comunaPcts.sort((a, b) => a - b);
        const medianaComunal = comunaPcts.length > 0 ? (comunaPcts.length % 2 === 0 ? ((comunaPcts[comunaPcts.length / 2 - 1] + comunaPcts[comunaPcts.length / 2]) / 2).toFixed(1) : comunaPcts[Math.floor(comunaPcts.length / 2)].toFixed(1)) : '0.0';

        // Nombre de la vacuna dinámico (Influenza, Covid, VRS, VPH)
        let nombreVacuna = "la Campaña";
        if (window.location.href.toLowerCase().includes('influenza')) nombreVacuna = 'Influenza 2026';
        else if (window.location.href.toLowerCase().includes('covid')) nombreVacuna = 'Covid-19';
        else if (window.location.href.toLowerCase().includes('vrs')) nombreVacuna = 'VRS';
        else if (window.location.href.toLowerCase().includes('vph')) nombreVacuna = 'VPH';

        let epiTextGeneral = `El cruce automatizado analizó una cohorte final de <strong>${(r.total || 0).toLocaleString('es-CL')} personas únicas</strong>`;
        if (totalComunas > 0) {
            epiTextGeneral += `, distribuidas en <strong>${totalComunas} comunas</strong> y <strong>${totalCentros} establecimientos</strong> de la red.`;
        } else {
            epiTextGeneral += `.`;
        }
        
        const cada100 = r.total > 0 ? Math.round((totalRechazos / r.total) * 100) : 0;
        
        epiTextGeneral += ` Del total, <strong>${(r.si || 0).toLocaleString('es-CL')} personas (${pctSi}%)</strong> presentan registro válido de vacunación para ${nombreVacuna}, mientras <strong>${(r.no || 0).toLocaleString('es-CL')} (${pctNo}%)</strong> no presentan registro en la base consultada. En términos poblacionales, esto representa aproximadamente <strong>${cada100} personas sin registro por cada 100 integrantes</strong> de la cohorte.`;

        let epiTextTerritorial = '';
        if (totalComunas > 0 && bestComuna.name !== '') {
            epiTextTerritorial += `La distribución territorial no es homogénea. La proporción con registro varía desde <strong>${worstComuna.pct.toFixed(1)}% en ${worstComuna.name}</strong> hasta <strong>${bestComuna.pct.toFixed(1)}% en ${bestComuna.name}</strong>, observándose una variabilidad territorial de <strong>${diffExtremosPP} puntos porcentuales (pp)</strong> entre ambos extremos. La mediana comunal de registro es <strong>${medianaComunal}%</strong>. `;
            const diffMedianaGlobal = Math.abs(parseFloat(medianaComunal) - pctSi).toFixed(1);
            if (diffMedianaGlobal >= 1.0) {
                epiTextTerritorial += `La diferencia entre la mediana comunal (${medianaComunal}%) y el resultado global (${pctSi}%) es de <strong>${diffMedianaGlobal} pp</strong>, lo que sugiere que los territorios con mayor peso poblacional están desplazando el resultado agregado hacia ${parseFloat(medianaComunal) > pctSi ? 'abajo' : 'arriba'}. `;
            }
            

            if (bestComuna.name !== worstComuna.name) {
                const diffBest = (bestComuna.pct - pctSi).toFixed(1);
                const diffWorst = (pctSi - worstComuna.pct).toFixed(1);
                epiTextTerritorial += `<strong>${bestComuna.name}</strong> se ubica <strong>${diffBest} pp</strong> sobre el resultado global de la cohorte (${pctSi}%), mientras <strong>${worstComuna.name}</strong> se sitúa <strong>${diffWorst} pp</strong> por debajo. `;
            }
            
            if (topRechazos.length > 0) {
                epiTextTerritorial += `<br><br>Además, la brecha presenta una importante <strong>concentración institucional</strong>: <strong>${brechaTop2.toLocaleString('es-CL')}</strong> de las ${totalRechazos.toLocaleString('es-CL')} personas sin registro (<strong>${pctTop2}%</strong>) se concentran en los dos establecimientos con mayor número absoluto, mientras que los diez principales concentran <strong>${brechaTop10.toLocaleString('es-CL')} personas (${pctTop10}%)</strong>. En efecto, de los ${totalCentros} establecimientos incluidos en la cohorte, <strong>${topRechazos.length}</strong> presentan al menos una persona sin registro. Si <strong>${top80Count}</strong> de estos establecimientos concentran <strong>${brecha80.toLocaleString('es-CL')} personas</strong>, entonces representan el <strong>${topRechazos.length > 0 ? ((top80Count / topRechazos.length) * 100).toFixed(1) : 0}%</strong> de los establecimientos con brecha y concentran el <strong>${pctTop80}%</strong> de la brecha total, lo que evidencia focos priorizables para intervención y revisión de antecedentes.`;
            }
        }
        
        let hallazgosHtml = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 20px;">
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="color: #0284c7; font-size: 1.8rem; font-weight: 800;">${pctSi}%</div>
                    <div style="color: #64748b; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px;">Con registro</div>
                </div>
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="color: #ef4444; font-size: 1.8rem; font-weight: 800;">${pctNo}%</div>
                    <div style="color: #64748b; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px;">Sin registro</div>
                </div>
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="color: #10b981; font-size: 1.8rem; font-weight: 800;">${diffExtremosPP} pp</div>
                    <div style="color: #64748b; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px;">Rango territorial</div>
                </div>
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="color: #f59e0b; font-size: 1.8rem; font-weight: 800;">${pctTop2}%</div>
                    <div style="color: #64748b; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px;">Brecha acumulada Top 2</div>
                </div>
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="color: #ec4899; font-size: 1.8rem; font-weight: 800;">${pctTop80}%</div>
                    <div style="color: #64748b; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px;">Brecha acumulada Top ${top80Count}</div>
                </div>
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="color: #8b5cf6; font-size: 1.8rem; font-weight: 800;">${pctTop10}%</div>
                    <div style="color: #64748b; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px;">Brecha acumulada Top 10</div>
                </div>
            </div>
        `;

        // --- Lógica de Causales de Rechazo ---
        let htmlCausales = '';
        
        if (topRechazos.length > 0) {
            htmlCausales += `<div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 25px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                                <h4 style="color: #0f172a; font-weight: 700; margin-bottom: 15px; font-size: 1.1rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px;">
                                    <i class="fas fa-exclamation-circle" style="color: #ef4444;"></i> Matriz de Priorización Operativa y Análisis de Causales <sup style="color: #64748b;">†</sup>
                                </h4>
                                <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 15px; line-height: 1.5;">Se presentan los establecimientos que registran al menos una persona sin registro de vacunación en la cohorte analizada. Los establecimientos con brecha igual a cero no se incluyen en esta tabla.</p>
                                <div style="overflow-x: auto; max-height: 500px; overflow-y: auto;">
                                    <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                                        <thead>
                                            <tr style="background: #f8fafc; color: #475569; text-align: left; font-size: 0.8rem; text-transform: uppercase;">
                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0;">Comuna</th>
                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0;">Establecimiento</th>
                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; text-align: center;">Cohorte local (N)</th>
                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; text-align: center;" title="Total de personas sin registro en la base de datos">Total Sin Registro</th>
                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; text-align: center;" title="Porcentaje de personas sin registro dentro de la cohorte propia del establecimiento">% local sin registro</th>
                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; text-align: center;">Prioridad</th>
                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; text-align: center;" title="Sin registro - sin causal informada (Rezagos)">Sin causal informada</th>
                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; text-align: center;" title="Sin registro - con causal informada (Rechazos)">Con causal informada</th>
                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0;">Detalle de causal registrada</th>
                                            </tr>
                                        </thead>
                                        <tbody>`;
                                        
            for (let i = 0; i < topRechazos.length; i++) {
                const item = topRechazos[i];
                
                // Filtrar solo rechazos reales
                const rechazosReales = Object.entries(item.causales).filter(c => c[0] !== 'SIN REGISTRO / CAUSAL NO ESPECIFICADA').sort((a, b) => b[1] - a[1]);
                let causalesStr = '';
                if (rechazosReales.length === 0) {
                    causalesStr = '<span style="color: #94a3b8; font-style: italic;">Ninguna registrada</span>';
                } else {
                    for (let j = 0; j < Math.min(rechazosReales.length, 3); j++) {
                        causalesStr += `<span style="background: #f1f5f9; color: #334155; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; margin-right: 4px; display: inline-block; margin-bottom: 4px;">${rechazosReales[j][0]}: <strong>${rechazosReales[j][1]}</strong></span>`;
                    }
                    if (rechazosReales.length > 3) {
                        causalesStr += `<span style="color: #94a3b8; font-size: 0.8rem;">+${rechazosReales.length - 3} motivos</span>`;
                    }
                }
                
                // Color formatting for relative priority
                const globalNo = parseFloat(pctNo);
                
                let prioridadClasif = 'Baja';
                let pBg = '#dcfce7';
                let pText = '#166534';
                if (item.pctLocal > globalNo * 1.2 && item.totalNo > 10 && item.cohorte > 30) {
                    prioridadClasif = 'Alta';
                    pBg = '#fee2e2'; pText = '#991b1b';
                } else if ((item.pctLocal > globalNo && item.totalNo > 5) || (item.pctLocal > globalNo * 1.5 && item.totalNo > 2)) {
                    prioridadClasif = 'Media';
                    pBg = '#fef3c7'; pText = '#92400e';
                }
                
                let pctColor = '#0f172a';
                if (item.pctLocal > globalNo * 1.5) pctColor = '#ef4444';
                else if (item.pctLocal > globalNo) pctColor = '#f59e0b';

                htmlCausales += `<tr style="border-bottom: 1px solid #f1f5f9; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#f8fafc'" onmouseout="this.style.backgroundColor='transparent'">
                                    <td style="padding: 10px; color: #334155;">${item.comuna}</td>
                                    <td style="padding: 10px; color: #0f172a; font-weight: 500;">${item.centro}</td>
                                    <td style="padding: 10px; text-align: center; color: #334155;">${item.cohorte.toLocaleString('es-CL')}</td>
                                    <td style="padding: 10px; text-align: center; color: #ef4444; font-weight: 700;">${item.totalNo.toLocaleString('es-CL')}</td>
                                    <td style="padding: 10px; text-align: center; color: ${pctColor}; font-weight: 700; font-size: 0.95rem;">${item.pctLocal.toFixed(1)}%</td>
                                    <td style="padding: 10px; text-align: center;"><span style="background-color: ${pBg}; color: ${pText}; padding: 3px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: 600;">${prioridadClasif}</span></td>
                                    <td style="padding: 10px; text-align: center; color: #64748b; font-weight: 500; font-size: 0.95rem;">${item.totalRezago.toLocaleString('es-CL')}</td>
                                    <td style="padding: 10px; text-align: center; color: #8b5cf6; font-weight: 700; font-size: 0.95rem; background-color: rgba(139,92,246,0.05); border-radius: 4px;">${item.totalRechazo.toLocaleString('es-CL')}</td>
                                    <td style="padding: 10px;">${causalesStr}</td>
                                 </tr>`;
            }
            
            let globalRezago = topRechazos.reduce((sum, item) => sum + item.totalRezago, 0);
            let globalRechazo = topRechazos.reduce((sum, item) => sum + item.totalRechazo, 0);
            
            htmlCausales += `           </tbody>
                                        <tfoot>
                                            <tr style="background: #f8fafc; font-weight: 700; border-top: 2px solid #cbd5e1; color: #0f172a;">
                                                <td colspan="2" style="padding: 12px 10px; text-align: right; text-transform: uppercase;">Total General (Toda la red):</td>
                                                <td style="padding: 12px 10px; text-align: center; color: #0f172a; font-size: 1.05rem;">${r.total.toLocaleString('es-CL')}</td>
                                                <td style="padding: 12px 10px; text-align: center; color: #ef4444; font-size: 1.05rem;">${totalRechazos.toLocaleString('es-CL')}</td>
                                                <td style="padding: 12px 10px; text-align: center; color: #0f172a; font-size: 1.05rem;">${pctNo}%</td>
                                                <td style="padding: 12px 10px;"></td>
                                                <td style="padding: 12px 10px; text-align: center; color: #64748b; font-size: 1.05rem;">${globalRezago.toLocaleString('es-CL')}</td>
                                                <td style="padding: 12px 10px; text-align: center; color: #8b5cf6; font-size: 1.05rem;">${globalRechazo.toLocaleString('es-CL')}</td>
                                                <td style="padding: 12px 10px;"></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                                <p style="font-size: 0.8rem; color: #64748b; margin-top: 15px; margin-bottom: 5px;">† Interpretar con cautela: proporción calculada sobre una cohorte local pequeña; variaciones de pocos registros pueden producir cambios importantes en el porcentaje (N &lt; 30).</p>
                                <p style="font-size: 0.8rem; color: #475569; margin-top: 5px; margin-bottom: 0; background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0;"><strong>Regla de Prioridad Operativa:</strong><br>
                                <span style="color: #991b1b; font-weight: 600;">Alta:</span> Proporción local sin registro >= ${(parseFloat(pctNo) * 1.2).toFixed(1)}%, más de 10 personas sin registro y cohorte local > 30.<br>
                                <span style="color: #92400e; font-weight: 600;">Media:</span> (Proporción local sin registro > ${parseFloat(pctNo).toFixed(1)}% y > 5 casos) o (proporción local > ${(parseFloat(pctNo) * 1.5).toFixed(1)}% y > 2 casos).<br>
                                <span style="color: #166534; font-weight: 600;">Baja:</span> Resto de establecimientos.</p>
                             </div>`;
        }

        const glosarioAPA = `
            <div style="margin-top: 15px; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.85rem; color: #64748b; line-height: 1.5;">
                <h5 style="color: #475569; font-weight: 700; margin-bottom: 8px; font-size: 0.95rem;">Ayuda Interpretativa y Notas Metodológicas</h5>
                <ul style="list-style: none; padding: 0; margin: 0;">
                    <li style="margin-bottom: 4px;"><strong style="color: #334155;">* Cohorte Analizada:</strong> Corresponde al universo total de registros válidos procesados en el cruce de datos actual.</li>
                    <li style="margin-bottom: 4px;"><strong style="color: #334155;">** Brecha de registro de vacunación:</strong> Proporción de la cohorte que carece de registro de inmunización en la base nacional durante el cruce de datos. No constituye confirmación biológica de susceptibilidad.</li>
                    <li style="margin-bottom: 4px;"><strong style="color: #334155;">† Causales Administrativas:</strong> Categorías provenientes directamente del archivo cargado. No deben interpretarse automáticamente como rechazo explícito a la vacunación.</li>
                    <li><strong style="color: #334155;">‡ Registro de vacunación:</strong> Persona con registro válido de vacunación correspondiente a la campaña analizada.</li>
                    <li style="margin-bottom: 4px;"><strong style="color: #334155;">§ Prioridad operativa:</strong> Clasificación construida mediante la combinación de la magnitud absoluta de personas sin registro, la proporción local sin registro y el tamaño de la cohorte local (N). Su finalidad es orientar la focalización operativa y no constituye una clasificación de riesgo clínico.</li>
                    <li><strong style="color: #334155;">¶ Alcance interpretativo:</strong> Los resultados describen exclusivamente la cohorte ingresada y los registros disponibles en la fuente consultada a la fecha de corte. No deben extrapolarse automáticamente a la población general de la comuna o establecimiento cuando la cohorte analizada no corresponda a su población total.</li>
                </ul>
            </div>
        `;

        let semaphoreHtml = '';
        if (totalRechazos === r.no || r.no === 0) {
            semaphoreHtml = `
            <div style="background-color: #ecfdf5; border: 1px solid #10b981; border-left: 4px solid #059669; padding: 12px 15px; border-radius: 6px; margin-bottom: 20px; display: flex; align-items: center;">
                <i class="fas fa-check-circle" style="color: #059669; font-size: 1.2rem; margin-right: 10px;"></i>
                <div style="flex: 1;">
                    <strong style="color: #065f46; font-size: 0.95rem;">Consistencia aritmética y estructural: Validada</strong>
                    <div style="color: #047857; font-size: 0.85rem;">Los totales y agregaciones son coherentes con la cohorte analizada.</div>
                </div>
            </div>`;
        } else {
            semaphoreHtml = `
            <div style="background-color: #fffbeb; border: 1px solid #f59e0b; border-left: 4px solid #d97706; padding: 12px 15px; border-radius: 6px; margin-bottom: 20px; display: flex; align-items: center;">
                <i class="fas fa-exclamation-triangle" style="color: #d97706; font-size: 1.2rem; margin-right: 10px;"></i>
                <div style="flex: 1;">
                    <strong style="color: #92400e; font-size: 0.95rem;">Consistencia de datos: Advertencia</strong>
                    <div style="color: #b45309; font-size: 0.85rem;">Se detectaron discrepancias matemáticas entre la brecha global (${r.no}) y la sumatoria por establecimiento (${totalRechazos}).</div>
                </div>
            </div>`;
        }

        const epiSummary = `
            <div class="autoconsulta-epi-summary" style="background: linear-gradient(145deg, #ffffff, #f8fafc); border: 1px solid #e2e8f0; border-left: 4px solid #0284c7; padding: 20px; border-radius: 12px; margin-bottom: 25px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                <h4 style="color: #0f172a; font-weight: 700; margin-bottom: 15px; font-size: 1.1rem; display: flex; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
                    <i class="fas fa-microscope" style="color: #0284c7; margin-right: 10px; font-size: 1.3rem;"></i> Resumen Ejecutivo del Análisis
                </h4>
                
                ${semaphoreHtml}
                
                <style>
                    details.epi-accordion { margin-bottom: 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: white; overflow: hidden; }
                    details.epi-accordion summary { padding: 12px 15px; font-weight: 600; color: #334155; cursor: pointer; background: #f8fafc; list-style: none; display: flex; align-items: center; justify-content: space-between; user-select: none; }
                    details.epi-accordion summary::-webkit-details-marker { display: none; }
                    details.epi-accordion summary:hover { background: #f1f5f9; }
                    details.epi-accordion summary::after { content: '\\f078'; font-family: 'Font Awesome 5 Free'; font-weight: 900; color: #64748b; font-size: 0.85rem; transition: transform 0.2s; }
                    details.epi-accordion[open] summary::after { transform: rotate(180deg); }
                    details.epi-accordion .epi-content { padding: 15px; color: #475569; font-size: 0.95rem; line-height: 1.6; border-top: 1px solid #e2e8f0; }
                </style>
                
                <details class="epi-accordion" open>
                    <summary><span style="display: flex; align-items: center; gap: 8px;"><i class="fas fa-chart-pie" style="color: #0284c7;"></i> Resultado general</span></summary>
                    <div class="epi-content">${hallazgosHtml}${epiTextGeneral}</div>
                </details>
                
                ${epiTextTerritorial ? `
                <details class="epi-accordion" open>
                    <summary><span style="display: flex; align-items: center; gap: 8px;"><i class="fas fa-map-marked-alt" style="color: #10b981;"></i> Análisis territorial y concentración de la brecha</span></summary>
                    <div class="epi-content">
                        ${epiTextTerritorial}
                        <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-top: 20px;">
                            <div style="flex: 1; min-width: 300px; background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 15px;">
                                <h5 style="color: #334155; margin-bottom: 10px; font-size: 0.95rem;"><i class="fas fa-chart-bar" style="color: #0284c7;"></i> Registro por Comuna vs Resultado Global de la Cohorte</h5>
                                <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 15px; text-align: center;">
                                    <span style="color: #10b981; margin-right: 4px;">■</span> Sobre resultado global <span style="color: #ef4444; margin-left: 12px; margin-right: 4px;">■</span> Bajo resultado global
                                </div>
                                <div style="position: relative; height: 280px;"><canvas id="chartBarComunas"></canvas></div>
                            </div>
                            <div style="flex: 1; min-width: 300px; background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 15px;">
                                <h5 style="color: #334155; margin-bottom: 10px; font-size: 0.95rem;"><i class="fas fa-sort-amount-down" style="color: #8b5cf6;"></i> Análisis de Pareto — Concentración de la Brecha</h5>
                                <div style="position: relative; height: 280px;"><canvas id="chartPareto"></canvas></div>
                            </div>
                        </div>
                    </div>
                </details>
                ` : ''}
                
                <details class="epi-accordion">
                    <summary><span style="display: flex; align-items: center; gap: 8px;"><i class="fas fa-hospital" style="color: #ef4444;"></i> Priorización de establecimientos</span></summary>
                    <div class="epi-content" style="padding: 0; background: #f8fafc;">
                        <div style="padding: 15px;">
                            ${htmlCausales}
                            ${statsHTML}
                        </div>
                    </div>
                </details>
                
                <details class="epi-accordion">
                    <summary><span style="display: flex; align-items: center; gap: 8px;"><i class="fas fa-info-circle" style="color: #f59e0b;"></i> Calidad, trazabilidad y metodología de los datos</span></summary>
                    <div class="epi-content">
                        <h5 style="color: #334155; font-weight: 700; margin-bottom: 12px; font-size: 0.95rem;"><i class="fas fa-filter" style="color: #0284c7;"></i> Embudo de procesamiento</h5>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px;">
                            <div style="padding: 12px; background: white; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
                                <div style="font-size: 1.4rem; font-weight: 800; color: #0f172a;">${(r.totalRecibidos || 0).toLocaleString('es-CL')}</div>
                                <div style="font-size: 0.8rem; color: #64748b; text-transform: uppercase;">Registros recibidos</div>
                            </div>
                            <div style="padding: 12px; background: white; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
                                <div style="font-size: 1.4rem; font-weight: 800; color: #f59e0b;">${(r.invalidos || 0).toLocaleString('es-CL')}</div>
                                <div style="font-size: 0.8rem; color: #64748b; text-transform: uppercase;">RUT vacíos / inválidos</div>
                            </div>
                            <div style="padding: 12px; background: white; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
                                <div style="font-size: 1.4rem; font-weight: 800; color: #8b5cf6;">${(r.duplicados || 0).toLocaleString('es-CL')}</div>
                                <div style="font-size: 0.8rem; color: #64748b; text-transform: uppercase;">RUT duplicados</div>
                            </div>
                            <div style="padding: 12px; background: white; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
                                <div style="font-size: 1.4rem; font-weight: 800; color: #ef4444;">${((r.invalidos || 0) + (r.duplicados || 0)).toLocaleString('es-CL')}</div>
                                <div style="font-size: 0.8rem; color: #64748b; text-transform: uppercase;">Registros excluidos</div>
                            </div>
                            <div style="padding: 12px; background: #f0fdf4; border-radius: 8px; border: 2px solid #10b981; text-align: center;">
                                <div style="font-size: 1.4rem; font-weight: 800; color: #059669;">${(r.cohorteFinal || r.total || 0).toLocaleString('es-CL')}</div>
                                <div style="font-size: 0.8rem; color: #166534; text-transform: uppercase; font-weight: 600;">RUT únicos (Cohorte final)</div>
                            </div>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 15px; font-size: 0.85rem; color: #475569; line-height: 1.5;">
                            <i class="fas fa-info-circle" style="color: #0284c7;"></i> <strong>Nota:</strong> Los porcentajes y gráficos del informe se calculan estrictamente sobre la <strong>Cohorte Final</strong> (${(r.cohorteFinal || 0).toLocaleString('es-CL')} personas únicas). Cuando existen, los RUT duplicados o inválidos detectados en el archivo original (${(r.totalRecibidos || 0).toLocaleString('es-CL')} filas) se excluyen del análisis estadístico, garantizando que un mismo individuo no altere los resultados poblacionales.
                        </div>
                        ${glosarioAPA}
                    </div>
                </details>
                
                <details class="epi-accordion">
                    <summary><span style="display: flex; align-items: center; gap: 8px;"><i class="fas fa-file-alt" style="color: #0284c7;"></i> Conclusión ejecutiva</span></summary>
                    <div class="epi-content">
                        <p style="margin: 0; line-height: 1.7;">El análisis de la cohorte única evidencia que ${(r.no || 0).toLocaleString('es-CL')} de las ${(r.total || 0).toLocaleString('es-CL')} personas procesadas (<strong>${pctNo}%</strong>) no presentan registro de vacunación en la base consultada. ${totalComunas > 1 ? `Se observa heterogeneidad territorial en la proporción de registro, con valores que varían desde <strong>${worstComuna.pct.toFixed(1)}%</strong> hasta <strong>${bestComuna.pct.toFixed(1)}%</strong>, equivalente a una amplitud de <strong>${diffExtremosPP} puntos porcentuales</strong> entre ambos extremos (mediana comunal: <strong>${medianaComunal}%</strong>).` : ''}</p>
                        <p style="margin-top: 10px; line-height: 1.7;">La brecha presenta concentración institucional: De los <strong>${totalCentros}</strong> establecimientos incluidos en la cohorte, <strong>${topRechazos.length}</strong> presentan al menos una persona sin registro. ${topRechazos.length >= 2 ? `<strong>${top80Count}</strong> de estos establecimientos concentran <strong>${brecha80.toLocaleString('es-CL')} personas</strong>, equivalentes al <strong>${pctTop80}%</strong> de la brecha total.` : ''}</p>
                        <p style="margin-top: 10px; line-height: 1.7;">Estos resultados permiten focalizar las acciones de revisión de antecedentes y rescate territorial, priorizando inicialmente los establecimientos de <strong>prioridad Alta</strong> y, posteriormente, aquellos de <strong>prioridad Media</strong> según capacidad operativa, dado que combinan una elevada magnitud absoluta de personas sin registro con una proporción local desfavorable, considerando siempre el tamaño de la cohorte local <sup>¶</sup>.</p>
                    </div>
                </details>
            </div>
        `;

        resultsArea.innerHTML = `
            <div id="autoconsultaPhotoContainer" style="padding: 10px; background: #f8fafc;">
                ${epiSummary}
                
                <div class="autoconsulta-meta" style="display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 25px; background: rgba(255,255,255,0.7); padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <span style="flex: 1; min-width: 200px; padding: 10px; background: white; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: flex; align-items: center; justify-content: space-between;">
                        <span style="color: #64748b; font-size: 0.9rem;">Con registro <sup>‡</sup></span>
                        <strong style="color: #10b981; font-size: 1.1rem;"><i class="fas fa-check-circle"></i> ${(r.si || 0).toLocaleString('es-CL')}</strong>
                    </span>
                    <span style="flex: 1; min-width: 200px; padding: 10px; background: white; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: flex; align-items: center; justify-content: space-between;">
                        <span style="color: #64748b; font-size: 0.9rem;">Sin registro <sup>**</sup></span>
                        <strong style="color: #ef4444; font-size: 1.1rem;"><i class="fas fa-times-circle"></i> ${(r.no || 0).toLocaleString('es-CL')}</strong>
                    </span>
                    <span style="flex: 1; min-width: 200px; padding: 10px; background: white; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: flex; align-items: center; justify-content: space-between;">
                        <span style="color: #64748b; font-size: 0.9rem;">Cohorte Analizada <sup>*</sup></span>
                        <strong style="color: #0f172a; font-size: 1.1rem;"><i class="fas fa-users"></i> ${(r.total || 0).toLocaleString('es-CL')}</strong>
                    </span>
                </div>
                
                <div class="autoconsulta-charts-container" style="display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 25px;">
                    <div class="autoconsulta-chart-card" style="flex: 1; background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); text-align: center; border: 1px solid #e2e8f0;">
                        <h4 style="margin-bottom: 20px; color: #334155; font-size: 1.05rem;">Proporción con Registro de Vacunación</h4>
                        <div style="position: relative; width: 180px; height: 180px; margin: 0 auto; border-radius: 50%; background: conic-gradient(#10b981 ${pctSi}%, #ef4444 ${pctSi}% 100%); display: flex; align-items: center; justify-content: center; box-shadow: inset 0 0 0 10px rgba(255,255,255,0.2), 0 8px 20px rgba(0,0,0,0.1); transition: transform 0.3s ease;">
                            <div style="width: 130px; height: 130px; background: white; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: inset 0 2px 8px rgba(0,0,0,0.05);">
                                <span style="font-size: 28px; font-weight: 800; color: #0f172a; line-height: 1;">${pctSi}%</span>
                                <span style="font-size: 13px; color: #64748b; font-weight: 500; margin-top: 4px;">Con registro</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; justify-content: center; gap: 20px; margin-top: 20px; margin-bottom: 20px; flex-wrap: wrap;" data-html2canvas-ignore="true">
                <button onclick="Autoconsulta.reset()" style="background: white; color: #475569; border: 1px solid #cbd5e1; padding: 14px 28px; border-radius: 10px; font-weight: 600; font-size: 1rem; cursor: pointer; transition: all 0.3s ease; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);" onmouseover="this.style.background='#f8fafc'; this.style.borderColor='#94a3b8'; this.style.transform='translateY(-2px)';" onmouseout="this.style.background='white'; this.style.borderColor='#cbd5e1'; this.style.transform='translateY(0)';">
                    <i class="fas fa-undo"></i> Nueva Consulta
                </button>
                
                <button id="autoconsultaBtnDownload" onclick="Autoconsulta.downloadResult()" style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 1rem; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 6px 20px rgba(16, 185, 129, 0.3); display: flex; align-items: center; gap: 10px;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 25px rgba(16, 185, 129, 0.4)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 6px 20px rgba(16, 185, 129, 0.3)';">
                        <i class="fas fa-file-excel" style="font-size: 1.1rem;"></i> Descargar Excel
                    </button>
                </div>
            </div>
        `;
        resultsArea.style.display = 'block';
        
        // Store chart data for rendering and PDF
        this._state.chartData = {
            statsComunas: r.statsComunas,
            topRechazos: topRechazos,
            totalRechazos: totalRechazos,
            pctSi: pctSi,
            pctNo: pctNo,
            diffExtremosPP: diffExtremosPP,
            pctTop2: pctTop2,
            pctTop10: pctTop10,
            brechaTop2: brechaTop2,
            brechaTop10: brechaTop10,
            nombreVacuna: nombreVacuna,
            totalComunas: totalComunas,
            totalCentros: totalCentros,
            bestComuna: bestComuna,
            worstComuna: worstComuna
        };
        
        // Render charts after DOM is ready
        setTimeout(() => this.renderCharts(), 100);
        
        // Close export dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const container = document.getElementById('exportDropdownContainer');
            if (container && !container.contains(e.target)) {
                const menu = document.getElementById('exportDropdownMenu');
                if (menu) menu.style.display = 'none';
            }
        });
    },

    /**
     * Toggle export dropdown menu
     */
    toggleExportMenu() {
        const menu = document.getElementById('exportDropdownMenu');
        if (menu) {
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        }
    },

    /**
     * Render Chart.js charts (Bar by Comuna + Pareto)
     */
    renderCharts() {
        if (typeof Chart === 'undefined' || !this._state.chartData) return;
        
        const data = this._state.chartData;
        const r = this._state.results;
        
        // --- Bar Chart: Registro por Comuna ---
        const barCanvas = document.getElementById('chartBarComunas');
        if (barCanvas && data.statsComunas) {
            const comunaData = [];
            for (const [comuna, centros] of Object.entries(data.statsComunas)) {
                let cSi = 0, cNo = 0;
                for (const stats of Object.values(centros)) {
                    cSi += stats.si;
                    cNo += stats.no;
                }
                const cTotal = cSi + cNo;
                if (cTotal > 0) {
                    comunaData.push({ name: comuna, pct: (cSi / cTotal) * 100, total: cTotal });
                }
            }
            comunaData.sort((a, b) => b.pct - a.pct);
            
            const globalPct = parseFloat(data.pctSi);
            
            new Chart(barCanvas, {
                type: 'bar',
                data: {
                    labels: comunaData.map(c => c.name),
                    datasets: [{
                        label: '% Con registro',
                        data: comunaData.map(c => c.pct.toFixed(1)),
                        backgroundColor: comunaData.map(c => c.pct >= globalPct ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)'),
                        borderColor: comunaData.map(c => c.pct >= globalPct ? '#059669' : '#dc2626'),
                        borderWidth: 1,
                        borderRadius: 4
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        annotation: undefined
                    },
                    scales: {
                        x: {
                            min: 0, max: 100,
                            ticks: { callback: v => v + '%', font: { size: 11 } },
                            grid: { color: '#f1f5f9' }
                        },
                        y: {
                            ticks: { font: { size: 11, weight: '500' } },
                            grid: { display: false }
                        }
                    }
                },
                plugins: [{
                    id: 'benchmarkLine',
                    afterDraw(chart) {
                        const xScale = chart.scales.x;
                        const ctx = chart.ctx;
                        const xPos = xScale.getPixelForValue(globalPct);
                        ctx.save();
                        ctx.beginPath();
                        ctx.setLineDash([6, 4]);
                        ctx.strokeStyle = '#0284c7';
                        ctx.lineWidth = 2;
                        ctx.moveTo(xPos, chart.chartArea.top);
                        ctx.lineTo(xPos, chart.chartArea.bottom);
                        ctx.stroke();
                        ctx.fillStyle = '#0284c7';
                        ctx.font = '11px Inter, sans-serif';
                        ctx.fillText('Resultado global: ' + globalPct.toFixed(1) + '%', xPos + 4, chart.chartArea.top + 12);
                        ctx.restore();
                    }
                }]
            });
        }
        
        // --- Pareto Chart ---
        const paretoCanvas = document.getElementById('chartPareto');
        if (paretoCanvas && data.topRechazos.length > 0) {
            const sorted = [...data.topRechazos].sort((a, b) => b.totalNo - a.totalNo).slice(0, 10);
            let cumulative = 0;
            const cumulativePcts = sorted.map(item => {
                cumulative += item.totalNo;
                return data.totalRechazos > 0 ? (cumulative / data.totalRechazos * 100).toFixed(1) : 0;
            });
            
            new Chart(paretoCanvas, {
                type: 'bar',
                data: {
                    labels: sorted.map(item => item.centro.length > 20 ? item.centro.substring(0, 18) + '...' : item.centro),
                    datasets: [
                        {
                            label: 'Sin registro',
                            data: sorted.map(item => item.totalNo),
                            backgroundColor: 'rgba(139, 92, 246, 0.6)',
                            borderColor: '#7c3aed',
                            borderWidth: 1,
                            borderRadius: 4,
                            yAxisID: 'y'
                        },
                        {
                            label: '% Acumulado',
                            data: cumulativePcts,
                            type: 'line',
                            borderColor: '#f59e0b',
                            backgroundColor: 'rgba(245, 158, 11, 0.1)',
                            borderWidth: 2,
                            pointBackgroundColor: '#f59e0b',
                            pointRadius: 4,
                            fill: true,
                            tension: 0.3,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { font: { size: 11 }, usePointStyle: true } }
                    },
                    scales: {
                        x: {
                            ticks: { font: { size: 9 }, maxRotation: 45, minRotation: 45 },
                            grid: { display: false }
                        },
                        y: {
                            beginAtZero: true,
                            position: 'left',
                            ticks: { font: { size: 11 } },
                            grid: { color: '#f1f5f9' },
                            title: { display: true, text: 'N° personas', font: { size: 11 } }
                        },
                        y1: {
                            beginAtZero: true,
                            max: 100,
                            position: 'right',
                            ticks: { callback: v => v + '%', font: { size: 11 } },
                            grid: { drawOnChartArea: false },
                            title: { display: true, text: '% Acumulado', font: { size: 11 } }
                        }
                    }
                },
                plugins: [{
                    id: 'paretoReference',
                    afterDraw(chart) {
                        const y1Scale = chart.scales.y1;
                        if (!y1Scale) return;
                        const ctx = chart.ctx;
                        const yPos = y1Scale.getPixelForValue(80);
                        ctx.save();
                        ctx.beginPath();
                        ctx.setLineDash([4, 4]);
                        ctx.strokeStyle = '#ef4444';
                        ctx.lineWidth = 1;
                        ctx.moveTo(chart.chartArea.left, yPos);
                        ctx.lineTo(chart.chartArea.right, yPos);
                        ctx.stroke();
                        ctx.fillStyle = '#ef4444';
                        ctx.font = '10px Inter, sans-serif';
                        ctx.fillText('80%', chart.chartArea.right - 25, yPos - 5);
                        ctx.restore();
                    }
                }]
            });
        }
    },

    /**
     * Genera y descarga un informe PDF institucional formal
     */
    downloadPDF() {
        // Close dropdown
        const menu = document.getElementById('exportDropdownMenu');
        if (menu) menu.style.display = 'none';
        
        // Load html2pdf.js dynamically if not present
        if (typeof html2pdf === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            script.onload = () => this._generatePDF();
            script.onerror = () => {
                alert('No se pudo cargar la librería de generación PDF. Verifique su conexión a internet e intente nuevamente.');
            };
            document.head.appendChild(script);
            
            if (typeof Toastify !== 'undefined') {
                Toastify({ text: '📄 Preparando generador PDF...', duration: 2000, gravity: 'bottom', position: 'right',
                    style: { background: 'linear-gradient(135deg, #0284c7, #0369a1)', borderRadius: '10px', fontFamily: "'Inter', sans-serif", fontWeight: '600' }
                }).showToast();
            }
            return;
        }
        this._generatePDF();
    },

    _generatePDF() {
        const resultsContainer = document.getElementById('autoconsultaResults');
        if (!resultsContainer || resultsContainer.style.display === 'none') {
            alert('No hay reporte para exportar. Procese un archivo primero.');
            return;
        }

        const cd = this._state.chartData;
        if (!cd) return;

        // Ocultar botones de accion (Nueva Consulta y Exportar) para que no salgan en el PDF
        let actionButtons = null;
        // Buscamos el contenedor de botones que esta al final del resultsContainer
        const flexContainers = resultsContainer.querySelectorAll('div');
        flexContainers.forEach(div => {
            if (div.style.justifyContent === 'center' && div.style.display === 'flex' && div.innerHTML.includes('Exportar')) {
                actionButtons = div;
            }
        });
        
        if (actionButtons) {
            actionButtons.style.display = 'none';
        }

        // Expandir todos los acordeones (details) para capturar toda la informacion (Grafico Pareto, etc)
        const details = resultsContainer.querySelectorAll('details');
        const previouslyClosed = [];
        details.forEach(d => {
            if (!d.hasAttribute('open')) {
                previouslyClosed.push(d);
                d.setAttribute('open', '');
            }
        });

        // Configurar PDF
        const now = new Date();
        const fechaStr = now.toLocaleDateString('es-CL').replace(/\//g, '-');
        const opt = {
            margin:       10,
            filename:     `Informe_Web_${cd.nombreVacuna.replace(/\s/g, '_')}_${fechaStr}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { 
                scale: 2, 
                useCORS: true, 
                logging: false,
                backgroundColor: '#f8fafc' // Color de fondo del body
            },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
        };

        if (typeof Toastify !== 'undefined') {
            Toastify({ text: '⏳ Capturando interfaz web... por favor espere.', duration: 3000, gravity: 'bottom', position: 'right', style: { background: '#3b82f6', borderRadius: '10px' } }).showToast();
        }

        // Darle 500ms al DOM para renderizar los acordeones abiertos antes de capturar
        setTimeout(() => {
            html2pdf().set(opt).from(resultsContainer).save().then(() => {
                // Restaurar estado
                if (actionButtons) actionButtons.style.display = 'flex';
                previouslyClosed.forEach(d => d.removeAttribute('open'));
                
                if (typeof Toastify !== 'undefined') {
                    Toastify({ text: '✅ PDF de la web descargado exitosamente', duration: 4000, gravity: 'bottom', position: 'right', style: { background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: '10px' } }).showToast();
                }
            }).catch(err => {
                console.error("Error generando PDF:", err);
                alert("Ocurrió un error al generar el PDF.");
                if (actionButtons) actionButtons.style.display = 'flex';
                previouslyClosed.forEach(d => d.removeAttribute('open'));
            });
        }, 500);
    },
    /**
     * Descarga el reporte visual como PNG
     */
    downloadPhoto() {
        const btn = document.getElementById('autoconsultaBtnPhoto');
        if (typeof html2canvas === 'undefined') {
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando cámara...';
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script.onload = () => {
                btn.innerHTML = originalHTML;
                this.downloadPhoto();
            };
            document.head.appendChild(script);
            return;
        }

        const report = document.getElementById('autoconsultaPhotoContainer');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Capturando...';
        
        html2canvas(report, {
            scale: 2,
            backgroundColor: '#f8fafc',
            logging: false,
            useCORS: true
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = `Reporte_Epidemiologico_${new Date().getTime()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            btn.innerHTML = originalHTML;
        }).catch(err => {
            console.error(err);
            alert("Error al capturar el reporte.");
            btn.innerHTML = originalHTML;
        });
    },

    /**
     * Descarga el Excel procesado con la columna INFLUENZA.
     */
    downloadResult() {
        // Close dropdown
        const menu = document.getElementById('exportDropdownMenu');
        if (menu) menu.style.display = 'none';

        if (!this._state.processedWorkbook) {
            alert('No hay datos procesados para descargar.');
            return;
        }

        try {
            const baseName = this._state.fileName.replace(/\.[^.]+$/, '');
            const outputName = `${baseName}_AUTOCONSULTA_INFLUENZA.xlsx`;

            XLSX.writeFile(this._state.processedWorkbook, outputName);

            if (typeof Toastify !== 'undefined') {
                Toastify({
                    text: 'OK Archivo Excel descargado exitosamente',
                    duration: 4000,
                    gravity: 'bottom',
                    position: 'right',
                    style: {
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        borderRadius: '10px',
                        fontFamily: "'Inter', sans-serif",
                        fontWeight: '600',
                        boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)'
                    }
                }).showToast();
            }
        } catch (err) {
            console.error("Error descargando:", err);
            alert("Hubo un error al generar el archivo Excel. Intente nuevamente.");
        }
    },
    /**
     * Reinicia el módulo para procesar otro archivo.
     */
    reset() {
        this._state = {
            originalWorkbook: null,
            processedWorkbook: null,
            fileName: '',
            results: null
        };

        const dropZone = document.getElementById('autoconsultaDropZone');
        const progressArea = document.getElementById('autoconsultaProgress');
        const resultsArea = document.getElementById('autoconsultaResults');
        const errorArea = document.getElementById('autoconsultaError');
        const fileInput = document.getElementById('autoconsultaFileInput');

        if (dropZone) dropZone.style.display = '';
        if (progressArea) progressArea.style.display = 'none';
        if (resultsArea) { resultsArea.style.display = 'none'; resultsArea.innerHTML = ''; }
        if (errorArea) errorArea.style.display = 'none';
        if (fileInput) fileInput.value = '';
    },

    /**
     * Muestra indicador de progreso.
     */
    showProgress(message, percentage = null) {
        const dropZone = document.getElementById('autoconsultaDropZone');
        const progressArea = document.getElementById('autoconsultaProgress');
        const resultsArea = document.getElementById('autoconsultaResults');
        const errorArea = document.getElementById('autoconsultaError');

        if (dropZone) dropZone.style.display = 'none';
        if (resultsArea) resultsArea.style.display = 'none';
        if (errorArea) errorArea.style.display = 'none';

        if (progressArea) {
            progressArea.innerHTML = `
                <div class="autoconsulta-progress-indicator">
                    <div class="autoconsulta-coffee-anim">
                        <div class="coffee-cup"></div>
                        <div class="coffee-steam steam-1"></div>
                        <div class="coffee-steam steam-2"></div>
                        <div class="coffee-steam steam-3"></div>
                    </div>
                    <p id="autoconsultaProgressText">${message}</p>
                    <div style="width: 280px; height: 10px; background: #e2e8f0; border-radius: 5px; margin-top: 15px; overflow: hidden; margin-left: auto; margin-right: auto; display: ${percentage !== null ? 'block' : 'none'};">
                        <div id="autoconsultaProgressBar" style="width: ${percentage || 0}%; height: 100%; background: linear-gradient(90deg, #0f69b4, #0ea5e9); transition: width 0.3s ease;"></div>
                    </div>
                </div>
            `;
            progressArea.style.display = 'flex';
        }
    },

    /**
     * Actualiza la barra de progreso
     */
    updateProgress(percentage, message) {
        const bar = document.getElementById('autoconsultaProgressBar');
        const text = document.getElementById('autoconsultaProgressText');
        const pctText = document.getElementById('autoconsultaProgressPct');
        
        if (bar) {
            bar.parentElement.style.display = 'block';
            bar.style.width = percentage + '%';
        }
        if (text && message) {
            text.textContent = message;
        }
        if (pctText && percentage !== null) {
            pctText.textContent = Math.floor(percentage) + '%';
            pctText.style.display = 'inline-block';
        }
    },

    /**
     * Muestra mensaje de error.
     */
    showError(message) {
        const dropZone = document.getElementById('autoconsultaDropZone');
        const progressArea = document.getElementById('autoconsultaProgress');
        const errorArea = document.getElementById('autoconsultaError');

        if (progressArea) progressArea.style.display = 'none';

        if (errorArea) {
            errorArea.innerHTML = `
                <div class="autoconsulta-error-card">
                    <div class="autoconsulta-error-icon">
                        <i class="fas fa-exclamation-circle"></i>
                    </div>
                    <h4>Error al procesar</h4>
                    <p>${message}</p>
                    <button class="autoconsulta-btn-reset" onclick="Autoconsulta.reset()">
                        <i class="fas fa-redo"></i> Intentar nuevamente
                    </button>
                </div>
            `;
            errorArea.style.display = 'block';
        }
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    Autoconsulta.init();
});



// ==========================================
// DESCARGAR PLANTILLA EXCEL
// ==========================================
window.downloadTemplate = function() {
    if (typeof XLSX === 'undefined') {
        if (typeof Toastify !== 'undefined') {
            Toastify({
                text: "Error: Librería de Excel no cargada. Recargue la página.",
                duration: 3000,
                gravity: "top",
                position: "right",
                style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
            }).showToast();
        } else {
            alert('Error: Librería de Excel no cargada.');
        }
        return;
    }
    
    // Crear un libro y una hoja simple con la cabecera 'RUT'
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['RUT']]);
    
    // Darle un poco de estilo si es posible, o al menos un ancho de columna decente
    ws['!cols'] = [{wch: 15}];
    
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, 'Plantilla_Autoconsulta.xlsx');
};
