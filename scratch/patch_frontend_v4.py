import os
import re

html_path = r"c:\Antigravity IDE\WEB DEIS\Programáticas_Web\index.html"
js_path = r"c:\Antigravity IDE\WEB DEIS\Programáticas_Web\app_v9.js"

with open(html_path, 'r', encoding='utf-8') as f:
    html_content = f.read()

# Construir el HTML de una tarjeta moderna
def build_card(id_prefix, title, is_hexa=False):
    icon = "fa-shield-virus" if "HEXA" in title.upper() or "NEUMO" in title.upper() or "MENIN" in title.upper() else "fa-syringe"
    color = "#f59e0b" if "HEXA" in title.upper() or "NEUMO" in title.upper() or "MENIN" in title.upper() else "#8b5cf6"
    
    return f"""
        <div class="reporte-card premium-card" id="card-{id_prefix}" style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); transition: transform 0.2s, box-shadow 0.2s;">
            <div style="background: #f8fafc; padding: 15px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <h4 style="margin: 0; color: #1e293b; font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                    <i class="fas {icon}" style="color: {color};"></i> {title}
                </h4>
            </div>
            
            <div style="padding: 25px 20px; text-align: center; flex-grow: 1; display: flex; flex-direction: column; justify-content: center; background: linear-gradient(to bottom, #ffffff, #f8fafc);">
                <div style="color: #64748b; font-size: 0.9rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">RESCATE ACTIVO</div>
                <div class="rescate-value" id="val-{id_prefix}-rescate" style="color: #ef4444; font-weight: 900; font-size: 3.5rem; line-height: 1; margin-bottom: 10px; text-shadow: 0 2px 4px rgba(239,68,68,0.1);">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem;"></i>
                </div>
                
                <div style="margin-top: 15px; border-top: 1px dashed #cbd5e1; padding-top: 15px;">
                    <button class="btn-detalles" onclick="toggleDetalles('{id_prefix}')" style="background: transparent; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 12px; color: #475569; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                        <i class="fas fa-chevron-down"></i> Ver Contexto
                    </button>
                </div>
                
                <div id="detalles-{id_prefix}" class="detalles-container" style="display: none; margin-top: 15px; text-align: left; background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 0.85rem;">
                    <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f1f5f9;">
                        <span style="color: #64748b;">Universo Evaluable:</span>
                        <span id="val-{id_prefix}-universo" style="font-weight: 700; color: #1e293b;">-</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f1f5f9;">
                        <span style="color: #64748b;">Esquema al Da:</span>
                        <span id="val-{id_prefix}-aldia" style="font-weight: 700; color: #10b981;">-</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f1f5f9;">
                        <span style="color: #64748b;">An no corresponde:</span>
                        <span id="val-{id_prefix}-aunno" style="font-weight: 700; color: #f59e0b;">-</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f1f5f9;">
                        <span style="color: #64748b;">Fallecidos excluidos:</span>
                        <span id="val-{id_prefix}-fallecidos" style="font-weight: 700; color: #94a3b8;">-</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f1f5f9;">
                        <span style="color: #64748b;">Fuera de Cohorte/Edad:</span>
                        <span id="val-{id_prefix}-fuera" style="font-weight: 700; color: #94a3b8;">-</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 4px 0;">
                        <span style="color: #64748b;">Error de Secuencia:</span>
                        <span id="val-{id_prefix}-error" style="font-weight: 700; color: #f43f5e;">-</span>
                    </div>
                </div>
            </div>
        </div>
"""

# Reemplazar Bloque Primario
nuevo_primario = f"""
                  <section id="bloque-primario" style="background: #f8fafc; border-radius: 12px; padding: 30px; margin-bottom: 40px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border-top: 4px solid #f59e0b; position: relative;">
                      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 25px; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px;">
                          <div style="display: flex; align-items: center; gap: 15px;">
                              <div style="background: #fffbeb; color: #f59e0b; width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                                  <i class="fas fa-shield-virus"></i>
                              </div>
                              <div>
                                  <h3 style="margin: 0; color: #0f172a; font-size: 1.4rem;">Seguimiento del Esquema Primario</h3>
                                  <p style="margin: 4px 0 0 0; color: #475569; font-size: 0.95rem;">Identificacin de menores sin registro de dosis correspondientes al esquema infantil.</p>
                              </div>
                          </div>
                      </div>
                      
                      <!-- Controles de Rescate -->
                      <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px 20px; margin-bottom: 25px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px;">
                          <div style="display: flex; align-items: center; gap: 15px;">
                              <span style="font-weight: 600; color: #1e293b;"><i class="fas fa-filter" style="color: #3b82f6;"></i> Filtro Territorial SSO:</span>
                              <div class="territory-toggle" style="background: #f1f5f9; padding: 4px; border-radius: 8px; display: flex;">
                                  <button id="btn-residencia" class="territory-btn active" onclick="setTerritoryFilter('residencia')" style="padding: 6px 16px; border: none; background: white; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); font-weight: 600; color: #0f172a; cursor: pointer; transition: all 0.2s;">Residencia SSO</button>
                                  <button id="btn-ocurrencia" class="territory-btn" onclick="setTerritoryFilter('ocurrencia')" style="padding: 6px 16px; border: none; background: transparent; font-weight: 600; color: #64748b; cursor: pointer; transition: all 0.2s;">Ocurrencia SSO</button>
                              </div>
                          </div>
                          
                          <div style="font-size: 0.85rem; color: #64748b; display: flex; gap: 15px;">
                              <span id="header-fuente"><i class="fas fa-server"></i> Fuente: Servidor DEIS-MINSAL</span>
                              <span id="header-base"><i class="fas fa-database"></i> Base Procesada: Cargando...</span>
                              <span id="header-corte"><i class="fas fa-calendar-check"></i> Datos vlidos hasta: Cargando...</span>
                          </div>
                      </div>

                      <div class="reportes-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                          {build_card('hexa2', 'HEXAVALENTE - 2. DOSIS')}
                          {build_card('neumo2', 'NEUMOCCICA CONJUGADA - 2. DOSIS')}
                          {build_card('menb2', 'MENINGOCCICA B - 2. DOSIS')}
                          {build_card('hexa3', 'HEXAVALENTE - 3. DOSIS')}
                      </div>
                  </section>
"""

nuevo_segundas = f"""
                  <section id="bloque-segundas" style="background: #f8fafc; border-radius: 12px; padding: 30px; margin-bottom: 40px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border-top: 4px solid #8b5cf6; position: relative;">
                      <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 25px; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px;">
                          <div style="background: #f5f3ff; color: #8b5cf6; width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                              <i class="fas fa-syringe"></i>
                          </div>
                          <div style="flex-grow: 1;">
                              <h3 style="margin: 0; color: #0f172a; font-size: 1.4rem;">Seguimiento de Segundas Dosis</h3>
                              <p style="margin: 4px 0 0 0; color: #475569; font-size: 0.95rem;">Identificacin de menores sin registro para cierre de esquemas bi-dosis.</p>
                          </div>
                      </div>
  
                      <div class="reportes-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                          {build_card('srp2', 'SRP - 2. DOSIS')}
                          {build_card('vari2', 'VARICELA - 2. DOSIS')}
                      </div>
                  </section>
"""

# HTML replace logic (regex to replace from section id to next section)
pattern_primario = r'<section id="bloque-primario".*?</section>\s*(?=<!-- BLOQUE 4: SEGUNDAS DOSIS -->)'
html_content = re.sub(pattern_primario, nuevo_primario + "\n", html_content, flags=re.DOTALL)

pattern_segundas = r'<section id="bloque-segundas".*?</section>\s*(?=<!-- BLOQUE 5: METODOLOGA Y FUENTES -->)'
html_content = re.sub(pattern_segundas, nuevo_segundas + "\n", html_content, flags=re.DOTALL)

# Tambien agregar script UI helper
html_content = html_content.replace('</body>', """
    <script>
        function toggleDetalles(id) {
            const el = document.getElementById('detalles-' + id);
            if(el.style.display === 'none') {
                el.style.display = 'block';
            } else {
                el.style.display = 'none';
            }
        }
    </script>
</body>
""")

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html_content)


# --- ACTUALIZAR APP_V9.JS ---
with open(js_path, 'r', encoding='utf-8') as f:
    js_content = f.read()

# I will inject the JSON fetching logic at the bottom of the ready function or at global level
fetch_logic = """
// --- LOGICA DE RESCATES JSON V4 ---
let rescatesData = null;
let currentTerritory = 'residencia'; // 'residencia' o 'ocurrencia'

$(document).ready(function() {
    loadRescatesJSON();
});

function loadRescatesJSON() {
    // Evitar cache appending version
    fetch('programaticas_rescates.json?v=' + new Date().getTime())
        .then(response => response.json())
        .then(data => {
            rescatesData = data;
            
            // Actualizar Cabeceras
            $('#header-base').html(`<i class="fas fa-database"></i> Base Procesada: ${data.base_procesada}`);
            $('#header-corte').html(`<i class="fas fa-calendar-check"></i> Datos vlidos hasta: ${data.fecha_corte_evaluacion}`);
            
            renderRescates();
        })
        .catch(err => {
            console.error("Error cargando JSON de rescates:", err);
        });
}

window.setTerritoryFilter = function(territory) {
    currentTerritory = territory;
    
    // UI Update buttons
    $('#btn-residencia').css({'background': 'transparent', 'box-shadow': 'none', 'color': '#64748b'});
    $('#btn-ocurrencia').css({'background': 'transparent', 'box-shadow': 'none', 'color': '#64748b'});
    
    $(`#btn-${territory}`).css({'background': 'white', 'box-shadow': '0 1px 3px rgba(0,0,0,0.1)', 'color': '#0f172a'});
    
    renderRescates();
}

const mapIds = {
    'hexa2': 'Hexavalente 2.',
    'hexa3': 'Hexavalente 3.',
    'neumo2': 'Neumoccica 2.',
    'menb2': 'Meningoccica B 2.',
    'srp2': 'SRP 2.',
    'vari2': 'Varicela 2.'
};

function formatNum(num) {
    return num.toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, ".");
}

function renderRescates() {
    if(!rescatesData) return;
    
    const d = currentTerritory === 'residencia' ? rescatesData.residencia : rescatesData.ocurrencia;
    
    for(const [prefix, jsonName] of Object.entries(mapIds)) {
        if(d[jsonName]) {
            const m = d[jsonName];
            $(`#val-${prefix}-rescate`).html(formatNum(m.RESCATE_ACTIVO));
            $(`#val-${prefix}-universo`).text(formatNum(m.UNIVERSO_EVALUABLE));
            $(`#val-${prefix}-aldia`).text(formatNum(m.ESQUEMA_AL_DIA));
            $(`#val-${prefix}-aunno`).text(formatNum(m.AUN_NO_CORRESPONDE));
            $(`#val-${prefix}-fallecidos`).text(formatNum(m.FALLECIDOS));
            $(`#val-${prefix}-error`).text(formatNum(m.ERROR_SECUENCIA));
            $(`#val-${prefix}-fuera`).text(formatNum(m.FUERA_COHORTE_EDAD));
        }
    }
}
// -----------------------------------
"""

if "// --- LOGICA DE RESCATES JSON V4 ---" not in js_content:
    with open(js_path, 'a', encoding='utf-8') as f:
        f.write("\n\n" + fetch_logic)
        
print("Patch aplicado exitosamente.")
