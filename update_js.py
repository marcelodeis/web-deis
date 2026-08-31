import os
import re

files = [
    r'C:\Antigravity IDE\WEB DEIS\Influenza_Web\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\Covid_Web\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\VRS\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\VPH_Web\autoconsulta.js'
]

def apply_patches(content, vaccine):
    # 1. Update max width in HTML / CSS later, here we just do JS logic.

    # 2. Add properties to collect stats
    detect_cols_code = r'''
        // Detectar columnas de comuna y centro para el reporte estadístico
        let comunaColIdx = -1;
        let centroColIdx = -1;
        const keywordsComuna = ['nombre_comuna', 'comuna'];
        const keywordsCentro = ['nombre_centro', 'centro', 'establecimiento', 'nombre establecimiento'];

        for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = sheet[XLSX.utils.encode_cell({r: range.s.r, c: c})];
            if (cell && cell.v) {
                const headerText = String(cell.v).toLowerCase().trim();
                if (keywordsComuna.includes(headerText) && comunaColIdx === -1) {
                    comunaColIdx = c;
                }
                if (keywordsCentro.includes(headerText) && centroColIdx === -1) {
                    centroColIdx = c;
                }
            }
        }
        
        // Estructura para almacenar estadísticas
        const statsComunas = {};
    '''
    
    # Insert detect_cols_code after "this.updateProgress(30..."
    content = content.replace(
        "this.updateProgress(30, `Columna detectada: \"${detectedHeader}\". Iniciando cruce de datos...`);",
        "this.updateProgress(30, `Columna detectada: \"${detectedHeader}\". Iniciando cruce de datos...`);\n" + detect_cols_code
    )

    # 3. In procesarLote, collect stats
    collect_stats_code = r'''
                    if (comunaColIdx !== -1 && centroColIdx !== -1) {
                        const cellComuna = sheet[XLSX.utils.encode_cell({r: currentRow, c: comunaColIdx})];
                        const cellCentro = sheet[XLSX.utils.encode_cell({r: currentRow, c: centroColIdx})];
                        
                        const valComuna = cellComuna ? String(cellComuna.v).trim().toUpperCase() : 'SIN COMUNA';
                        const valCentro = cellCentro ? String(cellCentro.v).trim().toUpperCase() : 'SIN CENTRO';
                        
                        if (!statsComunas[valComuna]) {
                            statsComunas[valComuna] = {};
                        }
                        if (!statsComunas[valComuna][valCentro]) {
                            statsComunas[valComuna][valCentro] = { si: 0, no: 0 };
                        }
                        
                        if (result === 'SI') {
                            statsComunas[valComuna][valCentro].si++;
                        } else {
                            statsComunas[valComuna][valCentro].no++;
                        }
                    }
    '''
    content = content.replace(
        "// Escribir celda resultado",
        collect_stats_code + "\n                    // Escribir celda resultado"
    )

    # 4. Pass statsComunas to _finalizarProcesamiento
    content = content.replace(
        "this._finalizarProcesamiento(workbook, detectedHeader, totalDataRows, siCount, noCount, vaciosCount);",
        "this._finalizarProcesamiento(workbook, detectedHeader, totalDataRows, siCount, noCount, vaciosCount, statsComunas);"
    )
    content = content.replace(
        "_finalizarProcesamiento(workbook, detectedHeader, totalRows, siCount, noCount, vaciosCount)",
        "_finalizarProcesamiento(workbook, detectedHeader, totalRows, siCount, noCount, vaciosCount, statsComunas)"
    )

    # Store in _state.results
    content = content.replace(
        "columnaDetectada: detectedHeader",
        "columnaDetectada: detectedHeader,\n            statsComunas: statsComunas"
    )

    # 5. Modify render in showResults to include the mini report
    mini_informe_html = r'''
        // Generar HTML del Mini-Informe Estadístico
        let statsHTML = '';
        if (r.statsComunas && Object.keys(r.statsComunas).length > 0) {
            statsHTML += 
                <div class="autoconsulta-mini-informe">
                    <h4 class="autoconsulta-info-title" style="margin-top: 1.5rem; border-top: 1px solid rgba(0,0,0,0.1); padding-top: 1.5rem;">
                        <i class="fas fa-chart-bar"></i> Resumen por Establecimiento (Provincia de Osorno)
                    </h4>
                    <div class="autoconsulta-stats-grid">
            ;
            
            for (const [comuna, centros] of Object.entries(r.statsComunas).sort()) {
                statsHTML += 
                    <div class="autoconsulta-comuna-card">
                        <div class="autoconsulta-comuna-header">
                            <i class="fas fa-map-marker-alt"></i> 
                        </div>
                        <div class="autoconsulta-centro-list">
                ;
                
                // Ordenar centros por nombre
                const sortedCentros = Object.entries(centros).sort();
                for (const [centro, stats] of sortedCentros) {
                    const total = stats.si + stats.no;
                    const pctSi = total > 0 ? Math.round((stats.si / total) * 100) : 0;
                    
                    statsHTML += 
                            <div class="autoconsulta-centro-item">
                                <div class="autoconsulta-centro-name" title=""></div>
                                <div class="autoconsulta-centro-stats">
                                    <div class="autoconsulta-centro-bar-container">
                                        <div class="autoconsulta-centro-bar-si" style="width: %"></div>
                                    </div>
                                    <div class="autoconsulta-centro-numbers">
                                        <span class="text-si"><i class="fas fa-check"></i> </span>
                                        <span class="text-no"><i class="fas fa-times"></i> </span>
                                    </div>
                                </div>
                            </div>
                    ;
                }
                
                statsHTML += 
                        </div>
                    </div>
                ;
            }
            
            statsHTML += 
                    </div>
                </div>
            ;
        }
    '''
    
    content = content.replace(
        "const pctNo = parseFloat(r.pctNo);",
        "const pctNo = parseFloat(r.pctNo);\n\n" + mini_informe_html
    )

    # Insert statsHTML right after <div class="autoconsulta-meta">...</div>
    content = content.replace(
        "                        <span><i class=\"fas fa-columns\"></i> Columna detectada: <strong>\"\"</strong></span>\n                    </div>",
        "                        <span><i class=\"fas fa-columns\"></i> Columna detectada: <strong>\"\"</strong></span>\n                    </div>\n                    "
    )

    # 6. Optimize downloadResult()
    download_code = r'''
    downloadResult() {
        if (!this._state.processedWorkbook) return;

        const btn = document.getElementById('autoconsultaBtnDownload');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando Excel... espere';
        btn.disabled = true;
        btn.style.opacity = '0.8';

        // Usamos setTimeout para permitir que el DOM se actualice (muestre el spinner) 
        // antes de bloquear el thread principal con XLSX.writeFile
        setTimeout(() => {
            try {
                const baseName = this._state.fileName.replace(/\.[^.]+$/, '');
                const outputName = ${baseName}_AUTOCONSULTA_{VACCINE}.xlsx;

                XLSX.writeFile(this._state.processedWorkbook, outputName);

                // Toast de confirmación si Toastify está disponible
                if (typeof Toastify !== 'undefined') {
                    Toastify({
                        text: ✅ Archivo descargado: ,
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
                alert("Hubo un error al generar el Excel.");
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        }, 50);
    }
    '''
    
    download_code = download_code.replace("{VACCINE}", vaccine.upper())
    
    # We replace the entire downloadResult function. Let's use regex.
    pattern = r"downloadResult\(\)\s*\{.*?(?=\n\s*\/\*\*\n\s*\*\s*Reinicia el módulo)/s"
    match = re.search(r"downloadResult\(\)\s*\{.*?\}\s*\}", content, flags=re.DOTALL)
    if match:
        content = content.replace(match.group(0), download_code.strip())
    
    return content


for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if "Influenza" in file:
        vaccine = "INFLUENZA"
    elif "Covid" in file:
        vaccine = "COVID"
    elif "VRS" in file:
        vaccine = "VRS"
    else:
        vaccine = "VPH"
        
    new_content = apply_patches(content, vaccine)
    with open(file, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Updated JS: {file}")

