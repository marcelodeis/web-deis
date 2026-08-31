import os, re

files = {
    "Covid": r"c:\Antigravity IDE\WEB DEIS\Covid_Web\autoconsulta.js",
    "VRS":   r"c:\Antigravity IDE\WEB DEIS\VRS\autoconsulta.js",
    "VPH":   r"c:\Antigravity IDE\WEB DEIS\VPH_Web\autoconsulta.js"
}

vaccines = {
    "Covid": "COVID",
    "VRS": "VRS",
    "VPH": "VPH"
}

for name, path in files.items():
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    pattern = r"    downloadResult\(\) \{.*?\n    \},"
    
    new_downloadResult = f'''    downloadResult() {{
        // Close dropdown
        const menu = document.getElementById('exportDropdownMenu');
        if (menu) menu.style.display = 'none';

        if (!this._state.processedWorkbook) {{
            alert('No hay datos procesados para descargar.');
            return;
        }}

        try {{
            const baseName = this._state.fileName.replace(/\.[^.]+$/, '');
            const outputName = `${{baseName}}_AUTOCONSULTA_{vaccines[name]}.xlsx`;

            XLSX.writeFile(this._state.processedWorkbook, outputName);

            if (typeof Toastify !== 'undefined') {{
                Toastify({{
                    text: '✅ Archivo Excel descargado exitosamente',
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
            alert("Hubo un error al generar el archivo Excel. Intente nuevamente.");
        }}
    }},'''

    content = re.sub(pattern, new_downloadResult, content, flags=re.DOTALL)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print(f"Fixed {name}")
