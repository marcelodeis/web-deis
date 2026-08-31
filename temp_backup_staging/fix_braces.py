import os
import re

files = ['Influenza_Web/autoconsulta.js', 'Covid_Web/autoconsulta.js', 'VRS/autoconsulta.js', 'VPH_Web/autoconsulta.js']

for f in files:
    path = os.path.join(r"C:\Antigravity IDE\WEB DEIS", f)
    if not os.path.exists(path): continue
    with open(path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # We want to remove the extra closing brace that was left behind
    # The erroneous block is:
    #                             statsComunas[valComuna][valCentro].causales[causalText]++;
    #                         }
    #                     }
    #                     }
    # 
    #                     // Escribir celda resultado
    
    pattern = r"statsComunas\[valComuna\]\[valCentro\]\.causales\[causalText\]\+\+;\s*\}\s*\}\s*\}"
    replacement = r"statsComunas[valComuna][valCentro].causales[causalText]++;\n                        }\n                    }"
    
    if re.search(pattern, content):
        content = re.sub(pattern, replacement, content)
        with open(path, 'w', encoding='utf-8') as file:
            file.write(content)
        print(f"Fixed extra brace in {f}")
    else:
        print(f"Pattern not found in {f}")

