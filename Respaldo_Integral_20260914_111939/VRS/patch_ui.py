import os

TARGET = r"C:\Antigravity IDE\WEB DEIS\VRS\script.js"

with open(TARGET, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the statusTxt block
old_status_txt = "let statusTxt = coverage >= 80 ? 'Inmunidad de Rebaño Alcanzada' : (coverage >= 70 ? 'Precaución - Riesgo Moderado' : 'Alerta Roja - Vulnerabilidad Extrema');"
new_status_txt = "let statusTxt = coverage >= 80 ? 'Avance Programático Óptimo' : (coverage >= 70 ? 'Avance Programático Moderado' : 'Falta de Avance Programático');"
content = content.replace(old_status_txt, new_status_txt)

# Find and replace the dynamicCoberturaText logic
old_block = r"""              dynamicCoberturaText = `<div style="background: ${colorCls}15; border-left: 4px solid ${colorCls}; padding: 14px; border-radius: 8px; margin-top: 15px;">
                  <strong style="color: ${colorCls}; font-size: 1.05rem;"><i class="fas fa-shield-virus" style="margin-right:8px;"></i>${statusTxt} (${coverage.toFixed(1).replace('.', ',')}%)</strong>
                  <p style="margin: 8px 0 0 0; color: #475569;">Se registran <strong>${targetDosesSum.toLocaleString('es-CL')}</strong> dosis administradas en una población objetivo de <strong>${metaT.toLocaleString('es-CL')}</strong> recién nacidos y lactantes en ${locationContext}. ${missingDoses > 0 ? `Para alcanzar el umbral interno de semaforización del dashboard (80%) y reducir el riesgo de hospitalización, restan por inmunizar <strong>${missingDoses.toLocaleString('es-CL')} lactantes adicionales</strong>.` : `Se ha superado exitosamente el umbral interno de semaforización.`}</p>
              </div>`;"""

new_block = r"""              const brechaMetaTotal = metaT - targetDosesSum;
              let mensajeBrecha = "";
              if (brechaMetaTotal > 0) {
                  mensajeBrecha = `Brecha absoluta a la población estimada: <strong>${brechaMetaTotal.toLocaleString('es-CL')} administraciones</strong>.`;
              } else {
                  mensajeBrecha = `Brecha a la meta: <strong>0</strong>.<br><span style="color: #10b981;">Meta superada en <strong>${Math.abs(brechaMetaTotal).toLocaleString('es-CL')}</strong> administraciones respecto del denominador programático estimado.</span>`;
              }
              
              dynamicCoberturaText = `<div style="background: ${colorCls}15; border-left: 4px solid ${colorCls}; padding: 14px; border-radius: 8px; margin-top: 15px;">
                  <strong style="color: ${colorCls}; font-size: 1.05rem;"><i class="fas fa-chart-line" style="margin-right:8px;"></i>${statusTxt} (${coverage.toFixed(1).replace('.', ',')}%)</strong>
                  <p style="margin: 8px 0 0 0; color: #475569;">Se registran <strong>${targetDosesSum.toLocaleString('es-CL')}</strong> dosis administradas en una estimación poblacional de <strong>${metaT.toLocaleString('es-CL')}</strong> recién nacidos y lactantes en ${locationContext}.</p>
                  <p style="margin: 4px 0 0 0; color: #475569; font-size: 0.95em;">${mensajeBrecha}</p>
              </div>`;"""

content = content.replace(old_block, new_block)

with open(TARGET, 'w', encoding='utf-8') as f:
    f.write(content)

print("script.js patched for coverage block")
