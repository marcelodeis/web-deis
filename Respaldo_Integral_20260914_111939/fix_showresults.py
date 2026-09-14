import os

files = ['Influenza_Web/autoconsulta.js', 'Covid_Web/autoconsulta.js', 'VRS/autoconsulta.js', 'VPH_Web/autoconsulta.js']

for f in files:
    path = os.path.join(r"C:\Antigravity IDE\WEB DEIS", f)
    if not os.path.exists(path): continue
    with open(path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    inject_code = '''
        resultsArea.innerHTML = `
            <div class="autoconsulta-meta" style="display: flex; gap: 15px; margin-bottom: 20px; background: rgba(255,255,255,0.7); padding: 15px; border-radius: 8px;">
                <span><i class="fas fa-check-circle" style="color: #10b981;"></i> Encontrados: <strong>${r.siCount}</strong></span>
                <span><i class="fas fa-times-circle" style="color: #ef4444;"></i> No encontrados: <strong>${r.noCount}</strong></span>
                <span><i class="fas fa-exclamation-triangle" style="color: #f59e0b;"></i> Vacíos/Error: <strong>${r.vaciosCount}</strong></span>
                <span><i class="fas fa-columns" style="color: #3b82f6;"></i> Columna detectada: <strong>"${r.columnaDetectada}"</strong></span>
            </div>
            
            <div class="autoconsulta-charts-container" style="display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 20px;">
                <div class="autoconsulta-chart-card" style="flex: 1; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); text-align: center;">
                    <h4 style="margin-bottom: 15px; color: #475569;">Distribución General</h4>
                    <div style="position: relative; width: 160px; height: 160px; margin: 0 auto; border-radius: 50%; background: conic-gradient(#10b981 ${pctSi}%, #ef4444 ${pctSi}% 100%); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                        <div style="width: 120px; height: 120px; background: white; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                            <span style="font-size: 24px; font-weight: bold; color: #1e293b;">${pctSi}%</span>
                            <span style="font-size: 12px; color: #64748b;">Vacunados</span>
                        </div>
                    </div>
                </div>
            </div>

            ${statsHTML}
        `;
        resultsArea.style.display = 'block';
    },'''
    
    if "resultsArea.innerHTML = `" not in content:
        import re
        content = re.sub(r'statsHTML \+= `\s*</div>\s*</div>\s*`;\s*\}\s*\},', r'statsHTML += `\n                    </div>\n                </div>\n            `;\n        }\n' + inject_code, content)
        with open(path, 'w', encoding='utf-8') as file:
            file.write(content)
        print(f"Fixed {f}")
    else:
        print(f"resultsArea.innerHTML already exists in {f}")

