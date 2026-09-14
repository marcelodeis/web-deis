import codecs
import re

path = r'c:\Antigravity IDE\WEB DEIS\VRS\index.html'

with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

# 1. Remove the visit counter and modal
# We will use regex to remove the <div style="display: flex; justify-content: flex-end; ...">...</div> block
# and the <div id="visitModal" ...>...</div> block up to the footer.

# The visit counter block:
counter_start = content.find('<div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 2rem; padding-bottom: 2rem; flex-wrap: wrap;">')
if counter_start != -1:
    counter_end = content.find('</div>', counter_start + 10)
    counter_end = content.find('</div>', counter_end + 10) + 6 # end of the wrapper
    
    # Also find visitModal
    modal_start = content.find('<div id="visitModal"')
    if modal_start != -1:
        # Find footer to know where it ends
        footer_start = content.find('<footer', modal_start)
        if footer_start != -1:
            content = content[:counter_start] + content[footer_start:]

# 2. Inject the "Descarga Masiva" card
steps_start = content.find('<!-- 3 Steps -->')
if steps_start != -1:
    descarga_masiva_html = """
                    <div style="display: grid; grid-template-columns: 1fr 2.5fr; gap: 20px; align-items: start;">
                        
                        <!-- Columna Izquierda: Descarga Rescates -->
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
                        </div>

                        <!-- Columna Derecha: Autoconsulta Excel -->
                        <div style="display: flex; flex-direction: column; gap: 20px;">
"""
    # Now we need to close the 2 column grid after the autoconsulta area
    # The autoconsulta area ends with </section> for tab-autoconsulta.
    # We should find the `</section>` after the steps.
    
    # Find the end of the autoconsulta section
    autoconsulta_end = content.find('</section>', steps_start)
    
    if autoconsulta_end != -1:
        # We need to insert `</div></div>` right before `</section>`
        content = content[:autoconsulta_end] + "                        </div>\n                    </div>\n                " + content[autoconsulta_end:]
        content = content[:steps_start] + descarga_masiva_html + content[steps_start:]

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
