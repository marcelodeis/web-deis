import os
import glob
import re

new_icon = """<div class="autoconsulta-drop-icon" style="height: 120px; display: flex; align-items: center; justify-content: center; margin-bottom: 15px;">
                            <svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" style="overflow: visible;">
                                <defs>
                                    <filter id="anim-shadow" x="-20%" y="-20%" width="140%" height="140%">
                                        <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000" flood-opacity="0.08" />
                                    </filter>
                                </defs>
                                <style>
                                    .doc-in { animation: docInFlow 4s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
                                    .sys-screen { animation: sysPulse 4s ease-in-out infinite; }
                                    .sys-spinner { animation: sysSpin 4s linear infinite; transform-origin: 60px 60px; }
                                    .doc-out { animation: docOutFlow 4s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
                                    
                                    @keyframes docInFlow {
                                        0% { transform: translate(-30px, 15px) scale(0.8) rotate(-10deg); opacity: 0; }
                                        15% { transform: translate(-10px, 0px) scale(1) rotate(0deg); opacity: 1; }
                                        25% { transform: translate(5px, 10px) scale(0.5); opacity: 0; }
                                        100% { transform: translate(5px, 10px) scale(0.5); opacity: 0; }
                                    }
                                    
                                    @keyframes sysPulse {
                                        0%, 20% { fill: #f1f5f9; }
                                        25%, 50% { fill: #e0f2fe; }
                                        55%, 100% { fill: #f1f5f9; }
                                    }
                                    
                                    @keyframes sysSpin {
                                        0%, 20% { opacity: 0; transform: rotate(0deg) scale(0.5); }
                                        25% { opacity: 1; transform: rotate(90deg) scale(1); stroke: #0ea5e9; }
                                        45% { opacity: 1; transform: rotate(360deg) scale(1); stroke: #0284c7; }
                                        50%, 100% { opacity: 0; transform: rotate(450deg) scale(0.5); }
                                    }
                                    
                                    @keyframes docOutFlow {
                                        0%, 45% { transform: translate(5px, 10px) scale(0.5); opacity: 0; }
                                        55% { transform: translate(15px, -15px) scale(1) rotate(5deg); opacity: 1; }
                                        75% { transform: translate(25px, -20px) scale(1) rotate(10deg); opacity: 1; }
                                        90%, 100% { transform: translate(40px, -10px) scale(0.8) rotate(15deg); opacity: 0; }
                                    }
                                </style>
                                <g class="doc-in">
                                    <rect x="25" y="45" width="28" height="38" rx="4" fill="#0f69b4" filter="url(#anim-shadow)" />
                                    <path d="M 32 55 L 46 55 M 32 63 L 46 63 M 32 71 L 40 71" stroke="#ffffff" stroke-width="2" stroke-linecap="round" />
                                    <rect x="33" y="42" width="12" height="12" rx="2" fill="#38bdf8" opacity="0.9" />
                                    <text x="35" y="51" fill="#ffffff" font-size="8" font-family="sans-serif" font-weight="bold">X</text>
                                </g>
                                <g class="doc-out">
                                    <rect x="55" y="25" width="34" height="46" rx="4" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" filter="url(#anim-shadow)" />
                                    <path d="M 64 42 L 69 47 L 79 36" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                                    <rect x="63" y="54" width="4" height="8" rx="1" fill="#cbd5e1" />
                                    <rect x="69" y="50" width="4" height="12" rx="1" fill="#94a3b8" />
                                    <rect x="75" y="44" width="4" height="18" rx="1" fill="#0f69b4" />
                                </g>
                                <g>
                                    <rect x="40" y="45" width="40" height="30" rx="3" fill="#ffffff" stroke="#94a3b8" stroke-width="2" filter="url(#anim-shadow)" />
                                    <path d="M 50 75 L 70 75 L 75 82 L 45 82 Z" fill="#94a3b8" />
                                    <rect x="43" y="48" width="34" height="24" rx="1" class="sys-screen" />
                                    <circle cx="60" cy="60" r="6" fill="none" stroke="#0ea5e9" stroke-width="2" stroke-dasharray="10 6" stroke-linecap="round" class="sys-spinner" />
                                </g>
                            </svg>
                        </div>"""

pattern = re.compile(r'<div class="autoconsulta-drop-icon"[^>]*>\s*<i class="fas fa-cloud-upload-alt"></i>\s*</div>')

count = 0
for root, dirs, files in os.walk('.'):
    for name in files:
        if name == 'index.html':
            filepath = os.path.join(root, name)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = pattern.sub(new_icon, content)
            
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                count += 1
                print(f'Updated {filepath}')
print(f'Total files updated: {count}')
