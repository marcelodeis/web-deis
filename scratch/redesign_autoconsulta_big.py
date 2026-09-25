import io, re

html_path = r'C:\Antigravity IDE\WEB DEIS\Programáticas_Web\index.html'

with io.open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

new_block = """<!-- BLOQUE 1: AUTOCONSULTA (REDISEÑADO Y AMPLIADO) -->
                <section id="bloque-autoconsulta" style="margin-bottom: 50px;">
                    <div class="autoconsulta-banner" style="display: flex; align-items: center; justify-content: space-between; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border: 1px solid #e2e8f0; border-left: 10px solid #3b82f6; border-radius: 20px; padding: 45px 50px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05); transition: all 0.3s ease;">
                        
                        <div style="display: flex; align-items: center; gap: 30px;">
                            <div style="background: #eff6ff; color: #3b82f6; width: 90px; height: 90px; border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 3.5rem; box-shadow: inset 0 4px 6px rgba(255,255,255,0.5), 0 4px 10px rgba(59, 130, 246, 0.15);">
                                <i class="fas fa-file-excel"></i>
                            </div>
                            <div>
                                <h3 style="margin: 0; color: #0f172a; font-size: 2.2rem; font-weight: 800; letter-spacing: -0.5px;">Auditoría y Cruce de Nóminas</h3>
                                <p style="margin: 8px 0 0 0; color: #64748b; font-size: 1.25rem;">Cargue un archivo Excel (.xlsx) con una columna RUT para consultar automáticamente el estado vacunal.</p>
                            </div>
                        </div>

                        <div class="autoconsulta-action" style="display: flex; align-items: center; gap: 15px;">
                            <input type="file" id="autoconsultaFileInput" accept=".xlsx,.xls,.xlsm,.csv" style="display: none;" />
                            <div id="autoconsultaDropZone" onclick="document.getElementById('autoconsultaFileInput').click()" style="background: white; border: 3px dashed #cbd5e1; border-radius: 12px; padding: 20px 40px; color: #475569; font-size: 1.3rem; font-weight: 700; cursor: pointer; transition: all 0.3s ease; display: flex; align-items: center; gap: 15px;" onmouseover="this.style.borderColor='#3b82f6'; this.style.color='#3b82f6'; this.style.background='#eff6ff'; this.querySelector('i').style.transform='translateY(-4px) scale(1.1)';" onmouseout="this.style.borderColor='#cbd5e1'; this.style.color='#475569'; this.style.background='white'; this.querySelector('i').style.transform='translateY(0) scale(1)';">
                                <i class="fas fa-cloud-upload-alt" style="font-size: 2rem; transition: transform 0.3s ease;"></i>
                                <span>Subir archivo o arrastrar aquí</span>
                            </div>
                        </div>
                        
                    </div>
                </section>"""

pattern = re.compile(r'<!-- BLOQUE 1: AUTOCONSULTA \(REDISEÑADO\).*?</section>', re.DOTALL)
# In case it has a weird char due to encoding, let's use a safer regex
pattern_safe = re.compile(r'<!-- BLOQUE 1: AUTOCONSULTA.*?</section>', re.DOTALL)
html = pattern_safe.sub(new_block, html)

with io.open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)
    
print("Redesign Ampliado applied successfully.")
