import os
import re

files = [
    r'c:\Antigravity IDE\WEB DEIS\Influenza_Web\autoconsulta.js',
    r'c:\Antigravity IDE\WEB DEIS\Covid_Web\autoconsulta.js',
    r'c:\Antigravity IDE\WEB DEIS\VRS\autoconsulta.js',
    r'c:\Antigravity IDE\WEB DEIS\VPH_Web\autoconsulta.js'
]

new_code = r'''
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
            diffExtremosPP = (bestComuna.pct - worstComuna.pct).toFixed(1);
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

        // Nombre de la vacuna dinámico (Influenza, Covid, VRS, VPH)
        let nombreVacuna = "la Campaña";
        if (window.location.href.toLowerCase().includes('influenza')) nombreVacuna = 'Influenza 2026';
        else if (window.location.href.toLowerCase().includes('covid')) nombreVacuna = 'Covid-19';
        else if (window.location.href.toLowerCase().includes('vrs')) nombreVacuna = 'VRS';
        else if (window.location.href.toLowerCase().includes('vph')) nombreVacuna = 'VPH';

        let epiTextGeneral = `El cruce automatizado analizó <strong>${(r.total || 0).toLocaleString('es-CL')} personas</strong>`;
        if (totalComunas > 0) {
            epiTextGeneral += `, distribuidas en <strong>${totalComunas} comunas</strong> y <strong>${totalCentros} establecimientos</strong> de la red.`;
        } else {
            epiTextGeneral += `.`;
        }
        
        const cada100 = r.total > 0 ? Math.round((totalRechazos / r.total) * 100) : 0;
        
        epiTextGeneral += ` Del total, <strong>${(r.si || 0).toLocaleString('es-CL')} personas (${pctSi}%)</strong> presentan registro válido de vacunación para ${nombreVacuna}, mientras <strong>${(r.no || 0).toLocaleString('es-CL')} (${pctNo}%)</strong> no presentan registro en la base consultada. En términos poblacionales, esto representa aproximadamente <strong>${cada100} personas sin registro por cada 100 integrantes</strong> de la cohorte.`;

        let epiTextTerritorial = '';
        if (totalComunas > 0 && bestComuna.name !== '') {
            epiTextTerritorial += `La distribución territorial no es homogénea. La proporción con registro varía desde <strong>${worstComuna.pct.toFixed(1)}% en ${worstComuna.name}</strong> hasta <strong>${bestComuna.pct.toFixed(1)}% en ${bestComuna.name}</strong>, observándose una variabilidad territorial de <strong>${diffExtremosPP} puntos porcentuales (pp)</strong> entre ambos extremos. `;
            
            const globalPctSi = parseFloat(pctSi);
            if (bestComuna.name !== worstComuna.name) {
                const diffBest = (bestComuna.pct - globalPctSi).toFixed(1);
                const diffWorst = (globalPctSi - worstComuna.pct).toFixed(1);
                epiTextTerritorial += `<strong>${bestComuna.name}</strong> se ubica <strong>${diffBest} pp</strong> sobre el resultado global de la cohorte (${pctSi}%), mientras <strong>${worstComuna.name}</strong> se sitúa <strong>${diffWorst} pp</strong> por debajo. `;
            }
            
            if (topRechazos.length > 0) {
                epiTextTerritorial += `<br><br>Además, la brecha presenta una importante <strong>concentración institucional</strong>: <strong>${brechaTop2.toLocaleString('es-CL')}</strong> de las ${totalRechazos.toLocaleString('es-CL')} personas sin registro (<strong>${pctTop2}%</strong>) se concentran en los dos establecimientos con mayor número absoluto, mientras que los diez principales concentran <strong>${brechaTop10.toLocaleString('es-CL')} personas (${pctTop10}%)</strong>. Esto evidencia que el problema identificado no presenta una distribución homogénea y existen núcleos territoriales claramente priorizables para intervención y revisión de antecedentes.`;
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
                    <div style="color: #64748b; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px;">Brecha en Top 2</div>
                </div>
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="color: #8b5cf6; font-size: 1.8rem; font-weight: 800;">${pctTop10}%</div>
                    <div style="color: #64748b; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px;">Brecha en Top 10</div>
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
                                <div style="overflow-x: auto;">
                                    <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                                        <thead>
                                            <tr style="background: #f8fafc; color: #475569; text-align: left; font-size: 0.8rem; text-transform: uppercase;">
                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0;">Comuna</th>
                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0;">Establecimiento</th>
                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; text-align: center;" title="Total de personas sin registro en la base de datos">Total Sin Registro</th>
                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; text-align: center;" title="Porcentaje de personas sin registro dentro de la cohorte propia del establecimiento">Prioridad Relativa<br><span style="font-size: 0.7rem; font-weight: normal;">(% local sin registro)</span></th>
                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; text-align: center;" title="Sin registro - sin causal informada (Rezagos)">Sin causal informada</th>
                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; text-align: center;" title="Sin registro - con causal informada (Rechazos)">Con causal informada</th>
                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0;">Detalle de causal registrada</th>
                                            </tr>
                                        </thead>
                                        <tbody>`;
                                        
            for (let i = 0; i < Math.min(topRechazos.length, 15); i++) {
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
                let priorityColor = '#0f172a';
                if (item.pctLocal > globalNo * 1.5) priorityColor = '#ef4444';
                else if (item.pctLocal > globalNo) priorityColor = '#f59e0b';
                
                htmlCausales += `<tr style="border-bottom: 1px solid #f1f5f9; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#f8fafc'" onmouseout="this.style.backgroundColor='transparent'">
                                    <td style="padding: 10px; color: #334155;">${item.comuna}</td>
                                    <td style="padding: 10px; color: #0f172a; font-weight: 500;">${item.centro}</td>
                                    <td style="padding: 10px; text-align: center; color: #ef4444; font-weight: 700;">${item.totalNo.toLocaleString('es-CL')}</td>
                                    <td style="padding: 10px; text-align: center; color: ${priorityColor}; font-weight: 700; font-size: 0.95rem;">${item.pctLocal.toFixed(1)}%</td>
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
                                                <td style="padding: 12px 10px; text-align: center; color: #ef4444; font-size: 1.05rem;">${totalRechazos.toLocaleString('es-CL')}</td>
                                                <td style="padding: 12px 10px; text-align: center; color: #0f172a; font-size: 1.05rem;">${pctNo}%</td>
                                                <td style="padding: 12px 10px; text-align: center; color: #64748b; font-size: 1.05rem;">${globalRezago.toLocaleString('es-CL')}</td>
                                                <td style="padding: 12px 10px; text-align: center; color: #8b5cf6; font-size: 1.05rem;">${globalRechazo.toLocaleString('es-CL')}</td>
                                                <td style="padding: 12px 10px;"></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                             </div>`;
        }
'''

for filepath in files:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # The block we want to replace starts with:
    # // --- Lógica Avanzada de Síntesis Epidemiológica ---
    # and ends exactly before:
    #         const glosarioAPA = `

    pattern = r'// --- Lógica Avanzada de Síntesis Epidemiológica ---.*?const glosarioAPA = `'
    match = re.search(pattern, content, flags=re.DOTALL)
    
    if match:
        content = content[:match.start()] + new_code.strip() + '\n\n        const glosarioAPA = `' + content[match.end():]
        # Inject hallazgosHtml into the epi-accordion container
        # Search for: <details class="epi-accordion" open>
        #                 <summary><span style="display: flex; align-items: center; gap: 8px;"><i class="fas fa-chart-pie" style="color: #0284c7;"></i> Resultado general</span></summary>
        #                 <div class="epi-content">${epiTextGeneral}</div>
        #             </details>
        
        # Replace `<div class="epi-content">${epiTextGeneral}</div>` with 
        # `<div class="epi-content">\n${hallazgosHtml}\n${epiTextGeneral}</div>`
        
        if "hallazgosHtml" not in content:
            content = content.replace('class="epi-content">${epiTextGeneral}</div>', 'class="epi-content">${hallazgosHtml}${epiTextGeneral}</div>')
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Refactored {filepath}")
    else:
        print(f"Could not find block in {filepath}")
