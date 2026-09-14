import os
import re

files = ['Influenza_Web/autoconsulta.js', 'Covid_Web/autoconsulta.js', 'VRS/autoconsulta.js', 'VPH_Web/autoconsulta.js']

for f in files:
    path = os.path.join(r"C:\Antigravity IDE\WEB DEIS", f)
    if not os.path.exists(path): continue
    with open(path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # --- 1. Detectar columna de rechazo ---
    detect_pattern = r"// Detectar columnas de comuna y centro para el reporte estadístico\s*let comunaColIdx = -1;.*?(?=\s*// Estructura para almacenar estadísticas)"
    detect_replacement = '''// Detectar columnas de comuna, centro y causales de rechazo
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
        }'''
    content = re.sub(detect_pattern, detect_replacement, content, flags=re.DOTALL)
    
    # --- 2. Clean duplicated block and inject causales logic ---
    loop_pattern = r"(if\s*\(comunaColIdx !== -1 && centroColIdx !== -1\)\s*\{.*?statsComunas\[valComuna\]\[valCentro\]\.no\+\+;\s*\})(?:\s*if\s*\(comunaColIdx !== -1 && centroColIdx !== -1\)\s*\{.*?statsComunas\[valComuna\]\[valCentro\]\.no\+\+;\s*\})?"
    loop_replacement = '''if (comunaColIdx !== -1 && centroColIdx !== -1) {
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
                            
                            let causalText = 'SIN ESPECIFICAR / REZAGO GENERAL';
                            if (rechazoColIdx !== -1) {
                                const cellRechazo = sheet[XLSX.utils.encode_cell({r: currentRow, c: rechazoColIdx})];
                                if (cellRechazo && cellRechazo.v) causalText = String(cellRechazo.v).trim().toUpperCase();
                            }
                            
                            if (!statsComunas[valComuna][valCentro].causales[causalText]) {
                                statsComunas[valComuna][valCentro].causales[causalText] = 0;
                            }
                            statsComunas[valComuna][valCentro].causales[causalText]++;
                        }
                    }'''
    content = re.sub(loop_pattern, loop_replacement, content, flags=re.DOTALL)
    
    # --- 3. Update HTML injection ---
    html_pattern = r'const epiSummary = `.*?resultsArea\.style\.display = \'block\';\s*\},'
    
    # The new UI requires adding a table for "Rechazos/Rezago" and an APA glossary.
    html_replacement = r'''// --- Lógica de Causales de Rechazo ---
        let htmlCausales = '';
        let totalRechazos = 0;
        const topRechazos = [];
        
        if (r.statsComunas) {
            for (const [comuna, centros] of Object.entries(r.statsComunas)) {
                for (const [centro, stats] of Object.entries(centros)) {
                    if (stats.no > 0) {
                        totalRechazos += stats.no;
                        topRechazos.push({ comuna, centro, causales: stats.causales, totalNo: stats.no });
                    }
                }
            }
        }
        
        // Sort by totalNo descending
        topRechazos.sort((a, b) => b.totalNo - a.totalNo);
        
        if (topRechazos.length > 0) {
            htmlCausales += `<div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 25px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                                <h4 style="color: #0f172a; font-weight: 700; margin-bottom: 15px; font-size: 1.1rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px;">
                                    <i class="fas fa-exclamation-circle" style="color: #ef4444;"></i> Detalle de Rezago y Rechazos por Establecimiento <sup style="color: #64748b;">†</sup>
                                </h4>
                                <div style="overflow-x: auto;">
                                    <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                                        <thead>
                                            <tr style="background: #f8fafc; color: #475569; text-align: left;">
                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0;">Comuna</th>
                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0;">Establecimiento</th>
                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; text-align: center;">Población Susceptible</th>
                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0;">Causales Principales</th>
                                            </tr>
                                        </thead>
                                        <tbody>`;
                                        
            for (let i = 0; i < Math.min(topRechazos.length, 10); i++) {
                const item = topRechazos[i];
                
                // Formatear causales
                const sortedCausales = Object.entries(item.causales).sort((a, b) => b[1] - a[1]);
                let causalesStr = '';
                for (let j = 0; j < Math.min(sortedCausales.length, 3); j++) {
                    causalesStr += `<span style="background: #f1f5f9; color: #334155; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; margin-right: 4px; display: inline-block; margin-bottom: 4px;">${sortedCausales[j][0]}: <strong>${sortedCausales[j][1]}</strong></span>`;
                }
                if (sortedCausales.length > 3) {
                    causalesStr += `<span style="color: #94a3b8; font-size: 0.8rem;">+${sortedCausales.length - 3} motivos</span>`;
                }
                
                htmlCausales += `<tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 10px; color: #334155;">${item.comuna}</td>
                                    <td style="padding: 10px; color: #0f172a; font-weight: 500;">${item.centro}</td>
                                    <td style="padding: 10px; text-align: center; color: #ef4444; font-weight: 700;">${item.totalNo.toLocaleString('es-CL')}</td>
                                    <td style="padding: 10px;">${causalesStr}</td>
                                 </tr>`;
            }
            
            htmlCausales += `           </tbody>
                                    </table>
                                </div>
                             </div>`;
        }
        
        const glosarioAPA = `
            <div style="margin-top: 30px; padding: 15px; border-top: 2px dashed #cbd5e1; font-size: 0.85rem; color: #64748b; line-height: 1.5;">
                <h5 style="color: #475569; font-weight: 700; margin-bottom: 8px; font-size: 0.95rem;">Ayuda Interpretativa y Notas Metodológicas</h5>
                <ul style="list-style: none; padding: 0; margin: 0;">
                    <li style="margin-bottom: 4px;"><strong style="color: #334155;">* Cohorte Analizada:</strong> Corresponde al universo total de registros válidos procesados en el cruce de datos actual.</li>
                    <li style="margin-bottom: 4px;"><strong style="color: #334155;">** Brecha Susceptible:</strong> Proporción de la cohorte que carece de registro de inmunización en la base nacional, manteniéndose biológicamente susceptible.</li>
                    <li style="margin-bottom: 4px;"><strong style="color: #334155;">† Rezago / Posible Rechazo:</strong> Individuos objetivo no inmunizados. Las causales detalladas provienen directamente del archivo cargado (columna 'Causal', 'Rechazo' u 'Observación'). Si el archivo original no declara motivos específicos, el sistema los categoriza metodológicamente como "SIN ESPECIFICAR / REZAGO GENERAL".</li>
                    <li><strong style="color: #334155;">‡ Inmunidad Poblacional:</strong> Se refiere a la protección conferida por la campaña actual registrada exitosamente.</li>
                </ul>
            </div>
        `;

        const epiSummary = `
            <div class="autoconsulta-epi-summary" style="background: linear-gradient(145deg, #ffffff, #f8fafc); border: 1px solid #e2e8f0; border-left: 4px solid #0284c7; padding: 20px; border-radius: 12px; margin-bottom: 25px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                <h4 style="color: #0f172a; font-weight: 700; margin-bottom: 12px; font-size: 1.1rem; display: flex; align-items: center;">
                    <i class="fas fa-microscope" style="color: #0284c7; margin-right: 10px; font-size: 1.3rem;"></i> Síntesis Epidemiológica y Territorial
                </h4>
                <p style="color: #334155; font-size: 0.95rem; line-height: 1.6; margin: 0;">
                    ${epiText}
                </p>
            </div>
        `;

        resultsArea.innerHTML = `
            <div id="autoconsultaPhotoContainer" style="padding: 10px; background: #f8fafc;">
                ${epiSummary}
                
                <div class="autoconsulta-meta" style="display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 25px; background: rgba(255,255,255,0.7); padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <span style="flex: 1; min-width: 200px; padding: 10px; background: white; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: flex; align-items: center; justify-content: space-between;">
                        <span style="color: #64748b; font-size: 0.9rem;">Inmunizados <sup>‡</sup></span>
                        <strong style="color: #10b981; font-size: 1.1rem;"><i class="fas fa-check-circle"></i> ${(r.si || 0).toLocaleString('es-CL')}</strong>
                    </span>
                    <span style="flex: 1; min-width: 200px; padding: 10px; background: white; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: flex; align-items: center; justify-content: space-between;">
                        <span style="color: #64748b; font-size: 0.9rem;">Brecha Susceptible <sup>**</sup></span>
                        <strong style="color: #ef4444; font-size: 1.1rem;"><i class="fas fa-times-circle"></i> ${(r.no || 0).toLocaleString('es-CL')}</strong>
                    </span>
                    <span style="flex: 1; min-width: 200px; padding: 10px; background: white; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: flex; align-items: center; justify-content: space-between;">
                        <span style="color: #64748b; font-size: 0.9rem;">Cohorte Analizada <sup>*</sup></span>
                        <strong style="color: #0f172a; font-size: 1.1rem;"><i class="fas fa-users"></i> ${(r.total || 0).toLocaleString('es-CL')}</strong>
                    </span>
                    <span style="flex: 1; min-width: 200px; padding: 10px; background: white; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: flex; align-items: center; justify-content: space-between;">
                        <span style="color: #64748b; font-size: 0.9rem;">Celdas Vacías/Error</span>
                        <strong style="color: #f59e0b; font-size: 1.1rem;"><i class="fas fa-exclamation-triangle"></i> ${(r.vacios || 0).toLocaleString('es-CL')}</strong>
                    </span>
                </div>
                
                <div class="autoconsulta-charts-container" style="display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 25px;">
                    <div class="autoconsulta-chart-card" style="flex: 1; background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); text-align: center; border: 1px solid #e2e8f0;">
                        <h4 style="margin-bottom: 20px; color: #334155; font-size: 1.05rem;">Distribución de la Cohorte Analizada</h4>
                        <div style="position: relative; width: 180px; height: 180px; margin: 0 auto; border-radius: 50%; background: conic-gradient(#10b981 ${pctSi}%, #ef4444 ${pctSi}% 100%); display: flex; align-items: center; justify-content: center; box-shadow: inset 0 0 0 10px rgba(255,255,255,0.2), 0 8px 20px rgba(0,0,0,0.1); transition: transform 0.3s ease;">
                            <div style="width: 130px; height: 130px; background: white; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: inset 0 2px 8px rgba(0,0,0,0.05);">
                                <span style="font-size: 28px; font-weight: 800; color: #0f172a; line-height: 1;">${pctSi}%</span>
                                <span style="font-size: 13px; color: #64748b; font-weight: 500; margin-top: 4px;">Inmunizados</span>
                            </div>
                        </div>
                    </div>
                </div>

                ${htmlCausales}
                ${statsHTML}
                ${glosarioAPA}
            </div>
            
            <div style="display: flex; justify-content: center; gap: 20px; margin-top: 20px; margin-bottom: 20px; flex-wrap: wrap;" data-html2canvas-ignore="true">
                <button onclick="Autoconsulta.reset()" style="background: white; color: #475569; border: 1px solid #cbd5e1; padding: 14px 28px; border-radius: 10px; font-weight: 600; font-size: 1rem; cursor: pointer; transition: all 0.3s ease; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);" onmouseover="this.style.background='#f8fafc'; this.style.borderColor='#94a3b8'; this.style.transform='translateY(-2px)';" onmouseout="this.style.background='white'; this.style.borderColor='#cbd5e1'; this.style.transform='translateY(0)';">
                    <i class="fas fa-undo"></i> Nueva Consulta
                </button>
                <button id="autoconsultaBtnPhoto" class="autoconsulta-btn-photo" onclick="Autoconsulta.downloadPhoto()" style="background: linear-gradient(135deg, #6366f1, #4f46e5); color: white; border: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 1rem; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 6px 20px rgba(99, 102, 241, 0.3); display: flex; align-items: center; gap: 10px;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 25px rgba(99, 102, 241, 0.4)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 6px 20px rgba(99, 102, 241, 0.3)';">
                    <i class="fas fa-camera" style="font-size: 1.2rem;"></i> Descargar Foto del Reporte
                </button>
                <button id="autoconsultaBtnDownload" class="autoconsulta-btn-download" onclick="Autoconsulta.downloadResult()" style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 1rem; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 6px 20px rgba(16, 185, 129, 0.3); display: flex; align-items: center; gap: 10px;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 25px rgba(16, 185, 129, 0.4)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 6px 20px rgba(16, 185, 129, 0.3)';">
                    <i class="fas fa-file-excel" style="font-size: 1.2rem;"></i> Exportar Resultados
                </button>
            </div>
        `;
        resultsArea.style.display = 'block';
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
    },'''
    
    content = re.sub(html_pattern, html_replacement, content, flags=re.DOTALL)
    
    with open(path, 'w', encoding='utf-8') as file:
        file.write(content)
    print(f"Patched {f}")
