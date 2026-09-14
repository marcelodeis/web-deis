import os

file_path = r'C:\Antigravity IDE\WEB DEIS\Influenza_Web\rechazos.js'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the second occurrence of '// Initialize select options and event listener if not already done'
first_idx = -1
second_idx = -1

for i, line in enumerate(lines):
    if '// Initialize select options and event listener if not already done' in line:
        if first_idx == -1:
            first_idx = i
        else:
            second_idx = i
            break

if second_idx != -1:
    # Delete from second_idx to the end of the file
    lines = lines[:second_idx]
    
    # Append the correct end logic
    lines.append('''    html += `<div style="font-size: 0.7rem; color: #94a3b8; line-height: 1.4; text-align: center; background: rgba(241, 245, 249, 0.5); padding: 0.5rem; border-radius: 4px;">
                La comuna y el establecimiento corresponden al lugar donde fue registrado el rechazo (base de ocurrencia). Este análisis describe volumen de registros y no una tasa poblacional de rechazo.
             </div>`;

    if (estList.length > 3) {
        window.currentRechazosFullRanking = { list: estList, total: totalOcurrencia, scope: scopeLabel };
        const btnLabel = comuna === 'all' ? 'Ver toda la red' : 'Ver toda la Comuna';
        html += `<div style="margin-top: 1rem; text-align: center;">
                    <button onclick="abrirModalRankingRechazos()" class="btn-ranking-completo" style="background: transparent; border: 1px solid #94a3b8; color: #475569; padding: 6px 16px; border-radius: 6px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#f1f5f9'; this.style.borderColor='#64748b'; this.style.color='#1e293b';" onmouseout="this.style.background='transparent'; this.style.borderColor='#94a3b8'; this.style.color='#475569';">
                        <i class="fas fa-list-ul" style="margin-right: 6px;"></i> ${btnLabel}
                    </button>
                 </div>`;
    }

    content.innerHTML = html;
};

window.abrirModalRankingRechazos = function() {
    const data = window.currentRechazosFullRanking;
    if (!data) return;
    
    const modal = document.getElementById('rechazosFullRankingModal');
    const listContainer = document.getElementById('rechazosFullRankingList');
    const statsContainer = document.getElementById('rechazosFullRankingStats');
    
    if (!modal || !listContainer || !statsContainer) return;
    
    const titleEl = document.getElementById('rechazosFullRankingTitle');
    if (titleEl) titleEl.innerText = 'Detalle de Establecimientos · ' + data.scope;
    
    let accum = 0;
    let paretoCount = 0;
    const target = data.total * 0.8;
    
    for (let i = 0; i < data.list.length; i++) {
        accum += data.list[i].count;
        paretoCount++;
        if (accum >= target) break;
    }
    
    const paretoPct = ((paretoCount / data.list.length) * 100).toFixed(1).replace('.', ',');
    
    statsContainer.innerHTML = `
        <div style="display:flex; gap:12px; align-items:center;">
            <i class="fas fa-lightbulb" style="color: #3b82f6; font-size: 1.5rem;"></i>
            <div>
                <strong style="display:block; margin-bottom:4px; color: #1e293b;">Principio de Pareto (Concentración 80/20)</strong>
                El <b>${paretoPct}%</b> de los establecimientos (${paretoCount} de ${data.list.length}) concentra el ~80% de los rechazos registrados en ${data.scope.toLowerCase()}.
            </div>
        </div>
    `;
    
    let htmlList = '';
    data.list.forEach((d, i) => {
        const pct = ((d.count / data.total) * 100).toFixed(1).replace('.', ',');
        const isTop = i < paretoCount;
        const bg = isTop ? '#eff6ff' : '#ffffff';
        const border = isTop ? '1px solid #bfdbfe' : '1px solid #f1f5f9';
        
        htmlList += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem 1rem; background:${bg}; border-radius:6px; border:${border};">
                <div style="display:flex; align-items:center; gap: 10px;">
                    <div style="font-weight:700; color: #94a3b8; width: 20px; text-align:right;">${i+1}.</div>
                    <div style="font-weight:600; color:#334155; font-size:0.9rem;">${d.est}</div>
                </div>
                <div style="font-size:0.85rem; color:#475569; text-align:right;">
                    <span style="font-weight:700; color:#0f69b4;">${d.count.toLocaleString('es-CL')}</span> rechazos <span style="color:#cbd5e1; margin:0 4px;">|</span> ${pct}%
                </div>
            </div>
        `;
    });
    
    listContainer.innerHTML = htmlList;
    modal.classList.remove('hidden');
};

window.cerrarModalRankingRechazos = function() {
    const modal = document.getElementById('rechazosFullRankingModal');
    if (modal) modal.classList.add('hidden');
};
''')

    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Fixed.")
else:
    print("Second block not found")
