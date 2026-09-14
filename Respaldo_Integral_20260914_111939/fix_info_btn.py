import os
import re

path = r"C:\Antigravity IDE\WEB DEIS\VRS\index.html"

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Using regex to find the block
old_block = r'''                <div style="margin-top: 15px;">
                    <span class="meta-badge">
                        <i class="fas fa-clock" style="color: #60a5fa;"></i> 
                        <span id="reportDate"></span>
                    </span>
                </div>
                <div style="margin-top: 10px; display: flex; gap: 10px;">
                    <button onclick="document.getElementById\('strategyContextModal'\)\.classList\.remove\('hidden'\)" class="btn-export" style="background: rgba\(255,255,255,0\.1\); border: 1px solid rgba\(255,255,255,0\.3\); color: white; padding: 8px 12px; border-radius: 8px;" title="Revisar evidencia y contexto clínico">
                        <i class="fas fa-book-medical"></i> Evidencia Epidemiológica
                    </button>
                    
                </div>'''

new_block = '''                <div style="margin-top: 15px; display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                    <span class="meta-badge">
                        <i class="fas fa-clock" style="color: #60a5fa;"></i> 
                        <span id="reportDate"></span>
                    </span>
                    <button onclick="document.getElementById('strategyContextModal').classList.remove('hidden')" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.9); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-size: 0.8rem; padding: 4px 12px; border-radius: 20px; transition: all 0.2s; font-weight: 500;" onmouseover="this.style.background='rgba(255,255,255,0.15)'; this.style.color='#fff';" onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.color='rgba(255,255,255,0.9)';" title="Revisar evidencia y contexto clínico">
                        <i class="fas fa-book-medical" style="color: #60a5fa;"></i> Información y Evidencia
                    </button>
                </div>'''

content = re.sub(old_block, new_block, content, flags=re.DOTALL)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed the info button successfully.")
