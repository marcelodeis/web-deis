import os

files = [
    r'C:\Antigravity IDE\WEB DEIS\Influenza_Web\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\Covid_Web\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\VRS\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\VPH_Web\autoconsulta.js'
]

for path in files:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # The file has multiple broken copies because of my python script appending?
    # Wait, the file is 1084 lines now, originally it was 624.
    # Ah! I replaced code using .replace and maybe there were multiple matches.
    # Let me just clear everything from // Generar HTML del Mini-Informe Estadístico
    # up to const resultsHTML = 
    
    start_tag = "// Generar HTML del Mini-Informe Estadístico"
    end_tag = "        const resultsHTML = "
    
    if start_tag in content and end_tag in content:
        start_idx = content.find(start_tag)
        end_idx = content.rfind(end_tag) # get the LAST occurrence if there are multiples
        
        correct_html = '''// Generar HTML del Mini-Informe Estadístico
        let statsHTML = '';
        if (r.statsComunas && Object.keys(r.statsComunas).length > 0) {
            statsHTML += 
                <div class="autoconsulta-mini-informe">
                    <h4 class="autoconsulta-info-title" style="margin-top: 1.5rem; border-top: 1px solid rgba(0,0,0,0.1); padding-top: 1.5rem;">
                        <i class="fas fa-chart-bar"></i> Resumen por Establecimiento (Provincia de Osorno)
                    </h4>
                    <div class="autoconsulta-stats-grid">
            ;
            
            for (const [comuna, centros] of Object.entries(r.statsComunas).sort()) {
                statsHTML += 
                    <div class="autoconsulta-comuna-card">
                        <div class="autoconsulta-comuna-header">
                            <i class="fas fa-map-marker-alt"></i> 
                        </div>
                        <div class="autoconsulta-centro-list">
                ;
                
                const sortedCentros = Object.entries(centros).sort();
                for (const [centro, stats] of sortedCentros) {
                    const total = stats.si + stats.no;
                    const pctSi = total > 0 ? Math.round((stats.si / total) * 100) : 0;
                    
                    statsHTML += 
                            <div class="autoconsulta-centro-item">
                                <div class="autoconsulta-centro-name" title=""></div>
                                <div class="autoconsulta-centro-stats">
                                    <div class="autoconsulta-centro-bar-container">
                                        <div class="autoconsulta-centro-bar-si" style="width: %"></div>
                                    </div>
                                    <div class="autoconsulta-centro-numbers">
                                        <span class="text-si"><i class="fas fa-check"></i> </span>
                                        <span class="text-no"><i class="fas fa-times"></i> </span>
                                    </div>
                                </div>
                            </div>
                    ;
                }
                
                statsHTML += 
                        </div>
                    </div>
                ;
            }
            
            statsHTML += 
                    </div>
                </div>
            ;
        }

'''
        
        content = content[:start_idx] + correct_html + content[end_idx:]
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
            print("Fixed", path)
