import os, re

files = {
    "Influenza": r"c:\Antigravity IDE\WEB DEIS\Influenza_Web\autoconsulta.js",
    "Covid":     r"c:\Antigravity IDE\WEB DEIS\Covid_Web\autoconsulta.js",
    "VRS":       r"c:\Antigravity IDE\WEB DEIS\VRS\autoconsulta.js",
    "VPH":       r"c:\Antigravity IDE\WEB DEIS\VPH_Web\autoconsulta.js"
}

def fix_generate_pdf_styling(content, vaccine_name):
    start_marker = "    _generatePDF() {"
    end_marker = "    /**\n     * Descarga el reporte visual como PNG"
    
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker)
    if end_idx == -1:
        end_marker = "    /**\r\n     * Descarga el reporte visual como PNG"
        end_idx = content.find(end_marker)
        
    if start_idx == -1 or end_idx == -1:
        print(f"[{vaccine_name}] Could not find _generatePDF bounds")
        return content
        
    new_generate = '''    _generatePDF() {
        const r = this._state.results;
        const cd = this._state.chartData;
        if (!r || !cd) {
            alert('No hay datos para generar el informe. Procese un archivo primero.');
            return;
        }
        
        const now = new Date();
        const fechaStr = now.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const horaStr = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
        
        // Construir ranking de establecimientos
        let rankingRows = '';
        if (cd.topRechazos && cd.topRechazos.length > 0) {
            cd.topRechazos.forEach((item, idx) => {
                const bgColor = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                // Clasificación de prioridad
                const globalNoPct = parseFloat(cd.pctNo);
                let prioridad = 'Baja';
                let prioColor = '#166534';
                let prioBg = '#dcfce7';
                if (item.pctLocal > globalNoPct * 1.2 && item.totalNo > 10 && item.cohorte > 30) {
                    prioridad = 'ALTA'; prioColor = '#991b1b'; prioBg = '#fee2e2';
                } else if ((item.pctLocal > globalNoPct && item.totalNo > 5) || (item.pctLocal > globalNoPct * 1.5 && item.totalNo > 2)) {
                    prioridad = 'Media'; prioColor = '#92400e'; prioBg = '#fef3c7';
                }
                rankingRows += `
                    <tr>
                        <td style="background-color: ${bgColor}; padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600; color: #475569;">${idx + 1}</td>
                        <td style="background-color: ${bgColor}; padding: 6px 8px; border: 1px solid #cbd5e1; color: #334155;">${item.comuna}</td>
                        <td style="background-color: ${bgColor}; padding: 6px 8px; border: 1px solid #cbd5e1; color: #1e293b; font-weight: 500;">${item.centro}</td>
                        <td style="background-color: ${bgColor}; padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; color: #334155;">${item.cohorte.toLocaleString('es-CL')}</td>
                        <td style="background-color: ${bgColor}; padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; color: #dc2626; font-weight: 700;">${item.totalNo.toLocaleString('es-CL')}</td>
                        <td style="background-color: ${bgColor}; padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600;">${item.pctLocal.toFixed(1)}%</td>
                        <td style="background-color: ${bgColor}; padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;"><span style="background-color: ${prioBg}; color: ${prioColor}; padding: 3px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; display: inline-block;">${prioridad}</span></td>
                        <td style="background-color: ${bgColor}; padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; color: #64748b;">${item.totalRezago.toLocaleString('es-CL')}</td>
                        <td style="background-color: ${bgColor}; padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; color: #7c3aed; font-weight: 600;">${item.totalRechazo.toLocaleString('es-CL')}</td>
                    </tr>`;
            });
        }
        
        let analisisTerritorial = '';
        if (cd.totalComunas > 1 && cd.bestComuna && cd.worstComuna && cd.bestComuna.name) {
            analisisTerritorial = `<p style="text-align: justify; margin: 10px 0;">La distribución territorial no es homogénea. La proporción con registro varía desde <strong>${cd.worstComuna.pct.toFixed(1)}%</strong> en <strong>${cd.worstComuna.name}</strong> hasta <strong>${cd.bestComuna.pct.toFixed(1)}%</strong> en <strong>${cd.bestComuna.name}</strong>, observándose una variabilidad territorial de <strong>${cd.diffExtremosPP} puntos porcentuales (pp)</strong> entre ambos extremos.</p>`;
        }
        
        let analisisConcentracion = '';
        if (cd.topRechazos && cd.topRechazos.length >= 2) {
            analisisConcentracion = `<p style="text-align: justify; margin: 10px 0;">La brecha presenta una importante <strong>concentración institucional</strong>: <strong>${cd.brechaTop2.toLocaleString('es-CL')}</strong> de las ${cd.totalRechazos.toLocaleString('es-CL')} personas sin registro (<strong>${cd.pctTop2}%</strong>) se concentran en los dos establecimientos con mayor número absoluto, mientras que los diez principales concentran <strong>${cd.brechaTop10.toLocaleString('es-CL')} personas (${cd.pctTop10}%)</strong>.</p>`;
        }

        const pdfContainer = document.createElement('div');
        pdfContainer.id = 'pdfReportContainer';
        
        // Critical FIX: html2canvas needs the element in the DOM for accurate CSS rendering (tables, alignments, colors).
        // We position it absolute, top 0, left 0, z-index -1 so it stays behind the UI and does not cause scroll/layout shifts.
        // We explicitly set a fixed width of 800px so it perfectly matches A4 proportions when scaled down.
        pdfContainer.style.cssText = 'position: absolute; top: 0; left: 0; z-index: -9999; width: 800px; background-color: #ffffff; padding: 40px; box-sizing: border-box; font-family: Arial, sans-serif; color: #1e293b; font-size: 11px; line-height: 1.5;';
        
        pdfContainer.innerHTML = `
            <div>
                <!-- CABECERA INSTITUCIONAL -->
                <div style="border-bottom: 3px solid #0f4c81; padding-bottom: 15px; margin-bottom: 25px;">
                    <table style="width: 100%; border: none; border-collapse: collapse; table-layout: fixed;">
                        <tr>
                            <td style="border: none; vertical-align: middle; width: 70%; padding: 0; text-align: left;">
                                <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; font-weight: bold;">Servicio de Salud Osorno</div>
                                <div style="font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Departamento de Estadísticas e Información de Salud (DEIS)</div>
                            </td>
                            <td style="border: none; vertical-align: middle; text-align: right; width: 30%; padding: 0;">
                                <div style="font-size: 10px; color: #64748b;">Fecha: ${fechaStr}</div>
                                <div style="font-size: 10px; color: #64748b;">Hora: ${horaStr}</div>
                            </td>
                        </tr>
                    </table>
                </div>

                <!-- TÍTULO PRINCIPAL -->
                <div style="text-align: center; margin-bottom: 35px;">
                    <h1 style="font-size: 20px; color: #0f172a; margin: 0 0 8px 0; font-weight: 800; letter-spacing: 0.5px;">INFORME DE VERIFICACIÓN DE ESTADO DE VACUNACIÓN</h1>
                    <h2 style="font-size: 15px; color: #0f4c81; margin: 0 0 8px 0; font-weight: 700;">Campaña ${cd.nombreVacuna}</h2>
                    <div style="font-size: 11px; color: #475569; margin-top: 5px;">Cruce automatizado de RUNs contra base nacional DEIS — Provincia de Osorno</div>
                </div>

                <!-- 1. INDICADORES GENERALES -->
                <div style="margin-bottom: 30px;">
                    <h3 style="font-size: 13px; color: #0f4c81; border-bottom: 2px solid #0f4c81; padding-bottom: 4px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; margin-top: 0; font-weight: bold;">1. Indicadores Generales</h3>
                    <table style="width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11px;">
                        <thead>
                            <tr>
                                <!-- html2canvas FIX: backgrounds must be applied to TH/TD, not TR. Use background-color instead of background. -->
                                <th style="background-color: #0f4c81; color: #ffffff; padding: 8px 12px; border: 1px solid #0f4c81; text-align: left; font-weight: bold; width: 65%;">Indicador</th>
                                <th style="background-color: #0f4c81; color: #ffffff; padding: 8px 12px; border: 1px solid #0f4c81; text-align: right; font-weight: bold; width: 35%;">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="background-color: #f8fafc; padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: bold; color: #334155;">Filas recibidas en archivo original</td>
                                <td style="background-color: #f8fafc; padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right; color: #0f172a;">${(r.totalRecibidos || 0).toLocaleString('es-CL')}</td>
                            </tr>
                            <tr>
                                <td style="background-color: #ffffff; padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: bold; color: #334155;">Cohorte final analizada (personas únicas)</td>
                                <td style="background-color: #ffffff; padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #0f172a;">${(r.total || 0).toLocaleString('es-CL')}</td>
                            </tr>
                            <tr>
                                <td style="background-color: #f8fafc; padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: bold; color: #334155;">Con registro de vacunación</td>
                                <td style="background-color: #f8fafc; padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right; color: #059669; font-weight: bold;">${(r.si || 0).toLocaleString('es-CL')} (${cd.pctSi}%)</td>
                            </tr>
                            <tr>
                                <td style="background-color: #ffffff; padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: bold; color: #334155;">Sin registro de vacunación</td>
                                <td style="background-color: #ffffff; padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right; color: #dc2626; font-weight: bold;">${(r.no || 0).toLocaleString('es-CL')} (${cd.pctNo}%)</td>
                            </tr>
                            <tr>
                                <td style="background-color: #f8fafc; padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: bold; color: #334155;">RUNs duplicados excluidos</td>
                                <td style="background-color: #f8fafc; padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right; color: #0f172a;">${(r.duplicados || 0).toLocaleString('es-CL')}</td>
                            </tr>
                            <tr>
                                <td style="background-color: #ffffff; padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: bold; color: #334155;">RUNs inválidos / celdas vacías</td>
                                <td style="background-color: #ffffff; padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right; color: #0f172a;">${((r.invalidos || 0) + (r.vacios || 0)).toLocaleString('es-CL')}</td>
                            </tr>
                            <tr>
                                <td style="background-color: #f8fafc; padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: bold; color: #334155;">Comunas procesadas</td>
                                <td style="background-color: #f8fafc; padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right; color: #0f172a;">${cd.totalComunas}</td>
                            </tr>
                            <tr>
                                <td style="background-color: #ffffff; padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: bold; color: #334155;">Establecimientos procesados</td>
                                <td style="background-color: #ffffff; padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right; color: #0f172a;">${cd.totalCentros}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- 2. SÍNTESIS EPIDEMIOLÓGICA -->
                <div style="margin-bottom: 30px;">
                    <h3 style="font-size: 13px; color: #0f4c81; border-bottom: 2px solid #0f4c81; padding-bottom: 4px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; margin-top: 0; font-weight: bold;">2. Síntesis Epidemiológica</h3>
                    <p style="text-align: justify; margin: 10px 0;">El cruce automatizado analizó una cohorte final de <strong>${(r.total || 0).toLocaleString('es-CL')} personas únicas</strong>, distribuidas en <strong>${cd.totalComunas} comunas</strong> y <strong>${cd.totalCentros} establecimientos</strong> de la red asistencial. Del total, <strong>${(r.si || 0).toLocaleString('es-CL')} personas (${cd.pctSi}%)</strong> presentan registro válido de vacunación para ${cd.nombreVacuna}, mientras <strong>${(r.no || 0).toLocaleString('es-CL')} (${cd.pctNo}%)</strong> no presentan registro en la base consultada.</p>
                    ${analisisTerritorial}
                    ${analisisConcentracion}
                </div>

                <!-- 3. RANKING DE ESTABLECIMIENTOS -->
                <div style="margin-bottom: 30px; page-break-inside: auto;">
                    <h3 style="font-size: 13px; color: #0f4c81; border-bottom: 2px solid #0f4c81; padding-bottom: 4px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; margin-top: 0; font-weight: bold;">3. Matriz de Priorización por Establecimiento</h3>
                    <table style="width: 100%; border-collapse: collapse; table-layout: auto; font-size: 9px; page-break-inside: auto;">
                        <thead>
                            <tr>
                                <th style="background-color: #0f4c81; color: #ffffff; padding: 6px; border: 1px solid #0f4c81; text-align: center; font-weight: bold;">#</th>
                                <th style="background-color: #0f4c81; color: #ffffff; padding: 6px; border: 1px solid #0f4c81; text-align: left; font-weight: bold;">Comuna</th>
                                <th style="background-color: #0f4c81; color: #ffffff; padding: 6px; border: 1px solid #0f4c81; text-align: left; font-weight: bold;">Establecimiento</th>
                                <th style="background-color: #0f4c81; color: #ffffff; padding: 6px; border: 1px solid #0f4c81; text-align: center; font-weight: bold;">Cohorte</th>
                                <th style="background-color: #0f4c81; color: #ffffff; padding: 6px; border: 1px solid #0f4c81; text-align: center; font-weight: bold;">Sin Reg.</th>
                                <th style="background-color: #0f4c81; color: #ffffff; padding: 6px; border: 1px solid #0f4c81; text-align: center; font-weight: bold;">% Local</th>
                                <th style="background-color: #0f4c81; color: #ffffff; padding: 6px; border: 1px solid #0f4c81; text-align: center; font-weight: bold;">Prioridad</th>
                                <th style="background-color: #0f4c81; color: #ffffff; padding: 6px; border: 1px solid #0f4c81; text-align: center; font-weight: bold;">Sin Causal</th>
                                <th style="background-color: #0f4c81; color: #ffffff; padding: 6px; border: 1px solid #0f4c81; text-align: center; font-weight: bold;">Con Causal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rankingRows}
                        </tbody>
                    </table>
                </div>

                <!-- 4. METODOLOGÍA -->
                <div style="margin-bottom: 25px; page-break-inside: avoid;">
                    <h3 style="font-size: 13px; color: #0f4c81; border-bottom: 2px solid #0f4c81; padding-bottom: 4px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; margin-top: 0; font-weight: bold;">4. Metodología y Limitaciones</h3>
                    <ul style="margin: 10px 0; padding-left: 20px; font-size: 11px;">
                        <li style="margin-bottom: 6px;"><strong style="color: #334155;">Algoritmo de cruce:</strong> Normalización de RUN módulo 11 de Chile.</li>
                        <li style="margin-bottom: 6px;"><strong style="color: #334155;">Filtros:</strong> VACUNA_ADMINISTRADA=SI, REGISTRO_ELIMINADO≠SI, CRITERIO_ELEGIBILIDAD≠EPRO, DOSIS≠EPRO.</li>
                        <li style="margin-bottom: 6px;"><strong style="color: #334155;">Limitación:</strong> El resultado "Sin registro" no constituye confirmación biológica de susceptibilidad.</li>
                    </ul>
                </div>

                <!-- PIE DE PÁGINA -->
                <div style="margin-top: 30px; padding-top: 15px; border-top: 2px solid #0f4c81; font-size: 9px; color: #64748b; text-align: center; line-height: 1.5; page-break-inside: avoid;">
                    <div>Documento generado automáticamente por la plataforma de Geointeligencia en Vacunación</div>
                    <div>Departamento de Estadísticas e Información de Salud (DEIS) — Servicio de Salud Osorno</div>
                </div>
            </div>
        `;
        
        // Add to DOM so html2canvas renders CSS styles and dimensions accurately
        document.body.appendChild(pdfContainer);
        
        // We use setTimeout to ensure browser reflows the DOM before capturing
        setTimeout(() => {
            const opt = {
                margin: [10, 0, 10, 0], // Top, Right, Bottom, Left. Right/Left 0 because container has padding.
                filename: `Informe_Vacunacion_${cd.nombreVacuna.replace(/\\s/g, '_')}_${fechaStr.replace(/\\//g, '-')}.pdf`,
                image: { type: 'jpeg', quality: 1.0 },
                html2canvas: { 
                    scale: 2, 
                    useCORS: true, 
                    logging: false,
                    backgroundColor: '#ffffff'
                },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            
            html2pdf().set(opt).from(pdfContainer).save().then(() => {
                document.body.removeChild(pdfContainer);
                if (typeof Toastify !== 'undefined') {
                    Toastify({ text: '✅ Informe PDF descargado exitosamente', duration: 4000, gravity: 'bottom', position: 'right',
                        style: { background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: '10px', fontFamily: "'Inter', sans-serif", fontWeight: '600', boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)' }
                    }).showToast();
                }
            }).catch(err => {
                console.error('Error generating PDF:', err);
                try { document.body.removeChild(pdfContainer); } catch(e) {}
                alert('Error al generar el PDF. Intente nuevamente.');
            });
        }, 100);
    },
'''
    return content[:start_idx] + new_generate + content[end_idx:]

for vaccine, path in files.items():
    if not os.path.exists(path):
        continue
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
        
    content = fix_generate_pdf_styling(content, vaccine)
    
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
        
    print(f"Fixed {vaccine} styling for PDF!")
