import os
import re

files = ['Influenza_Web/autoconsulta.js', 'Covid_Web/autoconsulta.js', 'VRS/autoconsulta.js', 'VPH_Web/autoconsulta.js']

for f in files:
    path = os.path.join(r"C:\Antigravity IDE\WEB DEIS", f)
    if not os.path.exists(path): continue
    with open(path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # We want to replace everything from "resultsArea.innerHTML = `" up to "resultsArea.style.display = 'block';\n    },"
    # Since we previously injected this exactly, we can use a regex.
    pattern = r'resultsArea\.innerHTML\s*=\s*`.*?resultsArea\.style\.display\s*=\s*\'block\';\s*\},'
    
    replacement = '''const epiSummary = `
            <div class="autoconsulta-epi-summary" style="background: linear-gradient(145deg, #ffffff, #f8fafc); border: 1px solid #e2e8f0; border-left: 4px solid #0284c7; padding: 20px; border-radius: 12px; margin-bottom: 25px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                <h4 style="color: #0f172a; font-weight: 700; margin-bottom: 12px; font-size: 1.1rem; display: flex; align-items: center;">
                    <i class="fas fa-microscope" style="color: #0284c7; margin-right: 10px; font-size: 1.3rem;"></i> Síntesis Epidemiológica Operativa
                </h4>
                <p style="color: #334155; font-size: 0.95rem; line-height: 1.6; margin: 0;">
                    El cruce automatizado ha procesado exitosamente una cohorte de <strong>${(r.total || 0).toLocaleString('es-CL')}</strong> registros válidos. 
                    Actualmente, se constata una cobertura del <strong>${pctSi}%</strong> (${(r.si || 0).toLocaleString('es-CL')} personas) con registro de inmunización vigente, contribuyendo efectivamente a la inmunidad y protección poblacional. 
                    Por otro lado, existe una brecha del <strong>${pctNo}%</strong> (${(r.no || 0).toLocaleString('es-CL')} personas) que figuran como <strong>susceptibles</strong> (sin registro o rezagados). 
                    Se recomienda a los equipos de salud territoriales focalizar estrategias de rescate activo, contactabilidad y barrido sobre el grupo susceptible para mitigar riesgos de brotes y cumplir las metas sanitarias.
                </p>
            </div>
        `;

        resultsArea.innerHTML = `
            ${epiSummary}
            
            <div class="autoconsulta-meta" style="display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 25px; background: rgba(255,255,255,0.7); padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <span style="flex: 1; min-width: 200px; padding: 10px; background: white; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: flex; align-items: center; justify-content: space-between;">
                    <span style="color: #64748b; font-size: 0.9rem;">Encontrados (Vacunados)</span>
                    <strong style="color: #10b981; font-size: 1.1rem;"><i class="fas fa-check-circle"></i> ${(r.si || 0).toLocaleString('es-CL')}</strong>
                </span>
                <span style="flex: 1; min-width: 200px; padding: 10px; background: white; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: flex; align-items: center; justify-content: space-between;">
                    <span style="color: #64748b; font-size: 0.9rem;">No Encontrados (Susceptibles)</span>
                    <strong style="color: #ef4444; font-size: 1.1rem;"><i class="fas fa-times-circle"></i> ${(r.no || 0).toLocaleString('es-CL')}</strong>
                </span>
                <span style="flex: 1; min-width: 200px; padding: 10px; background: white; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: flex; align-items: center; justify-content: space-between;">
                    <span style="color: #64748b; font-size: 0.9rem;">Celdas Vacías/Error</span>
                    <strong style="color: #f59e0b; font-size: 1.1rem;"><i class="fas fa-exclamation-triangle"></i> ${(r.vacios || 0).toLocaleString('es-CL')}</strong>
                </span>
                <span style="flex: 1; min-width: 200px; padding: 10px; background: white; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: flex; align-items: center; justify-content: space-between;">
                    <span style="color: #64748b; font-size: 0.9rem;">Columna RUN</span>
                    <strong style="color: #3b82f6; font-size: 1rem;"><i class="fas fa-columns"></i> "${r.columnaDetectada}"</strong>
                </span>
            </div>
            
            <div class="autoconsulta-charts-container" style="display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 25px;">
                <div class="autoconsulta-chart-card" style="flex: 1; background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); text-align: center; border: 1px solid #e2e8f0;">
                    <h4 style="margin-bottom: 20px; color: #334155; font-size: 1.05rem;">Distribución de la Cohorte Analizada</h4>
                    <div style="position: relative; width: 180px; height: 180px; margin: 0 auto; border-radius: 50%; background: conic-gradient(#10b981 ${pctSi}%, #ef4444 ${pctSi}% 100%); display: flex; align-items: center; justify-content: center; box-shadow: inset 0 0 0 10px rgba(255,255,255,0.2), 0 8px 20px rgba(0,0,0,0.1); transition: transform 0.3s ease;">
                        <div style="width: 130px; height: 130px; background: white; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: inset 0 2px 8px rgba(0,0,0,0.05);">
                            <span style="font-size: 28px; font-weight: 800; color: #0f172a; line-height: 1;">${pctSi}%</span>
                            <span style="font-size: 13px; color: #64748b; font-weight: 500; margin-top: 4px;">Inmunizados</span>
                        </div>
                    </div>
                </div>
            </div>

            ${statsHTML}
            
            <div style="display: flex; justify-content: center; gap: 20px; margin-top: 40px; margin-bottom: 20px; flex-wrap: wrap;">
                <button onclick="Autoconsulta.reset()" style="background: white; color: #475569; border: 1px solid #cbd5e1; padding: 14px 28px; border-radius: 10px; font-weight: 600; font-size: 1rem; cursor: pointer; transition: all 0.3s ease; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);" onmouseover="this.style.background='#f8fafc'; this.style.borderColor='#94a3b8'; this.style.transform='translateY(-2px)';" onmouseout="this.style.background='white'; this.style.borderColor='#cbd5e1'; this.style.transform='translateY(0)';">
                    <i class="fas fa-undo"></i> Nueva Consulta
                </button>
                <button id="autoconsultaBtnDownload" class="autoconsulta-btn-download" onclick="Autoconsulta.downloadResult()" style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 1rem; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 6px 20px rgba(16, 185, 129, 0.3); display: flex; align-items: center; gap: 10px;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 25px rgba(16, 185, 129, 0.4)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 6px 20px rgba(16, 185, 129, 0.3)';">
                    <i class="fas fa-file-excel" style="font-size: 1.2rem;"></i> Exportar Resultados
                </button>
            </div>
        `;
        resultsArea.style.display = 'block';
    },'''
    
    if re.search(pattern, content, flags=re.DOTALL):
        content = re.sub(pattern, replacement, content, flags=re.DOTALL)
        with open(path, 'w', encoding='utf-8') as file:
            file.write(content)
        print(f"Replaced successfully in {f}")
    else:
        print(f"Could not find pattern in {f}")
