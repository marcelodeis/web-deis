import os

files = [
    r'c:\Antigravity IDE\WEB DEIS\Influenza_Web\autoconsulta.js',
    r'c:\Antigravity IDE\WEB DEIS\Covid_Web\autoconsulta.js',
    r'c:\Antigravity IDE\WEB DEIS\VRS\autoconsulta.js',
    r'c:\Antigravity IDE\WEB DEIS\VPH_Web\autoconsulta.js'
]

old_epi_summary = """
        const epiSummary = `
            <div class="autoconsulta-epi-summary" style="background: linear-gradient(145deg, #ffffff, #f8fafc); border: 1px solid #e2e8f0; border-left: 4px solid #0284c7; padding: 20px; border-radius: 12px; margin-bottom: 25px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                <h4 style="color: #0f172a; font-weight: 700; margin-bottom: 12px; font-size: 1.1rem; display: flex; align-items: center;">
                    <i class="fas fa-microscope" style="color: #0284c7; margin-right: 10px; font-size: 1.3rem;"></i> Síntesis Epidemiológica y Territorial
                </h4>
                <p style="color: #334155; font-size: 0.95rem; line-height: 1.6; margin: 0;">
                    ${epiText}
                </p>
            </div>
        `;
"""

for fpath in files:
    if os.path.exists(fpath):
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Remove the exact block
        if old_epi_summary in content:
            new_content = content.replace(old_epi_summary, "")
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Fixed {fpath}")
        else:
            print(f"Could not find exact block in {fpath}")
