import os

files = ['Influenza_Web/autoconsulta.js', 'Covid_Web/autoconsulta.js', 'VRS/autoconsulta.js', 'VPH_Web/autoconsulta.js']

for f in files:
    path = os.path.join(r"C:\Antigravity IDE\WEB DEIS", f)
    if not os.path.exists(path): continue
    with open(path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    replacement = '''            ${statsHTML}
            
            <div style="text-align: center; margin-top: 30px;">
                <button id="autoconsultaBtnDownload" class="autoconsulta-btn-download" onclick="Autoconsulta.downloadResult()" style="background: linear-gradient(135deg, #0ea5e9, #0284c7); color: white; border: none; padding: 12px 30px; border-radius: 8px; font-weight: 600; font-size: 1rem; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(14, 165, 233, 0.3);">
                    <i class="fas fa-file-excel"></i> Descargar Excel con Resultados
                </button>
            </div>
        `;
        resultsArea.style.display = 'block';'''
        
    old_str = "            ${statsHTML}\n        `;\n        resultsArea.style.display = 'block';"
    
    if old_str in content:
        content = content.replace(old_str, replacement)
        with open(path, 'w', encoding='utf-8') as file:
            file.write(content)
        print(f"Added download button to {f}")
    else:
        print(f"Target string not found in {f}")

