"""
Script integral que:
1. Corrige downloadResult() → el botón 'autoconsultaBtnDownload' ya no existe, 
   se reemplaza por lógica que no depende de un botón específico.
2. Reescribe _generatePDF() completo con diseño formal/elegante institucional.
3. Añade fallback onerror al cargar html2pdf desde CDN.
4. Aplica a los 4 módulos (Influenza, Covid, VRS, VPH).
"""
import os, re

files = {
    "Influenza": r"c:\Antigravity IDE\WEB DEIS\Influenza_Web\autoconsulta.js",
    "Covid":     r"c:\Antigravity IDE\WEB DEIS\Covid_Web\autoconsulta.js",
    "VRS":       r"c:\Antigravity IDE\WEB DEIS\VRS\autoconsulta.js",
    "VPH":       r"c:\Antigravity IDE\WEB DEIS\VPH_Web\autoconsulta.js",
}

# ──────────────────────────────────────────────────────────────────
# FIX 1: downloadResult() – eliminar dependencia del botón viejo
# ──────────────────────────────────────────────────────────────────
old_download = '''    downloadResult() {
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
                const baseName = this._state.fileName.replace(/\\.[^.]+$/, '');
                const outputName = `${baseName}_AUTOCONSULTA_INFLUENZA.xlsx`;

                XLSX.writeFile(this._state.processedWorkbook, outputName);

                // Toast de confirmación si Toastify está disponible
                if (typeof Toastify !== 'undefined') {
                    Toastify({
                        text: `OK Archivo descargado`,
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
    },'''

new_download_template = '''    downloadResult() {{
        // Close dropdown
        const menu = document.getElementById('exportDropdownMenu');
        if (menu) menu.style.display = 'none';

        if (!this._state.processedWorkbook) {{
            alert('No hay datos procesados para descargar.');
            return;
        }}

        try {{
            const baseName = this._state.fileName.replace(/\\.[^.]+$/, '');
            const outputName = `${{baseName}}_AUTOCONSULTA_{vaccine_upper}.xlsx`;

            XLSX.writeFile(this._state.processedWorkbook, outputName);

            if (typeof Toastify !== 'undefined') {{
                Toastify({{
                    text: 'OK Archivo Excel descargado exitosamente',
                    duration: 4000,
                    gravity: 'bottom',
                    position: 'right',
                    style: {{
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        borderRadius: '10px',
                        fontFamily: "'Inter', sans-serif",
                        fontWeight: '600',
                        boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)'
                    }}
                }}).showToast();
            }}
        }} catch (err) {{
            console.error("Error descargando:", err);
            alert("Hubo un error al generar el archivo Excel. Intente nuevamente.");
        }}
    }},'''

# ──────────────────────────────────────────────────────────────────
# FIX 2: downloadPDF() – añadir onerror y quitar CDN lento
# ──────────────────────────────────────────────────────────────────
old_downloadPDF = '''    downloadPDF() {
        // Close dropdown
        const menu = document.getElementById('exportDropdownMenu');
        if (menu) menu.style.display = 'none';
        
        // Load html2pdf.js dynamically if not present
        if (typeof html2pdf === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            script.onload = () => this._generatePDF();
            document.head.appendChild(script);
            
            if (typeof Toastify !== 'undefined') {
                Toastify({ text: '📄 Preparando generador PDF...', duration: 2000, gravity: 'bottom', position: 'right',
                    style: { background: 'linear-gradient(135deg, #0284c7, #0369a1)', borderRadius: '10px', fontFamily: "'Inter', sans-serif", fontWeight: '600' }
                }).showToast();
            }
            return;
        }
        this._generatePDF();
    },'''

new_downloadPDF = '''    downloadPDF() {
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
    },'''

# ──────────────────────────────────────────────────────────────────
# FIX 3: _generatePDF() – reescritura completa formal/elegante
# ──────────────────────────────────────────────────────────────────
# We'll replace from _generatePDF() { to the closing of the function
# Find start and end markers in content

def replace_generatePDF(content, vaccine_name):
    """Replace the entire _generatePDF function with the new formal version."""
    
    # Find start
    start_marker = "    _generatePDF() {"
    start_idx = content.find(start_marker)
    if start_idx == -1:
        print(f"  WARNING: _generatePDF not found")
        return content
    
    # Find end - we need to find the matching closing brace
    # The function ends with "    }," followed by a blank line or next function
    # Let's find "    /**\n     * Descarga el reporte visual como PNG"
    end_marker = "    /**\n     * Descarga el reporte visual como PNG"
    end_idx = content.find(end_marker, start_idx)
    if end_idx == -1:
        # Try with \r\n
        end_marker = "    /**\r\n     * Descarga el reporte visual como PNG"
        end_idx = content.find(end_marker, start_idx)
    
    if end_idx == -1:
        print(f"  WARNING: End of _generatePDF not found")
        return content
    
    new_generatePDF = '''    _generatePDF() {
        const r = this._state.results;
        const cd = this._state.chartData;
        if (!r || !cd) {
            alert('No hay datos para generar el informe. Procese un archivo primero.');
            return;
        }
        
        const now = new Date();
        const fechaStr = now.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const horaStr = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
        
        // ═══════════════════════════════════════════════════════════
        //  DISEÑO FORMAL E INSTITUCIONAL DEL PDF
        // ═══════════════════════════════════════════════════════════
        const pdfContainer = document.createElement('div');
        pdfContainer.id = 'pdfReportContainer';
        pdfContainer.style.cssText = 'position: absolute; left: -9999px; width: 210mm; font-family: Arial, Helvetica, sans-serif; color: #1e293b; font-size: 11px; line-height: 1.6;';
        
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
        
        // Texto de análisis territorial
        let analisisTerritorial = '';
        if (cd.totalComunas > 1 && cd.bestComuna && cd.worstComuna && cd.bestComuna.name) {
            analisisTerritorial = `<p style="text-align: justify; margin: 8px 0;">La distribución territorial no es homogénea. La proporción con registro varía desde <strong>${cd.worstComuna.pct.toFixed(1)}%</strong> en <strong>${cd.worstComuna.name}</strong> hasta <strong>${cd.bestComuna.pct.toFixed(1)}%</strong> en <strong>${cd.bestComuna.name}</strong>, observándose una variabilidad territorial de <strong>${cd.diffExtremosPP} puntos porcentuales (pp)</strong> entre ambos extremos.</p>`;
        }
        
        let analisisConcentracion = '';
        if (cd.topRechazos && cd.topRechazos.length >= 2) {
            analisisConcentracion = `<p style="text-align: justify; margin: 8px 0;">La brecha presenta una importante <strong>concentración institucional</strong>: <strong>${cd.brechaTop2.toLocaleString('es-CL')}</strong> de las ${cd.totalRechazos.toLocaleString('es-CL')} personas sin registro (<strong>${cd.pctTop2}%</strong>) se concentran en los dos establecimientos con mayor número absoluto, mientras que los diez principales concentran <strong>${cd.brechaTop10.toLocaleString('es-CL')} personas (${cd.pctTop10}%)</strong>.</p>`;
        }

        pdfContainer.innerHTML = `
            <div style="padding: 25px 30px;">
                <!-- ═══════════ CABECERA INSTITUCIONAL ═══════════ -->
                <div style="border-bottom: 3px solid #0f4c81; padding-bottom: 15px; margin-bottom: 25px;">
                    <table style="width: 100%; border: none;">
                        <tr>
                            <td style="border: none; vertical-align: middle; width: 70%;">
                                <div style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px;">Servicio de Salud Osorno</div>
                                <div style="font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px;">Departamento de Estadísticas e Información de Salud (DEIS)</div>
                            </td>
                            <td style="border: none; vertical-align: middle; text-align: right; width: 30%;">
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
                    <h3 style="font-size: 12px; color: #0f4c81; border-bottom: 2px solid #0f4c81; padding-bottom: 4px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">1. Indicadores Generales</h3>
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
                            <tr style="background: #f8fafc;">
                                <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 500;">Variabilidad territorial (rango extremos)</td>
                                <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right;">${cd.diffExtremosPP} pp</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- ═══════════ 2. SÍNTESIS EPIDEMIOLÓGICA ═══════════ -->
                <div style="margin-bottom: 20px;">
                    <h3 style="font-size: 12px; color: #0f4c81; border-bottom: 2px solid #0f4c81; padding-bottom: 4px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">2. Síntesis Epidemiológica</h3>
                    <p style="text-align: justify; margin: 8px 0;">El cruce automatizado analizó una cohorte final de <strong>${(r.total || 0).toLocaleString('es-CL')} personas únicas</strong>, distribuidas en <strong>${cd.totalComunas} comunas</strong> y <strong>${cd.totalCentros} establecimientos</strong> de la red asistencial. Del total, <strong>${(r.si || 0).toLocaleString('es-CL')} personas (${cd.pctSi}%)</strong> presentan registro válido de vacunación para ${cd.nombreVacuna}, mientras <strong>${(r.no || 0).toLocaleString('es-CL')} (${cd.pctNo}%)</strong> no presentan registro en la base consultada.</p>
                    ${analisisTerritorial}
                    ${analisisConcentracion}
                </div>

                <!-- ═══════════ 3. RANKING DE ESTABLECIMIENTOS ═══════════ -->
                <div style="margin-bottom: 20px;">
                    <h3 style="font-size: 12px; color: #0f4c81; border-bottom: 2px solid #0f4c81; padding-bottom: 4px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">3. Matriz de Priorización por Establecimiento</h3>
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
                    <h3 style="font-size: 12px; color: #0f4c81; border-bottom: 2px solid #0f4c81; padding-bottom: 4px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">4. Metodología y Limitaciones</h3>
                    <ul style="margin: 8px 0; padding-left: 18px; font-size: 10px;">
                        <li style="margin-bottom: 5px;"><strong>Fuente de datos:</strong> El usuario cargó un archivo Excel con RUNs de una cohorte poblacional. El sistema cruzó cada RUN contra la base nacional de vacunación (DEIS/MINSAL) previamente indexada.</li>
                        <li style="margin-bottom: 5px;"><strong>Algoritmo de cruce:</strong> Se aplicó normalización de RUN usando el algoritmo módulo 11 de Chile, incluyendo separación del dígito verificador y manejo de formatos variables.</li>
                        <li style="margin-bottom: 5px;"><strong>Filtros aplicados:</strong> Solo se consideran registros donde VACUNA_ADMINISTRADA=SI, REGISTRO_ELIMINADO≠SI, CRITERIO_ELEGIBILIDAD≠EPRO y DOSIS≠EPRO.</li>
                        <li style="margin-bottom: 5px;"><strong>Deduplicación:</strong> Se identifican y excluyen RUNs duplicados dentro del archivo del usuario, contabilizando cada persona una sola vez.</li>
                        <li style="margin-bottom: 5px;"><strong>Limitación principal:</strong> El resultado "Sin registro" indica ausencia de registro en la base consultada a la fecha de corte. No constituye confirmación biológica de susceptibilidad ni representa un diagnóstico médico.</li>
                        <li style="margin-bottom: 5px;"><strong>Procesamiento local:</strong> El cruce se ejecuta íntegramente en el navegador del usuario. Los datos no abandonan el computador local.</li>
                    </ul>
                </div>

                <!-- ═══════════ 5. CONCLUSIÓN ═══════════ -->
                <div style="margin-bottom: 20px;">
                    <h3 style="font-size: 12px; color: #0f4c81; border-bottom: 2px solid #0f4c81; padding-bottom: 4px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">5. Conclusión y Recomendaciones</h3>
                    <p style="text-align: justify; margin: 8px 0;">El análisis automatizado de la cohorte evidencia que un <strong>${cd.pctNo}%</strong> de las personas procesadas no presenta registro de vacunación vigente en la base nacional consultada. ${cd.totalComunas > 1 ? `La variabilidad territorial alcanza <strong>${cd.diffExtremosPP} puntos porcentuales</strong> entre comunas extremas.` : ''} ${cd.topRechazos && cd.topRechazos.length >= 2 ? `Los 2 establecimientos con mayor brecha absoluta concentran el <strong>${cd.pctTop2}%</strong> de todas las personas sin registro, lo que sugiere que intervenciones focalizadas en estos centros podrían generar un impacto significativo en la cobertura provincial.` : ''}</p>
                    <p style="text-align: justify; margin: 8px 0;">Se recomienda priorizar inicialmente los establecimientos de <strong>prioridad Alta</strong> y, posteriormente, aquellos de <strong>prioridad Media</strong> según capacidad operativa, orientando acciones de revisión de antecedentes, rescate activo y barrido territorial.</p>
                </div>

                <!-- ═══════════ PIE DE PÁGINA ═══════════ -->
                <div style="margin-top: 25px; padding-top: 12px; border-top: 2px solid #0f4c81; font-size: 8px; color: #94a3b8; text-align: center; line-height: 1.4;">
                    <div>Documento generado automáticamente por la plataforma de Geointeligencia en Vacunación</div>
                    <div>Departamento de Estadísticas e Información de Salud (DEIS) — Servicio de Salud Osorno</div>
                    <div style="margin-top: 3px;">${fechaStr} — ${horaStr} · Este informe es de uso interno y no reemplaza la validación clínica individual</div>
                </div>
            </div>
        `;
        
        document.body.appendChild(pdfContainer);
        
        const opt = {
            margin: [8, 8, 12, 8],
            filename: `Informe_Vacunacion_${cd.nombreVacuna.replace(/\\s/g, '_')}_${fechaStr.replace(/\\//g, '-')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };
        
        html2pdf().set(opt).from(pdfContainer).save().then(() => {
            document.body.removeChild(pdfContainer);
            if (typeof Toastify !== 'undefined') {
                Toastify({ text: 'OK Informe PDF descargado exitosamente', duration: 4000, gravity: 'bottom', position: 'right',
                    style: { background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: '10px', fontFamily: "'Inter', sans-serif", fontWeight: '600', boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)' }
                }).showToast();
            }
        }).catch(err => {
            console.error('Error generating PDF:', err);
            try { document.body.removeChild(pdfContainer); } catch(e) {}
            alert('Error al generar el PDF. Intente nuevamente.');
        });
    },

'''
    
    return content[:start_idx] + new_generatePDF + content[end_idx:]


# ──────────────────────────────────────────────────────────────────
#  APLICAR CAMBIOS
# ──────────────────────────────────────────────────────────────────
vaccine_upper_map = {
    "Influenza": "INFLUENZA",
    "Covid": "COVID",
    "VRS": "VRS",
    "VPH": "VPH"
}

for vaccine, path in files.items():
    if not os.path.exists(path):
        print(f"SKIP: {path} no existe")
        continue
    
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    
    changes = 0
    
    # FIX 1: downloadResult
    # Need to handle vaccine-specific name in output file
    vaccine_upper = vaccine_upper_map[vaccine]
    
    # Find the old downloadResult - it might have different vaccine names
    # Let's use a more flexible approach
    dr_start = content.find("    downloadResult() {")
    if dr_start != -1:
        # Find the end of downloadResult - look for the next method
        dr_end = content.find("\n    /**\n     * Reinicia el módulo", dr_start)
        if dr_end == -1:
            dr_end = content.find("\n    /**\r\n     * Reinicia el módulo", dr_start)
        
        if dr_end != -1:
            new_dr = new_download_template.format(vaccine_upper=vaccine_upper)
            content = content[:dr_start] + new_dr + content[dr_end:]
            changes += 1
            print(f"  [{vaccine}] FIX 1: downloadResult() corregido")
        else:
            print(f"  [{vaccine}] WARNING: fin de downloadResult no encontrado")
    else:
        print(f"  [{vaccine}] WARNING: downloadResult() no encontrado")
    
    # FIX 2: downloadPDF - add onerror
    if "script.onerror" not in content and old_downloadPDF in content:
        content = content.replace(old_downloadPDF, new_downloadPDF)
        changes += 1
        print(f"  [{vaccine}] FIX 2: downloadPDF() onerror añadido")
    elif "script.onerror" in content:
        print(f"  [{vaccine}] FIX 2: onerror ya existe, skip")
    else:
        print(f"  [{vaccine}] FIX 2: downloadPDF pattern no encontrado, intentando alternativo")
        # Try to just add onerror after onload line
        old_onload = "script.onload = () => this._generatePDF();\n            document.head.appendChild(script);"
        new_onload = "script.onload = () => this._generatePDF();\n            script.onerror = () => {\n                alert('No se pudo cargar la librería de generación PDF. Verifique su conexión a internet e intente nuevamente.');\n            };\n            document.head.appendChild(script);"
        if old_onload in content:
            content = content.replace(old_onload, new_onload)
            changes += 1
            print(f"  [{vaccine}] FIX 2: onerror añadido (alternativo)")
    
    # FIX 3: _generatePDF - rediseño completo
    content = replace_generatePDF(content, vaccine)
    changes += 1
    print(f"  [{vaccine}] FIX 3: _generatePDF() rediseñado")
    
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    
    print(f"  OK {vaccine}: {changes} correcciones aplicadas\n")

print("\n🎯 Todos los módulos actualizados exitosamente.")
