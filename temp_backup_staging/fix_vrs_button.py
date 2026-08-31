import os
import re

path = r"C:\Antigravity IDE\WEB DEIS\VRS\index.html"

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_block = r'''<!-- Columna Izquierda: Descarga Rescates -->
                        <div class="autoconsulta-drop-zone" style="text-align: center; padding: 30px 20px; background: rgba(239, 68, 68, 0.03); border: 2px dashed rgba(239, 68, 68, 0.3);">
                            <div class="autoconsulta-drop-icon" style="color: #ef4444; background: rgba(239, 68, 68, 0.1);">
                                <i class="fas fa-file-download"></i>
                            </div>
                            <h3 style="color: #0f172a; margin-bottom: 10px; font-size: 1.1rem;">Descarga Masiva</h3>
                            <p style="color: #64748b; font-size: 0.85rem; margin-bottom: 25px; line-height: 1.5;">
                                Descargue la nómina consolidada de todos los menores pendientes de inmunización a nivel provincial.
                            </p>
                            <a href="Rescates_VRS_Pendientes_2026.xlsx" download style="background: #ef4444; color: white; border: none; padding: 12px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.3); width: 100%; transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                                <i class="fas fa-file-excel"></i> Descargar Nómina VRS
                            </a>
                        </div>'''

new_block = '''<!-- Columna Izquierda: Descarga Rescates -->
                        <div style="text-align: center; padding: 35px 25px; background: white; border: 1px solid #e2e8f0; border-top: 4px solid #ef4444; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); height: fit-content; margin-top: 0;">
                            <div style="color: #ef4444; background: rgba(239, 68, 68, 0.1); width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; margin: 0 auto 20px auto;">
                                <i class="fas fa-file-download"></i>
                            </div>
                            <h3 style="color: #0f172a; margin-bottom: 15px; font-size: 1.2rem; font-weight: 700;">Descarga Masiva</h3>
                            <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 10px; line-height: 1.6;">
                                Descargue la nómina consolidada de todos los menores pendientes de inmunización a nivel provincial.
                            </p>
                            <div style="background: #fffbeb; color: #b45309; border: 1px solid #fde68a; padding: 10px; border-radius: 8px; font-size: 0.8rem; margin-bottom: 25px; text-align: left; display: flex; gap: 8px; align-items: flex-start;">
                                <i class="fas fa-lock" style="margin-top: 3px;"></i>
                                <span><strong>Atención:</strong> Por motivos de seguridad y resguardo de datos sensibles, el archivo Excel <strong>solicitará contraseña</strong> al abrirlo.</span>
                            </div>
                            <a href="Rescates_VRS_Pendientes_2026.xlsx" id="btnDescargaRescates" download style="background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none; padding: 14px 20px; border-radius: 8px; font-weight: 600; font-size: 1rem; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 6px 15px -3px rgba(239, 68, 68, 0.4); width: 100%; transition: all 0.3s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px -3px rgba(239, 68, 68, 0.5)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 6px 15px -3px rgba(239, 68, 68, 0.4)';">
                                <i class="fas fa-file-excel"></i> Descargar Nómina VRS
                            </a>
                        </div>'''

if old_block in content:
    content = content.replace(old_block, new_block)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced left column block successfully.")
else:
    print("Could not find the block to replace.")
