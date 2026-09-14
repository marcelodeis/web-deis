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

    # Re-insert backticks
    # Find statsHTML += \n <div class="autoconsulta-mini-informe">
    content = content.replace("statsHTML +=\n                <div", "statsHTML += `\n                <div")
    content = content.replace("                </div>\n            ;\n            \n            for (const", "                </div>\n            `;\n            \n            for (const")
    
    content = content.replace("statsHTML +=\n                    <div class=\"autoconsulta-comuna-card\">", "statsHTML += `\n                    <div class=\"autoconsulta-comuna-card\">")
    content = content.replace("                        <div class=\"autoconsulta-centro-list\">\n                ;\n", "                        <div class=\"autoconsulta-centro-list\">\n                `;\n")

    content = content.replace("statsHTML +=\n                            <div class=\"autoconsulta-centro-item\">", "statsHTML += `\n                            <div class=\"autoconsulta-centro-item\">")
    content = content.replace("                                </div>\n                            </div>\n                    ;\n                }", "                                </div>\n                            </div>\n                    `;\n                }")

    content = content.replace("statsHTML +=\n                        </div>\n                    </div>\n                ;\n            }", "statsHTML += `\n                        </div>\n                    </div>\n                `;\n            }")

    content = content.replace("statsHTML +=\n                    </div>\n                </div>\n            ;\n        }", "statsHTML += `\n                    </div>\n                </div>\n            `;\n        }")

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
        
for f in files:
    fix_file(f)
