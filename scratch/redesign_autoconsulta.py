import io, re

html_path = r'C:\Antigravity IDE\WEB DEIS\Programáticas_Web\index.html'

with io.open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

new_block = """<!-- BLOQUE 1: AUTOCONSULTA (REDISEÑADO) -->
                <section id="bloque-autoconsulta" style="margin-bottom: 40px;">
                    <div class="autoconsulta-banner" style="display: flex; align-items: center; justify-content: space-between; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border: 1px solid #e2e8f0; border-left: 5px solid #3b82f6; border-radius: 12px; padding: 20px 30px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); transition: all 0.3s ease;">
                        
                        <div style="display: flex; align-items: center; gap: 20px;">
                            <div style="background: #eff6ff; color: #3b82f6; width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; box-shadow: inset 0 2px 4px rgba(255,255,255,0.5), 0 2px 4px rgba(59, 130, 246, 0.1);">
                                <i class="fas fa-file-excel"></i>
                            </div>
                            <div>
                                <h3 style="margin: 0; color: #0f172a; font-size: 1.2rem; font-weight: 700;">Auditoría y Cruce de Nóminas</h3>
                                <p style="margin: 4px 0 0 0; color: #64748b; font-size: 0.9rem;">Cargue un archivo Excel (.xlsx) con una columna RUT para consultar automáticamente el estado vacunal.</p>
                            </div>
                        </div>

                        <div class="autoconsulta-action" style="display: flex; align-items: center; gap: 15px;">
                            <input type="file" id="autoconsultaFileInput" accept=".xlsx,.xls,.xlsm,.csv" style="display: none;" />
                            <div id="autoconsultaDropZone" onclick="document.getElementById('autoconsultaFileInput').click()" style="background: white; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 12px 24px; color: #475569; font-weight: 600; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; gap: 10px;" onmouseover="this.style.borderColor='#3b82f6'; this.style.color='#3b82f6'; this.style.background='#eff6ff'; this.querySelector('i').style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='#cbd5e1'; this.style.color='#475569'; this.style.background='white'; this.querySelector('i').style.transform='translateY(0)';">
                                <i class="fas fa-cloud-upload-alt" style="font-size: 1.2rem; transition: transform 0.2s ease;"></i>
                                <span>Subir archivo o arrastrar aquí</span>
                            </div>
                        </div>
                        
                    </div>
                </section>"""

# Using regex to replace everything from <!-- BLOQUE 1: AUTOCONSULTA --> to the closing </section> of it.
# We need to make sure we don't delete too much.
pattern = re.compile(r'<!-- BLOQUE 1: AUTOCONSULTA -->.*?</section>', re.DOTALL)
html = pattern.sub(new_block, html)

with io.open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)
    
print("Redesign applied successfully.")
