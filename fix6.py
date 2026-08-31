import os
import re

files = ['Covid_Web/autoconsulta.js', 'VRS/autoconsulta.js', 'VPH_Web/autoconsulta.js']

for f in files:
    path = os.path.join(r"C:\Antigravity IDE\WEB DEIS", f)
    if not os.path.exists(path): continue
    with open(path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    start_idx = content.find("downloadResult() {")
    
    match = re.search(r'\s*/\*\*[\s\S]*?Reinicia el m', content[start_idx:])
    
    if start_idx != -1 and match:
        end_idx = start_idx + match.start()
        
        vaccine = "COVID"
        if "VRS" in path: vaccine = "VRS"
        elif "VPH" in path: vaccine = "VPH"
        
        correct_code = f'''downloadResult() {{
        if (!this._state.processedWorkbook) return;

        const btn = document.getElementById('autoconsultaBtnDownload');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando Excel... espere';
        btn.disabled = true;
        btn.style.opacity = '0.8';

        // Usamos setTimeout para permitir que el DOM se actualice (muestre el spinner) 
        // antes de bloquear el thread principal con XLSX.writeFile
        setTimeout(() => {{
            try {{
                const baseName = this._state.fileName.replace(/\.[^.]+$/, '');
                const outputName = `${{baseName}}_AUTOCONSULTA_{vaccine}.xlsx`;

                XLSX.writeFile(this._state.processedWorkbook, outputName);

                // Toast de confirmación si Toastify está disponible
                if (typeof Toastify !== 'undefined') {{
                    Toastify({{
                        text: `✅ Archivo descargado`,
                        duration: 4000,
                        gravity: 'bottom',
                        position: 'right',
                        style: {{
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            borderRadius: '10px',
                            fontFamily: "'Inter', sans-serif",
                            fontWeight: '600',
                            boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)'
                        }}
                    }}).showToast();
                }}
            }} catch (err) {{
                console.error("Error descargando:", err);
                alert("Hubo un error al generar el Excel.");
            }} finally {{
                btn.innerHTML = originalText;
                btn.disabled = false;
                btn.style.opacity = '1';
            }}
        }}, 50);
    }},

'''
        content = content[:start_idx] + correct_code + content[end_idx:]
        with open(path, 'w', encoding='utf-8') as file:
            file.write(content)
        print(f"Fixed {f}")
    else:
        print(f"Indices not found in {f}")
