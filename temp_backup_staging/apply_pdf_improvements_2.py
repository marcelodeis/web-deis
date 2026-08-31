"""
apply_pdf_improvements_2.py
Second round of improvements based on PDF 2 observations.
Applies to: Influenza_Web, Covid_Web, VRS, VPH_Web autoconsulta.js files.
"""
import os
import re

target_modules = [
    r"c:\Antigravity IDE\WEB DEIS\Influenza_Web\autoconsulta.js",
    r"c:\Antigravity IDE\WEB DEIS\Covid_Web\autoconsulta.js",
    r"c:\Antigravity IDE\WEB DEIS\VRS\autoconsulta.js",
    r"c:\Antigravity IDE\WEB DEIS\VPH_Web\autoconsulta.js",
]

def apply_replacements(content, filepath):
    changes = 0
    
    # =========================================================================
    # 1. TRACEABILITY: Add duplicate RUT tracking to the processing loop
    # =========================================================================
    
    # 1a. Add seenRuns Set declaration after vaciosCount
    old_counters = "        let siCount = 0;\r\n        let noCount = 0;\r\n        let vaciosCount = 0;"
    new_counters = "        let siCount = 0;\r\n        let noCount = 0;\r\n        let vaciosCount = 0;\r\n        let duplicadosCount = 0;\r\n        let invalidosCount = 0;\r\n        const seenRuns = new Set();"
    if old_counters in content:
        content = content.replace(old_counters, new_counters)
        changes += 1
    else:
        # Try with LF line endings
        old_lf = old_counters.replace('\r\n', '\n')
        new_lf = new_counters.replace('\r\n', '\n')
        if old_lf in content:
            content = content.replace(old_lf, new_lf)
            changes += 1
        else:
            print(f"  WARNING: Could not find counter declarations in {filepath}")
    
    # 1b. Modify the processing loop to track duplicates and invalids
    old_loop = """                    if (!runStr) {
                        noCount++;
                        vaciosCount++;
                    } else {
                        const runNorm = normalizarRunSinDv(runStr);
                        if (runNorm && INFLUENZA_RUNS_INDEX.has(runNorm)) {
                            result = 'SI';
                            siCount++;
                        } else {
                            noCount++;
                        }
                    }"""
    new_loop = """                    if (!runStr) {
                        noCount++;
                        vaciosCount++;
                        invalidosCount++;
                    } else {
                        const runNorm = normalizarRunSinDv(runStr);
                        if (!runNorm || !/^\\d+$/.test(runNorm)) {
                            noCount++;
                            invalidosCount++;
                        } else if (seenRuns.has(runNorm)) {
                            duplicadosCount++;
                            if (INFLUENZA_RUNS_INDEX.has(runNorm)) {
                                result = 'SI';
                                siCount++;
                            } else {
                                noCount++;
                            }
                        } else {
                            seenRuns.add(runNorm);
                            if (INFLUENZA_RUNS_INDEX.has(runNorm)) {
                                result = 'SI';
                                siCount++;
                            } else {
                                noCount++;
                            }
                        }
                    }"""
    
    # We need to handle all 4 vaccine index names
    for idx_name in ['INFLUENZA_RUNS_INDEX', 'COVID_RUNS_INDEX', 'VRS_RUNS_INDEX', 'VPH_RUNS_INDEX']:
        old_specific = old_loop.replace('INFLUENZA_RUNS_INDEX', idx_name)
        new_specific = new_loop.replace('INFLUENZA_RUNS_INDEX', idx_name)
        if old_specific in content:
            content = content.replace(old_specific, new_specific)
            changes += 1
            break
    
    # 1c. Pass new counters to _finalizarProcesamiento
    old_finalizar_call = "this._finalizarProcesamiento(workbook, detectedHeader, totalDataRows, siCount, noCount, vaciosCount, statsComunas);"
    new_finalizar_call = "this._finalizarProcesamiento(workbook, detectedHeader, totalDataRows, siCount, noCount, vaciosCount, duplicadosCount, invalidosCount, statsComunas);"
    if old_finalizar_call in content:
        content = content.replace(old_finalizar_call, new_finalizar_call)
        changes += 1
    
    # 1d. Update _finalizarProcesamiento signature
    old_sig = "_finalizarProcesamiento(workbook, detectedHeader, totalRows, siCount, noCount, vaciosCount, statsComunas) {"
    new_sig = "_finalizarProcesamiento(workbook, detectedHeader, totalRows, siCount, noCount, vaciosCount, duplicadosCount, invalidosCount, statsComunas) {"
    if old_sig in content:
        content = content.replace(old_sig, new_sig)
        changes += 1
    
    # 1e. Add new fields to results object
    old_results = """            statsComunas: statsComunas,
            statsComunas: statsComunas"""
    new_results = """            statsComunas: statsComunas,
            duplicados: duplicadosCount,
            invalidos: invalidosCount,
            cohorteFinal: totalRows - duplicadosCount"""
    if old_results in content:
        content = content.replace(old_results, new_results)
        changes += 1
    
    # =========================================================================
    # 2. RENAME "Brecha en Top X" -> "Brecha acumulada Top X"
    # =========================================================================
    content = content.replace('Brecha en Top 2', 'Brecha acumulada Top 2')
    content = content.replace('Brecha en Top 10', 'Brecha acumulada Top 10')
    content = content.replace('Brecha en Top ${top80Count}', 'Brecha acumulada Top ${top80Count}')
    changes += 1
    
    # =========================================================================
    # 3. ADD MEDIAN CALCULATION for communes
    # =========================================================================
    # Insert after the brecha80/pctTop80 calculation block
    old_after_pareto = "        const pctTop80 = totalRechazos > 0 ? ((brecha80 / totalRechazos) * 100).toFixed(1) : 0;\r\n\r\n        // Nombre de la vacuna"
    new_after_pareto = """        const pctTop80 = totalRechazos > 0 ? ((brecha80 / totalRechazos) * 100).toFixed(1) : 0;\r
\r
        // Calcular mediana comunal de % con registro\r
        const comunaPcts = [];\r
        if (r.statsComunas) {\r
            for (const [comuna, centros] of Object.entries(r.statsComunas)) {\r
                let cSiM = 0, cNoM = 0;\r
                for (const stats of Object.values(centros)) { cSiM += stats.si; cNoM += stats.no; }\r
                const cTotalM = cSiM + cNoM;\r
                if (cTotalM > 0) comunaPcts.push((cSiM / cTotalM) * 100);\r
            }\r
        }\r
        comunaPcts.sort((a, b) => a - b);\r
        const medianaComunal = comunaPcts.length > 0 ? (comunaPcts.length % 2 === 0 ? ((comunaPcts[comunaPcts.length / 2 - 1] + comunaPcts[comunaPcts.length / 2]) / 2).toFixed(1) : comunaPcts[Math.floor(comunaPcts.length / 2)].toFixed(1)) : '0.0';\r
\r
        // Nombre de la vacuna"""
    if old_after_pareto in content:
        content = content.replace(old_after_pareto, new_after_pareto)
        changes += 1
    else:
        old_after_pareto_lf = old_after_pareto.replace('\r\n', '\n').replace('\r', '')
        new_after_pareto_lf = new_after_pareto.replace('\r\n', '\n').replace('\r', '')
        if old_after_pareto_lf in content:
            content = content.replace(old_after_pareto_lf, new_after_pareto_lf)
            changes += 1
        else:
            print(f"  WARNING: Could not insert median calculation in {filepath}")
    
    # =========================================================================
    # 4. ADD MEDIAN to territorial analysis text
    # =========================================================================
    old_territorial_end = """entre ambos extremos. `;\r
            \r
            const globalPctSi = parseFloat(pctSi);"""
    new_territorial_end = """entre ambos extremos. La mediana comunal de registro es <strong>${medianaComunal}%</strong>.`;\r
            \r
            const globalPctSi = parseFloat(pctSi);"""
    if old_territorial_end in content:
        content = content.replace(old_territorial_end, new_territorial_end)
        changes += 1
    else:
        # try LF
        o = old_territorial_end.replace('\r\n', '\n').replace('\r', '')
        n = new_territorial_end.replace('\r\n', '\n').replace('\r', '')
        if o in content:
            content = content.replace(o, n)
            changes += 1
        else:
            print(f"  WARNING: Could not insert median in territorial text in {filepath}")
    
    # =========================================================================
    # 5. ADD CLARIFICATION TEXT before the matrix table
    # =========================================================================
    old_matrix_start = """<i class="fas fa-exclamation-circle" style="color: #ef4444;"></i> Matriz de Priorización Operativa y Análisis de Causales <sup style="color: #64748b;">†</sup>
                                </h4>
                                <div style="overflow-x: auto;">"""
    new_matrix_start = """<i class="fas fa-exclamation-circle" style="color: #ef4444;"></i> Matriz de Priorización Operativa y Análisis de Causales <sup style="color: #64748b;">†</sup>
                                </h4>
                                <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 15px; line-height: 1.5;">Se presentan los establecimientos que registran al menos una persona sin registro de vacunación en la cohorte analizada. Los establecimientos con brecha igual a cero no se incluyen en esta tabla.</p>
                                <div style="overflow-x: auto;">"""
    if old_matrix_start in content:
        content = content.replace(old_matrix_start, new_matrix_start)
        changes += 1
    
    # =========================================================================
    # 6. DOCUMENT PRIORITY ALGORITHM + SCOPE LIMITATION in glossary
    # =========================================================================
    old_glossary_end = """                    <li><strong style="color: #334155;">‡ Registro de vacunación:</strong> Persona con registro válido de vacunación correspondiente a la campaña analizada.</li>
                </ul>"""
    new_glossary_end = """                    <li><strong style="color: #334155;">‡ Registro de vacunación:</strong> Persona con registro válido de vacunación correspondiente a la campaña analizada.</li>
                    <li style="margin-bottom: 4px;"><strong style="color: #334155;">§ Prioridad operativa:</strong> Clasificación construida mediante la combinación de la magnitud absoluta de personas sin registro, la proporción local sin registro y el tamaño de la cohorte local (N). Su finalidad es orientar la focalización operativa y no constituye una clasificación de riesgo clínico.</li>
                    <li><strong style="color: #334155;">¶ Alcance interpretativo:</strong> Los resultados describen exclusivamente la cohorte ingresada y los registros disponibles en la fuente consultada a la fecha de corte. No deben extrapolarse automáticamente a la población general de la comuna o establecimiento cuando la cohorte analizada no corresponda a su población total.</li>
                </ul>"""
    if old_glossary_end in content:
        content = content.replace(old_glossary_end, new_glossary_end)
        changes += 1
    
    # =========================================================================
    # 7. REPLACE "Calidad y metodología" section with full traceability embudo
    # =========================================================================
    old_quality = """                <details class="epi-accordion">
                    <summary><span style="display: flex; align-items: center; gap: 8px;"><i class="fas fa-info-circle" style="color: #f59e0b;"></i> Calidad y metodología de los datos</span></summary>
                    <div class="epi-content">
                        <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 15px;">
                            <span style="flex: 1; min-width: 200px; padding: 10px; background: white; border-radius: 6px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between;">
                                <span style="color: #64748b; font-size: 0.9rem;">Cohorte Analizada <sup>*</sup></span>
                                <strong style="color: #0f172a;"><i class="fas fa-users"></i> ${(r.total || 0).toLocaleString('es-CL')}</strong>
                            </span>
                            <span style="flex: 1; min-width: 200px; padding: 10px; background: white; border-radius: 6px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between;">
                                <span style="color: #64748b; font-size: 0.9rem;">Celdas Vacías/Error</span>
                                <strong style="color: #f59e0b;"><i class="fas fa-exclamation-triangle"></i> ${(r.vacios || 0).toLocaleString('es-CL')}</strong>
                            </span>
                        </div>
                        ${glosarioAPA}
                    </div>
                </details>"""
    
    new_quality = """                <details class="epi-accordion">
                    <summary><span style="display: flex; align-items: center; gap: 8px;"><i class="fas fa-info-circle" style="color: #f59e0b;"></i> Calidad, trazabilidad y metodología de los datos</span></summary>
                    <div class="epi-content">
                        <h5 style="color: #334155; font-weight: 700; margin-bottom: 12px; font-size: 0.95rem;"><i class="fas fa-filter" style="color: #0284c7;"></i> Embudo de procesamiento</h5>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px;">
                            <div style="padding: 12px; background: white; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
                                <div style="font-size: 1.4rem; font-weight: 800; color: #0f172a;">${(r.total || 0).toLocaleString('es-CL')}</div>
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
                            <i class="fas fa-info-circle" style="color: #0284c7;"></i> <strong>Nota:</strong> Los porcentajes y gráficos del informe se calculan sobre el total de registros procesados (${(r.total || 0).toLocaleString('es-CL')} filas). Los RUT duplicados se cruzan normalmente pero se contabilizan aquí para transparencia del embudo de datos.
                        </div>
                        ${glosarioAPA}
                    </div>
                </details>"""
    
    if old_quality in content:
        content = content.replace(old_quality, new_quality)
        changes += 1
    else:
        print(f"  WARNING: Could not replace quality section in {filepath}")
    
    # =========================================================================
    # 8. REFINE EXECUTIVE CONCLUSION
    # =========================================================================
    old_conclusion = """                        <p style="margin: 0; line-height: 1.7;">El análisis de la cohorte evidencia que ${(r.no || 0).toLocaleString('es-CL')} de las ${(r.total || 0).toLocaleString('es-CL')} personas procesadas (<strong>${pctNo}%</strong>) no presentan registro de vacunación en la base consultada. ${totalComunas > 1 ? `Se observa heterogeneidad territorial en la proporción de registro, con valores que varían desde <strong>${worstComuna.pct.toFixed(1)}%</strong> hasta <strong>${bestComuna.pct.toFixed(1)}%</strong>, equivalente a una amplitud de <strong>${diffExtremosPP} puntos porcentuales</strong> entre ambos extremos.` : ''} La brecha presenta además concentración institucional: ${topRechazos.length >= 2 ? `los <strong>2 establecimientos con mayor brecha absoluta</strong> reúnen el <strong>${pctTop2}%</strong> de las personas sin registro y los establecimientos del Top ${top80Count} concentran el <strong>${pctTop80}%</strong> del total.` : ''} Estos resultados permiten focalizar las acciones de revisión de antecedentes y rescate territorial, priorizando aquellos establecimientos que combinan una elevada magnitud absoluta de personas sin registro con una proporción local desfavorable, considerando siempre el tamaño de la cohorte local.</p>"""
    
    new_conclusion = """                        <p style="margin: 0; line-height: 1.7;">El análisis de la cohorte evidencia que ${(r.no || 0).toLocaleString('es-CL')} de las ${(r.total || 0).toLocaleString('es-CL')} personas procesadas (<strong>${pctNo}%</strong>) no presentan registro de vacunación en la base consultada. ${totalComunas > 1 ? `Se observa heterogeneidad territorial en la proporción de registro, con valores que varían desde <strong>${worstComuna.pct.toFixed(1)}%</strong> hasta <strong>${bestComuna.pct.toFixed(1)}%</strong>, equivalente a una amplitud de <strong>${diffExtremosPP} puntos porcentuales</strong> entre ambos extremos (mediana comunal: <strong>${medianaComunal}%</strong>).` : ''}</p>
                        <p style="margin-top: 10px; line-height: 1.7;">La brecha presenta concentración institucional: ${topRechazos.length >= 2 ? `<strong>${top80Count}</strong> de los <strong>${topRechazos.length}</strong> establecimientos analizados concentran <strong>${brecha80.toLocaleString('es-CL')} personas</strong>, equivalentes al <strong>${pctTop80}%</strong> de la brecha total.` : ''} Los <strong>2 establecimientos con mayor brecha absoluta</strong> reúnen el <strong>${pctTop2}%</strong> de las personas sin registro.</p>
                        <p style="margin-top: 10px; line-height: 1.7;">Estos resultados permiten focalizar las acciones de revisión de antecedentes y rescate territorial, priorizando aquellos establecimientos clasificados con <strong>prioridad Alta</strong> en la matriz operativa, que combinan una elevada magnitud absoluta de personas sin registro con una proporción local desfavorable, considerando siempre el tamaño de la cohorte local <sup>¶</sup>.</p>"""
    
    if old_conclusion in content:
        content = content.replace(old_conclusion, new_conclusion)
        changes += 1
    else:
        print(f"  WARNING: Could not replace conclusion in {filepath}")
    
    # =========================================================================
    # 9. ADD explicit 80% finding to epiTextTerritorial
    # =========================================================================
    old_territorial_pareto = """Esto evidencia que el problema identificado no presenta una distribución homogénea y existen núcleos territoriales claramente priorizables para intervención y revisión de antecedentes.`"""
    new_territorial_pareto = """En efecto, <strong>${top80Count}</strong> de los <strong>${topRechazos.length}</strong> establecimientos analizados (<strong>${topRechazos.length > 0 ? ((top80Count / topRechazos.length) * 100).toFixed(0) : 0}%</strong>) concentran <strong>${brecha80.toLocaleString('es-CL')} personas</strong>, equivalentes al <strong>${pctTop80}%</strong> de la brecha total, lo que evidencia focos priorizables para intervención y revisión de antecedentes.`"""
    if old_territorial_pareto in content:
        content = content.replace(old_territorial_pareto, new_territorial_pareto)
        changes += 1
    
    print(f"  Applied {changes} replacement blocks in {os.path.basename(filepath)}")
    return content

# =========================================================================
# MAIN
# =========================================================================
for filepath in target_modules:
    if not os.path.exists(filepath):
        print(f"SKIP: {filepath} does not exist.")
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    content = apply_replacements(content, filepath)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"DONE: {filepath}")
