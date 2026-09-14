import os

target_modules = [
    r"c:\Antigravity IDE\WEB DEIS\Influenza_Web\autoconsulta.js",
    r"c:\Antigravity IDE\WEB DEIS\Covid_Web\autoconsulta.js",
    r"c:\Antigravity IDE\WEB DEIS\VRS\autoconsulta.js",
    r"c:\Antigravity IDE\WEB DEIS\VPH_Web\autoconsulta.js",
]

replacements = [
    (
        "diffExtremosPP = (bestComuna.pct - worstComuna.pct).toFixed(1);",
        "let bestRounded = parseFloat(bestComuna.pct.toFixed(1));\n            let worstRounded = parseFloat(worstComuna.pct.toFixed(1));\n            diffExtremosPP = (bestRounded - worstRounded).toFixed(1);"
    ),
    (
        "const pctTop10 = totalRechazos > 0 ? ((brechaTop10 / totalRechazos) * 100).toFixed(1) : 0;",
        "const pctTop10 = totalRechazos > 0 ? ((brechaTop10 / totalRechazos) * 100).toFixed(1) : 0;\n\n        let brecha80 = 0;\n        let top80Count = 0;\n        let threshold = totalRechazos * 0.8;\n        let accumulated = 0;\n        for (let i = 0; i < topRechazos.length; i++) {\n            accumulated += topRechazos[i].totalNo;\n            top80Count++;\n            if (accumulated >= threshold) {\n                brecha80 = accumulated;\n                break;\n            }\n        }\n        const pctTop80 = totalRechazos > 0 ? ((brecha80 / totalRechazos) * 100).toFixed(1) : 0;"
    ),
    (
        '<div style="color: #8b5cf6; font-size: 1.8rem; font-weight: 800;">${pctTop10}%</div>\n                    <div style="color: #64748b; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px;">Brecha en Top 10</div>\n                </div>\n            </div>',
        '<div style="color: #8b5cf6; font-size: 1.8rem; font-weight: 800;">${pctTop10}%</div>\n                    <div style="color: #64748b; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px;">Brecha en Top 10</div>\n                </div>\n                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">\n                    <div style="color: #ec4899; font-size: 1.8rem; font-weight: 800;">${pctTop80}%</div>\n                    <div style="color: #64748b; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px;">Brecha en Top ${top80Count}</div>\n                </div>\n            </div>'
    ),
    (
        '<th style="padding: 10px; border-bottom: 2px solid #e2e8f0;">Establecimiento</th>\n                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; text-align: center;" title="Total de personas sin registro en la base de datos">Total Sin Registro</th>\n                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; text-align: center;" title="Porcentaje de personas sin registro dentro de la cohorte propia del establecimiento">Prioridad Relativa<br><span style="font-size: 0.7rem; font-weight: normal;">(% local sin registro)</span></th>',
        '<th style="padding: 10px; border-bottom: 2px solid #e2e8f0;">Establecimiento</th>\n                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; text-align: center;">Cohorte local (N)</th>\n                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; text-align: center;" title="Total de personas sin registro en la base de datos">Total Sin Registro</th>\n                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; text-align: center;" title="Porcentaje de personas sin registro dentro de la cohorte propia del establecimiento">% local sin registro</th>\n                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; text-align: center;">Prioridad</th>'
    ),
    (
        "const globalNo = parseFloat(pctNo);\n                let priorityColor = '#0f172a';\n                if (item.pctLocal > globalNo * 1.5) priorityColor = '#ef4444';\n                else if (item.pctLocal > globalNo) priorityColor = '#f59e0b';\n                \n                htmlCausales += `<tr style=\"border-bottom: 1px solid #f1f5f9; transition: background-color 0.2s;\" onmouseover=\"this.style.backgroundColor='#f8fafc'\" onmouseout=\"this.style.backgroundColor='transparent'\">\n                                    <td style=\"padding: 10px; color: #334155;\">${item.comuna}</td>\n                                    <td style=\"padding: 10px; color: #0f172a; font-weight: 500;\">${item.centro}</td>\n                                    <td style=\"padding: 10px; text-align: center; color: #ef4444; font-weight: 700;\">${item.totalNo.toLocaleString('es-CL')}</td>\n                                    <td style=\"padding: 10px; text-align: center; color: ${priorityColor}; font-weight: 700; font-size: 0.95rem;\">${item.pctLocal.toFixed(1)}%</td>",
        "const globalNo = parseFloat(pctNo);\n                \n                let prioridadClasif = 'Baja';\n                let pBg = '#dcfce7';\n                let pText = '#166534';\n                if (item.pctLocal > globalNo * 1.2 && item.totalNo > 10 && item.cohorte > 30) {\n                    prioridadClasif = 'Alta';\n                    pBg = '#fee2e2'; pText = '#991b1b';\n                } else if ((item.pctLocal > globalNo && item.totalNo > 5) || (item.pctLocal > globalNo * 1.5 && item.totalNo > 2)) {\n                    prioridadClasif = 'Media';\n                    pBg = '#fef3c7'; pText = '#92400e';\n                }\n                \n                let pctColor = '#0f172a';\n                if (item.pctLocal > globalNo * 1.5) pctColor = '#ef4444';\n                else if (item.pctLocal > globalNo) pctColor = '#f59e0b';\n\n                htmlCausales += `<tr style=\"border-bottom: 1px solid #f1f5f9; transition: background-color 0.2s;\" onmouseover=\"this.style.backgroundColor='#f8fafc'\" onmouseout=\"this.style.backgroundColor='transparent'\">\n                                    <td style=\"padding: 10px; color: #334155;\">${item.comuna}</td>\n                                    <td style=\"padding: 10px; color: #0f172a; font-weight: 500;\">${item.centro}</td>\n                                    <td style=\"padding: 10px; text-align: center; color: #334155;\">${item.cohorte.toLocaleString('es-CL')}</td>\n                                    <td style=\"padding: 10px; text-align: center; color: #ef4444; font-weight: 700;\">${item.totalNo.toLocaleString('es-CL')}</td>\n                                    <td style=\"padding: 10px; text-align: center; color: ${pctColor}; font-weight: 700; font-size: 0.95rem;\">${item.pctLocal.toFixed(1)}%</td>\n                                    <td style=\"padding: 10px; text-align: center;\"><span style=\"background-color: ${pBg}; color: ${pText}; padding: 3px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: 600;\">${prioridadClasif}</span></td>"
    ),
    (
        '<td colspan="2" style="padding: 12px 10px; text-align: right; text-transform: uppercase;">Total General (Toda la red):</td>\n                                                <td style="padding: 12px 10px; text-align: center; color: #ef4444; font-size: 1.05rem;">${totalRechazos.toLocaleString(\'es-CL\')}</td>\n                                                <td style="padding: 12px 10px; text-align: center; color: #0f172a; font-size: 1.05rem;">${pctNo}%</td>',
        '<td colspan="2" style="padding: 12px 10px; text-align: right; text-transform: uppercase;">Total General (Toda la red):</td>\n                                                <td style="padding: 12px 10px; text-align: center; color: #0f172a; font-size: 1.05rem;">${r.total.toLocaleString(\'es-CL\')}</td>\n                                                <td style="padding: 12px 10px; text-align: center; color: #ef4444; font-size: 1.05rem;">${totalRechazos.toLocaleString(\'es-CL\')}</td>\n                                                <td style="padding: 12px 10px; text-align: center; color: #0f172a; font-size: 1.05rem;">${pctNo}%</td>\n                                                <td style="padding: 12px 10px;"></td>'
    ),
    (
        '<li><strong style="color: #334155;">‡ Inmunidad Poblacional:</strong> Personas con registro válido de inmunización para la campaña actual.</li>',
        '<li><strong style="color: #334155;">‡ Registro de vacunación:</strong> Persona con registro válido de vacunación correspondiente a la campaña analizada.</li>'
    ),
    (
        '<strong style="color: #065f46; font-size: 0.95rem;">Consistencia de datos: Validada</strong>\n                    <div style="color: #047857; font-size: 0.85rem;">Los totales agregados coinciden estructuralmente con la cohorte analizada.</div>',
        '<strong style="color: #065f46; font-size: 0.95rem;">Consistencia aritmética y estructural: Validada</strong>\n                    <div style="color: #047857; font-size: 0.85rem;">Los totales y agregaciones son coherentes con la cohorte analizada.</div>'
    ),
    (
        '<p style="margin: 0; line-height: 1.7;">El análisis automatizado de la cohorte evidencia que un <strong>${pctNo}%</strong> de las personas procesadas no presenta registro de vacunación vigente en la base nacional consultada. ${totalComunas > 1 ? `La variabilidad territorial alcanza <strong>${diffExtremosPP} puntos porcentuales</strong> entre comunas extremas, lo que refleja una distribución <strong>${parseFloat(diffExtremosPP) > 15 ? \'marcadamente heterogénea\' : parseFloat(diffExtremosPP) > 8 ? \'moderadamente heterogénea\' : \'relativamente homogénea\'}</strong>.` : \'\'} ${topRechazos.length >= 2 ? `Los <strong>2 establecimientos con mayor brecha absoluta</strong> concentran el <strong>${pctTop2}%</strong> de todas las personas sin registro, lo que sugiere que intervenciones focalizadas en estos centros podrían generar un impacto significativo.` : \'\'} Se recomienda priorizar acciones de revisión de antecedentes, rescate activo y barrido territorial en los establecimientos identificados.</p>',
        '<p style="margin: 0; line-height: 1.7;">El análisis de la cohorte evidencia que ${(r.no || 0).toLocaleString(\'es-CL\')} de las ${(r.total || 0).toLocaleString(\'es-CL\')} personas procesadas (<strong>${pctNo}%</strong>) no presentan registro de vacunación en la base consultada. ${totalComunas > 1 ? `Se observa heterogeneidad territorial en la proporción de registro, con valores que varían desde <strong>${worstComuna.pct.toFixed(1)}%</strong> hasta <strong>${bestComuna.pct.toFixed(1)}%</strong>, equivalente a una amplitud de <strong>${diffExtremosPP} puntos porcentuales</strong> entre ambos extremos.` : \'\'} La brecha presenta además concentración institucional: ${topRechazos.length >= 2 ? `los <strong>2 establecimientos con mayor brecha absoluta</strong> reúnen el <strong>${pctTop2}%</strong> de las personas sin registro y los establecimientos del Top ${top80Count} concentran el <strong>${pctTop80}%</strong> del total.` : \'\'} Estos resultados permiten focalizar las acciones de revisión de antecedentes y rescate territorial, priorizando aquellos establecimientos que combinan una elevada magnitud absoluta de personas sin registro con una proporción local desfavorable, considerando siempre el tamaño de la cohorte local.</p>'
    ),
    (
        "ctx.fillText('Prom. ' + globalPct.toFixed(1) + '%', xPos + 4, chart.chartArea.top + 12);",
        "ctx.fillText('Resultado global: ' + globalPct.toFixed(1) + '%', xPos + 4, chart.chartArea.top + 12);"
    ),
    (
        '<h5 style="color: #334155; margin-bottom: 10px; font-size: 0.95rem;"><i class="fas fa-chart-bar" style="color: #0284c7;"></i> Registro por Comuna vs Promedio Global</h5>',
        '<h5 style="color: #334155; margin-bottom: 10px; font-size: 0.95rem;"><i class="fas fa-chart-bar" style="color: #0284c7;"></i> Registro por Comuna vs Promedio Global</h5>\n                                <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 15px; text-align: center;">\n                                    <span style="color: #10b981; margin-right: 4px;">■</span> Sobre resultado global <span style="color: #ef4444; margin-left: 12px; margin-right: 4px;">■</span> Bajo resultado global\n                                </div>'
    ),
    (
        '</div>\n                             </div>`;',
        '</div>\n                                <p style="font-size: 0.8rem; color: #64748b; margin-top: 15px; margin-bottom: 0;">† Interpretar con cautela: proporción calculada sobre una cohorte local pequeña; variaciones de pocos registros pueden producir cambios importantes en el porcentaje (N &lt; 30).</p>\n                             </div>`;'
    )
]

for filepath in target_modules:
    if not os.path.exists(filepath):
        print(f"Skipping {filepath}, does not exist.")
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Standard string replacements
    for old_str, new_str in replacements:
        if old_str in content:
            content = content.replace(old_str, new_str)
        else:
            print(f"Warning: String not found in {filepath} for replacement: {old_str[:50]}...")
            
    # Chart Pareto Plugin Replacement
    pareto_end_search = """                        y1: {
                            beginAtZero: true,
                            max: 100,
                            position: 'right',
                            ticks: { callback: v => v + '%', font: { size: 11 } },
                            grid: { drawOnChartArea: false },
                            title: { display: true, text: '% Acumulado', font: { size: 11 } }
                        }
                    }
                }
            });"""
            
    pareto_end_replace = """                        y1: {
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
            });"""
            
    if pareto_end_search in content:
        content = content.replace(pareto_end_search, pareto_end_replace)
    else:
        print(f"Warning: Pareto end search not found in {filepath}")
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print(f"Updated {filepath}")
