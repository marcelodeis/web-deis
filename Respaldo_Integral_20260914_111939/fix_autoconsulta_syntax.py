import os
import re

files = [
    r'C:\Antigravity IDE\WEB DEIS\Influenza_Web\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\Covid_Web\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\VRS\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\VPH_Web\autoconsulta.js'
]

correct_html = r'''
        // Generar HTML del Mini-Informe Estadístico
        let statsHTML = '';
        if (r.statsComunas && Object.keys(r.statsComunas).length > 0) {
            statsHTML += `
                <div class="autoconsulta-mini-informe">
                    <h4 class="autoconsulta-info-title" style="margin-top: 1.5rem; border-top: 1px solid rgba(0,0,0,0.1); padding-top: 1.5rem;">
                        <i class="fas fa-chart-bar"></i> Resumen por Establecimiento (Provincia de Osorno)
                    </h4>
                    <div class="autoconsulta-stats-grid">
            `;
            
            for (const [comuna, centros] of Object.entries(r.statsComunas).sort()) {
                statsHTML += `
                    <div class="autoconsulta-comuna-card">
                        <div class="autoconsulta-comuna-header">
                            <i class="fas fa-map-marker-alt"></i> ${comuna}
                        </div>
                        <div class="autoconsulta-centro-list">
                `;
                
                // Ordenar centros por nombre
                const sortedCentros = Object.entries(centros).sort();
                for (const [centro, stats] of sortedCentros) {
                    const total = stats.si + stats.no;
                    const pctSi = total > 0 ? Math.round((stats.si / total) * 100) : 0;
                    
                    statsHTML += `
                            <div class="autoconsulta-centro-item">
                                <div class="autoconsulta-centro-name" title="${centro}">${centro}</div>
                                <div class="autoconsulta-centro-stats">
                                    <div class="autoconsulta-centro-bar-container">
                                        <div class="autoconsulta-centro-bar-si" style="width: ${pctSi}%"></div>
                                    </div>
                                    <div class="autoconsulta-centro-numbers">
                                        <span class="text-si"><i class="fas fa-check"></i> ${stats.si}</span>
                                        <span class="text-no"><i class="fas fa-times"></i> ${stats.no}</span>
                                    </div>
                                </div>
                            </div>
                    `;
                }
                
                statsHTML += `
                        </div>
                    </div>
                `;
            }
            
            statsHTML += `
                    </div>
                </div>
            `;
        }
'''

def fix_file(path):
    if not os.path.exists(path): return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # The broken block starts at "// Generar HTML del Mini-Informe Estadístico" 
    # and ends at the last "}" before "downloadResult()" or EOF if it's the end of showResults.
    # Actually, we can just replace everything from "// Generar HTML del Mini-Informe" 
    # down to the end of the showResults block.
    # We will use regex to find the broken block.
    
    # Let's find:
    pattern = r'// Generar HTML del Mini-Informe Estadístico.*?let statsHTML = \'\';.*?if \(r\.statsComunas.*?\}\s*(?=downloadResult|/\*\*)'
    # Wait, the end of `showResults` might just have `}` for the function.
    
    # Instead, we will replace the whole block more precisely:
    pattern_precise = r'// Generar HTML del Mini-Informe Estadístico.*?let statsHTML = \'\';.*?if \(r\.statsComunas.*?\}\s*// Generar HTML del Mini-Informe Estadístico.*?let statsHTML = \'\';'
    
    # Actually I noticed it had "// Generar HTML del Mini-Informe Estadístico" TWICE!
    # Let's just find `// Generar HTML del Mini-Informe Estadístico` up to `// 6. Optimize downloadResult()` (not there)
    # Let's just replace from `// Generar HTML del Mini-Informe Estadístico` to the end of the `showResults()` function.
    
    match = re.search(r'(// Generar HTML del Mini-Informe Estadístico.*?\})\s*\}', content, flags=re.DOTALL)
    if match:
        # Check if it has multiple `statsHTML`
        block = match.group(1)
        # We replace the entire block with our correct_html
        content = content.replace(block, correct_html.strip() + "\n")
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {path}")
    else:
        # Try a more forgiving match
        match2 = re.search(r'// Generar HTML del Mini-Informe Estadístico.*?(?=\n\s*\})', content, flags=re.DOTALL)
        if match2:
            content = content.replace(match2.group(0), correct_html.strip())
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Fixed (fallback) {path}")
        else:
            print(f"Could not find block in {path}")

for f in files:
    fix_file(f)
