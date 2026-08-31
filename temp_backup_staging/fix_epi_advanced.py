import os
import re

files = ['Influenza_Web/autoconsulta.js', 'Covid_Web/autoconsulta.js', 'VRS/autoconsulta.js', 'VPH_Web/autoconsulta.js']

for f in files:
    path = os.path.join(r"C:\Antigravity IDE\WEB DEIS", f)
    if not os.path.exists(path): continue
    with open(path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # We want to replace the `const epiSummary = ` block
    # from:
    # const epiSummary = `
    #     <div class="autoconsulta-epi-summary"...
    # ...
    #     </div>
    # `;
    
    pattern = r'const epiSummary = `\s*<div class="autoconsulta-epi-summary".*?</div>\s*`;'
    
    replacement = '''// --- Lógica Avanzada de Síntesis Epidemiológica ---
        let bestComuna = { name: '', pct: -1, total: 0 };
        let worstComuna = { name: '', pct: 101, total: 0 };
        let worstCentro = { name: '', comuna: '', noCount: -1 };
        
        let totalComunas = 0;
        let totalCentros = 0;

        if (r.statsComunas) {
            for (const [comuna, centros] of Object.entries(r.statsComunas)) {
                totalComunas++;
                let cSi = 0;
                let cNo = 0;
                for (const [centro, stats] of Object.entries(centros)) {
                    totalCentros++;
                    cSi += stats.si;
                    cNo += stats.no;
                    if (stats.no > worstCentro.noCount) {
                        worstCentro = { name: centro, comuna: comuna, noCount: stats.no };
                    }
                }
                let cTotal = cSi + cNo;
                if (cTotal > 0) {
                    let cPct = (cSi / cTotal) * 100;
                    if (cPct > bestComuna.pct || (cPct === bestComuna.pct && cTotal > bestComuna.total)) {
                        bestComuna = { name: comuna, pct: cPct, total: cTotal };
                    }
                    if (cPct < worstComuna.pct || (cPct === worstComuna.pct && cTotal > worstComuna.total)) {
                        worstComuna = { name: comuna, pct: cPct, total: cTotal };
                    }
                }
            }
        }

        let epiText = `El cruce automatizado ha procesado exitosamente una cohorte de <strong>${(r.total || 0).toLocaleString('es-CL')}</strong> registros válidos`;
        if (totalComunas > 0) {
            epiText += `, distribuidos a lo largo de <strong>${totalComunas} comunas</strong> y <strong>${totalCentros} establecimientos</strong> de la red.`;
        } else {
            epiText += `.`;
        }
        
        epiText += ` A nivel general, se constata una cobertura del <strong>${pctSi}%</strong> (${(r.si || 0).toLocaleString('es-CL')} personas) con registro de inmunización vigente, contribuyendo efectivamente a la protección poblacional. Por otro lado, existe una brecha del <strong>${pctNo}%</strong> (${(r.no || 0).toLocaleString('es-CL')} personas) que figuran como <strong>susceptibles</strong> (sin registro o rezagados).`;

        if (totalComunas > 0 && bestComuna.name !== '') {
            epiText += `<br><br><strong style="color: #0284c7;"><i class="fas fa-map-marked-alt"></i> Análisis Territorial:</strong> `;
            if (bestComuna.name !== worstComuna.name) {
                epiText += `A nivel comunal, <strong>${bestComuna.name}</strong> destaca con el mejor desempeño relativo (<strong>${bestComuna.pct.toFixed(1)}%</strong> de inmunizados). En contraste, <strong>${worstComuna.name}</strong> exhibe la cobertura más baja (<strong>${worstComuna.pct.toFixed(1)}%</strong>). `;
            } else {
                epiText += `El análisis territorial abarca la comuna de <strong>${bestComuna.name}</strong> (<strong>${bestComuna.pct.toFixed(1)}%</strong>). `;
            }
            if (worstCentro.noCount > 0) {
                epiText += `A nivel de micro-red, el establecimiento <strong>${worstCentro.name}</strong> (${worstCentro.comuna}) concentra la mayor cantidad absoluta de población susceptible (<strong>${worstCentro.noCount.toLocaleString('es-CL')} personas rezagadas</strong>). `;
            }
            epiText += `Se recomienda a los equipos directivos focalizar estrategias de rescate activo, contactabilidad y barrido territorial priorizando los sectores con mayor brecha identificada.`;
        }

        const epiSummary = `
            <div class="autoconsulta-epi-summary" style="background: linear-gradient(145deg, #ffffff, #f8fafc); border: 1px solid #e2e8f0; border-left: 4px solid #0284c7; padding: 20px; border-radius: 12px; margin-bottom: 25px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                <h4 style="color: #0f172a; font-weight: 700; margin-bottom: 12px; font-size: 1.1rem; display: flex; align-items: center;">
                    <i class="fas fa-microscope" style="color: #0284c7; margin-right: 10px; font-size: 1.3rem;"></i> Síntesis Epidemiológica y Territorial
                </h4>
                <p style="color: #334155; font-size: 0.95rem; line-height: 1.6; margin: 0;">
                    ${epiText}
                </p>
            </div>
        `;'''
    
    if re.search(pattern, content, flags=re.DOTALL):
        content = re.sub(pattern, replacement, content, flags=re.DOTALL)
        with open(path, 'w', encoding='utf-8') as file:
            file.write(content)
        print(f"Enhanced epi summary in {f}")
    else:
        print(f"Could not find pattern in {f}")
