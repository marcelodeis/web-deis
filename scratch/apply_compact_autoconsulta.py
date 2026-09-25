import os
import re

target_files = [
    r'C:\Antigravity IDE\WEB DEIS\Influenza_Web\index.html',
    r'C:\Antigravity IDE\WEB DEIS\Covid_Web\index.html',
    r'C:\Antigravity IDE\WEB DEIS\VRS\index.html',
    r'C:\Antigravity IDE\WEB DEIS\VPH_Web\index.html'
]

compact_html = """<div class="autoconsulta-banner" style="display: flex; align-items: center; justify-content: space-between; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border: 1px solid #e2e8f0; border-left: 5px solid #3b82f6; border-radius: 12px; padding: 20px 30px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); transition: all 0.3s ease; margin-bottom: 20px; flex-wrap: wrap; gap: 20px;">
    
    <div style="display: flex; align-items: center; gap: 20px; flex: 1; min-width: 300px;">
        <div style="background: #eff6ff; color: #3b82f6; width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; box-shadow: inset 0 2px 4px rgba(255,255,255,0.5), 0 2px 4px rgba(59, 130, 246, 0.1); flex-shrink: 0;">
            <i class="fas fa-file-excel"></i>
        </div>
        <div>
            <h3 style="margin: 0; color: #0f172a; font-size: 1.2rem; font-weight: 700;">Autoconsulta Masiva de Vacunación</h3>
            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 0.9rem;">Cargue un archivo Excel (.xlsx) con una columna RUT para consultar automáticamente el estado vacunal.</p>
        </div>
    </div>

    <div class="autoconsulta-action" style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
        <button onclick="if(window.downloadTemplate) window.downloadTemplate(); else alert('Plantilla no disponible para este módulo.');" style="background: white; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; color: #475569; font-weight: 600; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; gap: 8px;" onmouseover="this.style.background='#f1f5f9'; this.style.borderColor='#94a3b8';" onmouseout="this.style.background='white'; this.style.borderColor='#cbd5e1';">
            <i class="fas fa-download"></i>
            <span>Plantilla</span>
        </button>
        <input type="file" id="autoconsultaFileInput" accept=".xlsx,.xls,.xlsm,.csv" style="display: none;" />
        <div id="autoconsultaDropZone" onclick="document.getElementById('autoconsultaFileInput').click()" style="background: white; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 12px 24px; color: #475569; font-weight: 600; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; gap: 10px;" onmouseover="this.style.borderColor='#3b82f6'; this.style.color='#3b82f6'; this.style.background='#eff6ff'; this.querySelector('i').style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='#cbd5e1'; this.style.color='#475569'; this.style.background='white'; this.querySelector('i').style.transform='translateY(0)';">
            <i class="fas fa-cloud-upload-alt" style="font-size: 1.2rem; transition: transform 0.2s ease;"></i>
            <span>Subir archivo o arrastrar aquí</span>
        </div>
    </div>
    
</div>"""

for path in target_files:
    if not os.path.exists(path):
        continue
        
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # We want to replace everything from <section class="autoconsulta-section"> or <div class="autoconsulta-unified-card">
    # down to just before <div class="autoconsulta-progress-area" or <div id="autoconsultaProgress"
    
    # Try Covid, Influenza, VRS, VPH pattern
    # Find the start
    start_idx = content.find('<div class="autoconsulta-unified-card">')
    if start_idx == -1:
        # Fallback to older Covid header style
        start_idx = content.find('<div class="autoconsulta-header">')
        if start_idx != -1:
            # We want to replace from here
            pass
        else:
            print(f"Start not found in {path}")
            continue
            
    # Find the end (start of progress area)
    end_idx = content.find('<div class="autoconsulta-progress-area"', start_idx)
    if end_idx == -1:
        end_idx = content.find('<div id="autoconsultaProgress"', start_idx)
        
    if end_idx != -1:
        new_content = content[:start_idx] + compact_html + "\n" + content[end_idx:]
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Successfully patched {path}")
    else:
        print(f"End pattern not found in {path}")

