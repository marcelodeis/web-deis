import os

files = [
    r'C:\Antigravity IDE\WEB DEIS\Influenza_Web\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\Covid_Web\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\VRS\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\VPH_Web\autoconsulta.js'
]

correct_html = '''
        // Generar HTML del Mini-Informe Estadístico
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
                
                // Ordenar centros por nombre
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

def fix_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    start_idx = content.find("// Generar HTML del Mini-Informe Estadístico")
    if start_idx != -1:
        end_idx = content.find("        const dropZone = document.getElementById('autoconsultaDropZone');")
        if end_idx != -1:
            new_content = content[:start_idx] + correct_html + content[end_idx:]
            with open(path, 'w', encoding='utf-8') as f:
                f.write(new_content)

for f in files:
    fix_file(f)
