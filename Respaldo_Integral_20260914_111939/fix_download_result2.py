import os
import re

files = [
    r'C:\Antigravity IDE\WEB DEIS\Influenza_Web\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\Covid_Web\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\VRS\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\VPH_Web\autoconsulta.js'
]

def fix_download_result(path):
    if not os.path.exists(path): return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    match = re.search(r'(downloadResult\(\)\s*\{.*?)(?=\n\s*/\*\*\s*\n\s*\*\s*Reinicia el módulo)', content, flags=re.DOTALL)
    
    if match:
        vaccine = "INFLUENZA"
        if "Covid" in path: vaccine = "COVID"
        elif "VRS" in path: vaccine = "VRS"
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
    }},'''
        content = content.replace(match.group(1), correct_code)
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {path}")
    else:
        print(f"Could not find downloadResult block in {path}")

for f in files:
    fix_download_result(f)
