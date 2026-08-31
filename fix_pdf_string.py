import os

files = {
    "Influenza": r"c:\Antigravity IDE\WEB DEIS\Influenza_Web\autoconsulta.js",
    "Covid":     r"c:\Antigravity IDE\WEB DEIS\Covid_Web\autoconsulta.js",
    "VRS":       r"c:\Antigravity IDE\WEB DEIS\VRS\autoconsulta.js",
    "VPH":       r"c:\Antigravity IDE\WEB DEIS\VPH_Web\autoconsulta.js"
}

def fix_generate_pdf_string(content, vaccine_name):
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
                    <tr style="background: ${bgColor};">
                        <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600; color: #475569;">${idx + 1}</td>
                        <td style="padding: 5px 8px; border: 1px solid #cbd5e1; color: #334155;">${item.comuna}</td>
                        <td style="padding: 5px 8px; border: 1px solid #cbd5e1; color: #1e293b; font-weight: 500;">${item.centro}</td>
                        <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; color: #334155;">${item.cohorte.toLocaleString('es-CL')}</td>
                        <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; color: #dc2626; font-weight: 700;">${item.totalNo.toLocaleString('es-CL')}</td>
                        <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600;">${item.pctLocal.toFixed(1)}%</td>
                        <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center;"><span style="background: ${prioBg}; color: ${prioColor}; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 700;">${prioridad}</span></td>
                        <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; color: #64748b;">${item.totalRezago.toLocaleString('es-CL')}</td>
                        <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; color: #7c3aed; font-weight: 600;">${item.totalRechazo.toLocaleString('es-CL')}</td>
                    </tr>`;
            });
        }
        
        let analisisTerritorial = '';
        if (cd.totalComunas > 1 && cd.bestComuna && cd.worstComuna && cd.bestComuna.name) {
            analisisTerritorial = `<p style="text-align: justify; margin: 8px 0;">La distribución territorial no es homogénea. La proporción con registro varía desde <strong>${cd.worstComuna.pct.toFixed(1)}%</strong> en <strong>${cd.worstComuna.name}</strong> hasta <strong>${cd.bestComuna.pct.toFixed(1)}%</strong> en <strong>${cd.bestComuna.name}</strong>, observándose una variabilidad territorial de <strong>${cd.diffExtremosPP} puntos porcentuales (pp)</strong> entre ambos extremos.</p>`;
        }
        
        let analisisConcentracion = '';
        if (cd.topRechazos && cd.topRechazos.length >= 2) {
            analisisConcentracion = `<p style="text-align: justify; margin: 8px 0;">La brecha presenta una importante <strong>concentración institucional</strong>: <strong>${cd.brechaTop2.toLocaleString('es-CL')}</strong> de las ${cd.totalRechazos.toLocaleString('es-CL')} personas sin registro (<strong>${cd.pctTop2}%</strong>) se concentran en los dos establecimientos con mayor número absoluto, mientras que los diez principales concentran <strong>${cd.brechaTop10.toLocaleString('es-CL')} personas (${cd.pctTop10}%)</strong>.</p>`;
        }

        // We use a pure HTML string with inline styles.
        // This avoids ANY DOM manipulation on the main window, preventing layout glitches and blank captures!
        const htmlContent = `
            <div style="padding: 10px 20px; font-family: Arial, Helvetica, sans-serif; color: #1e293b; font-size: 11px; line-height: 1.6; background-color: white;">
                <!-- ═══════════ CABECERA INSTITUCIONAL ═══════════ -->
                <div style="border-bottom: 3px solid #0f4c81; padding-bottom: 15px; margin-bottom: 25px;">
                    <table style="width: 100%; border: none; border-collapse: collapse;">
                        <tr>
                            <td style="border: none; vertical-align: middle; width: 70%; padding: 0;">
                                <div style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px;">Servicio de Salud Osorno</div>
                                <div style="font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px;">Departamento de Estadísticas e Información de Salud (DEIS)</div>
                            </td>
                            <td style="border: none; vertical-align: middle; text-align: right; width: 30%; padding: 0;">
                                <div style="font-size: 9px; color: #94a3b8;">Fecha: ${fechaStr}</div>
                                <div style="font-size: 9px; color: #94a3b8;">Hora: ${horaStr}</div>
                            </td>
                        </tr>
                    </table>
                </div>

                <!-- ═══════════ TÍTULO PRINCIPAL ═══════════ -->
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="font-size: 18px; color: #0f172a; margin: 0 0 5px 0; font-weight: 800; letter-spacing: 0.5px;">INFORME DE VERIFICACIÓN DE ESTADO DE VACUNACIÓN</h1>
                    <h2 style="font-size: 14px; color: #0f4c81; margin: 0 0 5px 0; font-weight: 600;">Campaña ${cd.nombreVacuna}</h2>
                    <div style="font-size: 10px; color: #64748b; margin-top: 8px;">Cruce automatizado de RUNs contra base nacional DEIS — Provincia de Osorno</div>
                </div>

                <!-- ═══════════ 1. INDICADORES GENERALES ═══════════ -->
                <div style="margin-bottom: 20px;">
                    <h3 style="font-size: 12px; color: #0f4c81; border-bottom: 2px solid #0f4c81; padding-bottom: 4px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; margin-top: 0;">1. Indicadores Generales</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                        <thead>
                            <tr style="background: #0f4c81; color: #ffffff;">
                                <th style="padding: 7px 10px; border: 1px solid #0f4c81; text-align: left; font-weight: 600; width: 55%;">Indicador</th>
                                <th style="padding: 7px 10px; border: 1px solid #0f4c81; text-align: right; font-weight: 600;">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style="background: #f8fafc;">
                                <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 500;">Filas recibidas en archivo original</td>
                                <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right;">${(r.totalRecibidos || 0).toLocaleString('es-CL')}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 500;">Cohorte final analizada (personas únicas)</td>
                                <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; font-weight: 700;">${(r.total || 0).toLocaleString('es-CL')}</td>
                            </tr>
                            <tr style="background: #f8fafc;">
                                <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 500;">Con registro de vacunación</td>
                                <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; color: #059669; font-weight: 700;">${(r.si || 0).toLocaleString('es-CL')} (${cd.pctSi}%)</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 500;">Sin registro de vacunación</td>
                                <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; color: #dc2626; font-weight: 700;">${(r.no || 0).toLocaleString('es-CL')} (${cd.pctNo}%)</td>
                            </tr>
                            <tr style="background: #f8fafc;">
                                <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 500;">RUNs duplicados excluidos</td>
                                <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right;">${(r.duplicados || 0).toLocaleString('es-CL')}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 500;">RUNs inválidos / celdas vacías</td>
                                <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right;">${((r.invalidos || 0) + (r.vacios || 0)).toLocaleString('es-CL')}</td>
                            </tr>
                            <tr style="background: #f8fafc;">
                                <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 500;">Comunas procesadas</td>
                                <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right;">${cd.totalComunas}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 500;">Establecimientos procesados</td>
                                <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right;">${cd.totalCentros}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- ═══════════ 2. SÍNTESIS EPIDEMIOLÓGICA ═══════════ -->
                <div style="margin-bottom: 20px;">
                    <h3 style="font-size: 12px; color: #0f4c81; border-bottom: 2px solid #0f4c81; padding-bottom: 4px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; margin-top: 0;">2. Síntesis Epidemiológica</h3>
                    <p style="text-align: justify; margin: 8px 0;">El cruce automatizado analizó una cohorte final de <strong>${(r.total || 0).toLocaleString('es-CL')} personas únicas</strong>, distribuidas en <strong>${cd.totalComunas} comunas</strong> y <strong>${cd.totalCentros} establecimientos</strong> de la red asistencial. Del total, <strong>${(r.si || 0).toLocaleString('es-CL')} personas (${cd.pctSi}%)</strong> presentan registro válido de vacunación para ${cd.nombreVacuna}, mientras <strong>${(r.no || 0).toLocaleString('es-CL')} (${cd.pctNo}%)</strong> no presentan registro en la base consultada.</p>
                    ${analisisTerritorial}
                    ${analisisConcentracion}
                </div>

                <!-- ═══════════ 3. RANKING DE ESTABLECIMIENTOS ═══════════ -->
                <div style="margin-bottom: 20px;">
                    <h3 style="font-size: 12px; color: #0f4c81; border-bottom: 2px solid #0f4c81; padding-bottom: 4px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; margin-top: 0;">3. Matriz de Priorización por Establecimiento</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
                        <thead>
                            <tr style="background: #0f4c81; color: #ffffff;">
                                <th style="padding: 5px; border: 1px solid #0f4c81; text-align: center; font-weight: 600;">#</th>
                                <th style="padding: 5px; border: 1px solid #0f4c81; text-align: left; font-weight: 600;">Comuna</th>
                                <th style="padding: 5px; border: 1px solid #0f4c81; text-align: left; font-weight: 600;">Establecimiento</th>
                                <th style="padding: 5px; border: 1px solid #0f4c81; text-align: center; font-weight: 600;">Cohorte</th>
                                <th style="padding: 5px; border: 1px solid #0f4c81; text-align: center; font-weight: 600;">Sin Reg.</th>
                                <th style="padding: 5px; border: 1px solid #0f4c81; text-align: center; font-weight: 600;">% Local</th>
                                <th style="padding: 5px; border: 1px solid #0f4c81; text-align: center; font-weight: 600;">Prioridad</th>
                                <th style="padding: 5px; border: 1px solid #0f4c81; text-align: center; font-weight: 600;">Sin Causal</th>
                                <th style="padding: 5px; border: 1px solid #0f4c81; text-align: center; font-weight: 600;">Con Causal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rankingRows}
                        </tbody>
                    </table>
                </div>

                <!-- ═══════════ 4. METODOLOGÍA ═══════════ -->
                <div style="margin-bottom: 20px;">
                    <h3 style="font-size: 12px; color: #0f4c81; border-bottom: 2px solid #0f4c81; padding-bottom: 4px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; margin-top: 0;">4. Metodología y Limitaciones</h3>
                    <ul style="margin: 8px 0; padding-left: 18px; font-size: 10px;">
                        <li style="margin-bottom: 5px;"><strong>Algoritmo de cruce:</strong> Normalización de RUN módulo 11 de Chile.</li>
                        <li style="margin-bottom: 5px;"><strong>Filtros:</strong> VACUNA_ADMINISTRADA=SI, REGISTRO_ELIMINADO≠SI, CRITERIO_ELEGIBILIDAD≠EPRO, DOSIS≠EPRO.</li>
                        <li style="margin-bottom: 5px;"><strong>Limitación:</strong> El resultado "Sin registro" no constituye confirmación biológica de susceptibilidad.</li>
                    </ul>
                </div>

                <!-- ═══════════ PIE DE PÁGINA ═══════════ -->
                <div style="margin-top: 25px; padding-top: 12px; border-top: 2px solid #0f4c81; font-size: 8px; color: #94a3b8; text-align: center; line-height: 1.4;">
                    <div>Documento generado automáticamente por la plataforma de Geointeligencia en Vacunación</div>
                    <div>Departamento de Estadísticas e Información de Salud (DEIS) — Servicio de Salud Osorno</div>
                </div>
            </div>
        `;
        
        const opt = {
            margin: [8, 8, 12, 8],
            filename: `Informe_Vacunacion_${cd.nombreVacuna.replace(/\\s/g, '_')}_${fechaStr.replace(/\\//g, '-')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
                scale: 2, 
                useCORS: true, 
                logging: false
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };
        
        // Pass the raw HTML string directly to html2pdf
        html2pdf().set(opt).from(htmlContent).save().then(() => {
            if (typeof Toastify !== 'undefined') {
                Toastify({ text: '✅ Informe PDF descargado exitosamente', duration: 4000, gravity: 'bottom', position: 'right',
                    style: { background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: '10px', fontFamily: "'Inter', sans-serif", fontWeight: '600', boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)' }
                }).showToast();
            }
        }).catch(err => {
            console.error('Error generating PDF:', err);
            alert('Error al generar el PDF. Intente nuevamente.');
        });
    },
'''
    return content[:start_idx] + new_generate + content[end_idx:]

for vaccine, path in files.items():
    if not os.path.exists(path):
        continue
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
        
    content = fix_generate_pdf_string(content, vaccine)
    
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
        
    print(f"Fixed {vaccine} with string HTML injection!")
