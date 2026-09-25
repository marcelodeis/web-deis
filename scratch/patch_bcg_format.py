import os, io, re

html_path = r'C:\Antigravity IDE\WEB DEIS\Programáticas_Web\index.html'

with io.open(html_path, 'r', encoding='utf-8') as f:
    html_content = f.read()

def build_card(id_prefix, title, excel_name, icon_class, color_hex, bg_icon_hex):
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
                <section id="bloque-primario" style="background: #f1f5f9; border-radius: 12px; padding: 30px; margin-bottom: 40px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); border-top: 4px solid #f59e0b; position: relative; overflow: hidden;">
                    
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 25px; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px;">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="background: #fffbeb; color: #f59e0b; width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                                <i class="fas fa-shield-virus"></i>
                            </div>
                            <div>
                                <h3 style="margin: 0; color: #0f172a; font-size: 1.4rem;">Seguimiento del Esquema Primario</h3>
                                <p style="margin: 4px 0 0 0; color: #475569; font-size: 0.95rem;">Identificación de menores sin registro de dosis correspondientes al esquema infantil.</p>
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 25px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px;">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <span style="font-weight: 600; color: #1e293b;"><i class="fas fa-filter" style="color: #3b82f6;"></i> Filtro Territorial SSO:</span>
                            <div class="territory-toggle" style="background: #f1f5f9; padding: 4px; border-radius: 8px; display: flex;">
                                <button id="btn-residencia" class="territory-btn active" onclick="setTerritoryFilter('residencia')" style="padding: 6px 16px; border: none; background: white; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); font-weight: 600; color: #0f172a; cursor: pointer; transition: all 0.2s;">Residencia SSO</button>
                                <button id="btn-ocurrencia" class="territory-btn" onclick="setTerritoryFilter('ocurrencia')" style="padding: 6px 16px; border: none; background: transparent; font-weight: 600; color: #64748b; cursor: pointer; transition: all 0.2s;">Ocurrencia SSO</button>
                            </div>
                        </div>
                        
                        <div style="font-size: 0.85rem; color: #64748b; display: flex; gap: 15px;">
                            <span id="header-fuente"><i class="fas fa-server"></i> Fuente: Servidor DEIS-MINSAL</span>
                            <span id="header-base"><i class="fas fa-database"></i> Base Procesada: Cargando...</span>
                            <span id="header-corte"><i class="fas fa-calendar-check"></i> Datos válidos hasta: Cargando...</span>
                        </div>
                    </div>

                    <div class="reportes-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
{build_card('prog-hexa2', 'HEXAVALENTE - 2.ª DOSIS', 'Rescates_Hexavalente_2_Pendientes_2026.xlsx', 'fa-shield-virus', '#f59e0b', '#fffbeb')}
{build_card('prog-neumo2', 'NEUMOCÓCICA - 2.ª DOSIS', 'Rescates_Neumococica_2_Pendientes_2026.xlsx', 'fa-shield-virus', '#f59e0b', '#fffbeb')}
{build_card('prog-menb2', 'MENINGOCÓCICA B - 2.ª DOSIS', 'Rescates_Meningococica_B_2_Pendientes_2026.xlsx', 'fa-shield-virus', '#f59e0b', '#fffbeb')}
{build_card('prog-hexa3', 'HEXAVALENTE - 3.ª DOSIS', 'Rescates_Hexavalente_3_Pendientes_2026.xlsx', 'fa-shield-virus', '#f59e0b', '#fffbeb')}
                    </div>
                </section>'''

nuevo_segundas = f'''
                <section id="bloque-segundas" style="background: #f1f5f9; border-radius: 12px; padding: 30px; margin-bottom: 40px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); border-top: 4px solid #8b5cf6; position: relative; overflow: hidden;">
                    <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 25px; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px;">
                        <div style="background: #f5f3ff; color: #8b5cf6; width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                            <i class="fas fa-syringe"></i>
                        </div>
                        <div style="flex-grow: 1;">
                            <h3 style="margin: 0; color: #0f172a; font-size: 1.4rem;">Seguimiento de Segundas Dosis</h3>
                            <p style="margin: 4px 0 0 0; color: #475569; font-size: 0.95rem;">Identificación de menores sin registro para cierre de esquemas bi-dosis.</p>
                        </div>
                    </div>

                    <div class="reportes-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
{build_card('prog-srp2', 'SRP - 2.ª DOSIS', 'Rescates_SRP_2_Pendientes_2026.xlsx', 'fa-syringe', '#8b5cf6', '#f5f3ff')}
{build_card('prog-vari2', 'VARICELA - 2.ª DOSIS', 'Rescates_Varicela_2_Pendientes_2026.xlsx', 'fa-syringe', '#8b5cf6', '#f5f3ff')}
                    </div>
                </section>'''

pattern_primario = r'<section id="bloque-primario".*?</section>\s*(?=<!-- BLOQUE 4: SEGUNDAS DOSIS -->)'
html_content = re.sub(pattern_primario, nuevo_primario + "\n", html_content, flags=re.DOTALL)

pattern_segundas = r'<section id="bloque-segundas".*?</section>\s*(?=<!-- BLOQUE 5:)'
html_content = re.sub(pattern_segundas, nuevo_segundas + "\n", html_content, flags=re.DOTALL)

with io.open(html_path, 'w', encoding='utf-8') as f:
    f.write(html_content)

print('HTML patched successfully')
