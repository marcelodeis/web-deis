import os, re

files_js = {
    "Influenza": r"c:\Antigravity IDE\WEB DEIS\Influenza_Web\autoconsulta.js",
    "Covid":     r"c:\Antigravity IDE\WEB DEIS\Covid_Web\autoconsulta.js",
    "VRS":       r"c:\Antigravity IDE\WEB DEIS\VRS\autoconsulta.js",
    "VPH":       r"c:\Antigravity IDE\WEB DEIS\VPH_Web\autoconsulta.js"
}

files_html = {
    "Influenza": r"c:\Antigravity IDE\WEB DEIS\Influenza_Web\index.html",
    "Covid":     r"c:\Antigravity IDE\WEB DEIS\Covid_Web\index.html",
    "VRS":       r"c:\Antigravity IDE\WEB DEIS\VRS\index.html",
    "VPH":       r"c:\Antigravity IDE\WEB DEIS\VPH_Web\index.html"
}

# 1. Update JS to remove dropdown and PDF button, keep only Excel
for vaccine, path in files_js.items():
    if not os.path.exists(path):
        continue
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # We replace the entire exportDropdownContainer block with a single button
    # The original container started with `<div style="position: relative; display: inline-block;" id="exportDropdownContainer">`
    # and ended before `</div>` of the flex container.
    
    pattern = r'<div style="position: relative; display: inline-block;" id="exportDropdownContainer">.*?</div>\s*</div>\s*</div>\s*`;'
    
    single_btn_html = '''<button id="autoconsultaBtnDownload" onclick="Autoconsulta.downloadResult()" style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 1rem; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 6px 20px rgba(16, 185, 129, 0.3); display: flex; align-items: center; gap: 10px;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 25px rgba(16, 185, 129, 0.4)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 6px 20px rgba(16, 185, 129, 0.3)';">
                        <i class="fas fa-file-excel" style="font-size: 1.1rem;"></i> Descargar Excel
                    </button>
                </div>
            </div>
        `;'''
        
    content = re.sub(pattern, single_btn_html, content, flags=re.DOTALL)
    
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
        
    print(f"Fixed {vaccine} JS (removed PDF)")

# 2. Update HTML to remove the top 'Informe PDF' button
for vaccine, path in files_html.items():
    if not os.path.exists(path):
        continue
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
        
    # The top PDF button looks like:
    # <button id="btnExportPdf" class="btn-export" ...>
    #     <i class="fas fa-file-pdf"></i> Informe PDF
    # </button>
    pattern = r'<button id="btnExportPdf"[^>]*>.*?<\/button>'
    content = re.sub(pattern, '', content, flags=re.DOTALL)
    
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
        
    print(f"Fixed {vaccine} HTML (removed top PDF button)")
