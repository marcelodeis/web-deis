"""
apply_pdf_improvements_3.py
Final round of improvements based on the third PDF.
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
    # 1. FIX DUPLICATE COUNTERS (STRICT DEDUPLICATION)
    # =========================================================================
    # We want to change the loop inside procesarLote so that if it's a duplicate, it just returns SI or NO but doesn't increment stats.
    # We will replace the inner logic entirely.
    
    # Let's locate the inner logic for each specific vaccine index
    for idx_name in ['INFLUENZA_RUNS_INDEX', 'COVID_RUNS_INDEX', 'VRS_RUNS_INDEX', 'VPH_RUNS_INDEX']:
        old_loop_logic = f"""                    if (!runStr) {{
                        noCount++;
                        vaciosCount++;
                        invalidosCount++;
                    }} else {{
                        const runNorm = normalizarRunSinDv(runStr);
                        if (!runNorm || !/^\\d+$/.test(runNorm)) {{
                            noCount++;
                            invalidosCount++;
                        }} else if (seenRuns.has(runNorm)) {{
                            duplicadosCount++;
                            if ({idx_name}.has(runNorm)) {{
                                result = 'SI';
                                siCount++;
                            }} else {{
                                noCount++;
                            }}
                        }} else {{
                            seenRuns.add(runNorm);
                            if ({idx_name}.has(runNorm)) {{
                                result = 'SI';
                                siCount++;
                            }} else {{
                                noCount++;
                            }}
                        }}
                    }}
"""
        
        new_loop_logic = f"""                    let esValidoYUnico = false;
                    if (!runStr) {{
                        vaciosCount++;
                        invalidosCount++;
                    }} else {{
                        const runNorm = normalizarRunSinDv(runStr);
                        if (!runNorm || !/^\\d+$/.test(runNorm)) {{
                            invalidosCount++;
                        }} else if (seenRuns.has(runNorm)) {{
                            duplicadosCount++;
                            if ({idx_name}.has(runNorm)) {{
                                result = 'SI';
                            }}
                        }} else {{
                            seenRuns.add(runNorm);
                            esValidoYUnico = true;
                            if ({idx_name}.has(runNorm)) {{
                                result = 'SI';
                                siCount++;
                            }} else {{
                                noCount++;
                            }}
                        }}
                    }}
"""
        # Note: I need to handle `statsComunas` which is just below this block!
        # If it's not `esValidoYUnico`, we shouldn't execute the statsComunas logic.
        # So I will wrap the statsComunas logic in `if (esValidoYUnico && comunaColIdx !== -1 && centroColIdx !== -1)`
        
        # We need to replace the entire chunk to handle the wrapping properly
        
        chunk_to_replace = old_loop_logic + """
                    
                    if (comunaColIdx !== -1 && centroColIdx !== -1) {"""
        
        chunk_replacement = new_loop_logic + """
                    
                    if (esValidoYUnico && comunaColIdx !== -1 && centroColIdx !== -1) {"""
        
        if chunk_to_replace in content:
            content = content.replace(chunk_to_replace, chunk_replacement)
            changes += 1
            break
        else:
            # Try LF
            o = chunk_to_replace.replace('\r\n', '\n').replace('\r', '')
            n = chunk_replacement.replace('\r\n', '\n').replace('\r', '')
            if o in content:
                content = content.replace(o, n)
                changes += 1
                break
    
    # 1b. Fix cohorte final calc. `totalRows` is now meaningless for `pctSi` etc. We must use `totalValidos` = siCount + noCount
    # Since totalRows is passed to `_finalizarProcesamiento`, let's just intercept it there.
    old_finalizar = """            total: totalRows,
            si: siCount,
            no: noCount,
            vacios: vaciosCount,
            pctSi: totalRows > 0 ? ((siCount / totalRows) * 100).toFixed(1) : '0.0',
            pctNo: totalRows > 0 ? ((noCount / totalRows) * 100).toFixed(1) : '0.0',
            columnaDetectada: detectedHeader,
            statsComunas: statsComunas,
            duplicados: duplicadosCount,
            invalidos: invalidosCount,
            cohorteFinal: totalRows - duplicadosCount"""
    
    new_finalizar = """            totalRecibidos: totalRows,
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
            cohorteFinal: siCount + noCount"""
    
    if old_finalizar in content:
        content = content.replace(old_finalizar, new_finalizar)
        changes += 1
    else:
        o = old_finalizar.replace('\r\n', '\n')
        n = new_finalizar.replace('\r\n', '\n')
        if o in content:
            content = content.replace(o, n)
            changes += 1
            
    # We must fix references to `r.total` in the UI to mean `r.total` which is now Cohorte Final. 
    # But wait! In the embudo, we use `r.total` as "Registros recibidos"!
    # I changed `totalRecibidos: totalRows` in the state. I need to update the embudo.
    old_embudo_received = """<div style="font-size: 1.4rem; font-weight: 800; color: #0f172a;">${(r.total || 0).toLocaleString('es-CL')}</div>
                                <div style="font-size: 0.8rem; color: #64748b; text-transform: uppercase;">Registros recibidos</div>"""
    new_embudo_received = """<div style="font-size: 1.4rem; font-weight: 800; color: #0f172a;">${(r.totalRecibidos || 0).toLocaleString('es-CL')}</div>
                                <div style="font-size: 0.8rem; color: #64748b; text-transform: uppercase;">Registros recibidos</div>"""
    if old_embudo_received in content:
        content = content.replace(old_embudo_received, new_embudo_received)
        changes += 1
        
    old_embudo_note = """Los porcentajes y gráficos del informe se calculan sobre el total de registros procesados (${(r.total || 0).toLocaleString('es-CL')} filas). Los RUT duplicados se cruzan normalmente pero se contabilizan aquí para transparencia del embudo de datos."""
    new_embudo_note = """Los porcentajes y gráficos del informe se calculan estrictamente sobre la <strong>Cohorte Final</strong> (${(r.cohorteFinal || 0).toLocaleString('es-CL')} personas únicas). Los RUT duplicados o inválidos detectados en el archivo original (${(r.totalRecibidos || 0).toLocaleString('es-CL')} filas) fueron excluidos del análisis estadístico, garantizando que un mismo individuo no altere los resultados poblacionales."""
    if old_embudo_note in content:
        content = content.replace(old_embudo_note, new_embudo_note)
        changes += 1
    else:
        o = old_embudo_note.replace('\r\n', '\n')
        n = new_embudo_note.replace('\r\n', '\n')
        if o in content:
            content = content.replace(o, n)
            changes += 1
            
    # =========================================================================
    # 2. ACLARAR ESTABLECIMIENTOS (Total vs con Brecha) + 6. PARETO PERCENTAGE
    # =========================================================================
    old_epi_gen = """        let epiTextGeneral = `El cruce automatizado analizó <strong>${(r.total || 0).toLocaleString('es-CL')} personas</strong>`;
        if (totalComunas > 0) {
            epiTextGeneral += `, distribuidas en <strong>${totalComunas} comunas</strong> y <strong>${totalCentros} establecimientos</strong> de la red.`;
        } else {
            epiTextGeneral += `.`;
        }"""
    
    new_epi_gen = """        let epiTextGeneral = `El cruce automatizado analizó una cohorte final de <strong>${(r.total || 0).toLocaleString('es-CL')} personas únicas</strong>`;
        if (totalComunas > 0) {
            epiTextGeneral += `, distribuidas en <strong>${totalComunas} comunas</strong> y <strong>${totalCentros} establecimientos</strong> de la red.`;
        } else {
            epiTextGeneral += `.`;
        }"""
    if old_epi_gen in content:
        content = content.replace(old_epi_gen, new_epi_gen)
        changes += 1
    else:
        o = old_epi_gen.replace('\r\n', '\n')
        n = new_epi_gen.replace('\r\n', '\n')
        if o in content:
            content = content.replace(o, n)
            changes += 1

    old_pareto_text = """En efecto, <strong>${top80Count}</strong> de los <strong>${topRechazos.length}</strong> establecimientos analizados (<strong>${topRechazos.length > 0 ? ((top80Count / topRechazos.length) * 100).toFixed(0) : 0}%</strong>) concentran <strong>${brecha80.toLocaleString('es-CL')} personas</strong>, equivalentes al <strong>${pctTop80}%</strong> de la brecha total, lo que evidencia focos priorizables para intervención y revisión de antecedentes.`"""
    new_pareto_text = """En efecto, de los ${totalCentros} establecimientos incluidos en la cohorte, <strong>${topRechazos.length}</strong> presentan al menos una persona sin registro. Si <strong>${top80Count}</strong> de estos establecimientos concentran <strong>${brecha80.toLocaleString('es-CL')} personas</strong>, entonces representan el <strong>${topRechazos.length > 0 ? ((top80Count / topRechazos.length) * 100).toFixed(1) : 0}%</strong> de los establecimientos con brecha y concentran el <strong>${pctTop80}%</strong> de la brecha total, lo que evidencia focos priorizables para intervención y revisión de antecedentes.`"""
    if old_pareto_text in content:
        content = content.replace(old_pareto_text, new_pareto_text)
        changes += 1
    
    # 5. EXPLOTAR LA MEDIANA
    old_mediana_territorial = """entre ambos extremos. La mediana comunal de registro es <strong>${medianaComunal}%</strong>.`;"""
    new_mediana_territorial = """entre ambos extremos. La mediana comunal de registro es <strong>${medianaComunal}%</strong>. `;
            const diffMedianaGlobal = Math.abs(parseFloat(medianaComunal) - globalPctSi).toFixed(1);
            if (diffMedianaGlobal >= 1.0) {
                epiTextTerritorial += `La diferencia entre la mediana comunal (${medianaComunal}%) y el resultado global (${pctSi}%) es de <strong>${diffMedianaGlobal} pp</strong>, lo que sugiere que los territorios con mayor peso poblacional están desplazando el resultado agregado hacia ${parseFloat(medianaComunal) > globalPctSi ? 'abajo' : 'arriba'}. `;
            }"""
    
    if old_mediana_territorial in content:
        content = content.replace(old_mediana_territorial, new_mediana_territorial)
        changes += 1
    
    # =========================================================================
    # 3. MATRIZ DE PRIORIZACIÓN: MOSTRAR TODOS y AGREGAR LEYENDA (8)
    # =========================================================================
    old_loop_matriz = """for (let i = 0; i < Math.min(topRechazos.length, 15); i++) {"""
    new_loop_matriz = """for (let i = 0; i < topRechazos.length; i++) {"""
    if old_loop_matriz in content:
        content = content.replace(old_loop_matriz, new_loop_matriz)
        changes += 1
        
    old_overflow_matriz = """<div style="overflow-x: auto;">"""
    new_overflow_matriz = """<div style="overflow-x: auto; max-height: 500px; overflow-y: auto;">"""
    if old_overflow_matriz in content:
        content = content.replace(old_overflow_matriz, new_overflow_matriz)
        changes += 1
        
    old_leyenda = """<p style="font-size: 0.8rem; color: #64748b; margin-top: 15px; margin-bottom: 0;">† Interpretar con cautela: proporción calculada sobre una cohorte local pequeña; variaciones de pocos registros pueden producir cambios importantes en el porcentaje (N &lt; 30).</p>"""
    new_leyenda = """<p style="font-size: 0.8rem; color: #64748b; margin-top: 15px; margin-bottom: 5px;">† Interpretar con cautela: proporción calculada sobre una cohorte local pequeña; variaciones de pocos registros pueden producir cambios importantes en el porcentaje (N &lt; 30).</p>
                                <p style="font-size: 0.8rem; color: #475569; margin-top: 5px; margin-bottom: 0; background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0;"><strong>Regla de Prioridad Operativa:</strong><br>
                                <span style="color: #991b1b; font-weight: 600;">Alta:</span> % Brecha local > 20% sobre el global AND Brecha absoluta > 10 casos AND Cohorte local > 30.<br>
                                <span style="color: #92400e; font-weight: 600;">Media:</span> (% Brecha local > global AND > 5 casos) OR (% Brecha local > 50% sobre el global AND > 2 casos).<br>
                                <span style="color: #166534; font-weight: 600;">Baja:</span> Resto de establecimientos.</p>"""
    if old_leyenda in content:
        content = content.replace(old_leyenda, new_leyenda)
        changes += 1
        
    # =========================================================================
    # 4. CAMBIAR "Promedio Global" -> "Resultado Global de la Cohorte"
    # =========================================================================
    content = content.replace('Registro por Comuna vs Promedio Global', 'Registro por Comuna vs Resultado Global de la Cohorte')
    # Let's also check if "Promedio" exists
    
    # =========================================================================
    # 7. ORDENAR TARJETAS ACUMULATIVAS
    # =========================================================================
    # Current order in HTML string:
    old_cards_order = """                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="color: #f59e0b; font-size: 1.8rem; font-weight: 800;">${pctTop2}%</div>
                    <div style="color: #64748b; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px;">Brecha acumulada Top 2</div>
                </div>
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="color: #8b5cf6; font-size: 1.8rem; font-weight: 800;">${pctTop10}%</div>
                    <div style="color: #64748b; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px;">Brecha acumulada Top 10</div>
                </div>
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="color: #ec4899; font-size: 1.8rem; font-weight: 800;">${pctTop80}%</div>
                    <div style="color: #64748b; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px;">Brecha acumulada Top ${top80Count}</div>
                </div>"""
                
    new_cards_order = """                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
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
                </div>"""
                
    if old_cards_order in content:
        content = content.replace(old_cards_order, new_cards_order)
        changes += 1
    else:
        o = old_cards_order.replace('\r\n', '\n')
        n = new_cards_order.replace('\r\n', '\n')
        if o in content:
            content = content.replace(o, n)
            changes += 1

    # =========================================================================
    # 9. REFINAR CONCLUSION EJECUTIVA
    # =========================================================================
    old_conclusion_2 = """<p style="margin-top: 10px; line-height: 1.7;">La brecha presenta concentración institucional: ${topRechazos.length >= 2 ? `<strong>${top80Count}</strong> de los <strong>${topRechazos.length}</strong> establecimientos analizados concentran <strong>${brecha80.toLocaleString('es-CL')} personas</strong>, equivalentes al <strong>${pctTop80}%</strong> de la brecha total.` : ''} Los <strong>2 establecimientos con mayor brecha absoluta</strong> reúnen el <strong>${pctTop2}%</strong> de las personas sin registro.</p>"""
    
    new_conclusion_2 = """<p style="margin-top: 10px; line-height: 1.7;">La brecha presenta concentración institucional: De los <strong>${totalCentros}</strong> establecimientos incluidos en la cohorte, <strong>${topRechazos.length}</strong> presentan al menos una persona sin registro. ${topRechazos.length >= 2 ? `<strong>${top80Count}</strong> de estos establecimientos concentran <strong>${brecha80.toLocaleString('es-CL')} personas</strong>, equivalentes al <strong>${pctTop80}%</strong> de la brecha total.` : ''}</p>"""
    
    if old_conclusion_2 in content:
        content = content.replace(old_conclusion_2, new_conclusion_2)
        changes += 1

    # Additional text update in conclusion: mention duplicate removal
    old_conclusion_1 = """<p style="margin: 0; line-height: 1.7;">El análisis de la cohorte evidencia que ${(r.no || 0).toLocaleString('es-CL')} de las ${(r.total || 0).toLocaleString('es-CL')} personas procesadas (<strong>${pctNo}%</strong>) no presentan registro de vacunación en la base consultada. """
    new_conclusion_1 = """<p style="margin: 0; line-height: 1.7;">El análisis de la cohorte única evidencia que ${(r.no || 0).toLocaleString('es-CL')} de las ${(r.total || 0).toLocaleString('es-CL')} personas procesadas (<strong>${pctNo}%</strong>) no presentan registro de vacunación en la base consultada. """
    if old_conclusion_1 in content:
        content = content.replace(old_conclusion_1, new_conclusion_1)
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
