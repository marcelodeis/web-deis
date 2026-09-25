import os, io, re

html_path = r'C:\Antigravity IDE\WEB DEIS\Programáticas_Web\index.html'

with io.open(html_path, 'r', encoding='utf-8') as f:
    html_content = f.read()

def build_card(id_prefix, title, excel_name, icon_class):
    color_hex = '#f97316'
    bg_icon_hex = '#ffedd5'
    return f'''
                        <!-- Tarjeta {title} -->
                        <div class="reporte-card" style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column;">
                            <div style="background: #f8fafc; padding: 15px 20px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 10px;">
                                <div style="background: {bg_icon_hex}; color: {color_hex}; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center;"><i class="fas {icon_class}"></i></div>
                                <h4 style="margin: 0; color: #0f172a; font-size: 1.1rem; font-weight: 700;">{title}</h4>
                            </div>
                            <div style="padding: 25px 20px; text-align: center; flex-grow: 1;">
                                <div style="font-size: 3rem; font-weight: 800; color: {color_hex}; line-height: 1;" id="{id_prefix}-brecha">--</div>
                                <div style="color: #64748b; font-weight: 600; font-size: 1rem; margin-top: 5px;">menores sin registro identificado</div>
                                <div style="color: {color_hex}; font-size: 0.85rem; font-weight: 600; margin-top: 5px;" id="{id_prefix}-pct-brecha">--% del universo elegible</div>
                                <div style="margin-top: 20px; text-align: left; background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.85rem;"><span style="color:#475569;">Universo:</span><strong id="{id_prefix}-uni">--</strong></div>
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.85rem;"><span style="color:#475569;">Excluidos del seguimiento <i class="fas fa-info-circle" title="Registros excluidos del seguimiento según los criterios metodológicos." style="color:#64748b; cursor:help;"></i>:</span><strong id="{id_prefix}-exc">--</strong></div>
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.85rem; padding-top: 4px; border-top: 1px dashed #e2e8f0;"><span style="color:#475569;">Universo elegible:</span><strong id="{id_prefix}-elegible">--</strong></div>
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.85rem;"><span style="color:#475569;">Con registro de vacunación:</span><strong id="{id_prefix}-vac">--</strong></div>
                                </div>
                            </div>
                            <div style="padding: 15px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; gap: 10px;">
                                <button onclick="abrirReporteProgramaticas('{id_prefix.split('-')[1]}')" style="flex: 1; background: white; border: 1px solid #3b82f6; color: #3b82f6; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#eff6ff'; this.style.borderColor='#2563eb'; this.style.color='#2563eb';" onmouseout="this.style.background='white'; this.style.borderColor='#3b82f6'; this.style.color='#3b82f6';"><i class="fas fa-eye"></i> Ver reporte</button>
                                <a id="btn-download-{id_prefix}" href="{excel_name}" download style="flex: 1; background: #10b981; color: white; border: none; padding: 10px; border-radius: 8px; font-weight: 600; text-decoration: none; text-align: center; display: inline-block; transition: background 0.2s;" onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'"><i class="fas fa-file-excel"></i> Descargar nómina</a>
                            </div>
                        </div>'''

nuevo_primario = f'''
                <section id="bloque-primario" style="background: white; border-radius: 12px; padding: 30px; margin-bottom: 40px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); border-top: 4px solid #10b981; position: relative; overflow: hidden;">
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px;">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="background: #ecfdf5; color: #10b981; width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                                <i class="fas fa-shield-virus"></i>
                            </div>
                            <div>
                                <h3 style="margin: 0; color: #0f172a; font-size: 1.3rem;">Seguimiento del Esquema Primario - Residencia SSO</h3>
                            </div>
                        </div>
                        <span style="padding: 6px 14px; border-radius: 6px; border: 1px solid #cbd5e1; font-weight: 600; color: #334155; background: #f8fafc; font-size: 0.9rem;">Año 2026</span>
                    </div>

                    <div class="reportes-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
{build_card('prog-hexa2', 'Hexavalente - 2.ª dosis', 'Rescates_Hexavalente_2_Pendientes_2026.xlsx', 'fa-shield-virus')}
{build_card('prog-neumo2', 'Neumocócica - 2.ª dosis', 'Rescates_Neumococica_2_Pendientes_2026.xlsx', 'fa-shield-virus')}
{build_card('prog-menb2', 'Meningocócica B - 2.ª dosis', 'Rescates_Meningococica_B_2_Pendientes_2026.xlsx', 'fa-shield-virus')}
{build_card('prog-hexa3', 'Hexavalente - 3.ª dosis', 'Rescates_Hexavalente_3_Pendientes_2026.xlsx', 'fa-shield-virus')}
                    </div>
                </section>'''

nuevo_segundas = f'''
                <section id="bloque-segundas" style="background: white; border-radius: 12px; padding: 30px; margin-bottom: 40px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); border-top: 4px solid #10b981; position: relative; overflow: hidden;">
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px;">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="background: #ecfdf5; color: #10b981; width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                                <i class="fas fa-syringe"></i>
                            </div>
                            <div>
                                <h3 style="margin: 0; color: #0f172a; font-size: 1.3rem;">Seguimiento de Segundas Dosis - Residencia SSO</h3>
                            </div>
                        </div>
                        <span style="padding: 6px 14px; border-radius: 6px; border: 1px solid #cbd5e1; font-weight: 600; color: #334155; background: #f8fafc; font-size: 0.9rem;">Año 2026</span>
                    </div>

                    <div class="reportes-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
{build_card('prog-srp2', 'SRP - 2.ª dosis', 'Rescates_SRP_2_Pendientes_2026.xlsx', 'fa-syringe')}
{build_card('prog-vari2', 'Varicela - 2.ª dosis', 'Rescates_Varicela_2_Pendientes_2026.xlsx', 'fa-syringe')}
                    </div>
                </section>'''

pattern_primario = r'<section id="bloque-primario".*?</section>\s*(?=<!-- BLOQUE 4: SEGUNDAS DOSIS -->)'
html_content = re.sub(pattern_primario, nuevo_primario + "\n", html_content, flags=re.DOTALL)

pattern_segundas = r'<section id="bloque-segundas".*?</section>\s*(?=<!-- BLOQUE 5:)'
html_content = re.sub(pattern_segundas, nuevo_segundas + "\n", html_content, flags=re.DOTALL)

with io.open(html_path, 'w', encoding='utf-8') as f:
    f.write(html_content)

print('HTML patched successfully')
