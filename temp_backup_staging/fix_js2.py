import os
import re

files = [
    r'C:\Antigravity IDE\WEB DEIS\Influenza_Web\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\Covid_Web\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\VRS\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\VPH_Web\autoconsulta.js'
]

def fix_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Re-insert backticks using regex
    content = re.sub(r'statsHTML \+=\s*\n\s*(<div class="autoconsulta-mini-informe")', r'statsHTML += \n                \1', content)
    content = re.sub(r'(<div class="autoconsulta-stats-grid">\s*)\n\s*;\s*', r'\1;\n            ', content)
    
    content = re.sub(r'statsHTML \+=\s*\n\s*(<div class="autoconsulta-comuna-card")', r'statsHTML += \n                    \1', content)
    content = re.sub(r'(<div class="autoconsulta-centro-list">\s*)\n\s*;\s*', r'\1;\n                ', content)

    content = re.sub(r'statsHTML \+=\s*\n\s*(<div class="autoconsulta-centro-item")', r'statsHTML += \n                            \1', content)
    content = re.sub(r'(<\/div>\s*<\/div>\s*)\n\s*;\s*\}', r'\1;\n                }', content)

    content = re.sub(r'statsHTML \+=\s*\n\s*(<\/div>\s*<\/div>)\s*\n\s*;\s*\}', r'statsHTML += \n                        \1\n                    ;\n            }', content)

    content = re.sub(r'statsHTML \+=\s*\n\s*(<\/div>\s*<\/div>)\s*\n\s*;\s*\}', r'statsHTML += \n                    \1\n                ;\n        }', content)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
        
for f in files:
    fix_file(f)
