import os
import re

files = [
    r'c:\Antigravity IDE\WEB DEIS\Influenza_Web\autoconsulta.js',
    r'c:\Antigravity IDE\WEB DEIS\Covid_Web\autoconsulta.js',
    r'c:\Antigravity IDE\WEB DEIS\VRS\autoconsulta.js',
    r'c:\Antigravity IDE\WEB DEIS\VPH_Web\autoconsulta.js'
]

def fix_table_logic():
    for filepath in files:
        if not os.path.exists(filepath):
            continue
            
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # 1. Update the topRechazos loop
        old_loop = """
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
        """
        
        new_loop = """
        if (r.statsComunas) {
            for (const [comuna, centros] of Object.entries(r.statsComunas)) {
                for (const [centro, stats] of Object.entries(centros)) {
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
                            totalRechazo: countRechazo
                        });
                    }
                }
            }
        }
        """
        
        content = content.replace(old_loop.strip(), new_loop.strip())
        
        # 2. Update table headers
        old_headers = """<th style="padding: 10px; border-bottom: 2px solid #e2e8f0; text-align: center;">Sin Registro de Vacunación</th>
                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0;">Causales Administrativas Predominantes</th>"""
        
        new_headers = """<th style="padding: 10px; border-bottom: 2px solid #e2e8f0; text-align: center;" title="Total de personas sin registro en la base de datos (Rezago + Rechazos)">Total Sin Registro</th>
                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; text-align: center;" title="Personas sin registro y sin un motivo especificado en el archivo (Rezagados)">Rezagos (Sin causal)</th>
                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; text-align: center;" title="Personas con registro de rechazo, contraindicación, u otro motivo explícito">Rechazos (Con causal)</th>
                                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0;">Detalle Causales de Rechazo</th>"""
        
        # In VRS and Influenza it says "Sin Registro de Inmunización" instead of "Vacunación"
        content = re.sub(r'<th[^>]*>Sin Registro de (Vacunación|Inmunización)</th>\s*<th[^>]*>Causales Administrativas Predominantes</th>', new_headers, content)

        # 3. Update table rendering logic
        old_render = """
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
        """
        
        new_render = """
                // Filtrar solo rechazos reales
                const rechazosReales = Object.entries(item.causales).filter(c => c[0] !== 'SIN REGISTRO / CAUSAL NO ESPECIFICADA').sort((a, b) => b[1] - a[1]);
                let causalesStr = '';
                if (rechazosReales.length === 0) {
                    causalesStr = '<span style="color: #94a3b8; font-style: italic;">Sin causales registradas</span>';
                } else {
                    for (let j = 0; j < Math.min(rechazosReales.length, 3); j++) {
                        causalesStr += `<span style="background: #f1f5f9; color: #334155; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; margin-right: 4px; display: inline-block; margin-bottom: 4px;">${rechazosReales[j][0]}: <strong>${rechazosReales[j][1]}</strong></span>`;
                    }
                    if (rechazosReales.length > 3) {
                        causalesStr += `<span style="color: #94a3b8; font-size: 0.8rem;">+${rechazosReales.length - 3} motivos</span>`;
                    }
                }
                
                htmlCausales += `<tr style="border-bottom: 1px solid #f1f5f9; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#f8fafc'" onmouseout="this.style.backgroundColor='transparent'">
                                    <td style="padding: 10px; color: #334155;">${item.comuna}</td>
                                    <td style="padding: 10px; color: #0f172a; font-weight: 500;">${item.centro}</td>
                                    <td style="padding: 10px; text-align: center; color: #ef4444; font-weight: 700;">${item.totalNo.toLocaleString('es-CL')}</td>
                                    <td style="padding: 10px; text-align: center; color: #f59e0b; font-weight: 500; font-size: 0.95rem;">${item.totalRezago.toLocaleString('es-CL')}</td>
                                    <td style="padding: 10px; text-align: center; color: #8b5cf6; font-weight: 700; font-size: 0.95rem; background-color: rgba(139,92,246,0.05); border-radius: 4px;">${item.totalRechazo.toLocaleString('es-CL')}</td>
                                    <td style="padding: 10px;">${causalesStr}</td>
                                 </tr>`;
        """
        
        content = content.replace(old_render.strip(), new_render.strip())
        
        # 4. Update footer
        old_footer = """
            htmlCausales += `           </tbody>
                                        <tfoot>
                                            <tr style="background: #f8fafc; font-weight: 700; border-top: 2px solid #cbd5e1; color: #0f172a;">
                                                <td colspan="2" style="padding: 12px 10px; text-align: right; text-transform: uppercase;">Total General (Toda la red):</td>
                                                <td style="padding: 12px 10px; text-align: center; color: #ef4444; font-size: 1.05rem;">${totalRechazos.toLocaleString('es-CL')}</td>
                                                <td style="padding: 12px 10px;"></td>
                                            </tr>
                                        </tfoot>
        """
        
        new_footer = """
            let globalRezago = topRechazos.reduce((sum, item) => sum + item.totalRezago, 0);
            let globalRechazo = topRechazos.reduce((sum, item) => sum + item.totalRechazo, 0);
            
            htmlCausales += `           </tbody>
                                        <tfoot>
                                            <tr style="background: #f8fafc; font-weight: 700; border-top: 2px solid #cbd5e1; color: #0f172a;">
                                                <td colspan="2" style="padding: 12px 10px; text-align: right; text-transform: uppercase;">Total General (Toda la red):</td>
                                                <td style="padding: 12px 10px; text-align: center; color: #ef4444; font-size: 1.05rem;">${totalRechazos.toLocaleString('es-CL')}</td>
                                                <td style="padding: 12px 10px; text-align: center; color: #f59e0b; font-size: 1.05rem;">${globalRezago.toLocaleString('es-CL')}</td>
                                                <td style="padding: 12px 10px; text-align: center; color: #8b5cf6; font-size: 1.05rem;">${globalRechazo.toLocaleString('es-CL')}</td>
                                                <td style="padding: 12px 10px;"></td>
                                            </tr>
                                        </tfoot>
        """
        
        content = content.replace(old_footer.strip(), new_footer.strip())
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
            
        print(f"Updated {filepath}")

fix_table_logic()
