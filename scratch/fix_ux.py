import os

file_path = r'C:\Antigravity IDE\WEB DEIS\Influenza_Web\rechazos.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update the select change style
old_select_logic = "const comuna = select.value;"
new_select_logic = """const comuna = select.value;
    const badge = document.getElementById('rechazosOcurrenciaBadge');
    if (comuna === 'all') {
        select.style.backgroundColor = '#ffffff';
        select.style.borderColor = '#cbd5e1';
        select.style.fontWeight = 'normal';
        if (badge) badge.style.display = 'none';
    } else {
        select.style.backgroundColor = '#e0f2fe';
        select.style.borderColor = '#7dd3fc';
        select.style.fontWeight = '600';
        if (badge) badge.style.display = 'inline-block';
    }"""
content = content.replace(old_select_logic, new_select_logic)

# 2. Methodology note 
old_note = """La comuna y el establecimiento corresponden al lugar donde fue registrado el rechazo (base de ocurrencia). Este análisis describe volumen de registros y no una tasa poblacional de rechazo."""
new_note = """En Base Ocurrencia, la persona se cuenta en la comuna y establecimiento donde fue registrado el rechazo. Los valores muestran volumen de personas con rechazo y no una tasa poblacional."""
content = content.replace(old_note, new_note)

# 3. Top 3 Text (line 2848-ish)
old_top3_text = "personas con rechazo registradas por ocurrencia en ${scopeText}"
# Wait, it might just be "rechazos registrados por ocurrencia en ${scopeText}"
# Let's replace the whole line if needed, or just "rechazos registrados"
content = content.replace("rechazos registrados por ocurrencia en ${scopeText}", "personas con rechazo registradas por ocurrencia en ${scopeText}")

# 4. Button label
content = content.replace("const btnLabel = comuna === 'all' ? 'Ver toda la red' : 'Ver toda la Comuna';", "const btnLabel = 'Ver ranking completo';")

# 5. Modal Title
old_title = "if (titleEl) titleEl.innerText = 'Detalle de Establecimientos · ' + data.scope;"
new_title = "if (titleEl) titleEl.innerHTML = `Ranking de establecimientos &middot; ${data.scope}<div style=\"font-size:0.75rem; color:#64748b; font-weight:normal; margin-top:4px;\">${data.list.length} establecimientos &middot; ${data.total.toLocaleString('es-CL')} personas con rechazo</div>`;"
content = content.replace(old_title, new_title)

# 6. Pareto Text
old_pareto_html = """                <strong style="display:block; margin-bottom:4px; color: #1e293b;">Principio de Pareto (Concentración 80/20)</strong>
                El <b>${paretoPct}%</b> de los establecimientos (${paretoCount} de ${data.list.length}) concentra el ~80% de los rechazos registrados en ${data.scope.toLowerCase()}."""
new_pareto_html = """                <strong style="display:block; margin-bottom:4px; color: #1e293b;">Concentración acumulada</strong>
                <b>${paretoCount} de ${data.list.length} establecimientos</b> concentran el ${paretoPct}% de las personas con rechazo registradas por ocurrencia en ${data.scope.toLowerCase()}."""
content = content.replace(old_pareto_html, new_pareto_html)

# 7. Highlight legend and change 'rechazos' to 'personas'
# Old:
#     let htmlList = '';
#     data.list.forEach((d, i) => {
old_html_list_start = "let htmlList = '';"
new_html_list_start = """let htmlList = `
        <div style="font-size: 0.75rem; color: #0284c7; background: #eff6ff; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-bottom: 0.5rem; border: 1px solid #bfdbfe;">
            <i class="fas fa-info-circle"></i> Establecimientos que acumulan &ge;80% del total comunal
        </div>
    `;"""
content = content.replace(old_html_list_start, new_html_list_start)

# 8. Personas in modal list
old_rechazos_modal = "rechazos <span style=\"color:#cbd5e1; margin:0 4px;\">|</span> ${pct}%"
new_rechazos_modal = "personas <span style=\"color:#cbd5e1; margin:0 4px;\">|</span> ${pct}%"
content = content.replace(old_rechazos_modal, new_rechazos_modal)

# 9. Add Modal methodology note
old_modal_end = "listContainer.innerHTML = htmlList;"
new_modal_end = """htmlList += `
        <div style="font-size: 0.7rem; color: #94a3b8; text-align: center; margin-top: 1rem; padding-top: 0.5rem; border-top: 1px dashed #e2e8f0;">
            El porcentaje indica qué proporción del total comunal de personas con rechazo corresponde a cada establecimiento. No representa una tasa de rechazo del establecimiento.
        </div>
    `;
    listContainer.innerHTML = htmlList;"""
content = content.replace(old_modal_end, new_modal_end)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("UX fixes applied.")
